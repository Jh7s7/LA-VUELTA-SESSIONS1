import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Sparkles,
  BarChart3,
  ReceiptText,
  FileCheck2,
  QrCode,
  ScanLine,
  Megaphone,
  Images,
  Users,
  ShieldAlert,
  Cake,
  Mail,
  WalletCards,
  Settings,
} from 'lucide-react';
import { PermissionKey } from '../../types';

export type AdminNavGroup =
  | 'Comando Ejecutivo'
  | 'Taquilla y Finanzas'
  | 'Programación y Marca'
  | 'Comunidad y Seguridad';

export interface AdminNavItem {
  key: PermissionKey;
  label: string;
  shortDesc: string;
  group: AdminNavGroup;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  'Comando Ejecutivo',
  'Taquilla y Finanzas',
  'Programación y Marca',
  'Comunidad y Seguridad',
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  // 1. Comando Ejecutivo
  {
    key: PermissionKey.OVERVIEW,
    label: 'Centro de Control',
    shortDesc: 'Pulso ejecutivo, métricas globales y acciones inmediatas',
    group: 'Comando Ejecutivo',
    icon: LayoutDashboard,
  },
  {
    key: PermissionKey.SALES_STATS,
    label: 'Analítica por Evento',
    shortDesc: 'Ingresos confirmados, cupos y exportación CSV',
    group: 'Comando Ejecutivo',
    icon: BarChart3,
  },

  // 2. Taquilla y Finanzas
  {
    key: PermissionKey.PENDING_VOUCHERS,
    label: 'Revisión de Comprobantes',
    shortDesc: 'Auditar pagos pendientes y emitir pases QR',
    group: 'Taquilla y Finanzas',
    icon: FileCheck2,
  },
  {
    key: PermissionKey.ORDERS_PAYMENTS,
    label: 'Órdenes y Reembolsos',
    shortDesc: 'Libro contable de transacciones y devoluciones',
    group: 'Taquilla y Finanzas',
    icon: ReceiptText,
  },
  {
    key: PermissionKey.TICKETS_QR,
    label: 'Pases QR Emitidos',
    shortDesc: 'Registro criptográfico de entradas activas y usadas',
    group: 'Taquilla y Finanzas',
    icon: QrCode,
  },
  {
    key: PermissionKey.VALIDATOR,
    label: 'Control de Puerta y LB',
    shortDesc: 'Escáner atómico de acceso y protocolo LB Validador',
    group: 'Taquilla y Finanzas',
    icon: ScanLine,
  },
  {
    key: PermissionKey.PAYMENT_METHODS,
    label: 'Datos de Pago (Pago Móvil / Binance)',
    shortDesc: 'Cargar y editar datos de Pago Móvil, Binance Pay y Banco receptor',
    group: 'Taquilla y Finanzas',
    icon: WalletCards,
  },

  // 3. Programación y Marca
  {
    key: PermissionKey.EVENTS,
    label: 'Producción de Eventos',
    shortDesc: 'Crear, publicar, ocultar o archivar sesiones',
    group: 'Programación y Marca',
    icon: CalendarDays,
  },
  {
    key: PermissionKey.SPECIAL_EVENTS,
    label: 'Campañas de Temporada',
    shortDesc: 'Ediciones temáticas y categorías dinámicas',
    group: 'Programación y Marca',
    icon: Sparkles,
  },
  {
    key: PermissionKey.PROMOS_FLYERS,
    label: 'Publicidad y Tributos',
    shortDesc: 'Vallas comerciales, patrocinantes, flyers y homenajes',
    group: 'Programación y Marca',
    icon: Megaphone,
  },
  {
    key: PermissionKey.GALLERY_ADMIN,
    label: 'Curaduría de Galería',
    shortDesc: 'Archivo fotográfico y categorías visuales',
    group: 'Programación y Marca',
    icon: Images,
  },

  // 4. Comunidad y Seguridad
  {
    key: PermissionKey.USERS,
    label: 'Directorio de Miembros',
    shortDesc: 'Clientes verificados y estado de cuentas',
    group: 'Comunidad y Seguridad',
    icon: Users,
  },
  {
    key: PermissionKey.BIRTHDAYS,
    label: 'Agenda de Cumpleaños',
    shortDesc: 'Cumpleañeros del mes y atención VIP',
    group: 'Comunidad y Seguridad',
    icon: Cake,
  },
  {
    key: PermissionKey.NOTIFICATIONS,
    label: 'Despacho de Correos',
    shortDesc: 'Recordatorios con consentimiento verificado',
    group: 'Comunidad y Seguridad',
    icon: Mail,
  },
  {
    key: PermissionKey.STAFF_RBAC,
    label: 'Equipo, Roles y Auditoría',
    shortDesc: 'Permisos granulares y bitácora de seguridad',
    group: 'Comunidad y Seguridad',
    icon: ShieldAlert,
  },
  {
    key: PermissionKey.SETTINGS,
    label: 'Parámetros y Seguridad',
    shortDesc: 'Identidad de marca, redes y diagnóstico HTTPS',
    group: 'Comunidad y Seguridad',
    icon: Settings,
  },
];
