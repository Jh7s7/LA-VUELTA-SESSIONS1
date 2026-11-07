import React, { useEffect, useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Moon,
  Sun,
  Eye,
  Monitor,
  Smartphone,
  ShieldCheck,
  LogOut,
  ExternalLink,
  WalletCards,
} from 'lucide-react';
import {
  AuthenticatedUser,
  DEFAULT_ROLE_PERMISSIONS,
  PermissionKey,
  PublicSection,
  ROLE_LABELS,
  SiteSettings,
  UserRole,
} from '../types';
import { apiRequest } from '../lib/api';
import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS } from './admin/AdminNavConfig';
import { AdminStatsAndEvents } from './admin/AdminStatsAndEvents';
import { AdminPaymentsAndQr } from './admin/AdminPaymentsAndQr';
import { AdminContentAndUsers } from './admin/AdminContentAndUsers';
import { PublicPlatform } from './PublicPlatform';

export type ControlSectionKey = PermissionKey | 'user_portal_live';

interface AdminWorkspaceProps {
  currentUser: AuthenticatedUser;
  activeSection: ControlSectionKey;
  onSelectSection: (section: ControlSectionKey) => void;
  onExitToFullPublic: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  securityStatus: {
    httpsActive: boolean;
    protocol: string;
    origin: string;
    googleAuthConfigured: boolean;
    emailProviderConfigured: boolean;
  };
  publicPortalData: {
    activePublicSection: PublicSection;
    selectedEventId: string | null;
    events: any[];
    specialCampaigns: any[];
    promotions: any[];
    galleryCategories: any[];
    galleryPhotos: any[];
    activePaymentMethods: Record<string, any>;
    myOrders: any[];
    myTickets: any[];
    settings: SiteSettings;
    onNavigatePublic: (section: PublicSection, eventId?: string) => void;
    onOpenAuth: (mode: 'login' | 'register') => void;
  };
  onOpenSlideDrawer: () => void;
  onRefreshPublicBootstrap: () => Promise<void>;
  onLogout: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const SIDEBAR_PREF_KEY = 'lv_admin_sidebar_collapsed';

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  currentUser,
  activeSection,
  onSelectSection,
  onExitToFullPublic,
  darkMode,
  onToggleDarkMode,
  securityStatus,
  publicPortalData,
  onOpenSlideDrawer,
  onRefreshPublicBootstrap,
  onLogout,
  onNotify,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_PREF_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewAuthMode, setPreviewAuthMode] = useState<'visitor' | 'authenticated'>('visitor');

  // Optional perspective filter for Super Admin to audit what other staff roles see without logging out
  const [simulatedRoleFilter, setSimulatedRoleFilter] = useState<UserRole | 'ALL'>('ALL');

  const [workspaceData, setWorkspaceData] = useState<any>({
    events: [],
    specialCampaigns: [],
    seasons: [],
    eventStats: [],
    orders: [],
    tickets: [],
    accessLogs: [],
    promotions: [],
    adInquiries: [],
    galleryCategories: [],
    galleryPhotos: [],
    paymentMethods: null,
    users: [],
    notificationLogs: [],
    auditLogs: [],
    settings: null,
  });

  const effectivePermissions =
    currentUser.role === UserRole.SUPER_ADMIN && simulatedRoleFilter !== 'ALL'
      ? DEFAULT_ROLE_PERMISSIONS[simulatedRoleFilter]
      : currentUser.permissions;

  const allowedItems = ADMIN_NAV_ITEMS.filter((item) =>
    effectivePermissions.includes(item.key)
  );

  useEffect(() => {
    if (
      activeSection !== 'user_portal_live' &&
      allowedItems.length > 0 &&
      !effectivePermissions.includes(activeSection)
    ) {
      onSelectSection(allowedItems[0].key);
    }
  }, [effectivePermissions, activeSection]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_PREF_KEY, String(next));
      } catch {
        // Ignore storage write error
      }
      return next;
    });
  };

  const loadWorkspace = async () => {
    try {
      const data = await apiRequest('GET', '/api/admin/workspace');
      setWorkspaceData(data);
      await onRefreshPublicBootstrap();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [currentUser.id, currentUser.role]);

  const pendingVouchersCount = (workspaceData.orders || []).filter(
    (o: any) => o.status === 'pending'
  ).length;

  const activePaymentMethodCount = Object.keys(publicPortalData.activePaymentMethods || {}).length;

  const currentNavMeta =
    activeSection === 'user_portal_live'
      ? {
          label: 'Vista Usuario en Vivo',
          shortDesc: 'Supervisión e interacción directa con la experiencia del usuario normal',
          group: 'Comando Ejecutivo',
        }
      : allowedItems.find((i) => i.key === activeSection) || allowedItems[0];

  const renderSidebarLinks = (isMobileDrawer: boolean) => {
    const showText = isMobileDrawer || !collapsed;

    return (
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* Highlighted Live User Experience Mirror inside Control Center */}
        <div>
          {showText && (
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">
              Espejo del Cliente
            </p>
          )}
          <div className="group relative">
            <button
              type="button"
              title={!showText ? 'Vista Usuario en Vivo' : undefined}
              onClick={() => {
                onSelectSection('user_portal_live');
                if (isMobileDrawer) setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                activeSection === 'user_portal_live'
                  ? 'bg-[#D4AF37] text-slate-950'
                  : 'border border-amber-500/25 bg-amber-500/[0.06] text-amber-800 hover:bg-amber-500/15 dark:text-[#D4AF37]'
              } ${!showText ? 'justify-center px-0' : ''}`}
            >
              <Eye className="h-4 w-4 shrink-0" />
              {showText && <span className="truncate">Vista Usuario en Vivo</span>}
            </button>
            {!showText && (
              <div
                role="tooltip"
                className="pointer-events-none invisible absolute top-1/2 left-full z-40 ml-2.5 -translate-y-1/2 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100"
              >
                Vista Usuario en Vivo
              </div>
            )}
          </div>
        </div>

        {/* Grouped Executive Modules */}
        {ADMIN_NAV_GROUPS.map((groupName) => {
          const groupItems = allowedItems.filter((i) => i.group === groupName);
          if (groupItems.length === 0) return null;

          return (
            <div key={groupName}>
              {showText && (
                <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                  {groupName}
                </p>
              )}
              <nav className="space-y-0.5" aria-label={groupName}>
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.key;
                  const showBadge =
                    item.key === PermissionKey.PENDING_VOUCHERS && pendingVouchersCount > 0;

                  return (
                    <div key={item.key} className="group relative">
                      <button
                        type="button"
                        title={!showText ? item.label : undefined}
                        onClick={() => {
                          onSelectSection(item.key);
                          if (isMobileDrawer) setMobileMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-[#E50914] text-white'
                            : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-white/[0.06]'
                        } ${!showText ? 'justify-center px-0' : ''}`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-4 w-4 shrink-0" />
                          {showText && <span className="truncate">{item.label}</span>}
                        </span>
                        {showText && showBadge && (
                          <span
                            className={`font-mono-tabular text-[11px] font-bold ${
                              isActive ? 'text-white' : 'text-[#E50914]'
                            }`}
                          >
                            {pendingVouchersCount}
                          </span>
                        )}
                      </button>

                      {!showText && (
                        <div
                          role="tooltip"
                          className="pointer-events-none invisible absolute top-1/2 left-full z-40 ml-2.5 -translate-y-1/2 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100"
                        >
                          {item.label}
                          {showBadge ? ` (${pendingVouchersCount})` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900 dark:bg-[#090B10] dark:text-slate-100">
      {/* Desktop Left Collapsible Executive Sidebar */}
      <aside
        className={`hidden md:flex md:flex-col md:shrink-0 border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-800/90 dark:bg-[#0D1017] ${
          collapsed ? 'md:w-[74px]' : 'md:w-[272px]'
        }`}
      >
        <div
          className={`flex h-16 items-center border-b border-slate-200 px-4 dark:border-slate-800/90 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/assets/lv-logo.png"
                alt="LV"
                referrerPolicy="no-referrer"
                className="h-8 w-8 shrink-0 rounded-lg object-contain ring-1 ring-slate-200 dark:ring-white/10"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold tracking-tight text-slate-900 dark:text-white">
                  PUNTO DE CONTROL
                </p>
                <p className="truncate text-[10px] font-medium text-amber-600 dark:text-[#D4AF37]">
                  LA VUELTA SESSIONS
                </p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir panel' : 'Contraer panel'}
            title={collapsed ? 'Expandir panel' : 'Contraer panel'}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {renderSidebarLinks(false)}

        {/* Executive Account Footer */}
        <div className="border-t border-slate-200 p-3 space-y-2 dark:border-slate-800/90">
          {!collapsed ? (
            <>
              {currentUser.role === UserRole.SUPER_ADMIN && (
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-400">
                    Auditar vista de rol:
                  </label>
                  <select
                    value={simulatedRoleFilter}
                    onChange={(e) => setSimulatedRoleFilter(e.target.value as UserRole | 'ALL')}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-800 dark:border-slate-800 dark:bg-[#131722] dark:text-slate-200"
                  >
                    <option value="ALL">Administrador Principal (16 módulos)</option>
                    <option value={UserRole.EVENT_MANAGER}>Como Gestor de Eventos</option>
                    <option value={UserRole.PAYMENT_REVIEWER}>Como Revisor de Pagos</option>
                    <option value={UserRole.DOOR_STAFF}>Como Personal de Puerta</option>
                    <option value={UserRole.PROMO_DESIGNER}>Como Diseñador / Promos</option>
                    <option value={UserRole.GALLERY_EDITOR}>Como Editor de Galería</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 px-1 pt-1">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                    {currentUser.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {ROLE_LABELS[currentUser.role]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div
              title={`${currentUser.name} (${ROLE_LABELS[currentUser.role]})`}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#D4AF37]/20 text-xs font-bold text-[#D4AF37]"
            >
              <ShieldCheck className="h-4 w-4" />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Executive Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/75"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[86vw] flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0D1017]">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/lv-logo.png"
                  alt="LV"
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded object-contain"
                />
                <span className="text-xs font-bold tracking-tight">PUNTO DE CONTROL</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-2 text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderSidebarLinks(true)}
          </aside>
        </div>
      )}

      {/* Main Executive Viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Executive Top Bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md md:px-8 dark:border-slate-800/90 dark:bg-[#090B10]/95">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir módulos de control"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <button
                type="button"
                onClick={onOpenSlideDrawer}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white whitespace-nowrap"
              >
                {currentNavMeta?.group || 'Punto de Control'}
              </button>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {currentNavMeta?.label || 'Módulo'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                onSelectSection(
                  activeSection === 'user_portal_live'
                    ? allowedItems[0]?.key || PermissionKey.OVERVIEW
                    : 'user_portal_live'
                )
              }
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'user_portal_live'
                  ? 'bg-[#E50914] text-white hover:bg-[#c80812]'
                  : 'border border-amber-500/35 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-[#D4AF37]'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>
                {activeSection === 'user_portal_live'
                  ? 'Volver a Módulos Admin'
                  : 'Ver Todo lo de Usuario'}
              </span>
            </button>
            {effectivePermissions.includes(PermissionKey.PAYMENT_METHODS) && (
              <button
                type="button"
                onClick={() => onSelectSection(PermissionKey.PAYMENT_METHODS)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeSection === PermissionKey.PAYMENT_METHODS
                    ? 'bg-[#E50914] text-white'
                    : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <WalletCards className="h-3.5 w-3.5 text-[#E50914]" />
                <span>Cuentas de Pago</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label="Alternar tema de consola"
              className="rounded-xl border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* =========================================================
            INTEGRATED LIVE USER EXPERIENCE MIRROR INSIDE CONTROL CENTER
        ========================================================= */}
        {activeSection === 'user_portal_live' ? (
          <div className="flex-1 p-4 md:p-6 space-y-5">
            {/* Executive Supervision Bar over the User Portal */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 dark:border-slate-800 dark:bg-[#0D1017]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-[#D4AF37]">
                    Supervisión en Tiempo Real desde el Punto de Control
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    Estás inspeccionando exactamente lo que ve e interactúa un usuario normal:{' '}
                    <strong className="font-mono-tabular text-slate-900 dark:text-white">
                      {publicPortalData.events.length}
                    </strong>{' '}
                    sesiones publicadas ·{' '}
                    <strong className="font-mono-tabular text-slate-900 dark:text-white">
                      {publicPortalData.specialCampaigns.length}
                    </strong>{' '}
                    ediciones especiales ·{' '}
                    <strong className="font-mono-tabular text-slate-900 dark:text-white">
                      {activePaymentMethodCount}
                    </strong>{' '}
                    pasarelas activas en checkout ·{' '}
                    <strong className="font-mono-tabular text-slate-900 dark:text-white">
                      {publicPortalData.galleryPhotos.length}
                    </strong>{' '}
                    fotos en galería.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Visitor vs Registered Customer Mode inside Supervision Mirror */}
                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-[#141824]">
                    <button
                      type="button"
                      onClick={() => setPreviewAuthMode('visitor')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        previewAuthMode === 'visitor'
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Usuario Visitante
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewAuthMode('authenticated')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        previewAuthMode === 'authenticated'
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Cliente con Pase
                    </button>
                  </div>

                  {/* Desktop vs Mobile 390px Customer Simulator */}
                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-[#141824]">
                    <button
                      type="button"
                      onClick={() => setPreviewViewport('desktop')}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        previewViewport === 'desktop'
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      <span>Escritorio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewport('mobile')}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        previewViewport === 'mobile'
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>Móvil (390px)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onExitToFullPublic}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 whitespace-nowrap"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Pantalla Completa</span>
                  </button>
                </div>
              </div>

              {/* Quick Section Switcher & Direct Edit Shortcuts */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3.5 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'home', label: 'Portada' },
                      { id: 'eventos', label: 'Cartelera' },
                      { id: 'especiales', label: 'Especiales' },
                      { id: 'event-detail', label: 'Checkout Cliente' },
                      { id: 'my-tickets', label: 'Billetera QR' },
                      { id: 'galeria', label: 'Galería' },
                      { id: 'promos', label: 'Tributos' },
                    ] as { id: PublicSection; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => publicPortalData.onNavigatePublic(tab.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        publicPortalData.activePublicSection === tab.id
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-[#141824] dark:text-slate-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {effectivePermissions.includes(PermissionKey.PAYMENT_METHODS) &&
                    activePaymentMethodCount === 0 && (
                      <button
                        type="button"
                        onClick={() => onSelectSection(PermissionKey.PAYMENT_METHODS)}
                        className="font-semibold text-[#E50914] hover:underline whitespace-nowrap"
                      >
                        Activar pasarelas de pago →
                      </button>
                    )}
                  {effectivePermissions.includes(PermissionKey.EVENTS) && (
                    <button
                      type="button"
                      onClick={() => onSelectSection(PermissionKey.EVENTS)}
                      className="font-medium text-slate-600 hover:underline dark:text-slate-300 whitespace-nowrap"
                    >
                      Editar eventos →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Framed Live Consumer Portal */}
            <div
              className={`mx-auto overflow-hidden rounded-2xl border border-slate-300 shadow-xl transition-all dark:border-slate-800 ${
                previewViewport === 'mobile' ? 'max-w-[400px]' : 'w-full'
              }`}
            >
              <PublicPlatform
                currentUser={previewAuthMode === 'visitor' ? null : currentUser}
                activeSection={publicPortalData.activePublicSection}
                selectedEventId={publicPortalData.selectedEventId}
                events={publicPortalData.events}
                specialCampaigns={publicPortalData.specialCampaigns}
                promotions={publicPortalData.promotions}
                galleryCategories={publicPortalData.galleryCategories}
                galleryPhotos={publicPortalData.galleryPhotos}
                activePaymentMethods={publicPortalData.activePaymentMethods}
                myOrders={previewAuthMode === 'visitor' ? [] : publicPortalData.myOrders}
                myTickets={previewAuthMode === 'visitor' ? [] : publicPortalData.myTickets}
                settings={publicPortalData.settings}
                embeddedInControlCenter={true}
                onNavigate={publicPortalData.onNavigatePublic}
                onOpenPanelDrawer={onOpenSlideDrawer}
                onOpenAuth={publicPortalData.onOpenAuth}
                onRefreshBootstrap={onRefreshPublicBootstrap}
                onNotify={onNotify}
              />
            </div>
          </div>
        ) : (
          <main className="mx-auto w-full max-w-[1340px] flex-1 p-4 md:p-8">
            {loading ? (
              <div className="space-y-4">
                <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
                    />
                  ))}
                </div>
              </div>
            ) : [
                PermissionKey.OVERVIEW,
                PermissionKey.EVENTS,
                PermissionKey.SPECIAL_EVENTS,
                PermissionKey.SALES_STATS,
              ].includes(activeSection) ? (
              <AdminStatsAndEvents
                activeSection={activeSection}
                events={workspaceData.events}
                specialCampaigns={workspaceData.specialCampaigns}
                seasons={workspaceData.seasons}
                initialStats={workspaceData.eventStats}
                galleryCategories={workspaceData.galleryCategories}
                userPermissions={effectivePermissions}
                paymentMethods={workspaceData.paymentMethods}
                onRefresh={loadWorkspace}
                onNavigateSection={onSelectSection}
                onOpenLiveUserPortal={() => onSelectSection('user_portal_live')}
                onNotify={onNotify}
              />
            ) : [
                PermissionKey.PENDING_VOUCHERS,
                PermissionKey.ORDERS_PAYMENTS,
                PermissionKey.TICKETS_QR,
                PermissionKey.VALIDATOR,
                PermissionKey.PAYMENT_METHODS,
              ].includes(activeSection) ? (
              <AdminPaymentsAndQr
                activeSection={activeSection}
                orders={workspaceData.orders}
                tickets={workspaceData.tickets}
                accessLogs={workspaceData.accessLogs}
                events={workspaceData.events}
                paymentMethods={workspaceData.paymentMethods}
                onRefresh={loadWorkspace}
                onNotify={onNotify}
              />
            ) : (
              <AdminContentAndUsers
                activeSection={activeSection}
                promotions={workspaceData.promotions}
                adInquiries={workspaceData.adInquiries || []}
                galleryCategories={workspaceData.galleryCategories}
                galleryPhotos={workspaceData.galleryPhotos}
                events={workspaceData.events}
                users={workspaceData.users}
                auditLogs={workspaceData.auditLogs}
                notificationLogs={workspaceData.notificationLogs}
                settings={workspaceData.settings}
                securityStatus={securityStatus}
                securityAuditLogs={workspaceData.securityAuditLogs || []}
                securityMetrics={workspaceData.securityMetrics}
                currentUserRole={currentUser.role}
                onRefresh={loadWorkspace}
                onNotify={onNotify}
              />
            )}
          </main>
        )}
      </div>
    </div>
  );
};
