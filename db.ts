import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

export interface StoredVoucherRecord {
  orderId: string;
  userId: string;
  eventId: string;
  paymentMethod: string;
  reference: string;
  uploadedAt: string;
  dataUrl: string;
}

let poolInstance: pg.Pool | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function getDatabaseUrl(): string {
  return (process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/lavueltasessions').trim();
}

export function getPgPool(): pg.Pool {
  if (!poolInstance) {
    const connectionString = getDatabaseUrl();
    if (!connectionString) {
      throw new Error('FATAL: DATABASE_URL is not configured. Refusing to start without PostgreSQL.');
    }
    poolInstance = new Pool({
      connectionString,
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return poolInstance;
}

export async function closePgPool(): Promise<void> {
  await writeQueue.catch(() => {});
  if (poolInstance) {
    const p = poolInstance;
    poolInstance = null;
    await p.end();
  }
}

export async function ensurePostgresSchema(pool: pg.Pool = getPgPool()): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kv_config (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      blocked BOOLEAN NOT NULL DEFAULT FALSE,
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at TEXT NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'published',
      published BOOLEAN NOT NULL DEFAULT TRUE,
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS special_campaigns (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT NOT NULL DEFAULT '',
      reference TEXT NOT NULL DEFAULT '',
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      order_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      event_id TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT '',
      reference TEXT NOT NULL DEFAULT '',
      uploaded_at TEXT NOT NULL,
      data_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      order_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'valid',
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS access_logs (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ad_inquiries (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS gallery_categories (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS gallery_photos (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS security_audit_logs (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export async function getOrCreateQrHmacSecret(
  fallbackSecretPath: string,
  placeholderSecrets: Set<string>,
  pool: pg.Pool = getPgPool()
): Promise<string> {
  const envSecret = (process.env.QR_HMAC_SECRET || '').trim();
  if (
    envSecret.length >= 16 &&
    !placeholderSecrets.has(envSecret.toUpperCase()) &&
    !placeholderSecrets.has(envSecret)
  ) {
    await pool.query(
      `INSERT INTO kv_config (key, value, updated_at)
       VALUES ('qrHmacSecret', $1::jsonb, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(envSecret), new Date().toISOString()]
    );
    return envSecret;
  }

  const res = await pool.query(`SELECT value FROM kv_config WHERE key = 'qrHmacSecret'`);
  if (res.rows.length > 0 && typeof res.rows[0].value === 'string' && res.rows[0].value.length >= 16) {
    return res.rows[0].value;
  }

  let initialSecret = '';
  try {
    if (fs.existsSync(fallbackSecretPath)) {
      const fromFile = fs.readFileSync(fallbackSecretPath, 'utf8').trim();
      if (fromFile.length >= 16) {
        initialSecret = fromFile;
      }
    }
  } catch {
    // ignore file read error
  }

  if (!initialSecret) {
    initialSecret = crypto.randomBytes(32).toString('hex');
  }

  await pool.query(
    `INSERT INTO kv_config (key, value, updated_at)
     VALUES ('qrHmacSecret', $1::jsonb, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [JSON.stringify(initialSecret), new Date().toISOString()]
  );

  return initialSecret;
}

export async function isPostgresPopulated(pool: pg.Pool = getPgPool()): Promise<boolean> {
  const res = await pool.query(`SELECT COUNT(*)::int AS cnt FROM users`);
  return (res.rows[0]?.cnt || 0) > 0;
}

export async function loadDatabaseFromPostgres<T = any>(pool: pg.Pool = getPgPool()): Promise<T> {
  const [
    usersRes,
    sessionsRes,
    eventsRes,
    campaignsRes,
    ordersRes,
    ticketsRes,
    accessLogsRes,
    promotionsRes,
    adInquiriesRes,
    galleryCatsRes,
    galleryPhotosRes,
    notifLogsRes,
    auditLogsRes,
    secAuditLogsRes,
    kvRes,
  ] = await Promise.all([
    pool.query(`SELECT data FROM users ORDER BY sort_index ASC`),
    pool.query(`SELECT token_hash, user_id, expires_at, created_at FROM sessions ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM events ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM special_campaigns ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM orders ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM tickets ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM access_logs ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM promotions ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM ad_inquiries ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM gallery_categories ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM gallery_photos ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM notification_logs ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM audit_logs ORDER BY sort_index ASC`),
    pool.query(`SELECT data FROM security_audit_logs ORDER BY sort_index ASC`),
    pool.query(`SELECT key, value FROM kv_config`),
  ]);

  const kvMap = new Map<string, any>();
  for (const row of kvRes.rows) {
    kvMap.set(row.key, row.value);
  }

  return {
    users: usersRes.rows.map((r) => r.data),
    sessions: sessionsRes.rows.map((r) => ({
      tokenHash: r.token_hash,
      userId: r.user_id,
      expiresAt: Number(r.expires_at),
      createdAt: r.created_at,
    })),
    seasons: kvMap.get('seasons') || [
      'Navidad',
      'Halloween',
      'Año Nuevo',
      'Carnaval',
      'San Valentín',
      'Vacaciones',
      'Aniversarios',
      'Eventos temáticos',
    ],
    specialCampaigns: campaignsRes.rows.map((r) => r.data),
    events: eventsRes.rows.map((r) => r.data),
    paymentMethods: kvMap.get('paymentMethods') || {
      pago_movil: {
        enabled: true,
        bank: 'Banco de Venezuela (0102)',
        phone: '04122920362',
        documentId: 'V29711480',
        holderName: 'Gustavo Francisco Rivero Prado',
        instructions:
          'Realiza el pago móvil por el monto exacto en Bs. indicado por la tasa oficial del día. En el concepto coloca solo tu nombre.',
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
        instructions:
          'Transfiere el monto exacto acordado en Bs. a la tasa oficial del día. En el concepto coloca tu nombre o déjalo vacío. No requiere código QR.',
        iconUrl: '',
        qrImageUrl: '',
        showQr: false,
      },
      binance: {
        enabled: true,
        payIdOrEmail: 'gustavorivero1810@gmail.com',
        networkOrAsset: 'USDT (Binance Pay)',
        instructions: 'Envía el monto neto en USDT mediante Binance Pay sin comisión de red.',
        iconUrl: '',
        qrImageUrl: '',
        showQr: false,
      },
    },
    orders: ordersRes.rows.map((r) => r.data),
    tickets: ticketsRes.rows.map((r) => r.data),
    accessLogs: accessLogsRes.rows.map((r) => r.data),
    promotions: promotionsRes.rows.map((r) => r.data),
    adInquiries: adInquiriesRes.rows.map((r) => r.data),
    adsSeededV2: kvMap.has('adsSeededV2') ? Boolean(kvMap.get('adsSeededV2')) : true,
    galleryCategories: galleryCatsRes.rows.map((r) => r.data),
    galleryPhotos: galleryPhotosRes.rows.map((r) => r.data),
    notificationLogs: notifLogsRes.rows.map((r) => r.data),
    sentNotificationKeys: kvMap.get('sentNotificationKeys') || [],
    auditLogs: auditLogsRes.rows.map((r) => r.data),
    securityAuditLogs: secAuditLogsRes.rows.map((r) => r.data),
    settings: kvMap.get('settings') || {
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
    exchangeRate: kvMap.get('exchangeRate') || {
      rate: 896.12,
      currency: 'VES',
      source: 'Banco Central de Venezuela (BCV Oficial)',
      lastUpdated: new Date().toISOString(),
      mode: 'auto',
    },
  } as unknown as T;
}

async function writeFullDatabaseSnapshotToPostgres(
  db: any,
  vouchers?: StoredVoucherRecord[],
  pool: pg.Pool = getPgPool()
): Promise<void> {
  const client = await pool.connect();
  const now = new Date().toISOString();
  try {
    await client.query('BEGIN');

    // Sync users
    await client.query('DELETE FROM users');
    const users = Array.isArray(db.users) ? db.users : [];
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      await client.query(
        `INSERT INTO users (id, email, role, blocked, data, sort_index)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           blocked = EXCLUDED.blocked,
           data = EXCLUDED.data,
           sort_index = EXCLUDED.sort_index`,
        [u.id, String(u.email || '').toLowerCase(), u.role || 'client', Boolean(u.blocked), JSON.stringify(u), i]
      );
    }

    // Sync sessions
    await client.query('DELETE FROM sessions');
    const sessions = Array.isArray(db.sessions) ? db.sessions : [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      await client.query(
        `INSERT INTO sessions (token_hash, user_id, expires_at, created_at, sort_index)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (token_hash) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           expires_at = EXCLUDED.expires_at,
           created_at = EXCLUDED.created_at,
           sort_index = EXCLUDED.sort_index`,
        [s.tokenHash, s.userId, Number(s.expiresAt), String(s.createdAt || now), i]
      );
    }

    // Sync events
    await client.query('DELETE FROM events');
    const events = Array.isArray(db.events) ? db.events : [];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      await client.query(
        `INSERT INTO events (id, status, published, data, sort_index)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [ev.id, String(ev.status || 'published'), Boolean(ev.published), JSON.stringify(ev), i]
      );
    }

    // Sync special_campaigns
    await client.query('DELETE FROM special_campaigns');
    const campaigns = Array.isArray(db.specialCampaigns) ? db.specialCampaigns : [];
    for (let i = 0; i < campaigns.length; i++) {
      const c = campaigns[i];
      await client.query(
        `INSERT INTO special_campaigns (id, data, sort_index) VALUES ($1, $2::jsonb, $3)`,
        [c.id, JSON.stringify(c), i]
      );
    }

    // Sync orders
    await client.query('DELETE FROM orders');
    const orders = Array.isArray(db.orders) ? db.orders : [];
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      await client.query(
        `INSERT INTO orders (id, user_id, event_id, status, payment_method, reference, data, sort_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [
          o.id,
          String(o.userId || ''),
          String(o.eventId || ''),
          String(o.status || 'pending'),
          String(o.paymentMethod || o.method || ''),
          String(o.reference || ''),
          JSON.stringify(o),
          i,
        ]
      );
    }

    // If vouchers array is explicitly provided (e.g. during migrate or restore), replace vouchers table
    if (Array.isArray(vouchers)) {
      await client.query('DELETE FROM vouchers');
      for (const v of vouchers) {
        if (v && v.orderId && v.dataUrl) {
          await client.query(
            `INSERT INTO vouchers (order_id, user_id, event_id, payment_method, reference, uploaded_at, data_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (order_id) DO UPDATE SET
               user_id = EXCLUDED.user_id,
               event_id = EXCLUDED.event_id,
               payment_method = EXCLUDED.payment_method,
               reference = EXCLUDED.reference,
               uploaded_at = EXCLUDED.uploaded_at,
               data_url = EXCLUDED.data_url`,
            [
              v.orderId,
              String(v.userId || ''),
              String(v.eventId || ''),
              String(v.paymentMethod || ''),
              String(v.reference || ''),
              String(v.uploadedAt || now),
              String(v.dataUrl),
            ]
          );
        }
      }
    }

    // Sync tickets
    await client.query('DELETE FROM tickets');
    const tickets = Array.isArray(db.tickets) ? db.tickets : [];
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      await client.query(
        `INSERT INTO tickets (id, code, order_id, user_id, event_id, status, data, sort_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [
          t.id,
          String(t.code || ''),
          String(t.orderId || ''),
          String(t.userId || ''),
          String(t.eventId || ''),
          String(t.status || 'valid'),
          JSON.stringify(t),
          i,
        ]
      );
    }

    // Sync access_logs
    await client.query('DELETE FROM access_logs');
    const accessLogs = Array.isArray(db.accessLogs) ? db.accessLogs : [];
    for (let i = 0; i < accessLogs.length; i++) {
      const a = accessLogs[i];
      await client.query(`INSERT INTO access_logs (id, data, sort_index) VALUES ($1, $2::jsonb, $3)`, [
        a.id || `acc_${i}`,
        JSON.stringify(a),
        i,
      ]);
    }

    // Sync promotions
    await client.query('DELETE FROM promotions');
    const promotions = Array.isArray(db.promotions) ? db.promotions : [];
    for (let i = 0; i < promotions.length; i++) {
      const p = promotions[i];
      await client.query(`INSERT INTO promotions (id, data, sort_index) VALUES ($1, $2::jsonb, $3)`, [
        p.id || `pro_${i}`,
        JSON.stringify(p),
        i,
      ]);
    }

    // Sync ad_inquiries
    await client.query('DELETE FROM ad_inquiries');
    const adInquiries = Array.isArray(db.adInquiries) ? db.adInquiries : [];
    for (let i = 0; i < adInquiries.length; i++) {
      const q = adInquiries[i];
      await client.query(`INSERT INTO ad_inquiries (id, data, sort_index) VALUES ($1, $2::jsonb, $3)`, [
        q.id || `adinq_${i}`,
        JSON.stringify(q),
        i,
      ]);
    }

    // Sync gallery_categories
    await client.query('DELETE FROM gallery_categories');
    const galleryCategories = Array.isArray(db.galleryCategories) ? db.galleryCategories : [];
    for (let i = 0; i < galleryCategories.length; i++) {
      const c = galleryCategories[i];
      await client.query(`INSERT INTO gallery_categories (id, data, sort_index) VALUES ($1, $2::jsonb, $3)`, [
        c.id || `cat_${i}`,
        JSON.stringify(c),
        i,
      ]);
    }

    // Sync gallery_photos
    await client.query('DELETE FROM gallery_photos');
    const galleryPhotos = Array.isArray(db.galleryPhotos) ? db.galleryPhotos : [];
    for (let i = 0; i < galleryPhotos.length; i++) {
      const g = galleryPhotos[i];
      await client.query(`INSERT INTO gallery_photos (id, data, sort_index) VALUES ($1, $2::jsonb, $3)`, [
        g.id || `gal_${i}`,
        JSON.stringify(g),
        i,
      ]);
    }

    // Sync notification_logs
    await client.query('DELETE FROM notification_logs');
    const notificationLogs = Array.isArray(db.notificationLogs) ? db.notificationLogs : [];
    for (let i = 0; i < notificationLogs.length; i++) {
      const n = notificationLogs[i];
      await client.query(`INSERT INTO notification_logs (id, data, sort_index) VALUES ($1, $2::jsonb, $3)`, [
        n.id || `not_${i}`,
        JSON.stringify(n),
        i,
      ]);
    }

    // Sync audit_logs
    await client.query('DELETE FROM audit_logs');
    const auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
    for (let i = 0; i < auditLogs.length; i++) {
      const a = auditLogs[i];
      await client.query(`INSERT INTO audit_logs (id, data, sort_index) VALUES ($1, $2::jsonb, $3)`, [
        a.id || `aud_${i}`,
        JSON.stringify(a),
        i,
      ]);
    }

    // Sync security_audit_logs
    await client.query('DELETE FROM security_audit_logs');
    const securityAuditLogs = Array.isArray(db.securityAuditLogs) ? db.securityAuditLogs : [];
    for (let i = 0; i < securityAuditLogs.length; i++) {
      const s = securityAuditLogs[i];
      await client.query(`INSERT INTO security_audit_logs (id, data, sort_index) VALUES ($1, $2::jsonb, $3)`, [
        s.id || `sec_${i}`,
        JSON.stringify(s),
        i,
      ]);
    }

    // Sync kv_config entries
    const kvEntries: [string, any][] = [
      ['seasons', db.seasons || []],
      ['paymentMethods', db.paymentMethods || {}],
      ['settings', db.settings || {}],
      ['exchangeRate', db.exchangeRate || {}],
      ['sentNotificationKeys', db.sentNotificationKeys || []],
      ['adsSeededV2', Boolean(db.adsSeededV2)],
    ];

    for (const [k, v] of kvEntries) {
      await client.query(
        `INSERT INTO kv_config (key, value, updated_at)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [k, JSON.stringify(v), now]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function enqueuePostgresPersist(db: any, vouchers?: StoredVoucherRecord[]): Promise<void> {
  writeQueue = writeQueue
    .catch(() => {})
    .then(() => writeFullDatabaseSnapshotToPostgres(db, vouchers));
  return writeQueue;
}

export async function saveVoucherToPostgres(voucher: StoredVoucherRecord, pool: pg.Pool = getPgPool()): Promise<void> {
  await pool.query(
    `INSERT INTO vouchers (order_id, user_id, event_id, payment_method, reference, uploaded_at, data_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (order_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       event_id = EXCLUDED.event_id,
       payment_method = EXCLUDED.payment_method,
       reference = EXCLUDED.reference,
       uploaded_at = EXCLUDED.uploaded_at,
       data_url = EXCLUDED.data_url`,
    [
      voucher.orderId,
      voucher.userId,
      voucher.eventId,
      voucher.paymentMethod,
      voucher.reference,
      voucher.uploadedAt,
      voucher.dataUrl,
    ]
  );
}

export async function getVoucherFromPostgres(
  orderId: string,
  pool: pg.Pool = getPgPool()
): Promise<StoredVoucherRecord | null> {
  const res = await pool.query(
    `SELECT order_id, user_id, event_id, payment_method, reference, uploaded_at, data_url
     FROM vouchers WHERE order_id = $1`,
    [orderId]
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    orderId: r.order_id,
    userId: r.user_id,
    eventId: r.event_id,
    paymentMethod: r.payment_method,
    reference: r.reference,
    uploadedAt: r.uploaded_at,
    dataUrl: r.data_url,
  };
}

export async function deleteVoucherFromPostgres(orderId: string, pool: pg.Pool = getPgPool()): Promise<void> {
  await pool.query(`DELETE FROM vouchers WHERE order_id = $1`, [orderId]);
}

export async function getAllVouchersFromPostgres(pool: pg.Pool = getPgPool()): Promise<StoredVoucherRecord[]> {
  const res = await pool.query(
    `SELECT order_id, user_id, event_id, payment_method, reference, uploaded_at, data_url
     FROM vouchers ORDER BY uploaded_at DESC`
  );
  return res.rows.map((r) => ({
    orderId: r.order_id,
    userId: r.user_id,
    eventId: r.event_id,
    paymentMethod: r.payment_method,
    reference: r.reference,
    uploadedAt: r.uploaded_at,
    dataUrl: r.data_url,
  }));
}

export async function exportFullPostgresBackup(currentDb?: any, pool: pg.Pool = getPgPool()): Promise<any> {
  await writeQueue.catch(() => {});
  const dbSnapshot: any = currentDb || (await loadDatabaseFromPostgres(pool));
  const vouchers = await getAllVouchersFromPostgres(pool);
  return {
    version: '2026.2-pg',
    storageEngine: 'PostgreSQL',
    exportedAt: new Date().toISOString(),
    platform: 'La Vuelta Sessions',
    users: dbSnapshot.users || [],
    sessions: dbSnapshot.sessions || [],
    seasons: dbSnapshot.seasons || [],
    specialCampaigns: dbSnapshot.specialCampaigns || [],
    events: dbSnapshot.events || [],
    paymentMethods: dbSnapshot.paymentMethods || {},
    orders: dbSnapshot.orders || [],
    vouchers,
    tickets: dbSnapshot.tickets || [],
    accessLogs: dbSnapshot.accessLogs || [],
    promotions: dbSnapshot.promotions || [],
    adInquiries: dbSnapshot.adInquiries || [],
    adsSeededV2: Boolean(dbSnapshot.adsSeededV2 ?? true),
    galleryCategories: dbSnapshot.galleryCategories || [],
    galleryPhotos: dbSnapshot.galleryPhotos || [],
    notificationLogs: dbSnapshot.notificationLogs || [],
    sentNotificationKeys: dbSnapshot.sentNotificationKeys || [],
    auditLogs: dbSnapshot.auditLogs || [],
    securityAuditLogs: dbSnapshot.securityAuditLogs || [],
    settings: dbSnapshot.settings || {},
    exchangeRate: dbSnapshot.exchangeRate || {},
  };
}

export function loadLegacyVouchersFromDisk(vouchersDir: string): StoredVoucherRecord[] {
  const records: StoredVoucherRecord[] = [];
  try {
    if (!fs.existsSync(vouchersDir)) return records;
    const files = fs.readdirSync(vouchersDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(vouchersDir, file), 'utf8'));
        if (parsed && parsed.orderId && parsed.dataUrl) {
          records.push({
            orderId: String(parsed.orderId),
            userId: String(parsed.userId || ''),
            eventId: String(parsed.eventId || ''),
            paymentMethod: String(parsed.paymentMethod || ''),
            reference: String(parsed.reference || ''),
            uploadedAt: String(parsed.uploadedAt || new Date().toISOString()),
            dataUrl: String(parsed.dataUrl),
          });
        }
      } catch {
        // skip malformed voucher file
      }
    }
  } catch {
    // ignore directory read error
  }
  return records;
}
