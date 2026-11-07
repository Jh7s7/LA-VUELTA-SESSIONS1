export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  EVENT_MANAGER = 'event_manager',
  PROMO_DESIGNER = 'promo_designer',
  PAYMENT_REVIEWER = 'payment_reviewer',
  DOOR_STAFF = 'door_staff',
  GALLERY_EDITOR = 'gallery_editor',
  CLIENT = 'client',
}

export enum PermissionKey {
  OVERVIEW = 'overview',
  EVENTS = 'events',
  SPECIAL_EVENTS = 'special_events',
  SALES_STATS = 'sales_stats',
  ORDERS_PAYMENTS = 'orders_payments',
  PENDING_VOUCHERS = 'pending_vouchers',
  TICKETS_QR = 'tickets_qr',
  VALIDATOR = 'validator',
  PROMOS_FLYERS = 'promos_flyers',
  GALLERY_ADMIN = 'gallery_admin',
  USERS = 'users',
  STAFF_RBAC = 'staff_rbac',
  BIRTHDAYS = 'birthdays',
  NOTIFICATIONS = 'notifications',
  PAYMENT_METHODS = 'payment_methods',
  SETTINGS = 'settings',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Administrador Principal',
  [UserRole.EVENT_MANAGER]: 'Administrador de Eventos',
  [UserRole.PROMO_DESIGNER]: 'Diseñador / Promociones',
  [UserRole.PAYMENT_REVIEWER]: 'Revisor de Pagos',
  [UserRole.DOOR_STAFF]: 'Personal de Puerta',
  [UserRole.GALLERY_EDITOR]: 'Editor de Galería',
  [UserRole.CLIENT]: 'Cliente',
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(PermissionKey),
  [UserRole.EVENT_MANAGER]: [
    PermissionKey.OVERVIEW,
    PermissionKey.EVENTS,
    PermissionKey.SPECIAL_EVENTS,
    PermissionKey.SALES_STATS,
    PermissionKey.NOTIFICATIONS,
    PermissionKey.PAYMENT_METHODS,
  ],
  [UserRole.PROMO_DESIGNER]: [
    PermissionKey.SPECIAL_EVENTS,
    PermissionKey.PROMOS_FLYERS,
  ],
  [UserRole.PAYMENT_REVIEWER]: [
    PermissionKey.ORDERS_PAYMENTS,
    PermissionKey.PENDING_VOUCHERS,
    PermissionKey.TICKETS_QR,
    PermissionKey.PAYMENT_METHODS,
  ],
  [UserRole.DOOR_STAFF]: [
    PermissionKey.VALIDATOR,
  ],
  [UserRole.GALLERY_EDITOR]: [
    PermissionKey.GALLERY_ADMIN,
  ],
  [UserRole.CLIENT]: [],
};

export type PublicSection =
  | 'home'
  | 'eventos'
  | 'sessions'
  | 'especiales'
  | 'promos'
  | 'galeria'
  | 'my-tickets'
  | 'event-detail'
  | 'profile';

export type AdminSection = PermissionKey;

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  cedulaMasked: string;
  hasCedula: boolean;
  birthMonth: number;
  birthDay: number;
  profileCompleted: boolean;
  marketingOptIn: boolean;
  emailVerified: boolean;
  authProvider: 'local' | 'google';
  role: UserRole;
  permissions: PermissionKey[];
  blocked: boolean;
}

export interface EventComboItem {
  id: string;
  name: string;
  description: string;
  price: number;
  available: boolean;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  isoDate: string;
  time: string;
  city: string;
  venue: string;
  capacity: number;
  generalPrice: number;
  generalCapacity: number;
  vipPrice: number;
  vipCapacity: number;
  availableGeneral?: number;
  availableVip?: number;
  availableTotal?: number;
  seatMapEnabled?: boolean;
  blockedSeats?: string[];
  occupiedSeats?: string[];
  combos?: EventComboItem[];
  saleBadge?: string;
  accessConditions: string;
  promoInfo: string;
  galleryCategoryId: string;
  specialCampaignId: string;
  notifyOnPublish: boolean;
  imageUrl: string;
  posterTheme: 'crimson' | 'cyan' | 'violet' | 'amber';
  status: 'draft' | 'published' | 'unpublished' | 'archived';
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SpecialCampaign {
  id: string;
  name: string;
  season: string;
  promoText: string;
  imageUrl: string;
  accentPrimary: string;
  accentSecondary: string;
  startDate: string;
  endDate: string;
  active: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PagoMovilConfig {
  enabled: boolean;
  bank: string;
  phone: string;
  documentId: string;
  holderName: string;
  instructions: string;
  iconUrl: string;
  qrImageUrl?: string;
  showQr?: boolean;
}

export interface TransferenciaConfig {
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
}

export interface BinanceConfig {
  enabled: boolean;
  payIdOrEmail: string;
  networkOrAsset: string;
  instructions: string;
  iconUrl: string;
  qrImageUrl?: string;
  showQr?: boolean;
}

export interface ExchangeRateConfig {
  rate: number;
  currency: string;
  source: string;
  lastUpdated: string;
  mode: 'auto' | 'manual';
}

export interface PaymentMethodsConfig {
  pago_movil: PagoMovilConfig;
  transferencia: TransferenciaConfig;
  binance: BinanceConfig;
  exchangeRate?: ExchangeRateConfig;
}

export type PaymentMethodType = 'pago_movil' | 'transferencia' | 'binance';
export type TicketTier = 'general' | 'vip';
export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'refunded';
export type TicketStatus = 'valid' | 'used' | 'revoked' | 'refunded';

export interface OrderComboSelection {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface OrderRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  eventId: string;
  eventTitle: string;
  ticketType: TicketTier | 'mixed';
  qty: number;
  generalQty?: number;
  vipQty?: number;
  selectedSeats?: string[];
  combos?: OrderComboSelection[];
  combosTotal?: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: PaymentMethodType;
  reference: string;
  paidAmountReported: number;
  paymentDate: string;
  payerName?: string;
  payerCedula?: string;
  payerPhone?: string;
  payerEmail?: string;
  hasVoucher: boolean;
  status: OrderStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketRecord {
  id: string;
  code: string;
  qrPayload: string;
  orderId: string;
  userId: string;
  userName: string;
  eventId: string;
  eventTitle: string;
  ticketType: TicketTier;
  seatLabel?: string;
  seq: number;
  status: TicketStatus;
  usedAt?: string;
  validatedBy?: string;
  createdAt: string;
}

export interface AccessValidationLog {
  id: string;
  timestamp: string;
  ticketId: string;
  ticketCode: string;
  eventId: string;
  eventTitle: string;
  holderName: string;
  ticketType: string;
  result:
    | 'ENTRADA_VALIDA'
    | 'YA_UTILIZADA'
    | 'NO_EXISTE'
    | 'FIRMA_INVALIDA'
    | 'PAGO_NO_APROBADO'
    | 'TICKET_REVOCADO'
    | 'EVENTO_NO_VIGENTE';
  message: string;
  validatedBy: string;
}

export type AdFormatType = 'billboard' | 'spotlight' | 'sponsor' | 'tribute';
export type AdVisualPreset = 'stage' | 'vip_bar' | 'streetwear' | 'rooftop';

export interface PromotionAd {
  id: string;
  title: string;
  slogan: string;
  text: string;
  imageUrl: string;
  eventId: string;
  linkSection: PublicSection;
  tribute: boolean;
  adFormat?: AdFormatType;
  sponsorBrand?: string;
  ctaLabel?: string;
  externalUrl?: string;
  visualPreset?: AdVisualPreset;
  from: string;
  to: string;
  published: boolean;
  order: number;
}

export interface AdInquiryRecord {
  id: string;
  brandName: string;
  contactName: string;
  email: string;
  phone: string;
  packageInterest: string;
  message: string;
  createdAt: string;
}

export interface GalleryCategory {
  id: string;
  name: string;
  slug: string;
  order: number;
}

export interface GalleryPhoto {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  categoryName: string;
  eventId: string;
  eventTitle: string;
  date: string;
  published: boolean;
  authorName: string;
  visualPreset: 'outfit' | 'flow' | 'community' | 'night' | 'dj' | 'backstage';
}

export interface EventStatsSummary {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventIsoDate: string;
  eventStatus: EventItem['status'];
  specialCampaignId: string;
  specialCampaignName: string;
  totalCapacity: number;
  availableGeneral: number;
  availableVip: number;
  availableTotal: number;
  reservedTickets: number;
  soldTickets: number;
  paidConfirmedTickets: number;
  pendingPaymentTickets: number;
  pendingVouchersCount: number;
  approvedVouchersCount: number;
  rejectedVouchersCount: number;
  generalSold: number;
  vipSold: number;
  grossConfirmedRevenue: number;
  refundedAmount: number;
  netConfirmedRevenue: number;
  validatedAtDoorCount: number;
  unusedValidTicketsCount: number;
}

export interface BirthdayEntry {
  userId: string;
  name: string;
  birthDay: number;
  birthMonth: number;
  isLeapDayBirthday: boolean;
  displayDayInSelectedYear: number;
  ageInSelectedYear?: number;
  email?: string;
  phone?: string;
  marketingOptIn: boolean;
}

export interface NotificationDispatchLog {
  id: string;
  eventId: string;
  eventTitle: string;
  kind: 'new_event' | 'upcoming_reminder';
  recipientCount: number;
  skippedNoConsentCount: number;
  skippedDuplicateCount: number;
  status: 'queued_awaiting_smtp' | 'sent' | 'error';
  providerNote: string;
  triggeredBy: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
}

export interface SiteSettings {
  brandHandle: string;
  instagramUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  whatsappContact: string;
  cityBase: string;
  timezone: string;
  refundFeePercent: number;
  emailNotificationsEnabled: boolean;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  event: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  ip: string;
  actorEmail?: string;
  details: string;
}

export interface SecurityMetrics {
  hmacAlgorithm: string;
  rateLimiterActive: boolean;
  activeIpBuckets: number;
  failedLoginAttemptsTracked: number;
  totalSecurityEvents: number;
  piiIsolation: string;
  voucherMagicCheck: string;
  ticketReplayProtection: string;
}
