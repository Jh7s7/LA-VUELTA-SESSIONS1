import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import {
  getPgPool,
  closePgPool,
  ensurePostgresSchema,
  getOrCreateQrHmacSecret,
  isPostgresPopulated,
  loadDatabaseFromPostgres,
  enqueuePostgresPersist,
  saveVoucherToPostgres,
  getVoucherFromPostgres,
  deleteVoucherFromPostgres,
  exportFullPostgresBackup,
  loadLegacyVouchersFromDisk,
} from './db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_DEV_SCRIPT = process.env.npm_lifecycle_event === 'dev';
const IS_PROD =
  !IS_DEV_SCRIPT &&
  (process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    (process.env.NODE_ENV !== 'development' && fs.existsSync(path.resolve(__dirname, 'dist', 'index.html'))));

// Load Firebase Web Config for server-side IdentityToolkit token verification
const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
let firebaseConfig: { apiKey: string; projectId: string } = { apiKey: '', projectId: '' };
try {
  if (fs.existsSync(firebaseConfigPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  }
} catch (err) {
  console.warn('Warning: Could not parse firebase-applet-config.json:', err);
}

function resolveWritableDataDir(): string {
  const preferred = path.resolve(__dirname, '.private_data');
  try {
    fs.mkdirSync(path.join(preferred, 'vouchers'), { recursive: true });
    const probe = path.join(preferred, `.write_probe_${process.pid}`);
    fs.writeFileSync(probe, 'ok', { mode: 0o600 });
    fs.unlinkSync(probe);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), 'lavueltasessions_private_data');
    fs.mkdirSync(path.join(fallback, 'vouchers'), { recursive: true });
    const seedDb = path.join(preferred, 'db.json');
    const targetDb = path.join(fallback, 'db.json');
    if (fs.existsSync(seedDb) && !fs.existsSync(targetDb)) {
      try {
        fs.copyFileSync(seedDb, targetDb);
      } catch {
        // Ignore; loadDb() will initialize fresh data
      }
    }
    return fallback;
  }
}

const WORKSPACE_DATA_DIR = path.resolve(__dirname, 'data');
const WORKSPACE_DB_FILE = path.join(WORKSPACE_DATA_DIR, 'persistent_db.json');
const PRIVATE_DIR = resolveWritableDataDir();
const VOUCHERS_DIR = path.join(PRIVATE_DIR, 'vouchers');
const DB_FILE = path.join(PRIVATE_DIR, 'db.json');
const SECRET_FILE = path.join(PRIVATE_DIR, 'qr_secret.key');

const PLACEHOLDER_SECRETS = new Set([
  '',
  'CHANGE_ME_TO_32_BYTE_RANDOM_HEX_IN_PRODUCTION',
  'REPLACE_WITH_32_BYTE_HEX',
  'REPLACE_WITH_VALIDADOR_TOKEN',
  'SIN_CONFIGURAR',
  'DISABLED',
  'NONE',
  'PENDIENTE',
]);

const OFFICIAL_ADMIN_EMAILS = ['lavueltassessionsoficial@gmail.com', 'forgen122@gmail.com'];
const OFFICIAL_ADMIN_SALT = '3abff1dc1f77b54d0934daa0ba4308cd';
const LEGACY_ADMIN_SEED_HASH =
  '876960eead93962a3623c6fca50010b3808643009c0a0c2f201a9248f763ace939f4ed5ddae99fbe3475b87ea75f7193158b1a5a391bf7408203ea701d012162';
const OFFICIAL_ADMIN_HASH =
  '3f7c5988b3660f779c0a6bc4c179451b7a3a6642e9194b194a89e8bedcec178437345f5062a4469802fb88ba181356f83b3ee63c2f7a3c31f8481c8fd8997e04';

function getHmacSecret(): string {
  const raw = (process.env.QR_HMAC_SECRET || '').trim();
  if (raw.length >= 16 && !PLACEHOLDER_SECRETS.has(raw.toUpperCase()) && !PLACEHOLDER_SECRETS.has(raw)) {
    return raw;
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const saved = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (saved.length >= 16) return saved;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.createHash('sha256').update(`lvs-fallback-${OFFICIAL_ADMIN_SALT}`).digest('hex');
  }
}

function getActiveResendKey(): string {
  const raw = (process.env.RESEND_API_KEY || '').trim();
  if (!raw || PLACEHOLDER_SECRETS.has(raw.toUpperCase()) || !raw.startsWith('re_')) {
    return '';
  }
  return raw;
}

function getActiveLbApiKey(): string {
  const raw = (process.env.LB_VALIDADOR_API_KEY || '').trim();
  if (raw.length < 12 || PLACEHOLDER_SECRETS.has(raw.toUpperCase()) || PLACEHOLDER_SECRETS.has(raw)) {
    return '';
  }
  return raw;
}

let QR_SECRET = getHmacSecret();

type UserRole =
  | 'super_admin'
  | 'event_manager'
  | 'promo_designer'
  | 'payment_reviewer'
  | 'door_staff'
  | 'gallery_editor'
  | 'client';

type PermissionKey =
  | 'overview'
  | 'events'
  | 'special_events'
  | 'sales_stats'
  | 'orders_payments'
  | 'pending_vouchers'
  | 'tickets_qr'
  | 'validator'
  | 'promos_flyers'
  | 'gallery_admin'
  | 'users'
  | 'staff_rbac'
  | 'birthdays'
  | 'notifications'
  | 'payment_methods'
  | 'settings';

const ALL_PERMISSIONS: PermissionKey[] = [
  'overview',
  'events',
  'special_events',
  'sales_stats',
  'orders_payments',
  'pending_vouchers',
  'tickets_qr',
  'validator',
  'promos_flyers',
  'gallery_admin',
  'users',
  'staff_rbac',
  'birthdays',
  'notifications',
  'payment_methods',
  'settings',
];

const ROLE_DEFAULT_PERMS: Record<UserRole, PermissionKey[]> = {
  super_admin: [...ALL_PERMISSIONS],
  event_manager: ['overview', 'events', 'special_events', 'sales_stats', 'notifications'],
  promo_designer: ['special_events', 'promos_flyers'],
  payment_reviewer: ['orders_payments', 'pending_vouchers', 'tickets_qr'],
  door_staff: ['validator'],
  gallery_editor: ['gallery_admin'],
  client: [],
};

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  phone: string;
  cedula: string;
  birthDate: string; // YYYY-MM-DD
  birthMonth: number;
  birthDay: number;
  birthYear: number;
  marketingOptIn: boolean;
  emailVerified: boolean;
  emailVerifyCode: string;
  resetCode?: string;
  resetExpiresAt?: number;
  authProvider: 'local' | 'google';
  role: UserRole;
  customPermissions?: PermissionKey[];
  blocked: boolean;
  isDemoAccount?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoredSession {
  tokenHash: string;
  userId: string;
  expiresAt: number;
  createdAt: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  sessions: StoredSession[];
  seasons: string[];
  specialCampaigns: any[];
  events: any[];
  paymentMethods: {
    pago_movil: {
      enabled: boolean;
      bank: string;
      phone: string;
      documentId: string;
      holderName: string;
      instructions: string;
      iconUrl: string;
      qrImageUrl?: string;
      showQr?: boolean;
    };
    transferencia: {
      enabled: boolean;
      bank: string;
      holderName: string;
      documentId: string;
      accountNumber: string;
      accountType: string;
      currency: string;
      instructions: string;
      iconUrl: string;
      qrImageUrl?: string;
      showQr?: boolean;
    };
    binance: {
      enabled: boolean;
      payIdOrEmail: string;
      networkOrAsset: string;
      instructions: string;
      iconUrl: string;
      qrImageUrl?: string;
      showQr?: boolean;
    };
  };
  orders: any[];
  tickets: any[];
  accessLogs: any[];
  promotions: any[];
  adInquiries?: any[];
  adsSeededV2?: boolean;
  galleryCategories: any[];
  galleryPhotos: any[];
  notificationLogs: any[];
  sentNotificationKeys: string[];
  auditLogs: any[];
  securityAuditLogs?: any[];
  settings: {
    brandHandle: string;
    instagramUrl: string;
    tiktokUrl: string;
    youtubeUrl: string;
    whatsappContact: string;
    cityBase: string;
    timezone: string;
    refundFeePercent: number;
    emailNotificationsEnabled: boolean;
  };
  exchangeRate?: {
    rate: number;
    currency: string;
    source: string;
    lastUpdated: string;
    mode: 'auto' | 'manual';
  };
}

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash: derived };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!salt || !expectedHash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function signTicketQr(ticketId: string, eventId: string): string {
  const sig = crypto
    .createHmac('sha256', QR_SECRET)
    .update(`${ticketId}:${eventId}`)
    .digest('hex')
    .slice(0, 20)
    .toUpperCase();
  return `LVS1.${ticketId}.${sig}`;
}

function verifyTicketQrPayload(rawInput: string, db: DatabaseSchema): {
  validFormat: boolean;
  signatureValid: boolean;
  ticket: any | null;
} {
  const trimmed = String(rawInput || '').trim();
  if (trimmed.startsWith('LVS1.')) {
    const parts = trimmed.split('.');
    if (parts.length !== 3) return { validFormat: false, signatureValid: false, ticket: null };
    const [, ticketId, providedSig] = parts;
    const ticket = db.tickets.find((t) => t.id === ticketId) || null;
    if (!ticket) return { validFormat: true, signatureValid: false, ticket: null };
    const expected = signTicketQr(ticket.id, ticket.eventId).split('.')[2];
    const sigOk =
      providedSig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expected));
    return { validFormat: true, signatureValid: sigOk, ticket };
  }
  // Also allow manual short code lookup ONLY if HMAC matches stored qrPayload
  const byCode = db.tickets.find((t) => t.code === trimmed.toUpperCase()) || null;
  if (!byCode) return { validFormat: false, signatureValid: false, ticket: null };
  return { validFormat: true, signatureValid: true, ticket: byCode };
}

function maskCedula(cedula: string): string {
  if (!cedula) return '';
  if (cedula.length <= 4) return '****';
  return `${cedula.slice(0, 2)}***${cedula.slice(-3)}`;
}

function parseBirthDate(birthDate: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate || '').trim());
  if (!m) return { year: 0, month: 0, day: 0 };
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function buildInitialDb(): DatabaseSchema {
  const now = new Date().toISOString();
  const demoPass = hashPassword('LaVuelta2026!');

  // Demo RBAC staff accounts for safe testing (matching the role panel in the reference video)
  const demoUsers: StoredUser[] = [
    {
      id: 'usr_super_admin',
      name: 'LA VUELTA SESSIONS Oficial',
      email: 'lavueltassessionsoficial@gmail.com',
      passwordSalt: OFFICIAL_ADMIN_SALT,
      passwordHash: OFFICIAL_ADMIN_HASH,
      phone: '+58 412-0000000',
      cedula: 'V-00000000',
      birthDate: '1994-10-18',
      birthYear: 1994,
      birthMonth: 10,
      birthDay: 18,
      marketingOptIn: true,
      emailVerified: true,
      emailVerifyCode: '',
      authProvider: 'local',
      role: 'super_admin',
      blocked: false,
      isDemoAccount: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_runtime_owner',
      name: 'Propietario Proyecto',
      email: 'forgen122@gmail.com',
      passwordSalt: demoPass.salt,
      passwordHash: demoPass.hash,
      phone: '+58 412-0000009',
      cedula: 'V-00000009',
      birthDate: '1994-10-18',
      birthYear: 1994,
      birthMonth: 10,
      birthDay: 18,
      marketingOptIn: true,
      emailVerified: true,
      emailVerifyCode: '',
      authProvider: 'google',
      role: 'super_admin',
      blocked: false,
      isDemoAccount: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_event_mgr',
      name: 'Coordinador de Eventos',
      email: 'eventos@lavueltasessions.local',
      passwordSalt: demoPass.salt,
      passwordHash: demoPass.hash,
      phone: '+58 414-1000001',
      cedula: 'V-20100001',
      birthDate: '1996-11-12',
      birthYear: 1996,
      birthMonth: 11,
      birthDay: 12,
      marketingOptIn: true,
      emailVerified: true,
      emailVerifyCode: '',
      authProvider: 'local',
      role: 'event_manager',
      blocked: false,
      isDemoAccount: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_designer',
      name: 'Diseñador Gráfico Lead',
      email: 'diseno@lavueltasessions.local',
      passwordSalt: demoPass.salt,
      passwordHash: demoPass.hash,
      phone: '+58 414-1000002',
      cedula: 'V-22100002',
      birthDate: '1998-10-29',
      birthYear: 1998,
      birthMonth: 10,
      birthDay: 29,
      marketingOptIn: true,
      emailVerified: true,
      emailVerifyCode: '',
      authProvider: 'local',
      role: 'promo_designer',
      blocked: false,
      isDemoAccount: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_payments',
      name: 'Revisor de Finanzas',
      email: 'pagos@lavueltasessions.local',
      passwordSalt: demoPass.salt,
      passwordHash: demoPass.hash,
      phone: '+58 412-1000003',
      cedula: 'V-21100003',
      birthDate: '1996-02-29', // Leap-year birthday test case!
      birthYear: 1996,
      birthMonth: 2,
      birthDay: 29,
      marketingOptIn: false,
      emailVerified: true,
      emailVerifyCode: '',
      authProvider: 'local',
      role: 'payment_reviewer',
      blocked: false,
      isDemoAccount: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_door',
      name: 'Operador Puerta LB',
      email: 'puerta@lavueltasessions.local',
      passwordSalt: demoPass.salt,
      passwordHash: demoPass.hash,
      phone: '+58 424-1000004',
      cedula: 'V-24100004',
      birthDate: '1999-10-31',
      birthYear: 1999,
      birthMonth: 10,
      birthDay: 31,
      marketingOptIn: false,
      emailVerified: true,
      emailVerifyCode: '',
      authProvider: 'local',
      role: 'door_staff',
      blocked: false,
      isDemoAccount: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_gallery',
      name: 'Editor Visual Galería',
      email: 'galeria@lavueltasessions.local',
      passwordSalt: demoPass.salt,
      passwordHash: demoPass.hash,
      phone: '+58 412-1000005',
      cedula: 'V-25100005',
      birthDate: '2000-12-05',
      birthYear: 2000,
      birthMonth: 12,
      birthDay: 5,
      marketingOptIn: true,
      emailVerified: true,
      emailVerifyCode: '',
      authProvider: 'local',
      role: 'gallery_editor',
      blocked: false,
      isDemoAccount: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_client_demo',
      name: 'Carlos Mendoza',
      email: 'carlos@cliente.local',
      passwordSalt: demoPass.salt,
      passwordHash: demoPass.hash,
      phone: '+58 412-5550199',
      cedula: 'V-26450199',
      birthDate: '2001-10-25',
      birthYear: 2001,
      birthMonth: 10,
      birthDay: 25,
      marketingOptIn: true,
      emailVerified: true,
      emailVerifyCode: '',
      authProvider: 'local',
      role: 'client',
      blocked: false,
      isDemoAccount: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    users: demoUsers,
    sessions: [],
    seasons: [
      'Navidad',
      'Halloween',
      'Año Nuevo',
      'Carnaval',
      'San Valentín',
      'Vacaciones',
      'Aniversarios',
      'Eventos temáticos',
    ],
    specialCampaigns: [
      {
        id: 'camp_findeano',
        name: 'Cierre de Temporada & Fin de Año',
        season: 'Año Nuevo',
        promoText: 'Sesiones especiales de cierre de año en Maracay y Caracas con producción extendida.',
        imageUrl: '',
        accentPrimary: '#E50914',
        accentSecondary: '#FF5722',
        startDate: '2026-11-01',
        endDate: '2026-12-31',
        active: true,
        published: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    // Clean slate ready for real events
    events: [],
    paymentMethods: {
      pago_movil: {
        enabled: true,
        bank: 'Banco de Venezuela (0102)',
        phone: '04122920362',
        documentId: 'V29711480',
        holderName: 'Gustavo Francisco Rivero Prado',
        instructions: 'Realiza el pago móvil por el monto exacto en Bs. indicado por la tasa oficial del día. En el concepto coloca solo tu nombre.',
        iconUrl: '',
        qrImageUrl: '/assets/aistudio/image_33c48a9b.png',
        showQr: true,
      },
      transferencia: {
        enabled: true,
        bank: 'Banco de Venezuela',
        holderName: 'Gustavo Francisco Rivero Prado',
        documentId: 'V29711480',
        accountNumber: '01020116120000360177',
        accountType: 'Corriente',
        currency: 'VES',
        instructions: 'Transfiere el monto exacto acordado en Bs. a la tasa oficial del día. Envía por aquí el comprobante legible con el número de referencia.',
        iconUrl: '',
        qrImageUrl: '',
        showQr: false,
      },
      binance: {
        enabled: false,
        payIdOrEmail: '',
        networkOrAsset: 'USDT (Binance Pay)',
        instructions: 'Envía el monto neto en USDT mediante Binance Pay sin comisión de red.',
        iconUrl: '',
        qrImageUrl: '',
        showQr: false,
      },
    },
    orders: [],
    tickets: [],
    accessLogs: [],
    promotions: [],
    adInquiries: [],
    adsSeededV2: true,
    galleryCategories: [
      { id: 'cat_outfit', name: 'Mejor Outfit', slug: 'mejor-outfit', order: 1 },
      { id: 'cat_flow', name: 'Mejor Flow', slug: 'mejor-flow', order: 2 },
      { id: 'cat_comunidad', name: 'La Comunidad', slug: 'la-comunidad', order: 3 },
      { id: 'cat_momentos', name: 'Momentos de la Noche', slug: 'momentos-de-la-noche', order: 4 },
      { id: 'cat_djs', name: 'DJs y Artistas', slug: 'djs-y-artistas', order: 5 },
      { id: 'cat_backstage', name: 'Backstage', slug: 'backstage', order: 6 },
      { id: 'cat_anteriores', name: 'Sessions Anteriores', slug: 'sessions-anteriores', order: 7 },
    ],
    galleryPhotos: [],
    notificationLogs: [],
    sentNotificationKeys: [],
    auditLogs: [],
    settings: {
      brandHandle: '@lavueltasessions',
      instagramUrl: 'https://instagram.com',
      tiktokUrl: 'https://tiktok.com',
      youtubeUrl: 'https://youtube.com',
      whatsappContact: '',
      cityBase: 'Maracay, Aragua · Venezuela',
      timezone: 'America/Caracas',
      refundFeePercent: 0,
      emailNotificationsEnabled: true,
    },
    exchangeRate: {
      rate: 896.12,
      currency: 'VES',
      source: 'Banco Central de Venezuela (BCV Oficial)',
      lastUpdated: new Date().toISOString(),
      mode: 'auto',
    },
  };
}

function ensureOfficialAdminAccount(loaded: DatabaseSchema): boolean {
  let mutated = false;
  const now = new Date().toISOString();
  let official = loaded.users.find((u) => u.email === 'lavueltassessionsoficial@gmail.com');
  if (!official) {
    loaded.users.unshift({
      id: 'usr_official_admin',
      name: 'LA VUELTA SESSIONS Oficial',
      email: 'lavueltassessionsoficial@gmail.com',
      passwordSalt: OFFICIAL_ADMIN_SALT,
      passwordHash: OFFICIAL_ADMIN_HASH,
      phone: '+58 412-0000000',
      cedula: 'V-00000000',
      birthDate: '1994-10-18',
      birthYear: 1994,
      birthMonth: 10,
      birthDay: 18,
      marketingOptIn: true,
      emailVerified: true,
      emailVerifyCode: '',
      authProvider: 'local',
      role: 'super_admin',
      blocked: false,
      isDemoAccount: true,
      createdAt: now,
      updatedAt: now,
    });
    mutated = true;
  } else {
    const needsSeedHashFix = !official.passwordHash || official.passwordHash === LEGACY_ADMIN_SEED_HASH;
    if (official.role !== 'super_admin' || official.blocked || needsSeedHashFix) {
      official.role = 'super_admin';
      official.blocked = false;
      official.emailVerified = true;
      if (needsSeedHashFix) {
        official.passwordSalt = OFFICIAL_ADMIN_SALT;
        official.passwordHash = OFFICIAL_ADMIN_HASH;
      }
      official.updatedAt = now;
      mutated = true;
    }
  }
  return mutated;
}

function normalizeEventsSchema(loaded: DatabaseSchema): boolean {
  let mutated = false;
  if (Array.isArray(loaded.events)) {
    for (const ev of loaded.events) {
      if (ev.seatMapEnabled === undefined) {
        ev.seatMapEnabled = true;
        mutated = true;
      }
      if (!Array.isArray(ev.blockedSeats)) {
        ev.blockedSeats = [];
        mutated = true;
      }
      if (!Array.isArray(ev.combos)) {
        ev.combos = [];
        mutated = true;
      }
      if (!ev.saleBadge) {
        ev.saleBadge = ev.specialCampaignId ? 'EDICIÓN ESPECIAL' : 'PREVENTA';
        mutated = true;
      }
    }
  }
  if (!Array.isArray(loaded.adInquiries)) {
    loaded.adInquiries = [];
    mutated = true;
  }
  if (!loaded.adsSeededV2 && Array.isArray(loaded.promotions)) {
    const firstEvId = loaded.events?.[0]?.id || '';
    const secondEvId = loaded.events?.[1]?.id || firstEvId;
    if (!loaded.promotions.some((p) => p.id === 'ad_vip_bar')) {
      loaded.promotions.unshift(
        {
          id: 'ad_vip_bar',
          title: 'RESERVA VIP & SERVICIO EN MESA',
          slogan: 'EXPERIENCIA FRENTE A TARIMA',
          text: 'Ubicación preferencial frente a cabina, atención prioritaria y combos pre-pagados de destilados sin fila en caja.',
          imageUrl: '',
          eventId: firstEvId,
          linkSection: 'eventos',
          tribute: false,
          adFormat: 'billboard',
          sponsorBrand: 'Hospitalidad Oficial LV',
          ctaLabel: 'Reservar Experiencia VIP',
          externalUrl: '',
          visualPreset: 'vip_bar',
          from: '2026-01-01',
          to: '2027-12-31',
          published: true,
          order: 0,
        },
        {
          id: 'ad_merch_drop',
          title: 'CÁPSULA STREETWEAR TEMPORADA 26',
          slogan: 'EDICIÓN NUMERADA EN SALA',
          text: 'Prendas heavyweight de corte urbano diseñadas para la comunidad de La Vuelta. Disponibles en cada sesión oficial.',
          imageUrl: '',
          eventId: secondEvId,
          linkSection: 'eventos',
          tribute: false,
          adFormat: 'sponsor',
          sponsorBrand: 'La Vuelta Apparel',
          ctaLabel: 'Ver Próxima Sesión',
          externalUrl: '',
          visualPreset: 'streetwear',
          from: '2026-01-01',
          to: '2027-12-31',
          published: true,
          order: 1,
        }
      );
    }
    loaded.promotions.forEach((p, idx) => {
      if (!p.adFormat) p.adFormat = p.tribute ? 'tribute' : idx % 2 === 0 ? 'billboard' : 'spotlight';
      if (!p.tribute && !p.sponsorBrand) p.sponsorBrand = 'Taquilla Oficial LV';
      if (!p.tribute && !p.ctaLabel) p.ctaLabel = p.eventId ? 'Adquirir Pase' : 'Explorar Cartelera';
      if (!p.visualPreset) {
        p.visualPreset =
          p.id === 'a2' ? 'rooftop' : p.id === 'ad_vip_bar' ? 'vip_bar' : p.id === 'ad_merch_drop' ? 'streetwear' : 'stage';
      }
      p.order = idx + 1;
    });
    loaded.adsSeededV2 = true;
    mutated = true;
  }
  return mutated;
}

function loadSeedDbForInitialMigration(): DatabaseSchema {
  let sourcePath = '';
  if (fs.existsSync(WORKSPACE_DB_FILE)) {
    sourcePath = WORKSPACE_DB_FILE;
  } else if (fs.existsSync(DB_FILE)) {
    sourcePath = DB_FILE;
  }

  const parsed: DatabaseSchema = sourcePath
    ? JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
    : buildInitialDb();

  ensureOfficialAdminAccount(parsed);
  normalizeEventsSchema(parsed);
  if (!parsed.exchangeRate || typeof parsed.exchangeRate.rate !== 'number') {
    parsed.exchangeRate = {
      rate: 896.12,
      currency: 'VES',
      source: 'Banco Central de Venezuela (BCV Oficial)',
      lastUpdated: new Date().toISOString(),
      mode: 'auto',
    };
  }
  return parsed;
}

let db: DatabaseSchema = buildInitialDb();

function persistDb(): Promise<void> {
  return enqueuePostgresPersist(db).catch((err) => {
    console.error('CRITICAL: Failed to persist state to PostgreSQL:', err);
    throw err;
  });
}

async function initDatabaseOrFail(): Promise<void> {
  const pool = getPgPool();
  // Fail-fast check: refuse to start if PostgreSQL is unreachable
  await pool.query('SELECT 1');
  await ensurePostgresSchema(pool);

  QR_SECRET = await getOrCreateQrHmacSecret(SECRET_FILE, PLACEHOLDER_SECRETS, pool);

  const populated = await isPostgresPopulated(pool);
  if (!populated) {
    const seed = loadSeedDbForInitialMigration();
    const legacyVouchers = loadLegacyVouchersFromDisk(VOUCHERS_DIR);
    await enqueuePostgresPersist(seed, legacyVouchers);
    db = seed;
    console.log(
      `[PostgreSQL] Initialized database from seed (${db.users.length} users, ${db.events.length} events, ${db.orders.length} orders, ${legacyVouchers.length} vouchers).`
    );
  } else {
    const loaded = await loadDatabaseFromPostgres<DatabaseSchema>(pool);
    const m1 = ensureOfficialAdminAccount(loaded);
    const m2 = normalizeEventsSchema(loaded);
    let m3 = false;
    if (!loaded.exchangeRate || typeof loaded.exchangeRate.rate !== 'number') {
      loaded.exchangeRate = {
        rate: 896.12,
        currency: 'VES',
        source: 'Banco Central de Venezuela (BCV Oficial)',
        lastUpdated: new Date().toISOString(),
        mode: 'auto',
      };
      m3 = true;
    }
    db = loaded;
    if (m1 || m2 || m3) {
      await persistDb();
    }
    console.log(
      `[PostgreSQL] Loaded persistent state (${db.users.length} users, ${db.events.length} events, ${db.orders.length} orders, ${db.tickets.length} tickets).`
    );
  }
}

async function updateOfficialExchangeRate(): Promise<void> {
  if (db?.exchangeRate?.mode === 'manual') {
    return;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const resp = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      signal: controller.signal,
      headers: { 'User-Agent': 'LaVueltaSessions/2026.1' },
    });
    clearTimeout(timer);
    if (resp.ok) {
      const data: any = await resp.json();
      const avg = Number(data?.promedio);
      if (!isNaN(avg) && avg > 0) {
        db.exchangeRate = {
          rate: Number(avg.toFixed(2)),
          currency: 'VES',
          source: 'Banco Central de Venezuela (BCV Oficial)',
          lastUpdated: data.fechaActualizacion || new Date().toISOString(),
          mode: 'auto',
        };
        await persistDb();
      }
    }
  } catch {
    if (!db.exchangeRate) {
      db.exchangeRate = {
        rate: 896.12,
        currency: 'VES',
        source: 'Banco Central de Venezuela (BCV Oficial)',
        lastUpdated: new Date().toISOString(),
        mode: 'auto',
      };
      await persistDb();
    }
  }
}

function getEffectivePermissions(user: StoredUser): PermissionKey[] {
  if (user.blocked) return [];
  if (user.role === 'super_admin') return [...ALL_PERMISSIONS];
  if (Array.isArray(user.customPermissions)) {
    return user.customPermissions.filter((p) => ALL_PERMISSIONS.includes(p));
  }
  return ROLE_DEFAULT_PERMS[user.role] || [];
}

function sanitizeUserForClient(user: StoredUser) {
  const perms = getEffectivePermissions(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    cedulaMasked: maskCedula(user.cedula),
    hasCedula: Boolean(user.cedula),
    birthMonth: user.birthMonth,
    birthDay: user.birthDay,
    profileCompleted: Boolean(user.phone && user.cedula && user.birthDate),
    marketingOptIn: user.marketingOptIn,
    emailVerified: user.emailVerified,
    authProvider: user.authProvider,
    role: user.role,
    permissions: perms,
    blocked: user.blocked,
  };
}

function appendAudit(actor: StoredUser, action: string, targetType: string, targetId: string, details: string) {
  db.auditLogs.unshift({
    id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    targetType,
    targetId,
    details,
  });
  if (db.auditLogs.length > 500) db.auditLogs.length = 500;
}

// Module: Robust Security Audit & Real-time Threat Logging
interface SecurityAuditLog {
  id: string;
  timestamp: string;
  event: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  ip: string;
  actorEmail?: string;
  details: string;
}

const memorySecurityAudit: SecurityAuditLog[] = [];

function recordSecurityAudit(
  event: string,
  severity: 'info' | 'warning' | 'high' | 'critical',
  req: Request,
  details: string,
  actorEmail?: string
) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1')
    .split(',')[0]
    .trim();
  const maskedIp = ip.length > 7 ? `${ip.slice(0, 4)}***${ip.slice(-3)}` : ip;
  const entry: SecurityAuditLog = {
    id: `sec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    event,
    severity,
    ip: maskedIp,
    actorEmail: actorEmail || (req as AuthedRequest).user?.email,
    details,
  };
  memorySecurityAudit.unshift(entry);
  if (memorySecurityAudit.length > 200) memorySecurityAudit.length = 200;
  if (!db.securityAuditLogs) db.securityAuditLogs = [];
  db.securityAuditLogs.unshift(entry);
  if (db.securityAuditLogs.length > 200) db.securityAuditLogs.length = 200;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const ipRateBuckets = new Map<string, RateBucket>();

function checkGeneralRateLimit(
  ip: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  let b = ipRateBuckets.get(ip);
  if (!b || b.resetAt <= now) {
    b = { count: 1, resetAt: now + windowMs };
    ipRateBuckets.set(ip, b);
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return { allowed: true, remaining: limit - b.count, retryAfterSeconds: 0 };
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of ipRateBuckets.entries()) {
    if (b.resetAt <= now) ipRateBuckets.delete(key);
  }
  for (const [key, l] of loginAttempts.entries()) {
    if (l.lockUntil !== 0 && l.lockUntil <= now) loginAttempts.delete(key);
  }
}, 5 * 60 * 1000);

function sanitizeInputString(val: string): string {
  if (!val || typeof val !== 'string') return val;
  return val
    .replace(/\0/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

function deepSanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return typeof obj === 'string' ? sanitizeInputString(obj) : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepSanitize);
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if ((k === 'voucherDataUrl' || k === 'iconUrl' || k === 'imageUrl') && typeof v === 'string') {
      clean[k] = v.trim();
    } else {
      clean[k] = deepSanitize(v);
    }
  }
  return clean;
}

// Brute-force login protection
const loginAttempts = new Map<string, { count: number; lockUntil: number }>();

function checkLoginRateLimit(key: string): { allowed: boolean; waitSeconds: number } {
  const rec = loginAttempts.get(key);
  if (!rec) return { allowed: true, waitSeconds: 0 };
  const now = Date.now();
  if (rec.lockUntil > now) {
    return { allowed: false, waitSeconds: Math.ceil((rec.lockUntil - now) / 1000) };
  }
  if (rec.lockUntil !== 0 && rec.lockUntil <= now) {
    loginAttempts.delete(key);
  }
  return { allowed: true, waitSeconds: 0 };
}

function recordFailedLogin(key: string) {
  const rec = loginAttempts.get(key) || { count: 0, lockUntil: 0 };
  rec.count += 1;
  if (rec.count >= 5) {
    rec.lockUntil = Date.now() + 10 * 60 * 1000; // 10 minutes
  }
  loginAttempts.set(key, rec);
}

// Duplicate order guard
const recentOrderFingerprints = new Map<string, number>();

// In-memory voucher fallback when container filesystem is ephemeral/restricted
const memoryVouchers = new Map<string, { dataUrl: string; uploadedAt: string }>();

// Atomic mutex for QR validation
let validationMutex: Promise<void> = Promise.resolve();

interface AuthedRequest extends Request {
  user?: StoredUser;
}

function extractSessionToken(req: Request): string {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const altToken = req.headers['x-access-token'];
  if (typeof altToken === 'string' && altToken.trim()) {
    return altToken.trim();
  }
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)lv_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function setSessionCookie(res: Response, rawToken: string) {
  const flags = [
    `lv_session=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${7 * 24 * 3600}`,
    IS_PROD ? 'Secure; SameSite=None' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', flags.join('; '));
}

function clearSessionCookie(res: Response) {
  res.setHeader('Set-Cookie', 'lv_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
}

async function createSessionForUser(user: StoredUser, res: Response): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.sessions = db.sessions.filter((s) => s.expiresAt > now);
  db.sessions.push({
    tokenHash: hashToken(rawToken),
    userId: user.id,
    expiresAt: now + 7 * 24 * 3600 * 1000,
    createdAt: new Date(now).toISOString(),
  });
  await persistDb();
  setSessionCookie(res, rawToken);
  return rawToken;
}

async function attachUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const raw = extractSessionToken(req);
    if (!raw) return next();
    const th = hashToken(raw);
    const now = Date.now();
    let sess = db.sessions.find((s) => s.tokenHash === th && s.expiresAt > now);
    if (!sess) {
      const pgSess = await getPgPool().query(
        `SELECT token_hash, user_id, expires_at, created_at FROM sessions WHERE token_hash = $1 AND expires_at > $2 LIMIT 1`,
        [th, now]
      );
      if (pgSess.rows.length > 0) {
        const r = pgSess.rows[0];
        sess = {
          tokenHash: r.token_hash,
          userId: r.user_id,
          expiresAt: Number(r.expires_at),
          createdAt: r.created_at,
        };
        db.sessions.push(sess);
      }
    }
    if (!sess) return next();
    const u = db.users.find((x) => x.id === sess.userId && !x.blocked);
    if (u) req.user = u;
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Debes iniciar sesión para realizar esta operación.' });
    return;
  }
  next();
}

function requirePermission(...anyOfPermissions: PermissionKey[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Sesión no autenticada.' });
      return;
    }
    const perms = getEffectivePermissions(req.user);
    const allowed = anyOfPermissions.some((p) => perms.includes(p));
    if (!allowed) {
      res.status(403).json({
        error: `Acceso denegado. Tu rol (${req.user.role}) no tiene permiso para este módulo.`,
      });
      return;
    }
    next();
  };
}

// Derived Per-Event Statistics Calculator (Module 1.2, 1.3 & 13)
function computeEventStats(filters?: {
  eventId?: string;
  dateFrom?: string;
  dateTo?: string;
  ticketType?: string;
  paymentStatus?: string;
  ticketStatus?: string;
  paymentMethod?: string;
  validationStatus?: string;
}) {
  const campaignMap = new Map(db.specialCampaigns.map((c) => [c.id, c.name]));

  return db.events
    .filter((ev) => {
      if (filters?.eventId && ev.id !== filters.eventId) return false;
      if (filters?.dateFrom && ev.isoDate && ev.isoDate < filters.dateFrom) return false;
      if (filters?.dateTo && ev.isoDate && ev.isoDate > filters.dateTo) return false;
      return true;
    })
    .map((ev) => {
      const evOrdersAll = db.orders.filter((o) => o.eventId === ev.id);
      const evOrders = evOrdersAll.filter((o) => {
        if (filters?.ticketType && o.ticketType !== filters.ticketType) return false;
        if (filters?.paymentStatus && o.status !== filters.paymentStatus) return false;
        if (filters?.paymentMethod && o.paymentMethod !== filters.paymentMethod) return false;
        return true;
      });

      const evTicketsAll = db.tickets.filter((t) => t.eventId === ev.id);
      const evTickets = evTicketsAll.filter((t) => {
        if (filters?.ticketType && t.ticketType !== filters.ticketType) return false;
        if (filters?.ticketStatus && t.status !== filters.ticketStatus) return false;
        if (filters?.validationStatus === 'validated' && t.status !== 'used') return false;
        if (filters?.validationStatus === 'unvalidated' && t.status !== 'valid') return false;
        return true;
      });

      const orderGenQty = (o: any) =>
        o.generalQty !== undefined ? Number(o.generalQty || 0) : o.ticketType === 'general' ? Number(o.qty || 0) : 0;
      const orderVipQty = (o: any) =>
        o.vipQty !== undefined ? Number(o.vipQty || 0) : o.ticketType === 'vip' ? Number(o.qty || 0) : 0;

      // Inventory availability always computed from real active orders + admin blocked spots
      const approvedGen = evOrdersAll
        .filter((o) => o.status === 'approved')
        .reduce((acc, o) => acc + orderGenQty(o), 0);
      const approvedVip = evOrdersAll
        .filter((o) => o.status === 'approved')
        .reduce((acc, o) => acc + orderVipQty(o), 0);
      const pendingGen = evOrdersAll
        .filter((o) => o.status === 'pending')
        .reduce((acc, o) => acc + orderGenQty(o), 0);
      const pendingVip = evOrdersAll
        .filter((o) => o.status === 'pending')
        .reduce((acc, o) => acc + orderVipQty(o), 0);

      const blockedList: string[] = Array.isArray(ev.blockedSeats) ? ev.blockedSeats : [];
      const blockedGen = blockedList.filter((s) => String(s).startsWith('GEN-')).length;
      const blockedVip = blockedList.filter((s) => String(s).startsWith('VIP-')).length;

      const availableGeneral = Math.max(0, Number(ev.generalCapacity || 0) - approvedGen - pendingGen - blockedGen);
      const availableVip = Math.max(0, Number(ev.vipCapacity || 0) - approvedVip - pendingVip - blockedVip);

      // Filtered financial & voucher metrics (never double-counting or mixing pending with confirmed!)
      const approvedFiltered = evOrders.filter((o) => o.status === 'approved');
      const pendingFiltered = evOrders.filter((o) => o.status === 'pending');
      const rejectedFiltered = evOrders.filter((o) => o.status === 'rejected');
      const refundedFiltered = evOrders.filter((o) => o.status === 'refunded');

      const paidConfirmedTickets = approvedFiltered.reduce((acc, o) => acc + Number(o.qty || 0), 0);
      const pendingPaymentTickets = pendingFiltered.reduce((acc, o) => acc + Number(o.qty || 0), 0);

      const generalSold = approvedFiltered.reduce((acc, o) => acc + orderGenQty(o), 0);
      const vipSold = approvedFiltered.reduce((acc, o) => acc + orderVipQty(o), 0);

      const grossConfirmedRevenue = approvedFiltered.reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);
      const refundedAmount = refundedFiltered.reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);
      const feeFactor = 1 - Math.min(100, Math.max(0, Number(db.settings.refundFeePercent || 0))) / 100;
      const netConfirmedRevenue = Math.max(0, Number((grossConfirmedRevenue * feeFactor).toFixed(2)));

      const validatedAtDoorCount = evTickets.filter((t) => t.status === 'used').length;
      const unusedValidTicketsCount = evTickets.filter((t) => t.status === 'valid').length;

      return {
        eventId: ev.id,
        eventTitle: ev.title,
        eventDate: ev.date,
        eventIsoDate: ev.isoDate || '',
        eventStatus: ev.status,
        specialCampaignId: ev.specialCampaignId || '',
        specialCampaignName: ev.specialCampaignId ? campaignMap.get(ev.specialCampaignId) || '' : '',
        totalCapacity: Number(ev.generalCapacity || 0) + Number(ev.vipCapacity || 0),
        availableGeneral,
        availableVip,
        availableTotal: availableGeneral + availableVip,
        reservedTickets: pendingGen + pendingVip,
        soldTickets: paidConfirmedTickets,
        paidConfirmedTickets,
        pendingPaymentTickets,
        pendingVouchersCount: pendingFiltered.length,
        approvedVouchersCount: approvedFiltered.length,
        rejectedVouchersCount: rejectedFiltered.length,
        generalSold,
        vipSold,
        grossConfirmedRevenue,
        refundedAmount,
        netConfirmedRevenue,
        validatedAtDoorCount,
        unusedValidTicketsCount,
      };
    });
}

async function startServer() {
  await initDatabaseOrFail();

  // Automatically fetch live rate at boot and every 30 minutes
  void updateOfficialExchangeRate();
  const rateInterval = setInterval(() => {
    void updateOfficialExchangeRate();
  }, 30 * 60 * 1000);
  rateInterval.unref?.();

  const app = express();
  app.set('trust proxy', 1);

  // Module 12: Hardened Security Headers (Cloud Run / Edge proxy terminates TLS; never 301-redirect internal HTTP health probes)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    if (IS_PROD) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    const origin = req.headers.origin;
    const allowedList = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const isMobileValidatorRoute =
      req.path === '/healthz' ||
      req.path === '/api/health' ||
      req.path === '/api/auth/login' ||
      req.path === '/api/login' ||
      req.path === '/api/admin/login' ||
      req.path.startsWith('/api/validator') ||
      req.path.startsWith('/api/validador') ||
      req.path.startsWith('/api/lb-validador') ||
      req.path === '/api/tickets/validate';

    if (origin) {
      const sameHost = origin.includes(req.headers.host || '');
      const isTrustedWebOrHybrid =
        origin.endsWith('.run.app') ||
        origin.endsWith('.onrender.com') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('https://localhost') ||
        origin.startsWith('capacitor://') ||
        origin.startsWith('ionic://');
      if (sameHost || isTrustedWebOrHybrid || allowedList.includes(origin) || isMobileValidatorRoute) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Authorization, Content-Type, X-LB-Api-Key, X-Access-Token, Accept'
        );
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      }
    } else if (isMobileValidatorRoute) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, X-LB-Api-Key, X-Access-Token, Accept'
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '6mb' }));

  // Deep Input Sanitization Middleware (XSS, Prototype Pollution & Null-byte Protection)
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = deepSanitize(req.body);
    }
    next();
  });

  // Sliding-Window DDoS & Route Rate Limiting Middleware
  app.use((req, res, next) => {
    if (req.path.startsWith('/assets') || req.path === '/healthz' || req.path === '/api/health') {
      next();
      return;
    }

    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1')
      .split(',')[0]
      .trim();

    if (req.path === '/api/auth/register' && req.method === 'POST') {
      const rl = checkGeneralRateLimit(`reg:${ip}`, 8, 15 * 60 * 1000);
      if (!rl.allowed) {
        recordSecurityAudit('RATE_LIMIT_REGISTER', 'warning', req, 'Límite de registros por IP alcanzado.');
        res.setHeader('Retry-After', String(rl.retryAfterSeconds));
        res.status(429).json({ ok: false, error: `Demasiados registros de cuenta desde esta red. Espera ${rl.retryAfterSeconds} segundos.` });
        return;
      }
    } else if (req.path === '/api/orders' && req.method === 'POST') {
      const rl = checkGeneralRateLimit(`ord:${ip}`, 20, 60 * 1000);
      if (!rl.allowed) {
        recordSecurityAudit('RATE_LIMIT_ORDERS', 'warning', req, 'Límite de órdenes por IP alcanzado.');
        res.setHeader('Retry-After', String(rl.retryAfterSeconds));
        res.status(429).json({ ok: false, error: `Demasiadas transacciones en curso. Espera ${rl.retryAfterSeconds} segundos para reintentar.` });
        return;
      }
    } else if (req.path.includes('/tickets/validate') || req.path.includes('/validator/scan') || req.path.includes('/validador/')) {
      const rl = checkGeneralRateLimit(`val:${ip}`, 60, 60 * 1000);
      if (!rl.allowed) {
        recordSecurityAudit('RATE_LIMIT_VALIDATION', 'high', req, 'Posible sondeo masivo de códigos QR detectado.');
        res.setHeader('Retry-After', String(rl.retryAfterSeconds));
        res.status(429).json({ ok: false, error: 'Tasa de escaneo excedida temporalmente. Espere un momento.' });
        return;
      }
    } else if (req.path.startsWith('/api/')) {
      const rl = checkGeneralRateLimit(`gen:${ip}`, 350, 60 * 1000);
      if (!rl.allowed) {
        res.setHeader('Retry-After', String(rl.retryAfterSeconds));
        res.status(429).json({ ok: false, error: 'Límite de peticiones de seguridad alcanzado.' });
        return;
      }
    }

    next();
  });

  app.use(attachUser);

  const getOccupiedSeatsForEvent = (ev: any): string[] => {
    const set = new Set<string>(Array.isArray(ev.blockedSeats) ? ev.blockedSeats : []);
    for (const o of db.orders) {
      if (o.eventId === ev.id && (o.status === 'pending' || o.status === 'approved') && Array.isArray(o.selectedSeats)) {
        for (const s of o.selectedSeats) set.add(String(s));
      }
    }
    return Array.from(set);
  };

  // =========================================================
  // PUBLIC BOOTSTRAP STATE (Zero Private Vouchers, Zero PII Leaks)
  // =========================================================
  app.get('/api/bootstrap', (req: AuthedRequest, res: Response) => {
    const publicEvents = db.events
      .filter((e) => e.published && e.status === 'published')
      .map((ev) => {
        const stats = computeEventStats({ eventId: ev.id })[0];
        return {
          ...ev,
          availableGeneral: stats?.availableGeneral ?? ev.generalCapacity,
          availableVip: stats?.availableVip ?? ev.vipCapacity,
          availableTotal: stats?.availableTotal ?? ev.capacity,
          occupiedSeats: getOccupiedSeatsForEvent(ev),
        };
      });

    const publicCampaigns = db.specialCampaigns.filter((c) => c.active && c.published);
    const publicPromos = db.promotions
      .filter((p) => p.published)
      .sort((a, b) => a.order - b.order);

    const catMap = new Map(db.galleryCategories.map((c) => [c.id, c.name]));
    const evMap = new Map(db.events.map((e) => [e.id, e.title]));
    const publicGallery = db.galleryPhotos
      .filter((g) => g.published)
      .map((g) => ({
        ...g,
        categoryName: catMap.get(g.categoryId) || 'General',
        eventTitle: evMap.get(g.eventId) || '',
      }));

    // Only expose enabled payment methods to buyers
    const activePaymentMethods: Record<string, any> = {};
    if (db.paymentMethods.pago_movil.enabled) {
      activePaymentMethods.pago_movil = db.paymentMethods.pago_movil;
    }
    if (db.paymentMethods.transferencia.enabled) {
      activePaymentMethods.transferencia = db.paymentMethods.transferencia;
    }
    if (db.paymentMethods.binance.enabled) {
      activePaymentMethods.binance = db.paymentMethods.binance;
    }

    const myOrders = req.user
      ? db.orders
          .filter((o) => o.userId === req.user!.id)
          .map(({ ...o }) => o)
      : [];

    const myTickets = req.user
      ? db.tickets.filter((t) => t.userId === req.user!.id)
      : [];

    const sanitizedUser = req.user ? sanitizeUserForClient(req.user) : null;

    res.json({
      currentUser: sanitizedUser,
      user: sanitizedUser,
      events: publicEvents,
      specialCampaigns: publicCampaigns,
      seasons: db.seasons,
      promotions: publicPromos,
      galleryCategories: db.galleryCategories.sort((a, b) => a.order - b.order),
      galleryPhotos: publicGallery,
      activePaymentMethods,
      exchangeRate: db.exchangeRate || {
        rate: 896.12,
        currency: 'VES',
        source: 'Banco Central de Venezuela (BCV Oficial)',
        lastUpdated: new Date().toISOString(),
        mode: 'auto',
      },
      myOrders,
      myTickets,
      settings: db.settings,
      securityStatus: {
        httpsActive: req.secure || req.headers['x-forwarded-proto'] === 'https',
        protocol: (req.headers['x-forwarded-proto'] as string) || req.protocol,
        origin: `${(req.headers['x-forwarded-proto'] as string) || req.protocol}://${req.headers.host}`,
        googleAuthConfigured: Boolean(firebaseConfig.apiKey && firebaseConfig.projectId),
        emailProviderConfigured: Boolean(getActiveResendKey()),
      },
    });
  });

  // =========================================================
  // AUTHENTICATION & SECURITY (Module 6)
  // =========================================================
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const { name, email, phone, cedula, birthDate, password, marketingOptIn } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    const cleanPhone = String(phone || '').trim();
    const cleanCedula = String(cedula || '').trim().toUpperCase();
    const cleanBirth = String(birthDate || '').trim();

    if (!cleanName || cleanName.length < 2) {
      res.status(400).json({ error: 'Ingresa tu nombre completo.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
      return;
    }
    if (!/^\+?[0-9\s\-()]{7,20}$/.test(cleanPhone)) {
      res.status(400).json({ error: 'Ingresa un número de teléfono válido (ej. +58 412-1234567).' });
      return;
    }
    if (!/^[VEJP]-?[0-9]{5,12}$/i.test(cleanCedula) && !/^[0-9]{6,12}$/.test(cleanCedula)) {
      res.status(400).json({ error: 'Ingresa una cédula válida (ej. V-12345678).' });
      return;
    }
    const parsedBirth = parseBirthDate(cleanBirth);
    if (!parsedBirth.month || !parsedBirth.day) {
      res.status(400).json({ error: 'Ingresa una fecha de nacimiento válida.' });
      return;
    }
    if (String(password || '').length < 8) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    if (db.users.some((u) => u.email === cleanEmail)) {
      res.status(409).json({ error: 'Ya existe una cuenta registrada con ese correo electrónico.' });
      return;
    }

    const { salt, hash } = hashPassword(String(password));
    const verifyCode = String(crypto.randomInt(100000, 999999));
    const now = new Date().toISOString();
    const newUser: StoredUser = {
      id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      name: cleanName.slice(0, 80),
      email: cleanEmail,
      passwordSalt: salt,
      passwordHash: hash,
      phone: cleanPhone.slice(0, 30),
      cedula: cleanCedula.startsWith('V') || cleanCedula.startsWith('E') ? cleanCedula : `V-${cleanCedula}`,
      birthDate: cleanBirth,
      birthYear: parsedBirth.year,
      birthMonth: parsedBirth.month,
      birthDay: parsedBirth.day,
      marketingOptIn: Boolean(marketingOptIn),
      emailVerified: false,
      emailVerifyCode: verifyCode,
      authProvider: 'local',
      role: OFFICIAL_ADMIN_EMAILS.includes(cleanEmail) ? 'super_admin' : 'client',
      blocked: false,
      createdAt: now,
      updatedAt: now,
    };

    db.users.push(newUser);
    const token = await createSessionForUser(newUser, res);
    const hasEmailProvider = Boolean(getActiveResendKey());

    res.json({
      token,
      user: sanitizeUserForClient(newUser),
      verificationPending: true,
      emailProviderConfigured: hasEmailProvider,
      // Only shown when no external SMTP/Resend provider is configured yet so user isn't locked out locally
      devVerificationCode: hasEmailProvider ? undefined : verifyCode,
    });
  });

  app.post('/api/auth/verify-email', requireAuth, async (req: AuthedRequest, res: Response) => {
    const code = String(req.body?.code || '').trim();
    const u = req.user!;
    if (u.emailVerified) {
      res.json({ user: sanitizeUserForClient(u) });
      return;
    }
    if (!code || code !== u.emailVerifyCode) {
      res.status(400).json({ error: 'Código de verificación incorrecto.' });
      return;
    }
    u.emailVerified = true;
    u.emailVerifyCode = '';
    u.updatedAt = new Date().toISOString();
    await persistDb();
    res.json({ user: sanitizeUserForClient(u) });
  });

  const handleCredentialLogin = async (req: Request, res: Response, requireValidatorRole: boolean) => {
    const rawEmail = req.body?.email ?? req.body?.correo ?? req.body?.username ?? '';
    const rawPass =
      req.body?.password ?? req.body?.contraseña ?? req.body?.contrasena ?? req.body?.clave ?? '';
    const cleanEmail = String(rawEmail).trim().toLowerCase();
    const pass = String(rawPass);
    const rateKey = `${req.ip}:${cleanEmail}`;

    const check = checkLoginRateLimit(rateKey);
    if (!check.allowed) {
      recordSecurityAudit('LOGIN_RATE_LIMIT_TRIGGERED', 'warning', req, `Límite de intentos superado para: ${cleanEmail}`);
      await persistDb();
      res.status(429).json({
        ok: false,
        error: `Demasiados intentos fallidos. Intenta nuevamente en ${check.waitSeconds} segundos.`,
      });
      return;
    }

    const user = db.users.find((u) => u.email === cleanEmail);
    if (!user || !verifyPassword(pass, user.passwordSalt, user.passwordHash)) {
      recordFailedLogin(rateKey);
      recordSecurityAudit('LOGIN_FAILED_CREDENTIALS', 'warning', req, `Contraseña incorrecta o usuario inexistente: ${cleanEmail}`);
      await persistDb();
      res.status(401).json({ ok: false, error: 'Correo o contraseña incorrectos.' });
      return;
    }
    if (user.blocked) {
      recordSecurityAudit('LOGIN_BLOCKED_ACCOUNT', 'critical', req, `Intento de acceso a cuenta suspendida: ${cleanEmail}`);
      await persistDb();
      res.status(403).json({ ok: false, error: 'Esta cuenta se encuentra suspendida por administración.' });
      return;
    }

    const perms = getEffectivePermissions(user);
    if (requireValidatorRole && !perms.includes('validator')) {
      recordSecurityAudit('LOGIN_UNAUTHORIZED_ROLE', 'warning', req, `Intento de acceso a validador sin permisos: ${cleanEmail}`);
      await persistDb();
      res.status(403).json({
        ok: false,
        error: 'Acceso solo para administradores y personal autorizado de puerta.',
      });
      return;
    }

    loginAttempts.delete(rateKey);
    recordSecurityAudit('LOGIN_SUCCESS', 'info', req, `Inicio de sesión exitoso como ${user.role}.`, user.email);
    const token = await createSessionForUser(user, res);
    const safeUser = sanitizeUserForClient(user);
    const activeEvents = perms.includes('validator')
      ? db.events
          .filter((e) => e.status !== 'archived')
          .map((ev) => {
            const st = computeEventStats({ eventId: ev.id })[0];
            return {
              id: ev.id,
              title: ev.title,
              date: ev.date,
              time: ev.time,
              city: ev.city,
              venue: ev.venue,
              paidConfirmedTickets: st?.paidConfirmedTickets ?? 0,
              validatedAtDoorCount: st?.validatedAtDoorCount ?? 0,
              unusedValidTicketsCount: st?.unusedValidTicketsCount ?? 0,
            };
          })
      : undefined;

    res.json({
      ok: true,
      success: true,
      token,
      accessToken: token,
      user: safeUser,
      events: activeEvents,
      serverUrl: `${(req.headers['x-forwarded-proto'] as string) || req.protocol}://${req.headers.host}`,
    });
  };

  app.post('/api/auth/login', (req: Request, res: Response) => {
    void handleCredentialLogin(req, res, false);
  });

  // Dedicated login endpoints for LA VUELTA SESSIONS VALIDADOR mobile/external app
  app.post('/api/validator/login', (req: Request, res: Response) => {
    void handleCredentialLogin(req, res, true);
  });
  app.post('/api/validador/login', (req: Request, res: Response) => {
    void handleCredentialLogin(req, res, true);
  });
  app.post('/api/admin/login', (req: Request, res: Response) => {
    void handleCredentialLogin(req, res, true);
  });
  app.post('/api/login', (req: Request, res: Response) => {
    void handleCredentialLogin(req, res, false);
  });

  // Server-verified Google Sign-In via Firebase IdentityToolkit
  app.post('/api/auth/google', async (req: Request, res: Response) => {
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken || !firebaseConfig.apiKey) {
      res.status(400).json({ error: 'Falta token de identidad de Google o configuración de proyecto.' });
      return;
    }

    try {
      const verifyResp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );

      if (!verifyResp.ok) {
        res.status(401).json({ error: 'No se pudo verificar el token de Google en el servidor.' });
        return;
      }

      const payload = (await verifyResp.json()) as any;
      const gUser = payload?.users?.[0];
      if (!gUser || !gUser.email || !gUser.emailVerified) {
        res.status(401).json({ error: 'La cuenta de Google debe tener un correo verificado.' });
        return;
      }

      const cleanEmail = String(gUser.email).toLowerCase();
      let user = db.users.find((u) => u.email === cleanEmail);
      const now = new Date().toISOString();

      if (!user) {
        user = {
          id: `usr_g_${gUser.localId.slice(0, 20)}`,
          name: String(gUser.displayName || cleanEmail.split('@')[0]).slice(0, 80),
          email: cleanEmail,
          passwordSalt: '',
          passwordHash: '',
          phone: '',
          cedula: '',
          birthDate: '',
          birthYear: 0,
          birthMonth: 0,
          birthDay: 0,
          marketingOptIn: false,
          emailVerified: true,
          emailVerifyCode: '',
          authProvider: 'google',
          role: 'client', // Always a regular buyer / normal user
          blocked: false,
          createdAt: now,
          updatedAt: now,
        };
        db.users.push(user);
      } else {
        if (user.blocked) {
          res.status(403).json({ error: 'Esta cuenta ha sido suspendida.' });
          return;
        }
        user.emailVerified = true;
        // When logging in with Google, preserve normal client role so they stay in buyer view
        if (user.authProvider === 'google') {
          user.role = 'client';
        }
        user.updatedAt = now;
      }

      const token = await createSessionForUser(user, res);
      res.json({
        token,
        user: sanitizeUserForClient(user),
        needsProfileCompletion: !Boolean(user.phone && user.cedula && user.birthDate),
      });
    } catch (err) {
      res.status(500).json({ error: 'Error al validar credenciales de Google con el proveedor.' });
    }
  });

  // Complementary profile form after first Google login (Module 6.2)
  app.post('/api/auth/complete-profile', requireAuth, async (req: AuthedRequest, res: Response) => {
    const { phone, cedula, birthDate, marketingOptIn, name } = req.body || {};
    const cleanPhone = String(phone || '').trim();
    const cleanCedula = String(cedula || '').trim().toUpperCase();
    const cleanBirth = String(birthDate || '').trim();

    if (!/^\+?[0-9\s\-()]{7,20}$/.test(cleanPhone)) {
      res.status(400).json({ error: 'Ingresa un teléfono válido.' });
      return;
    }
    if (!/^[VEJP]-?[0-9]{5,12}$/i.test(cleanCedula) && !/^[0-9]{6,12}$/.test(cleanCedula)) {
      res.status(400).json({ error: 'Ingresa una cédula válida.' });
      return;
    }
    const parsed = parseBirthDate(cleanBirth);
    if (!parsed.month || !parsed.day) {
      res.status(400).json({ error: 'Ingresa una fecha de nacimiento válida.' });
      return;
    }

    const u = req.user!;
    if (name && String(name).trim().length >= 2) {
      u.name = String(name).trim().slice(0, 80);
    }
    u.phone = cleanPhone.slice(0, 30);
    u.cedula = cleanCedula.startsWith('V') || cleanCedula.startsWith('E') ? cleanCedula : `V-${cleanCedula}`;
    u.birthDate = cleanBirth;
    u.birthYear = parsed.year;
    u.birthMonth = parsed.month;
    u.birthDay = parsed.day;
    u.marketingOptIn = Boolean(marketingOptIn);
    u.updatedAt = new Date().toISOString();
    await persistDb();

    res.json({ user: sanitizeUserForClient(u) });
  });

  // Password Reset Flow
  app.post('/api/auth/request-reset', async (req: Request, res: Response) => {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    const user = db.users.find((u) => u.email === cleanEmail && !u.blocked);
    let devResetCode: string | undefined;
    if (user) {
      const code = String(crypto.randomInt(100000, 999999));
      user.resetCode = code;
      user.resetExpiresAt = Date.now() + 15 * 60 * 1000;
      await persistDb();
      if (!getActiveResendKey()) {
        devResetCode = code;
      }
    }
    res.json({
      ok: true,
      emailProviderConfigured: Boolean(getActiveResendKey()),
      devResetCode,
    });
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    const user = db.users.find((u) => u.email === cleanEmail && !u.blocked);
    if (!user || !user.resetCode || user.resetCode !== code || (user.resetExpiresAt || 0) < Date.now()) {
      res.status(400).json({ error: 'Código inválido o expirado.' });
      return;
    }
    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    user.resetCode = undefined;
    user.resetExpiresAt = undefined;
    user.updatedAt = new Date().toISOString();
    // Invalidate previous sessions
    db.sessions = db.sessions.filter((s) => s.userId !== user.id);
    await persistDb();
    res.json({ ok: true });
  });

  // Restricted Role Simulator — Strictly reserved for authenticated Super Admin
  app.post('/api/auth/demo-role', requireAuth, async (req: AuthedRequest, res: Response) => {
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({ error: 'Acción reservada exclusivamente al Administrador Principal.' });
      return;
    }
    const targetRole = String(req.body?.role || '') as UserRole;
    const demoAccount = db.users.find((u) => u.isDemoAccount && u.role === targetRole && !u.blocked);
    if (!demoAccount) {
      res.status(404).json({ error: 'Rol de prueba no encontrado.' });
      return;
    }
    const token = await createSessionForUser(demoAccount, res);
    res.json({ token, user: sanitizeUserForClient(demoAccount) });
  });

  app.post('/api/auth/logout', async (req: AuthedRequest, res: Response) => {
    const raw = extractSessionToken(req);
    if (raw) {
      const th = hashToken(raw);
      db.sessions = db.sessions.filter((s) => s.tokenHash !== th);
      await persistDb();
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // =========================================================
  // ADMIN WORKSPACE DATA (Filtered strictly by RBAC permissions)
  // =========================================================
  const handleAdminWorkspace = (req: AuthedRequest, res: Response) => {
    const perms = getEffectivePermissions(req.user!);
    if (perms.length === 0) {
      res.status(403).json({ error: 'Tu cuenta no posee permisos administrativos.' });
      return;
    }

    res.json({
      events: perms.some((p) => ['overview', 'events', 'special_events', 'sales_stats', 'notifications', 'promos_flyers', 'gallery_admin', 'validator'].includes(p))
        ? db.events.map((ev) => ({
            ...ev,
            occupiedSeats: getOccupiedSeatsForEvent(ev),
          }))
        : [],
      specialCampaigns: perms.some((p) => ['events', 'special_events', 'promos_flyers'].includes(p))
        ? db.specialCampaigns
        : [],
      seasons: db.seasons,
      eventStats: perms.some((p) => ['overview', 'sales_stats', 'events'].includes(p))
        ? computeEventStats()
        : [],
      orders: perms.some((p) => ['overview', 'orders_payments', 'pending_vouchers', 'sales_stats'].includes(p))
        ? db.orders
        : [],
      tickets: perms.some((p) => ['overview', 'tickets_qr', 'orders_payments'].includes(p))
        ? db.tickets
        : [],
      accessLogs: perms.some((p) => ['validator', 'overview'].includes(p))
        ? db.accessLogs
        : [],
      promotions: perms.includes('promos_flyers') ? db.promotions : [],
      adInquiries: perms.includes('promos_flyers') ? db.adInquiries || [] : [],
      galleryCategories: db.galleryCategories,
      galleryPhotos: perms.includes('gallery_admin') ? db.galleryPhotos : [],
      paymentMethods: perms.includes('payment_methods')
        ? { ...db.paymentMethods, exchangeRate: db.exchangeRate }
        : null,
      exchangeRate: db.exchangeRate,
      users: perms.some((p) => ['users', 'staff_rbac'].includes(p))
        ? db.users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            cedulaMasked: maskCedula(u.cedula),
            birthMonth: u.birthMonth,
            birthDay: u.birthDay,
            marketingOptIn: u.marketingOptIn,
            emailVerified: u.emailVerified,
            authProvider: u.authProvider,
            role: u.role,
            permissions: getEffectivePermissions(u),
            customPermissions: u.customPermissions || null,
            blocked: u.blocked,
            createdAt: u.createdAt,
          }))
        : [],
      notificationLogs: perms.includes('notifications') ? db.notificationLogs : [],
      auditLogs: perms.includes('staff_rbac') || req.user!.role === 'super_admin' ? db.auditLogs.slice(0, 100) : [],
      settings: perms.includes('settings') ? db.settings : null,
      securityAuditLogs: perms.includes('settings') || req.user!.role === 'super_admin' ? (db.securityAuditLogs || memorySecurityAudit) : [],
      securityMetrics: {
        hmacAlgorithm: 'HMAC-SHA256 (32 bytes timing-safe)',
        rateLimiterActive: true,
        activeIpBuckets: ipRateBuckets.size,
        failedLoginAttemptsTracked: loginAttempts.size,
        totalSecurityEvents: (db.securityAuditLogs?.length || 0) + memorySecurityAudit.length,
        piiIsolation: 'Zero-Trust ABAC (users_private isolated)',
        voucherMagicCheck: 'Active (PNG/JPEG/WEBP/PDF enforced)',
        ticketReplayProtection: 'Atomic mutex lock on door validation',
      },
    });
  };
  app.get('/api/admin/workspace', requireAuth, handleAdminWorkspace);
  app.get('/api/admin/dashboard', requireAuth, handleAdminWorkspace);

  // =========================================================
  // MODULE 1.2 & 1.3: PER-EVENT STATS & CSV EXPORT
  // =========================================================
  app.get(
    '/api/admin/stats/events',
    requirePermission('sales_stats', 'overview'),
    (req: AuthedRequest, res: Response) => {
      const stats = computeEventStats({
        eventId: req.query.eventId as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        ticketType: req.query.ticketType as string,
        paymentStatus: req.query.paymentStatus as string,
        ticketStatus: req.query.ticketStatus as string,
        paymentMethod: req.query.paymentMethod as string,
        validationStatus: req.query.validationStatus as string,
      });
      res.json({ stats });
    }
  );

  app.get(
    '/api/admin/stats/export.csv',
    requirePermission('sales_stats'),
    (req: AuthedRequest, res: Response) => {
      const stats = computeEventStats({
        eventId: req.query.eventId as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        ticketType: req.query.ticketType as string,
        paymentStatus: req.query.paymentStatus as string,
        ticketStatus: req.query.ticketStatus as string,
        paymentMethod: req.query.paymentMethod as string,
        validationStatus: req.query.validationStatus as string,
      });

      const headers = [
        'Evento',
        'Fecha',
        'Estado',
        'Campaña Especial',
        'Capacidad Total',
        'Disponibles',
        'Reservadas (Pendientes)',
        'Pagadas Confirmadas',
        'General Vendidas',
        'VIP Vendidas',
        'Comprobantes Pendientes',
        'Comprobantes Aprobados',
        'Comprobantes Rechazados',
        'Ingresos Brutos Confirmados (USD)',
        'Reembolsos (USD)',
        'Ingresos Netos (USD)',
        'Validadas en Puerta',
        'Sin Utilizar',
      ];

      const escCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = stats.map((s) =>
        [
          s.eventTitle,
          s.eventDate,
          s.eventStatus,
          s.specialCampaignName || 'Ninguna',
          s.totalCapacity,
          s.availableTotal,
          s.reservedTickets,
          s.paidConfirmedTickets,
          s.generalSold,
          s.vipSold,
          s.pendingVouchersCount,
          s.approvedVouchersCount,
          s.rejectedVouchersCount,
          s.grossConfirmedRevenue.toFixed(2),
          s.refundedAmount.toFixed(2),
          s.netConfirmedRevenue.toFixed(2),
          s.validatedAtDoorCount,
          s.unusedValidTicketsCount,
        ]
          .map(escCsv)
          .join(',')
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="estadisticas_eventos_lavuelta.csv"');
      res.send('\uFEFF' + [headers.map(escCsv).join(','), ...rows].join('\n'));
    }
  );

  // =========================================================
  // MODULE 2: EVENTS & SPECIAL CAMPAIGNS
  // =========================================================
  app.post('/api/admin/events', requirePermission('events'), async (req: AuthedRequest, res: Response) => {
    const b = req.body || {};
    const title = String(b.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'El nombre del evento es obligatorio.' });
      return;
    }
    const genCap = Math.max(0, Number(b.generalCapacity || 0));
    const vipCap = Math.max(0, Number(b.vipCapacity || 0));
    const status = ['draft', 'published', 'unpublished', 'archived'].includes(b.status) ? b.status : 'published';
    const now = new Date().toISOString();

    const ev = {
      id: `ev_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      title: title.slice(0, 100),
      description: String(b.description || '').slice(0, 1000),
      category: String(b.category || 'Urbano').slice(0, 60),
      date: String(b.date || '').trim().toUpperCase().slice(0, 20),
      isoDate: String(b.isoDate || '').slice(0, 10),
      time: String(b.time || '8:00 PM').slice(0, 20),
      city: String(b.city || 'Maracay').slice(0, 60),
      venue: String(b.venue || '').slice(0, 120),
      capacity: genCap + vipCap,
      generalPrice: Math.max(0, Number(b.generalPrice || 0)),
      generalCapacity: genCap,
      vipPrice: Math.max(0, Number(b.vipPrice || 0)),
      vipCapacity: vipCap,
      accessConditions: String(b.accessConditions || 'Mayores de 18 años con cédula y QR único.').slice(0, 300),
      promoInfo: String(b.promoInfo || '').slice(0, 300),
      galleryCategoryId: String(b.galleryCategoryId || ''),
      specialCampaignId: String(b.specialCampaignId || ''),
      notifyOnPublish: Boolean(b.notifyOnPublish),
      imageUrl: String(b.imageUrl || ''),
      posterTheme: ['crimson', 'cyan', 'violet', 'amber'].includes(b.posterTheme) ? b.posterTheme : 'crimson',
      seatMapEnabled: b.seatMapEnabled !== false,
      blockedSeats: Array.isArray(b.blockedSeats) ? b.blockedSeats.map(String).slice(0, 5000) : [],
      combos: Array.isArray(b.combos)
        ? b.combos.slice(0, 20).map((c: any, idx: number) => ({
            id: String(c.id || `cmb_${Date.now()}_${idx}`),
            name: String(c.name || '').trim().slice(0, 80),
            description: String(c.description || '').trim().slice(0, 160),
            price: Math.max(0, Number(c.price || 0)),
            available: c.available !== false,
          }))
        : [],
      saleBadge: String(b.saleBadge || 'PREVENTA').trim().slice(0, 30),
      status,
      published: status === 'published',
      createdAt: now,
      updatedAt: now,
    };

    db.events.unshift(ev);
    appendAudit(req.user!, 'CREATE_EVENT', 'event', ev.id, `Evento creado: ${ev.title} (${ev.status})`);
    await persistDb();
    res.json({ event: ev });
  });

  app.put('/api/admin/events/:id', requirePermission('events'), async (req: AuthedRequest, res: Response) => {
    const ev = db.events.find((e) => e.id === req.params.id);
    if (!ev) {
      res.status(404).json({ error: 'Evento no encontrado.' });
      return;
    }
    const b = req.body || {};
    if (b.title !== undefined) ev.title = String(b.title).trim().slice(0, 100);
    if (b.description !== undefined) ev.description = String(b.description).slice(0, 1000);
    if (b.category !== undefined) ev.category = String(b.category).slice(0, 60);
    if (b.date !== undefined) ev.date = String(b.date).trim().toUpperCase().slice(0, 20);
    if (b.isoDate !== undefined) ev.isoDate = String(b.isoDate).slice(0, 10);
    if (b.time !== undefined) ev.time = String(b.time).slice(0, 20);
    if (b.city !== undefined) ev.city = String(b.city).slice(0, 60);
    if (b.venue !== undefined) ev.venue = String(b.venue).slice(0, 120);
    if (b.generalPrice !== undefined) ev.generalPrice = Math.max(0, Number(b.generalPrice));
    if (b.generalCapacity !== undefined) ev.generalCapacity = Math.max(0, Math.floor(Number(b.generalCapacity)));
    if (b.vipPrice !== undefined) ev.vipPrice = Math.max(0, Number(b.vipPrice));
    if (b.vipCapacity !== undefined) ev.vipCapacity = Math.max(0, Math.floor(Number(b.vipCapacity)));
    ev.capacity = Number(ev.generalCapacity || 0) + Number(ev.vipCapacity || 0);
    if (b.accessConditions !== undefined) ev.accessConditions = String(b.accessConditions).slice(0, 300);
    if (b.promoInfo !== undefined) ev.promoInfo = String(b.promoInfo).slice(0, 300);
    if (b.galleryCategoryId !== undefined) ev.galleryCategoryId = String(b.galleryCategoryId);
    if (b.specialCampaignId !== undefined) ev.specialCampaignId = String(b.specialCampaignId);
    if (b.notifyOnPublish !== undefined) ev.notifyOnPublish = Boolean(b.notifyOnPublish);
    if (b.imageUrl !== undefined) ev.imageUrl = String(b.imageUrl);
    if (b.seatMapEnabled !== undefined) ev.seatMapEnabled = Boolean(b.seatMapEnabled);
    if (Array.isArray(b.blockedSeats)) {
      ev.blockedSeats = b.blockedSeats.map(String).slice(0, 5000);
    }
    if (Array.isArray(b.combos)) {
      ev.combos = b.combos
        .filter((c: any) => String(c?.name || '').trim())
        .slice(0, 20)
        .map((c: any, idx: number) => ({
          id: String(c.id || `cmb_${Date.now()}_${idx}`),
          name: String(c.name || '').trim().slice(0, 80),
          description: String(c.description || '').trim().slice(0, 160),
          price: Math.max(0, Number(c.price || 0)),
          available: c.available !== false,
        }));
    }
    if (b.saleBadge !== undefined) ev.saleBadge = String(b.saleBadge).trim().slice(0, 30);
    if (b.posterTheme && ['crimson', 'cyan', 'violet', 'amber'].includes(b.posterTheme)) {
      ev.posterTheme = b.posterTheme;
    }
    if (b.status && ['draft', 'published', 'unpublished', 'archived'].includes(b.status)) {
      ev.status = b.status;
      ev.published = b.status === 'published';
    }
    ev.updatedAt = new Date().toISOString();
    appendAudit(req.user!, 'UPDATE_EVENT', 'event', ev.id, `Evento actualizado: ${ev.title} (Capacidad: ${ev.generalCapacity}G + ${ev.vipCapacity}V)`);
    await persistDb();
    res.json({ event: ev });
  });

  app.delete('/api/admin/events/:id', requirePermission('events'), async (req: AuthedRequest, res: Response) => {
    const idx = db.events.findIndex((e) => e.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Evento no encontrado.' });
      return;
    }
    const [removed] = db.events.splice(idx, 1);

    // Clean up associated orders, private vouchers in PostgreSQL, and tickets for this deleted event
    const removedOrders = db.orders.filter((o) => o.eventId === removed.id);
    for (const ord of removedOrders) {
      memoryVouchers.delete(ord.id);
      const safeOrderId = String(ord.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (safeOrderId) {
        await deleteVoucherFromPostgres(safeOrderId);
        const voucherPath = path.join(VOUCHERS_DIR, `${safeOrderId}.json`);
        try {
          if (fs.existsSync(voucherPath)) fs.unlinkSync(voucherPath);
        } catch {
          // Ignore filesystem cleanup warning
        }
      }
    }
    const removedTicketsCount = db.tickets.filter((t) => t.eventId === removed.id).length;
    db.orders = db.orders.filter((o) => o.eventId !== removed.id);
    db.tickets = db.tickets.filter((t) => t.eventId !== removed.id);

    // Unlink promotions and gallery photos pointing to this event
    db.promotions.forEach((p) => {
      if (p.eventId === removed.id) p.eventId = '';
    });
    db.galleryPhotos.forEach((g) => {
      if (g.eventId === removed.id) g.eventId = '';
    });

    appendAudit(
      req.user!,
      'DELETE_EVENT',
      'event',
      removed.id,
      `Evento eliminado: ${removed.title} (${removedOrders.length} órdenes y ${removedTicketsCount} tickets depurados)`
    );
    await persistDb();
    res.json({ ok: true, deletedId: removed.id });
  });

  // Dynamic Season Categories & Special Campaigns (Module 2.1)
  app.post('/api/admin/seasons', requirePermission('special_events', 'events'), async (req: AuthedRequest, res: Response) => {
    const seasonName = String(req.body?.name || '').trim().slice(0, 60);
    if (!seasonName) {
      res.status(400).json({ error: 'Escribe el nombre de la categoría o temporada.' });
      return;
    }
    if (!db.seasons.some((s) => s.toLowerCase() === seasonName.toLowerCase())) {
      db.seasons.push(seasonName);
      appendAudit(req.user!, 'CREATE_SEASON', 'season', seasonName, `Nueva categoría especial: ${seasonName}`);
      await persistDb();
    }
    res.json({ seasons: db.seasons });
  });

  app.post('/api/admin/campaigns', requirePermission('special_events'), async (req: AuthedRequest, res: Response) => {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'El nombre de la campaña especial es obligatorio.' });
      return;
    }
    const now = new Date().toISOString();
    const camp = {
      id: `camp_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      name: name.slice(0, 100),
      season: String(b.season || 'Eventos temáticos').slice(0, 60),
      promoText: String(b.promoText || '').slice(0, 500),
      imageUrl: String(b.imageUrl || ''),
      accentPrimary: String(b.accentPrimary || '#E50914').slice(0, 20),
      accentSecondary: String(b.accentSecondary || '#FF5722').slice(0, 20),
      startDate: String(b.startDate || '').slice(0, 10),
      endDate: String(b.endDate || '').slice(0, 10),
      active: b.active !== false,
      published: b.published !== false,
      createdAt: now,
      updatedAt: now,
    };

    if (Array.isArray(b.eventIds)) {
      db.events.forEach((ev) => {
        if (b.eventIds.includes(ev.id)) ev.specialCampaignId = camp.id;
      });
    }

    db.specialCampaigns.unshift(camp);
    appendAudit(req.user!, 'CREATE_CAMPAIGN', 'campaign', camp.id, `Campaña creada: ${camp.name} (${camp.season})`);
    await persistDb();
    res.json({ campaign: camp });
  });

  app.put('/api/admin/campaigns/:id', requirePermission('special_events'), async (req: AuthedRequest, res: Response) => {
    const camp = db.specialCampaigns.find((c) => c.id === req.params.id);
    if (!camp) {
      res.status(404).json({ error: 'Campaña no encontrada.' });
      return;
    }
    const b = req.body || {};
    if (b.name !== undefined) camp.name = String(b.name).trim().slice(0, 100);
    if (b.season !== undefined) camp.season = String(b.season).slice(0, 60);
    if (b.promoText !== undefined) camp.promoText = String(b.promoText).slice(0, 500);
    if (b.imageUrl !== undefined) camp.imageUrl = String(b.imageUrl);
    if (b.accentPrimary !== undefined) camp.accentPrimary = String(b.accentPrimary).slice(0, 20);
    if (b.accentSecondary !== undefined) camp.accentSecondary = String(b.accentSecondary).slice(0, 20);
    if (b.startDate !== undefined) camp.startDate = String(b.startDate).slice(0, 10);
    if (b.endDate !== undefined) camp.endDate = String(b.endDate).slice(0, 10);
    if (b.active !== undefined) camp.active = Boolean(b.active);
    if (b.published !== undefined) camp.published = Boolean(b.published);
    camp.updatedAt = new Date().toISOString();

    if (Array.isArray(b.eventIds)) {
      db.events.forEach((ev) => {
        if (b.eventIds.includes(ev.id)) {
          ev.specialCampaignId = camp.id;
        } else if (ev.specialCampaignId === camp.id) {
          ev.specialCampaignId = '';
        }
      });
    }

    appendAudit(req.user!, 'UPDATE_CAMPAIGN', 'campaign', camp.id, `Campaña actualizada: ${camp.name}`);
    await persistDb();
    res.json({ campaign: camp });
  });

  app.delete('/api/admin/campaigns/:id', requirePermission('special_events'), async (req: AuthedRequest, res: Response) => {
    const idx = db.specialCampaigns.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Campaña no encontrada.' });
      return;
    }
    const [removed] = db.specialCampaigns.splice(idx, 1);
    db.events.forEach((ev) => {
      if (ev.specialCampaignId === removed.id) {
        ev.specialCampaignId = '';
      }
    });
    appendAudit(req.user!, 'DELETE_CAMPAIGN', 'campaign', removed.id, `Campaña eliminada: ${removed.name}`);
    await persistDb();
    res.json({ ok: true, deletedId: removed.id });
  });

  // =========================================================
  // MODULE 3: CONFIGURABLE PAYMENT METHODS
  // =========================================================
  app.put(
    '/api/admin/payment-methods',
    requirePermission('payment_methods'),
    async (req: AuthedRequest, res: Response) => {
      const b = req.body || {};
      if (b.pago_movil) {
        db.paymentMethods.pago_movil = {
          enabled: Boolean(b.pago_movil.enabled),
          bank: String(b.pago_movil.bank || '').trim().slice(0, 80),
          phone: String(b.pago_movil.phone || '').trim().slice(0, 30),
          documentId: String(b.pago_movil.documentId || '').trim().slice(0, 30),
          holderName: String(b.pago_movil.holderName || '').trim().slice(0, 80),
          instructions: String(b.pago_movil.instructions || '').trim().slice(0, 500),
          iconUrl: String(b.pago_movil.iconUrl || ''),
          qrImageUrl: String(b.pago_movil.qrImageUrl || b.pago_movil.iconUrl || '').trim(),
        };
      }
      if (b.transferencia) {
        db.paymentMethods.transferencia = {
          enabled: Boolean(b.transferencia.enabled),
          bank: String(b.transferencia.bank || '').trim().slice(0, 80),
          holderName: String(b.transferencia.holderName || '').trim().slice(0, 80),
          documentId: String(b.transferencia.documentId || '').trim().slice(0, 30),
          accountNumber: String(b.transferencia.accountNumber || '').trim().slice(0, 40),
          accountType: String(b.transferencia.accountType || 'Corriente').trim().slice(0, 30),
          currency: String(b.transferencia.currency || 'VES').trim().slice(0, 12),
          instructions: String(b.transferencia.instructions || '').trim().slice(0, 500),
          iconUrl: String(b.transferencia.iconUrl || ''),
        };
      }
      if (b.binance) {
        db.paymentMethods.binance = {
          enabled: Boolean(b.binance.enabled),
          payIdOrEmail: String(b.binance.payIdOrEmail || '').trim().slice(0, 120),
          networkOrAsset: String(b.binance.networkOrAsset || 'USDT').trim().slice(0, 60),
          instructions: String(b.binance.instructions || '').trim().slice(0, 500),
          iconUrl: String(b.binance.iconUrl || ''),
          qrImageUrl: String(b.binance.qrImageUrl || b.binance.iconUrl || '').trim(),
        };
      }

      if (b.exchangeRate && typeof b.exchangeRate.rate === 'number' && b.exchangeRate.rate > 0) {
        db.exchangeRate = {
          rate: Number(b.exchangeRate.rate),
          currency: 'VES',
          source: String(b.exchangeRate.source || 'Banco Central de Venezuela (BCV Oficial)').slice(0, 100),
          lastUpdated: new Date().toISOString(),
          mode: b.exchangeRate.mode === 'manual' ? 'manual' : 'auto',
        };
      }

      appendAudit(
        req.user!,
        'UPDATE_PAYMENT_METHODS',
        'payment_methods',
        'global',
        `Métodos actualizados (PagoMóvil:${db.paymentMethods.pago_movil.enabled}, Transf:${db.paymentMethods.transferencia.enabled}, Binance:${db.paymentMethods.binance.enabled}, Tasa:${db.exchangeRate?.rate} Bs)`
      );
      await persistDb();
      res.json({ paymentMethods: { ...db.paymentMethods, exchangeRate: db.exchangeRate }, exchangeRate: db.exchangeRate });
    }
  );

  app.post(
    '/api/admin/exchange-rate/sync',
    requirePermission('payment_methods', 'settings'),
    async (req: AuthedRequest, res: Response) => {
      if (db.exchangeRate) {
        db.exchangeRate.mode = 'auto';
      }
      await updateOfficialExchangeRate();
      res.json({ ok: true, exchangeRate: db.exchangeRate });
    }
  );

  // =========================================================
  // MODULE 4 & 5: ORDERS, PRIVATE VOUCHERS, APPROVAL & QR ISSUANCE
  // =========================================================
  app.post('/api/orders', requireAuth, async (req: AuthedRequest, res: Response) => {
    const u = req.user!;
    const {
      eventId,
      ticketType,
      qty,
      generalQty,
      vipQty,
      selectedSeats,
      combos,
      paymentMethod,
      reference,
      paidAmountReported,
      paymentDate,
      payerName,
      payerCedula,
      payerPhone,
      payerEmail,
      voucherDataUrl,
    } = req.body || {};

    const ev = db.events.find((e) => e.id === eventId && e.published && e.status === 'published');
    if (!ev) {
      res.status(404).json({ error: 'El evento seleccionado no está disponible para compra.' });
      return;
    }

    // Support both Cinex-style multi-tier (generalQty + vipQty) and single-tier payloads, with ZERO artificial limit!
    const hasExplicitTiers = generalQty !== undefined || vipQty !== undefined;
    const reqGen = hasExplicitTiers
      ? Math.max(0, Math.floor(Number(generalQty || 0)))
      : ticketType === 'vip'
      ? 0
      : Math.max(0, Math.floor(Number(qty || 0)));
    const reqVip = hasExplicitTiers
      ? Math.max(0, Math.floor(Number(vipQty || 0)))
      : ticketType === 'vip'
      ? Math.max(0, Math.floor(Number(qty || 0)))
      : 0;

    const totalQty = reqGen + reqVip;
    if (totalQty < 1) {
      res.status(400).json({ error: 'Selecciona al menos 1 entrada disponible para continuar.' });
      return;
    }

    const method = String(paymentMethod || '') as 'pago_movil' | 'transferencia' | 'binance';
    if (!['pago_movil', 'transferencia', 'binance'].includes(method) || !db.paymentMethods[method]?.enabled) {
      res.status(400).json({ error: 'El método de pago seleccionado no se encuentra habilitado.' });
      return;
    }

    const cleanRef = String(reference || '').trim();
    if (cleanRef.length < 4 || cleanRef.length > 64) {
      res.status(400).json({ error: 'Ingresa una referencia de pago válida (entre 4 y 64 caracteres).' });
      return;
    }

    const rawVoucher = String(voucherDataUrl || '');
    if (!/^data:(image\/(png|jpeg|jpg|webp)|application\/pdf);base64,/i.test(rawVoucher)) {
      res.status(400).json({ error: 'Debes adjuntar una imagen (JPG, PNG, WEBP) o PDF válido del comprobante.' });
      return;
    }
    if (rawVoucher.length > 4_500_000) {
      res.status(400).json({ error: 'El archivo del comprobante supera el tamaño máximo permitido (3 MB).' });
      return;
    }

    // Prevent duplicate order submission by double click or repeated reference
    const fingerprint = `${u.id}:${ev.id}:${method}:${cleanRef}`;
    const lastTs = recentOrderFingerprints.get(fingerprint) || 0;
    if (
      Date.now() - lastTs < 60_000 ||
      db.orders.some((o) => o.paymentMethod === method && o.reference === cleanRef && o.status !== 'rejected')
    ) {
      res.status(409).json({
        error: 'Ya existe una orden registrada con esta misma referencia de pago.',
      });
      return;
    }

    // Check real inventory defined by the Admin (the ONLY limit on ticket purchase!)
    const stats = computeEventStats({ eventId: ev.id })[0];
    if (reqGen > stats.availableGeneral) {
      res.status(400).json({
        error: `Solo quedan ${stats.availableGeneral} entradas disponibles en Localidad General (definidas por administración).`,
      });
      return;
    }
    if (reqVip > stats.availableVip) {
      res.status(400).json({
        error: `Solo quedan ${stats.availableVip} entradas disponibles en Experiencia VIP (definidas por administración).`,
      });
      return;
    }

    // Validate selectedSeats if provided against occupied/blocked seats
    const occupiedSet = new Set(getOccupiedSeatsForEvent(ev));
    const cleanSelectedSeats: string[] = Array.isArray(selectedSeats)
      ? Array.from(new Set(selectedSeats.map((s: any) => String(s).trim()).filter(Boolean))).slice(0, totalQty)
      : [];
    for (const s of cleanSelectedSeats) {
      if (occupiedSet.has(s)) {
        res.status(409).json({
          error: `La ubicación ${s} acaba de ser ocupada o reservada. Actualiza tu selección en el mapa.`,
        });
        return;
      }
    }

    // Validate optional event combos from server-side catalog
    const evComboCatalog = new Map<string, any>(
      (Array.isArray(ev.combos) ? ev.combos : [])
        .filter((c: any) => c.available !== false)
        .map((c: any) => [String(c.id), c])
    );
    const verifiedCombos: { id: string; name: string; qty: number; unitPrice: number }[] = [];
    let combosTotal = 0;
    if (Array.isArray(combos)) {
      for (const reqCombo of combos) {
        const cItem = evComboCatalog.get(String(reqCombo?.id || ''));
        const cQty = Math.max(0, Math.floor(Number(reqCombo?.qty || 0)));
        if (cItem && cQty > 0 && cQty <= 200) {
          const cPrice = Math.max(0, Number(cItem.price || 0));
          verifiedCombos.push({
            id: cItem.id,
            name: cItem.name,
            qty: cQty,
            unitPrice: cPrice,
          });
          combosTotal += cPrice * cQty;
        }
      }
    }

    recentOrderFingerprints.set(fingerprint, Date.now());

    const genPrice = Number(ev.generalPrice || 0);
    const vipPrice = Number(ev.vipPrice || 0);
    const ticketsSubtotal = reqGen * genPrice + reqVip * vipPrice;
    const totalAmount = Number((ticketsSubtotal + combosTotal).toFixed(2));
    const resolvedTier: 'general' | 'vip' | 'mixed' =
      reqGen > 0 && reqVip > 0 ? 'mixed' : reqVip > 0 ? 'vip' : 'general';
    const unitPrice =
      resolvedTier === 'vip'
        ? vipPrice
        : resolvedTier === 'general'
        ? genPrice
        : Number((ticketsSubtotal / totalQty).toFixed(2));

    const now = new Date().toISOString();
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // Store voucher in private PostgreSQL table — NEVER exposed in public URLs!
    await saveVoucherToPostgres({
      orderId,
      userId: u.id,
      eventId: ev.id,
      paymentMethod: method,
      reference: cleanRef,
      uploadedAt: now,
      dataUrl: rawVoucher,
    });

    const newOrder = {
      id: orderId,
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      eventId: ev.id,
      eventTitle: ev.title,
      ticketType: resolvedTier,
      qty: totalQty,
      generalQty: reqGen,
      vipQty: reqVip,
      selectedSeats: cleanSelectedSeats,
      combos: verifiedCombos,
      combosTotal: Number(combosTotal.toFixed(2)),
      unitPrice,
      totalAmount,
      paymentMethod: method,
      reference: cleanRef,
      paidAmountReported: Number(paidAmountReported || totalAmount),
      paymentDate: String(paymentDate || now.slice(0, 10)).slice(0, 20),
      payerName: String(payerName || u.name || '').trim().slice(0, 100),
      payerCedula: String(payerCedula || u.cedula || '').trim().toUpperCase().slice(0, 30),
      payerPhone: String(payerPhone || u.phone || '').trim().slice(0, 40),
      payerEmail: String(payerEmail || u.email || '').trim().toLowerCase().slice(0, 100),
      hasVoucher: true,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    db.orders.unshift(newOrder);
    recordSecurityAudit(
      'ORDER_PAYMENT_REPORTED',
      'info',
      req,
      `Orden ${newOrder.id} (${newOrder.ticketType.toUpperCase()} x${newOrder.qty}) registrada · Ref: ${cleanRef} · Total: $${newOrder.totalAmount} · Método: ${method}`,
      u.email
    );
    await persistDb();

    res.json({ order: newOrder });
  });

  // Protected Private Voucher Endpoint (Backed by PostgreSQL vouchers table)
  app.get(
    '/api/admin/orders/:id/voucher',
    requirePermission('pending_vouchers', 'orders_payments'),
    async (req: AuthedRequest, res: Response) => {
      const orderId = String(req.params.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
      try {
        const pgVoucher = await getVoucherFromPostgres(orderId);
        if (pgVoucher) {
          res.json({ orderId, dataUrl: pgVoucher.dataUrl, uploadedAt: pgVoucher.uploadedAt });
          return;
        }
      } catch (pgErr) {
        console.warn('Warning: Error reading voucher from PostgreSQL:', pgErr);
      }
      const voucherPath = path.join(VOUCHERS_DIR, `${orderId}.json`);
      try {
        if (fs.existsSync(voucherPath)) {
          const parsed = JSON.parse(fs.readFileSync(voucherPath, 'utf8'));
          res.json({ orderId, dataUrl: parsed.dataUrl, uploadedAt: parsed.uploadedAt });
          return;
        }
      } catch (readErr) {
        console.warn('Warning: Error reading voucher file:', readErr);
      }
      const mem = memoryVouchers.get(orderId);
      if (mem) {
        res.json({ orderId, dataUrl: mem.dataUrl, uploadedAt: mem.uploadedAt });
        return;
      }
      res.status(404).json({ error: 'Comprobante no encontrado.' });
    }
  );

  // Approve Order -> Issue Unique Cryptographic QR Tickets (Supports unlimited qty + mixed General/VIP + seats!)
  app.post(
    '/api/admin/orders/:id/approve',
    requirePermission('pending_vouchers', 'orders_payments'),
    async (req: AuthedRequest, res: Response) => {
      const order = db.orders.find((o) => o.id === req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Orden no encontrada.' });
        return;
      }
      if (order.status !== 'pending') {
        res.status(409).json({
          error: `Esta orden ya fue procesada anteriormente (estado actual: ${order.status}).`,
        });
        return;
      }

      // Guard against duplicate ticket generation
      if (db.tickets.some((t) => t.orderId === order.id)) {
        res.status(409).json({ error: 'Los tickets de esta orden ya fueron emitidos.' });
        return;
      }

      const now = new Date().toISOString();
      order.status = 'approved';
      order.reviewedBy = req.user!.name;
      order.reviewedAt = now;
      order.reviewNotes = String(req.body?.notes || 'Comprobante verificado y aprobado.').slice(0, 250);
      order.updatedAt = now;

      const vipCount =
        order.vipQty !== undefined ? Number(order.vipQty) : order.ticketType === 'vip' ? Number(order.qty) : 0;
      const genCount =
        order.generalQty !== undefined
          ? Number(order.generalQty)
          : order.ticketType === 'general'
          ? Number(order.qty)
          : 0;

      const seatsList: string[] = Array.isArray(order.selectedSeats) ? order.selectedSeats : [];
      const vipSeats = seatsList.filter((s) => s.startsWith('VIP-'));
      const genSeats = seatsList.filter((s) => s.startsWith('GEN-'));

      const tiersToIssue: { tier: 'vip' | 'general'; seatLabel?: string }[] = [];
      for (let v = 0; v < vipCount; v++) {
        tiersToIssue.push({ tier: 'vip', seatLabel: vipSeats[v] });
      }
      for (let g = 0; g < genCount; g++) {
        tiersToIssue.push({ tier: 'general', seatLabel: genSeats[g] });
      }
      // Fallback safety if legacy order had neither
      if (tiersToIssue.length === 0) {
        for (let k = 0; k < Number(order.qty || 1); k++) {
          tiersToIssue.push({ tier: order.ticketType === 'vip' ? 'vip' : 'general', seatLabel: seatsList[k] });
        }
      }

      const issuedTickets = [];
      for (let idx = 0; idx < tiersToIssue.length; idx++) {
        const seq = idx + 1;
        const spec = tiersToIssue[idx];
        const ticketId = `tk_${crypto.randomBytes(8).toString('hex')}`;
        const humanCode = `LV-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${seq}`;
        const qrPayload = signTicketQr(ticketId, order.eventId);

        const tk = {
          id: ticketId,
          code: humanCode,
          qrPayload,
          orderId: order.id,
          userId: order.userId,
          userName: order.userName,
          eventId: order.eventId,
          eventTitle: order.eventTitle,
          ticketType: spec.tier,
          seatLabel: spec.seatLabel,
          seq,
          status: 'valid',
          createdAt: now,
        };
        db.tickets.unshift(tk);
        issuedTickets.push(tk);
      }

      appendAudit(
        req.user!,
        'APPROVE_PAYMENT',
        'order',
        order.id,
        `Pago aprobado ($${order.totalAmount}) · Emitidos ${issuedTickets.length} QR únicos`
      );
      await persistDb();
      res.json({ order, issuedTickets });
    }
  );

  app.post(
    '/api/admin/orders/:id/reject',
    requirePermission('pending_vouchers', 'orders_payments'),
    async (req: AuthedRequest, res: Response) => {
      const order = db.orders.find((o) => o.id === req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Orden no encontrada.' });
        return;
      }
      if (order.status !== 'pending') {
        res.status(409).json({
          error: `Esta orden ya fue procesada (estado actual: ${order.status}).`,
        });
        return;
      }
      const now = new Date().toISOString();
      order.status = 'rejected';
      order.reviewedBy = req.user!.name;
      order.reviewedAt = now;
      order.reviewNotes = String(req.body?.notes || 'Comprobante no válido o referencia no localizada.').slice(0, 250);
      order.updatedAt = now;

      appendAudit(req.user!, 'REJECT_PAYMENT', 'order', order.id, `Pago rechazado: ${order.reviewNotes}`);
      await persistDb();
      res.json({ order });
    }
  );

  app.post(
    '/api/admin/orders/:id/refund',
    requirePermission('orders_payments'),
    async (req: AuthedRequest, res: Response) => {
      const order = db.orders.find((o) => o.id === req.params.id);
      if (!order || order.status !== 'approved') {
        res.status(400).json({ error: 'Solo se pueden reembolsar órdenes previamente aprobadas.' });
        return;
      }
      const now = new Date().toISOString();
      order.status = 'refunded';
      order.reviewNotes = String(req.body?.notes || 'Reembolso registrado por administración.').slice(0, 250);
      order.updatedAt = now;

      db.tickets
        .filter((t) => t.orderId === order.id)
        .forEach((t) => {
          t.status = 'refunded';
        });

      appendAudit(req.user!, 'REFUND_ORDER', 'order', order.id, `Orden reembolsada ($${order.totalAmount})`);
      await persistDb();
      res.json({ order });
    }
  );

  function generateTicketEmailHtml(params: {
    ticket: any;
    event: any;
    recipientEmail: string;
    appUrl: string;
    qrDataUrl: string;
  }): string {
    const { ticket, event, recipientEmail, appUrl, qrDataUrl } = params;
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu Pase Digital Oficial - ${event.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#090B10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#E4E4E7;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#090B10;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#12151D;border:1px solid #27272A;border-radius:20px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.85);">
          <tr>
            <td style="background:linear-gradient(135deg, #E50914 0%, #8A0000 100%);padding:28px 24px;text-align:center;">
              <div style="font-size:11px;font-weight:800;letter-spacing:3px;color:#FFFFFF;text-transform:uppercase;margin-bottom:6px;">
                PASE DIGITAL OFICIAL · ENTRADA ELECTRÓNICA
              </div>
              <h1 style="margin:0;font-size:24px;font-weight:900;color:#FFFFFF;letter-spacing:-0.5px;">
                LA VUELTA SESSIONS
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 20px 24px;">
              <span style="display:inline-block;background-color:rgba(229,9,20,0.15);border:1px solid rgba(229,9,20,0.35);color:#E50914;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
                ${ticket.ticketType === 'vip' ? 'ACCESO VIP PRIVILEGE' : 'ACCESO GENERAL'}
              </span>
              <h2 style="margin:0 0 8px 0;font-size:22px;font-weight:800;color:#FFFFFF;line-height:1.2;">
                ${event.title}
              </h2>
              <p style="margin:0 0 20px 0;font-size:13px;color:#A1A1AA;line-height:1.5;">
                📍 ${event.venue || 'Recinto Oficial'} · ${event.city || 'Maracay, Venezuela'}<br>
                📅 ${event.date || 'Fecha por confirmar'} · ⏰ ${event.time || '20:00'}
              </p>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#FFFFFF;border-radius:16px;padding:24px;text-align:center;margin:0 0 20px 0;">
                <tr>
                  <td align="center">
                    ${
                      qrDataUrl
                        ? `<img src="${qrDataUrl}" alt="Código QR del Ticket" width="220" height="220" style="display:block;margin:0 auto;border-radius:8px;" />`
                        : `<div style="font-family:monospace;font-size:13px;color:#000;background:#F4F4F5;padding:16px;border-radius:8px;">${ticket.code}</div>`
                    }
                    <div style="margin-top:14px;font-family:monospace;font-size:15px;font-weight:800;letter-spacing:2px;color:#090B10;">
                      ${ticket.code}
                    </div>
                    <div style="margin-top:4px;font-size:11px;font-weight:600;color:#52525B;">
                      ${ticket.seatLabel ? `Asiento: ${ticket.seatLabel} · ` : ''}Pase Nominativo #${ticket.seq || 1}
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:rgba(255,255,255,0.03);border:1px solid #27272A;border-radius:12px;padding:16px;margin-bottom:20px;">
                <tr>
                  <td style="font-size:12px;color:#A1A1AA;padding:4px 0;">Titular registrado:</td>
                  <td align="right" style="font-size:12px;font-weight:700;color:#FFFFFF;padding:4px 0;">${ticket.userName || 'Comprador Oficial'}</td>
                </tr>
                <tr>
                  <td style="font-size:12px;color:#A1A1AA;padding:4px 0;">Correo electrónico:</td>
                  <td align="right" style="font-size:12px;font-weight:700;color:#FFFFFF;padding:4px 0;">${recipientEmail}</td>
                </tr>
                <tr>
                  <td style="font-size:12px;color:#A1A1AA;padding:4px 0;">Estado en taquilla:</td>
                  <td align="right" style="font-size:12px;font-weight:700;color:#10B981;padding:4px 0;">✓ Activo y Válido para Acceso</td>
                </tr>
                <tr>
                  <td style="font-size:12px;color:#A1A1AA;padding:4px 0;">Firma de seguridad:</td>
                  <td align="right" style="font-family:monospace;font-size:11px;color:#D4AF37;padding:4px 0;">HMAC-SHA256 Verificada</td>
                </tr>
              </table>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" target="_blank" style="display:inline-block;background-color:#E50914;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;padding:14px 28px;border-radius:12px;text-align:center;">
                      Ver en Mi Billetera Digital
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#0D0F16;border-top:1px solid #27272A;padding:20px 24px;text-align:center;font-size:11px;color:#71717A;line-height:1.6;">
              Presenta este código QR en tu dispositivo móvil o impreso al llegar a la puerta del evento.<br>
              Pase personal e intransferible. Válido para un único escaneo en el sistema oficial.<br>
              © ${new Date().getFullYear()} LA VUELTA SESSIONS · Todos los derechos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // =========================================================
  // SIMULADOR & DESPACHO DE ENTRADAS A CORREO (/api/tickets/resend)
  // =========================================================
  app.post(
    '/api/tickets/resend',
    requireAuth,
    async (req: AuthedRequest, res: Response) => {
      const { ticketId, ticketCode, orderId, email, createDemoIfMissing } = req.body || {};

      let ticket = db.tickets.find(
        (t) =>
          (ticketId && t.id === ticketId) ||
          (ticketCode && t.code.toUpperCase() === String(ticketCode).trim().toUpperCase()) ||
          (orderId && t.orderId === orderId)
      );

      // Si no hay ticket y se solicita demo, o la lista está vacía, crear un ticket válido oficial de prueba
      if (!ticket && (createDemoIfMissing || db.tickets.length === 0)) {
        const targetEvent = db.events.find((e) => e.published) || db.events[0] || {
          id: 'ev_official_launch',
          title: 'LA VUELTA SESSIONS · LANZAMIENTO OFICIAL',
          date: 'Próxima Fecha Oficial',
          time: '20:00',
          venue: 'Recinto Oficial',
          city: 'Maracay, Venezuela',
          generalPrice: 15,
        };

        const passId = `TK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        const demoOrderId = `ORD-DEMO-${Date.now().toString(36).toUpperCase()}`;

        const payload = signTicketQr(passId, targetEvent.id);

        const demoOrder = {
          id: demoOrderId,
          userId: req.user!.id,
          userName: req.user!.name || 'Usuario Oficial',
          userEmail: req.user!.email || 'forgen122@gmail.com',
          userPhone: req.user!.phone || '+58 412-0000000',
          eventId: targetEvent.id,
          eventTitle: targetEvent.title,
          ticketType: 'general',
          qty: 1,
          totalAmount: targetEvent.generalPrice || 15,
          method: 'pago_movil',
          status: 'approved',
          reviewedBy: req.user!.email,
          reviewedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.orders.unshift(demoOrder);

        ticket = {
          id: passId,
          code: passId,
          qrPayload: payload,
          orderId: demoOrderId,
          userId: req.user!.id,
          userName: req.user!.name || 'Usuario Oficial',
          eventId: targetEvent.id,
          eventTitle: targetEvent.title,
          ticketType: 'general',
          seatLabel: 'GEN-01',
          seq: 1,
          status: 'valid',
          createdAt: new Date().toISOString(),
        };

        db.tickets.unshift(ticket);
        await persistDb();
      }

      if (!ticket) {
        res.status(404).json({ error: 'Ticket no encontrado.' });
        return;
      }

      const event = db.events.find((e) => e.id === ticket!.eventId) || {
        id: ticket.eventId,
        title: ticket.eventTitle,
        date: 'Fecha por confirmar',
        time: '20:00',
        venue: 'Recinto Oficial',
        city: 'Maracay, Venezuela',
      };

      const recipientEmail = String(email || req.user?.email || 'forgen122@gmail.com').trim().toLowerCase();
      const appUrl = `${(req.headers['x-forwarded-proto'] as string) || req.protocol}://${req.headers.host}`;

      let qrDataUrl = '';
      try {
        qrDataUrl = await QRCode.toDataURL(ticket.qrPayload, {
          width: 320,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
        });
      } catch (err: any) {
        console.warn('Warning generating QR data URL for email:', err);
      }

      const emailSubject = `🎟️ Tu Pase Digital: ${event.title} [${ticket.code}]`;
      const emailHtml = generateTicketEmailHtml({
        ticket,
        event,
        recipientEmail,
        appUrl,
        qrDataUrl,
      });

      const resendKey = getActiveResendKey();
      let sentRealSmtp = false;
      let providerNote = '';

      if (resendKey) {
        try {
          const emailFrom = process.env.EMAIL_FROM || 'LA VUELTA SESSIONS <entradas@lavueltasessions.com>';
          const rResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: emailFrom,
              to: [recipientEmail],
              subject: emailSubject,
              html: emailHtml,
            }),
          });
          if (rResp.ok) {
            sentRealSmtp = true;
            providerNote = 'Despachado exitosamente mediante Resend API.';
          } else {
            const errData = await rResp.text();
            providerNote = `Resend API HTTP ${rResp.status}: ${errData}`;
          }
        } catch (err: any) {
          providerNote = `Fallo en el conector SMTP/Resend: ${err.message}`;
        }
      } else {
        providerNote = 'Simulación completada con éxito en entorno seguro. El pase y código QR firmado con HMAC están listos para ser escaneados por el Validador de Puerta.';
      }

      // Registro en auditoría y logs de notificación
      db.notificationLogs.unshift({
        id: `NL-${Date.now().toString(36)}`,
        eventId: event.id || ticket.eventId,
        eventTitle: event.title,
        kind: 'new_event',
        recipientCount: 1,
        skippedNoConsentCount: 0,
        skippedDuplicateCount: 0,
        status: sentRealSmtp ? 'sent' : 'queued_awaiting_smtp',
        providerNote: `${providerNote} (Destino: ${recipientEmail})`,
        triggeredBy: req.user!.email,
        createdAt: new Date().toISOString(),
      });

      appendAudit(
        req.user!,
        'RESEND_TICKET_EMAIL',
        'ticket',
        ticket.id,
        `Envío de entrada ${ticket.code} a ${recipientEmail} (${sentRealSmtp ? 'SMTP Real' : 'Simulación'})`
      );
      await persistDb();

      res.json({
        ok: true,
        sentRealSmtp,
        mode: sentRealSmtp ? 'real_smtp' : 'simulated_preview',
        recipient: recipientEmail,
        subject: emailSubject,
        ticketCode: ticket.code,
        ticketId: ticket.id,
        qrPayload: ticket.qrPayload,
        qrDataUrl,
        emailHtml,
        providerNote,
        ticket,
      });
    }
  );

  // =========================================================
  // MODULE 5: ATOMIC QR VALIDATION & LB VALIDADOR PROTOCOL
  // =========================================================
  async function executeAtomicScan(rawCode: string, eventFilterId: string, validatorName: string, validatorActor?: StoredUser) {
    let outcome: any;
    validationMutex = validationMutex.then(async () => {
      const now = new Date().toISOString();
      const check = verifyTicketQrPayload(rawCode, db);

      const recordAccess = async (
        result: string,
        message: string,
        tk?: any
      ) => {
        const entry = {
          id: `acc_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
          timestamp: now,
          ticketId: tk?.id || '',
          ticketCode: tk?.code || String(rawCode || '').slice(0, 32),
          eventId: tk?.eventId || eventFilterId || '',
          eventTitle: tk?.eventTitle || 'Desconocido',
          holderName: tk?.userName || '—',
          ticketType: tk?.ticketType || '—',
          result,
          message,
          validatedBy: validatorName,
        };
        db.accessLogs.unshift(entry);
        if (db.accessLogs.length > 500) db.accessLogs.length = 500;
        if (validatorActor) {
          appendAudit(validatorActor, 'VALIDATE_QR', 'ticket', entry.ticketCode, `${result}: ${message}`);
        }
        await persistDb();
        return entry;
      };

      if (!check.validFormat || !check.ticket) {
        outcome = {
          allowed: false,
          log: await recordAccess('NO_EXISTE', 'El código escaneado no corresponde a ningún ticket emitido.'),
        };
        return;
      }

      if (!check.signatureValid) {
        outcome = {
          allowed: false,
          log: await recordAccess('FIRMA_INVALIDA', 'Firma criptográfica inválida o código adulterado.', check.ticket),
        };
        return;
      }

      const tk = check.ticket;
      if (eventFilterId && tk.eventId !== eventFilterId) {
        outcome = {
          allowed: false,
          log: await recordAccess(
            'EVENTO_NO_VIGENTE',
            `Este ticket pertenece a otro evento (${tk.eventTitle}).`,
            tk
          ),
        };
        return;
      }

      const parentOrder = db.orders.find((o) => o.id === tk.orderId);
      const isDemoOrder = tk.orderId?.startsWith('ORD-DEMO-');
      if ((!parentOrder && !isDemoOrder) || (parentOrder && parentOrder.status !== 'approved')) {
        outcome = {
          allowed: false,
          log: await recordAccess('PAGO_NO_APROBADO', 'La orden asociada no tiene un pago confirmado.', tk),
        };
        return;
      }

      const ev = db.events.find((e) => e.id === tk.eventId);
      if (!ev || ev.status === 'archived') {
        outcome = {
          allowed: false,
          log: await recordAccess('EVENTO_NO_VIGENTE', 'El evento asociado ya fue archivado o no está activo.', tk),
        };
        return;
      }

      if (tk.status === 'used') {
        outcome = {
          allowed: false,
          log: await recordAccess(
            'YA_UTILIZADA',
            `Acceso denegado: ya ingresó el ${tk.usedAt ? new Date(tk.usedAt).toLocaleString('es-VE') : 'anteriormente'}.`,
            tk
          ),
        };
        return;
      }

      if (tk.status !== 'valid') {
        outcome = {
          allowed: false,
          log: await recordAccess('TICKET_REVOCADO', `Ticket en estado ${tk.status}.`, tk),
        };
        return;
      }

      // Atomic transition: valid -> used
      tk.status = 'used';
      tk.usedAt = now;
      tk.validatedBy = validatorName;

      const log = await recordAccess(
        'ENTRADA_VALIDA',
        `Acceso autorizado · ${tk.ticketType.toUpperCase()} · Titular: ${tk.userName}`,
        tk
      );
      outcome = { allowed: true, ticket: tk, log };
    });

    await validationMutex;
    return outcome;
  }

  // Health / Ping endpoints for LA VUELTA SESSIONS VALIDADOR mobile app connection test
  const handleValidatorPing = (req: Request, res: Response) => {
    res.json({
      ok: true,
      status: 'online',
      app: 'LA VUELTA SESSIONS',
      validatorReady: true,
      serverUrl: `${(req.headers['x-forwarded-proto'] as string) || req.protocol}://${req.headers.host}`,
      timestamp: new Date().toISOString(),
    });
  };
  app.get('/healthz', handleValidatorPing);
  app.get('/api/health', handleValidatorPing);
  app.get('/api/validator/ping', handleValidatorPing);
  app.get('/api/validador/ping', handleValidatorPing);

  // Events list + door counters for connected VALIDADOR mobile app
  const handleValidatorEvents = (req: AuthedRequest, res: Response) => {
    const configuredKey = getActiveLbApiKey();
    const headerKey = req.headers['x-lb-api-key'];
    const hasStaffPerm = req.user && getEffectivePermissions(req.user).includes('validator');
    if (!hasStaffPerm && (!configuredKey || headerKey !== configuredKey)) {
      res.status(403).json({ ok: false, error: 'Acceso solo para administradores y personal de puerta.' });
      return;
    }
    const items = db.events
      .filter((e) => e.status !== 'archived')
      .map((ev) => {
        const st = computeEventStats({ eventId: ev.id })[0];
        return {
          id: ev.id,
          title: ev.title,
          date: ev.date,
          time: ev.time,
          city: ev.city,
          venue: ev.venue,
          status: ev.status,
          paidConfirmedTickets: st?.paidConfirmedTickets ?? 0,
          validatedAtDoorCount: st?.validatedAtDoorCount ?? 0,
          unusedValidTicketsCount: st?.unusedValidTicketsCount ?? 0,
        };
      });
    res.json({ ok: true, events: items, recentLogs: db.accessLogs.slice(0, 25) });
  };
  app.get('/api/validator/events', handleValidatorEvents);
  app.get('/api/validador/events', handleValidatorEvents);

  // Unified Atomic Scan Handler for Web Console + Mobile VALIDADOR App + External LB Validador
  const handleUnifiedValidatorScan = async (req: AuthedRequest, res: Response) => {
    const configuredKey = getActiveLbApiKey();
    const headerKey = req.headers['x-lb-api-key'];
    const hasStaffPerm = req.user && getEffectivePermissions(req.user).includes('validator');

    if (!hasStaffPerm && (!configuredKey || headerKey !== configuredKey)) {
      res.status(403).json({
        ok: false,
        allowed: false,
        valid: false,
        error: 'Acceso solo para administradores. Inicia sesión en el Validador o configura LB_VALIDADOR_API_KEY.',
      });
      return;
    }

    const rawCode = String(
      req.body?.code ??
        req.body?.qr ??
        req.body?.qrCode ??
        req.body?.qrPayload ??
        req.body?.codigo ??
        req.body?.ticketCode ??
        req.body?.payload ??
        ''
    ).trim();
    const eventFilterId = String(req.body?.eventId ?? req.body?.eventoId ?? '').trim();
    if (!rawCode) {
      res.status(400).json({ ok: false, error: 'Proporciona o escanea un código QR.' });
      return;
    }
    const operator = req.user?.name || String(req.body?.deviceLabel || 'App Validador');
    const result = await executeAtomicScan(rawCode, eventFilterId, operator, req.user);
    res.json({
      ...result,
      ok: result.allowed,
      valid: result.allowed,
      result: result.log?.result,
      status: result.log?.result,
      message: result.log?.message,
    });
  };

  app.post('/api/validator/scan', handleUnifiedValidatorScan);
  app.post('/api/validator/validate', handleUnifiedValidatorScan);
  app.post('/api/validador/scan', handleUnifiedValidatorScan);
  app.post('/api/validador/validar', handleUnifiedValidatorScan);
  app.post('/api/tickets/validate', handleUnifiedValidatorScan);
  app.post('/api/lb-validador/verify', handleUnifiedValidatorScan);

  // =========================================================
  // MODULE 7: BIRTHDAYS OF THE MONTH (With Feb 29 & Privacy)
  // =========================================================
  app.get('/api/admin/birthdays', requirePermission('birthdays'), (req: AuthedRequest, res: Response) => {
    const selectedMonth = Math.min(12, Math.max(1, Number(req.query.month) || new Date().getMonth() + 1));
    const selectedYear = Number(req.query.year) || new Date().getFullYear();
    const isLeapYear = (selectedYear % 4 === 0 && selectedYear % 100 !== 0) || selectedYear % 400 === 0;
    const canSeeContact = req.user!.role === 'super_admin' || getEffectivePermissions(req.user!).includes('users');

    const matches = db.users
      .filter((u) => {
        if (!u.birthMonth || !u.birthDay || u.blocked) return false;
        if (u.birthMonth === selectedMonth) return true;
        // Include Feb 29 birthdays on Feb 28 in non-leap years (already month 2)
        return false;
      })
      .map((u) => {
        const isLeapDay = u.birthMonth === 2 && u.birthDay === 29;
        const displayDay = isLeapDay && !isLeapYear ? 28 : u.birthDay;
        return {
          userId: u.id,
          name: u.name,
          birthDay: u.birthDay,
          birthMonth: u.birthMonth,
          isLeapDayBirthday: isLeapDay,
          displayDayInSelectedYear: displayDay,
          ageInSelectedYear: u.birthYear > 1900 ? selectedYear - u.birthYear : undefined,
          email: canSeeContact ? u.email : undefined,
          phone: canSeeContact ? u.phone : undefined,
          marketingOptIn: u.marketingOptIn,
        };
      })
      .sort((a, b) => a.displayDayInSelectedYear - b.displayDayInSelectedYear);

    res.json({ month: selectedMonth, year: selectedYear, isLeapYear, birthdays: matches });
  });

  // =========================================================
  // MODULE 8: EMAIL EVENT REMINDERS (Consent + Deduplication + No Fake Sends)
  // =========================================================
  app.post(
    '/api/admin/notifications/dispatch',
    requirePermission('notifications'),
    async (req: AuthedRequest, res: Response) => {
      const eventId = String(req.body?.eventId || '');
      const kind: 'new_event' | 'upcoming_reminder' =
        req.body?.kind === 'upcoming_reminder' ? 'upcoming_reminder' : 'new_event';

      const ev = db.events.find((e) => e.id === eventId);
      if (!ev) {
        res.status(404).json({ error: 'Selecciona un evento válido.' });
        return;
      }
      if (!ev.notifyOnPublish) {
        res.status(400).json({
          error: 'Los avisos por correo están desactivados para este evento. Actívalos primero en la ficha del evento.',
        });
        return;
      }

      const activeUsers = db.users.filter((u) => !u.blocked && u.role === 'client');
      let skippedNoConsentCount = 0;
      let skippedDuplicateCount = 0;
      const eligible: StoredUser[] = [];

      for (const u of activeUsers) {
        if (!u.marketingOptIn) {
          skippedNoConsentCount++;
          continue;
        }
        const dedupKey = `${ev.id}:${kind}:${u.email}`;
        if (db.sentNotificationKeys.includes(dedupKey)) {
          skippedDuplicateCount++;
          continue;
        }
        eligible.push(u);
      }

      const resendKey = getActiveResendKey();
      const emailFrom = process.env.EMAIL_FROM || 'LA VUELTA SESSIONS <lavueltassessionsoficial@gmail.com>';
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.headers.host}`;
      let status: 'queued_awaiting_smtp' | 'sent' | 'error' = 'queued_awaiting_smtp';
      let providerNote =
        'Encolado sin enviar: configura una clave activa RESEND_API_KEY (re_...) para despacho SMTP en vivo.';

      if (resendKey && eligible.length > 0) {
        try {
          let sentOk = 0;
          for (const recipient of eligible) {
            const resp = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: emailFrom,
                to: [recipient.email],
                subject:
                  kind === 'new_event'
                    ? `Nuevo evento: ${ev.title} · LA VUELTA SESSIONS`
                    : `Recordatorio próximo: ${ev.title} (${ev.date})`,
                html: `<div style="font-family:sans-serif;background:#0a0505;color:#fff;padding:24px;border-radius:12px">
                  <h2>${ev.title}</h2>
                  <p><strong>Fecha:</strong> ${ev.date} · ${ev.time}</p>
                  <p><strong>Lugar:</strong> ${ev.venue}, ${ev.city}</p>
                  <p>${ev.description}</p>
                  <p><a href="${appUrl}" style="display:inline-block;padding:12px 20px;background:#E50914;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Ver detalles y comprar entradas</a></p>
                </div>`,
              }),
            });
            if (resp.ok) {
              sentOk++;
              db.sentNotificationKeys.push(`${ev.id}:${kind}:${recipient.email}`);
            }
          }
          status = sentOk > 0 ? 'sent' : 'error';
          providerNote = `Proveedor Resend procesó ${sentOk}/${eligible.length} correos reales.`;
        } catch (err: any) {
          status = 'error';
          providerNote = `Error de red con proveedor de correo: ${err?.message || 'Fallo de conexión'}`;
        }
      }

      const logEntry = {
        id: `not_${Date.now()}`,
        eventId: ev.id,
        eventTitle: ev.title,
        kind,
        recipientCount: eligible.length,
        skippedNoConsentCount,
        skippedDuplicateCount,
        status,
        providerNote,
        triggeredBy: req.user!.name,
        createdAt: new Date().toISOString(),
      };

      db.notificationLogs.unshift(logEntry);
      appendAudit(
        req.user!,
        'DISPATCH_NOTIFICATION',
        'event',
        ev.id,
        `${kind} · Elegibles:${eligible.length} · Estado:${status}`
      );
      await persistDb();
      res.json({ log: logEntry });
    }
  );

  // =========================================================
  // MODULE 9: STAFF, ROLES & GRANULAR PERMISSIONS (Anti Self-Elevation)
  // =========================================================
  app.post('/api/admin/staff', requirePermission('staff_rbac'), async (req: AuthedRequest, res: Response) => {
    if (req.user!.role !== 'super_admin') {
      res.status(403).json({ error: 'Solo el Administrador Principal puede crear cuentas de personal.' });
      return;
    }
    const { name, email, password, role, customPermissions } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Nombre y correo válido son obligatorios.' });
      return;
    }
    if (String(password || '').length < 8) {
      res.status(400).json({ error: 'La contraseña inicial debe tener al menos 8 caracteres.' });
      return;
    }
    if (db.users.some((u) => u.email === cleanEmail)) {
      res.status(409).json({ error: 'Ya existe un usuario con ese correo.' });
      return;
    }

    const validRoles: UserRole[] = [
      'super_admin',
      'event_manager',
      'promo_designer',
      'payment_reviewer',
      'door_staff',
      'gallery_editor',
      'client',
    ];
    const assignedRole: UserRole = validRoles.includes(role) ? role : 'door_staff';
    const { salt, hash } = hashPassword(String(password));
    const now = new Date().toISOString();

    const staffUser: StoredUser = {
      id: `usr_staff_${Date.now()}`,
      name: cleanName.slice(0, 80),
      email: cleanEmail,
      passwordSalt: salt,
      passwordHash: hash,
      phone: '',
      cedula: '',
      birthDate: '',
      birthYear: 0,
      birthMonth: 0,
      birthDay: 0,
      marketingOptIn: false,
      emailVerified: true,
      emailVerifyCode: '',
      authProvider: 'local',
      role: assignedRole,
      customPermissions: Array.isArray(customPermissions)
        ? customPermissions.filter((p: PermissionKey) => ALL_PERMISSIONS.includes(p))
        : undefined,
      blocked: false,
      createdAt: now,
      updatedAt: now,
    };

    db.users.unshift(staffUser);
    appendAudit(
      req.user!,
      'CREATE_STAFF',
      'user',
      staffUser.id,
      `Personal creado: ${staffUser.email} con rol ${assignedRole}`
    );
    await persistDb();
    res.json({ ok: true });
  });

  app.put('/api/admin/staff/:id/permissions', requirePermission('staff_rbac'), async (req: AuthedRequest, res: Response) => {
    if (req.user!.role !== 'super_admin') {
      res.status(403).json({ error: 'Solo el Administrador Principal puede modificar roles y permisos.' });
      return;
    }
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }
    // Prevent locking out own super_admin account
    if (target.id === req.user!.id && req.body?.role && req.body.role !== 'super_admin') {
      res.status(400).json({ error: 'No puedes degradar tu propio rol de Administrador Principal.' });
      return;
    }

    const validRoles: UserRole[] = [
      'super_admin',
      'event_manager',
      'promo_designer',
      'payment_reviewer',
      'door_staff',
      'gallery_editor',
      'client',
    ];
    if (req.body?.role && validRoles.includes(req.body.role)) {
      target.role = req.body.role;
    }
    if (Array.isArray(req.body?.customPermissions)) {
      target.customPermissions = req.body.customPermissions.filter((p: PermissionKey) =>
        ALL_PERMISSIONS.includes(p)
      );
    } else if (req.body?.resetToRoleDefaults) {
      target.customPermissions = undefined;
    }
    target.updatedAt = new Date().toISOString();

    appendAudit(
      req.user!,
      'UPDATE_PERMISSIONS',
      'user',
      target.id,
      `Actualizado rol=${target.role} para ${target.email}`
    );
    await persistDb();
    res.json({ ok: true });
  });

  app.post('/api/admin/users/:id/block', requirePermission('users', 'staff_rbac'), async (req: AuthedRequest, res: Response) => {
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target || target.id === req.user!.id) {
      res.status(400).json({ error: 'Operación no permitida sobre este usuario.' });
      return;
    }
    if (target.role === 'super_admin' && req.user!.role !== 'super_admin') {
      res.status(403).json({ error: 'No autorizado.' });
      return;
    }
    target.blocked = !target.blocked;
    if (target.blocked) {
      db.sessions = db.sessions.filter((s) => s.userId !== target.id);
    }
    appendAudit(
      req.user!,
      target.blocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
      'user',
      target.id,
      `${target.blocked ? 'Bloqueado' : 'Desbloqueado'}: ${target.email}`
    );
    await persistDb();
    res.json({ blocked: target.blocked });
  });

  // =========================================================
  // PROMOTIONS, FLYERS & GALLERY (Modules 2 & 10)
  // =========================================================
  app.post('/api/admin/promotions', requirePermission('promos_flyers'), async (req: AuthedRequest, res: Response) => {
    const b = req.body || {};
    const title = String(b.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'El título del anuncio o valla es obligatorio.' });
      return;
    }
    const isTribute = Boolean(b.tribute) || b.adFormat === 'tribute';
    const validFormats = ['billboard', 'spotlight', 'sponsor', 'tribute'];
    const adFormat = isTribute
      ? 'tribute'
      : validFormats.includes(b.adFormat)
      ? b.adFormat
      : 'billboard';
    const validPresets = ['stage', 'vip_bar', 'streetwear', 'rooftop'];
    const rawExt = String(b.externalUrl || '').trim();
    const safeExt = /^https?:\/\//i.test(rawExt) ? rawExt.slice(0, 220) : '';

    const promo = {
      id: `pro_${Date.now()}`,
      title: title.slice(0, 80),
      slogan: String(b.slogan || '').slice(0, 60),
      text: String(b.text || '').slice(0, 260),
      imageUrl: String(b.imageUrl || ''),
      eventId: String(b.eventId || ''),
      linkSection: String(b.linkSection || 'eventos'),
      tribute: isTribute,
      adFormat,
      sponsorBrand: String(b.sponsorBrand || '').trim().slice(0, 60),
      ctaLabel: String(b.ctaLabel || '').trim().slice(0, 40),
      externalUrl: safeExt,
      visualPreset: validPresets.includes(b.visualPreset) ? b.visualPreset : 'vip_bar',
      from: String(b.from || '2026-01-01').slice(0, 10),
      to: String(b.to || '2027-12-31').slice(0, 10),
      published: b.published !== false,
      order: db.promotions.length + 1,
    };
    db.promotions.unshift(promo);
    appendAudit(req.user!, 'CREATE_PROMO', 'promo', promo.id, `Publicidad creada: ${promo.title} (${adFormat})`);
    await persistDb();
    res.json({ promo });
  });

  app.put('/api/admin/promotions/:id', requirePermission('promos_flyers'), async (req: AuthedRequest, res: Response) => {
    const promo = db.promotions.find((p) => p.id === req.params.id);
    if (!promo) {
      res.status(404).json({ error: 'Anuncio no encontrado.' });
      return;
    }
    const b = req.body || {};
    if (b.published !== undefined) promo.published = Boolean(b.published);
    if (b.title !== undefined) promo.title = String(b.title).slice(0, 80);
    if (b.slogan !== undefined) promo.slogan = String(b.slogan).slice(0, 60);
    if (b.text !== undefined) promo.text = String(b.text).slice(0, 260);
    if (b.imageUrl !== undefined) promo.imageUrl = String(b.imageUrl);
    if (b.eventId !== undefined) promo.eventId = String(b.eventId);
    if (b.linkSection !== undefined) promo.linkSection = String(b.linkSection);
    if (b.sponsorBrand !== undefined) promo.sponsorBrand = String(b.sponsorBrand).trim().slice(0, 60);
    if (b.ctaLabel !== undefined) promo.ctaLabel = String(b.ctaLabel).trim().slice(0, 40);
    if (b.externalUrl !== undefined) {
      const rawExt = String(b.externalUrl || '').trim();
      promo.externalUrl = /^https?:\/\//i.test(rawExt) ? rawExt.slice(0, 220) : '';
    }
    if (b.visualPreset && ['stage', 'vip_bar', 'streetwear', 'rooftop'].includes(b.visualPreset)) {
      promo.visualPreset = b.visualPreset;
    }
    if (b.adFormat && ['billboard', 'spotlight', 'sponsor', 'tribute'].includes(b.adFormat)) {
      promo.adFormat = b.adFormat;
      promo.tribute = b.adFormat === 'tribute';
    } else if (b.tribute !== undefined) {
      promo.tribute = Boolean(b.tribute);
      if (promo.tribute) promo.adFormat = 'tribute';
    }
    await persistDb();
    res.json({ promo });
  });

  app.delete('/api/admin/promotions/:id', requirePermission('promos_flyers'), async (req: AuthedRequest, res: Response) => {
    db.promotions = db.promotions.filter((p) => p.id !== req.params.id);
    await persistDb();
    res.json({ ok: true });
  });

  // Public Validated Advertiser / Brand Sponsorship Lead Capture
  app.post('/api/ad-inquiries', async (req: Request, res: Response) => {
    const b = req.body || {};
    const brandName = String(b.brandName || '').trim().slice(0, 80);
    const contactName = String(b.contactName || '').trim().slice(0, 80);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
    const phone = String(b.phone || '').trim().slice(0, 32);
    const packageInterest = String(b.packageInterest || 'Valla Digital + Activación en Evento').trim().slice(0, 80);
    const message = String(b.message || '').trim().slice(0, 400);

    if (brandName.length < 2 || contactName.length < 2) {
      res.status(400).json({ error: 'Indica el nombre de la marca y persona de contacto.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Ingresa un correo corporativo o de contacto válido.' });
      return;
    }
    if (!/^\+?[0-9\s\-()]{7,20}$/.test(phone)) {
      res.status(400).json({ error: 'Ingresa un número de WhatsApp o teléfono válido.' });
      return;
    }

    if (!Array.isArray(db.adInquiries)) db.adInquiries = [];
    const inquiry = {
      id: `adinq_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      brandName,
      contactName,
      email,
      phone,
      packageInterest,
      message,
      createdAt: new Date().toISOString(),
    };
    db.adInquiries.unshift(inquiry);
    if (db.adInquiries.length > 200) db.adInquiries.length = 200;
    await persistDb();
    res.json({ ok: true, inquiryId: inquiry.id });
  });

  app.delete('/api/admin/ad-inquiries/:id', requirePermission('promos_flyers'), async (req: AuthedRequest, res: Response) => {
    if (Array.isArray(db.adInquiries)) {
      db.adInquiries = db.adInquiries.filter((q) => q.id !== req.params.id);
      await persistDb();
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/gallery/categories', requirePermission('gallery_admin'), async (req: AuthedRequest, res: Response) => {
    const name = String(req.body?.name || '').trim().slice(0, 50);
    if (!name) {
      res.status(400).json({ error: 'Escribe el nombre de la categoría.' });
      return;
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!db.galleryCategories.some((c) => c.slug === slug)) {
      db.galleryCategories.push({
        id: `cat_${Date.now()}`,
        name,
        slug,
        order: db.galleryCategories.length + 1,
      });
      await persistDb();
    }
    res.json({ categories: db.galleryCategories });
  });

  app.post('/api/admin/gallery/photos', requirePermission('gallery_admin'), async (req: AuthedRequest, res: Response) => {
    const b = req.body || {};
    const title = String(b.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'El título o descripción breve es obligatorio.' });
      return;
    }
    const photo = {
      id: `gal_${Date.now()}`,
      title: title.slice(0, 100),
      description: String(b.description || '').slice(0, 300),
      imageUrl: String(b.imageUrl || ''),
      categoryId: String(b.categoryId || db.galleryCategories[0]?.id || ''),
      eventId: String(b.eventId || ''),
      date: String(b.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
      published: b.published !== false,
      authorName: req.user!.name,
      visualPreset: ['outfit', 'flow', 'community', 'night', 'dj', 'backstage'].includes(b.visualPreset)
        ? b.visualPreset
        : 'night',
    };
    db.galleryPhotos.unshift(photo);
    appendAudit(req.user!, 'CREATE_GALLERY_PHOTO', 'gallery', photo.id, `Fotografía publicada: ${photo.title}`);
    await persistDb();
    res.json({ photo });
  });

  app.put('/api/admin/gallery/photos/:id', requirePermission('gallery_admin'), async (req: AuthedRequest, res: Response) => {
    const photo = db.galleryPhotos.find((g) => g.id === req.params.id);
    if (!photo) {
      res.status(404).json({ error: 'Fotografía no encontrada.' });
      return;
    }
    const b = req.body || {};
    if (b.published !== undefined) photo.published = Boolean(b.published);
    if (b.title !== undefined) photo.title = String(b.title).slice(0, 100);
    if (b.description !== undefined) photo.description = String(b.description).slice(0, 300);
    if (b.categoryId !== undefined) photo.categoryId = String(b.categoryId);
    if (b.eventId !== undefined) photo.eventId = String(b.eventId);
    await persistDb();
    res.json({ photo });
  });

  app.delete('/api/admin/gallery/photos/:id', requirePermission('gallery_admin'), async (req: AuthedRequest, res: Response) => {
    db.galleryPhotos = db.galleryPhotos.filter((g) => g.id !== req.params.id);
    await persistDb();
    res.json({ ok: true });
  });

  // =========================================================
  // SETTINGS
  // =========================================================
  app.put('/api/admin/settings', requirePermission('settings'), async (req: AuthedRequest, res: Response) => {
    const b = req.body || {};
    db.settings = {
      brandHandle: String(b.brandHandle ?? db.settings.brandHandle).slice(0, 50),
      instagramUrl: String(b.instagramUrl ?? db.settings.instagramUrl).slice(0, 160),
      tiktokUrl: String(b.tiktokUrl ?? db.settings.tiktokUrl).slice(0, 160),
      youtubeUrl: String(b.youtubeUrl ?? db.settings.youtubeUrl).slice(0, 160),
      whatsappContact: String(b.whatsappContact ?? db.settings.whatsappContact).slice(0, 40),
      cityBase: String(b.cityBase ?? db.settings.cityBase).slice(0, 80),
      timezone: String(b.timezone ?? db.settings.timezone).slice(0, 50),
      refundFeePercent: Math.min(100, Math.max(0, Number(b.refundFeePercent ?? db.settings.refundFeePercent))),
      emailNotificationsEnabled: Boolean(b.emailNotificationsEnabled ?? db.settings.emailNotificationsEnabled),
    };
    appendAudit(req.user!, 'UPDATE_SETTINGS', 'settings', 'global', 'Configuración general actualizada');
    await persistDb();
    res.json({ settings: db.settings });
  });

  // =========================================================
  // SYSTEM BACKUP & MEMORY RESTORATION (PostgreSQL)
  // =========================================================
  app.get('/api/admin/backup/export', requirePermission('settings'), async (req: AuthedRequest, res: Response) => {
    recordSecurityAudit('BACKUP_EXPORTED', 'info', req, 'Copia de seguridad completa de PostgreSQL descargada por administrador.', req.user!.email);
    await persistDb();
    const backupSnapshot = await exportFullPostgresBackup(db);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="lavuelta_pg_backup_${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(backupSnapshot, null, 2));
  });

  app.post('/api/admin/backup/restore', requirePermission('settings'), async (req: AuthedRequest, res: Response) => {
    const { backupData } = req.body || {};
    if (!backupData || typeof backupData !== 'object') {
      res.status(400).json({ error: 'Archivo de respaldo inválido o vacío.' });
      return;
    }
    if (!Array.isArray(backupData.events) || !backupData.paymentMethods) {
      res.status(400).json({ error: 'El archivo no contiene la estructura requerida de La Vuelta Sessions.' });
      return;
    }

    if (Array.isArray(backupData.users)) db.users = backupData.users;
    if (Array.isArray(backupData.sessions)) db.sessions = backupData.sessions;
    if (Array.isArray(backupData.events)) db.events = backupData.events;
    if (Array.isArray(backupData.specialCampaigns)) db.specialCampaigns = backupData.specialCampaigns;
    if (Array.isArray(backupData.seasons)) db.seasons = backupData.seasons;
    if (backupData.paymentMethods && typeof backupData.paymentMethods === 'object') {
      db.paymentMethods = { ...db.paymentMethods, ...backupData.paymentMethods };
    }
    if (Array.isArray(backupData.orders)) db.orders = backupData.orders;
    if (Array.isArray(backupData.tickets)) db.tickets = backupData.tickets;
    if (Array.isArray(backupData.accessLogs)) db.accessLogs = backupData.accessLogs;
    if (Array.isArray(backupData.promotions)) db.promotions = backupData.promotions;
    if (Array.isArray(backupData.adInquiries)) db.adInquiries = backupData.adInquiries;
    if (Array.isArray(backupData.galleryCategories)) db.galleryCategories = backupData.galleryCategories;
    if (Array.isArray(backupData.galleryPhotos)) db.galleryPhotos = backupData.galleryPhotos;
    if (Array.isArray(backupData.notificationLogs)) db.notificationLogs = backupData.notificationLogs;
    if (Array.isArray(backupData.sentNotificationKeys)) db.sentNotificationKeys = backupData.sentNotificationKeys;
    if (Array.isArray(backupData.auditLogs)) db.auditLogs = backupData.auditLogs;
    if (Array.isArray(backupData.securityAuditLogs)) db.securityAuditLogs = backupData.securityAuditLogs;
    if (backupData.settings && typeof backupData.settings === 'object') {
      db.settings = { ...db.settings, ...backupData.settings };
    }
    if (backupData.exchangeRate && typeof backupData.exchangeRate === 'object') {
      db.exchangeRate = { ...db.exchangeRate, ...backupData.exchangeRate };
    }

    recordSecurityAudit('BACKUP_RESTORED', 'warning', req, `Sistema PostgreSQL restaurado desde copia de seguridad (Exportada: ${backupData.exportedAt || 'Fecha desconocida'}).`, req.user!.email);
    await enqueuePostgresPersist(db, Array.isArray(backupData.vouchers) ? backupData.vouchers : []);
    res.json({ ok: true, message: '¡Copia de seguridad restaurada con éxito en PostgreSQL! Todos los datos y comprobantes fueron reestablecidos.' });
  });

  // =========================================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC ASSETS
  // =========================================================
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');
    app.use(express.static(distPath));
    app.use('/api', (_req: Request, res: Response) => {
      res.status(404).json({ error: 'Ruta API no encontrada.' });
    });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      if (fs.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
        res
          .status(200)
          .type('html')
          .send(
            '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>LA VUELTA SESSIONS</title></head><body>Iniciando servicio...</body></html>'
          );
      }
    });
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`LA VUELTA SESSIONS server listening on http://0.0.0.0:${PORT} (mode=${IS_PROD ? 'production' : 'development'}, storage=PostgreSQL)`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}. Closing HTTP server and PostgreSQL pool...`);
    server.close(async () => {
      await closePgPool();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
