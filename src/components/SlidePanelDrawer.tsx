import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  X,
  Compass,
  Calendar,
  Sparkles,
  Ticket,
  Images,
  Megaphone,
  Moon,
  Sun,
  LogOut,
  LogIn,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  Eye,
  LayoutDashboard,
} from 'lucide-react';
import {
  AuthenticatedUser,
  PermissionKey,
  PublicSection,
  ROLE_LABELS,
} from '../types';
import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS } from './admin/AdminNavConfig';
import { AnimatedBrandMark } from './VisualArtwork';

interface SlidePanelDrawerProps {
  open: boolean;
  onClose: () => void;
  currentUser: AuthenticatedUser | null;
  activePublicSection: PublicSection;
  inAdminWorkspace: boolean;
  activeAdminSection: PermissionKey | 'user_portal_live';
  myValidTicketsCount: number;
  myPendingOrdersCount: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigatePublic: (section: PublicSection) => void;
  onNavigateAdmin: (section: PermissionKey | 'user_portal_live') => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => Promise<void>;
}

export const SlidePanelDrawer: React.FC<SlidePanelDrawerProps> = ({
  open,
  onClose,
  currentUser,
  activePublicSection,
  inAdminWorkspace,
  activeAdminSection,
  myValidTicketsCount,
  myPendingOrdersCount,
  darkMode,
  onToggleDarkMode,
  onNavigatePublic,
  onNavigateAdmin,
  onOpenAuth,
  onLogout,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const isStaffOrAdmin = Boolean(currentUser && currentUser.permissions.length > 0);
  const allowedAdminItems = currentUser
    ? ADMIN_NAV_ITEMS.filter((item) => currentUser.permissions.includes(item.key))
    : [];

  // Consumer-only navigation links (for visitors & normal users)
  const consumerLinks: {
    id: PublicSection;
    index: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'home', index: '01', label: 'Portada de Temporada', icon: Compass },
    { id: 'eventos', index: '02', label: 'Cartelera de Sesiones', icon: Calendar },
    { id: 'especiales', index: '03', label: 'Ediciones Especiales', icon: Sparkles },
    { id: 'galeria', index: '04', label: 'Archivo Visual y Galería', icon: Images },
    { id: 'promos', index: '05', label: 'Publicidad y Tributos', icon: Megaphone },
  ];

  const backdropTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

  const panelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <AnimatePresence>
      {open && isStaffOrAdmin && currentUser && (
        <div
          key="exec-drawer"
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Consola ejecutiva de control"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={onClose}
          />

          <motion.aside
            initial={{ x: '-100%', opacity: 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0.85 }}
            transition={panelTransition}
            className="relative z-10 flex h-full w-[340px] max-w-[90vw] flex-col border-r border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#090B10] dark:text-slate-100"
          >
            {/* Executive Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800/90">
              <div className="group flex items-center gap-3 min-w-0">
                <AnimatedBrandMark size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                    Punto de Control
                  </p>
                  <p className="truncate text-[11px] text-amber-600 dark:text-[#D4AF37]">
                    {ROLE_LABELS[currentUser.role]}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar consola"
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* Authenticated Staff Identity */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#10131C]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {currentUser.name}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {currentUser.email}
                    </p>
                  </div>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#D4AF37]" />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateAdmin(allowedAdminItems[0]?.key || PermissionKey.OVERVIEW);
                      onClose();
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      inAdminWorkspace && activeAdminSection !== 'user_portal_live'
                        ? 'bg-[#E50914] text-white'
                        : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span>Consola Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateAdmin('user_portal_live');
                      onClose();
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      inAdminWorkspace && activeAdminSection === 'user_portal_live'
                        ? 'bg-[#D4AF37] text-slate-950'
                        : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Vista Usuario</span>
                  </button>
                </div>
              </div>

              {/* Grouped Executive Modules (Strictly Filtered by Role Permissions) */}
              {ADMIN_NAV_GROUPS.map((groupName) => {
                const items = allowedAdminItems.filter((i) => i.group === groupName);
                if (items.length === 0) return null;
                return (
                  <div key={groupName}>
                    <p className="mb-1.5 px-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                      {groupName}
                    </p>
                    <nav className="space-y-0.5">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const active = inAdminWorkspace && activeAdminSection === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                              onNavigateAdmin(item.key);
                              onClose();
                            }}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                              active
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                            }`}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                );
              })}

              {/* LB Validador Direct Shortcut ONLY for authorized Validator Staff / Admin */}
              {currentUser.permissions.includes(PermissionKey.VALIDATOR) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#10131C]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Smartphone className="h-4 w-4 shrink-0 text-[#E50914]" />
                      <span className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                        Escáner LB Validador
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateAdmin(PermissionKey.VALIDATOR);
                        onClose();
                      }}
                      className="rounded-md bg-[#E50914] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#c80812] whitespace-nowrap"
                    >
                      Abrir Lector
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Executive Footer */}
            <div className="border-t border-slate-200 px-4 py-3.5 space-y-1.5 dark:border-slate-800">
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <span className="flex items-center gap-2.5">
                  {darkMode ? (
                    <Moon className="h-4 w-4 text-[#D4AF37]" />
                  ) : (
                    <Sun className="h-4 w-4 text-amber-600" />
                  )}
                  <span>{darkMode ? 'Consola Obsidian' : 'Consola Clara'}</span>
                </span>
                <span className="text-[11px] text-slate-400">Cambiar</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await onLogout();
                  onClose();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar Sesión Ejecutiva</span>
              </button>
            </div>
          </motion.aside>
        </div>
      )}

      {open && (!isStaffOrAdmin || !currentUser) && (
        <div
          key="consumer-drawer"
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de experiencia y pases"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={onClose}
          />

          <motion.aside
            initial={{ x: '-100%', opacity: 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0.85 }}
            transition={panelTransition}
            className="relative z-10 flex h-full w-80 max-w-[88vw] flex-col border-r border-zinc-200 bg-[#FAFAFA] text-zinc-900 shadow-2xl dark:border-white/10 dark:bg-[#070709] dark:text-zinc-100"
          >
            {/* Consumer Brand Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-white/10">
              <div className="group flex items-center gap-3 min-w-0">
                <AnimatedBrandMark size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-display text-2xl leading-none tracking-wider text-zinc-900 dark:text-white">
                    LA VUELTA SESSIONS
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                    Acceso Oficial y Billetera QR
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar menú"
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
              {/* Member Wallet Card */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                {currentUser ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Miembro de la Comunidad
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-zinc-900 dark:text-white">
                        {currentUser.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {currentUser.email}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onNavigatePublic('my-tickets');
                        onClose();
                      }}
                      className="flex w-full items-center justify-between rounded-xl bg-[#E50914] px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#c80812]"
                    >
                      <span className="flex items-center gap-2">
                        <Ticket className="h-4 w-4" />
                        <span>Mis Pases QR</span>
                      </span>
                      <span className="font-mono-tabular">
                        {myValidTicketsCount} activo{myValidTicketsCount === 1 ? '' : 's'}
                        {myPendingOrdersCount > 0 ? ` · ${myPendingOrdersCount} rev.` : ''}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Accede a tu cuenta para adquirir entradas General o VIP y consultar tus códigos QR nominativos.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenAuth('login');
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-[#E50914] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#c80812] whitespace-nowrap"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        <span>Ingresar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenAuth('register');
                        }}
                        className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.08] whitespace-nowrap"
                      >
                        Crear Cuenta
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Editorial Experience Navigation */}
              <div>
                <p className="mb-2 px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Recorrido de Temporada
                </p>
                <nav className="space-y-1">
                  {consumerLinks.map((item) => {
                    const Icon = item.icon;
                    const active = activePublicSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onNavigatePublic(item.id);
                          onClose();
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                            : 'text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="font-mono-tabular text-[11px] opacity-60">
                            {item.index}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </span>
                        <Icon className="h-4 w-4 shrink-0 opacity-70" />
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Consumer Footer */}
            <div className="border-t border-zinc-200 px-4 py-3.5 space-y-1.5 dark:border-white/10">
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
              >
                <span className="flex items-center gap-2.5">
                  {darkMode ? (
                    <Moon className="h-4 w-4 text-[#D4AF37]" />
                  ) : (
                    <Sun className="h-4 w-4 text-amber-600" />
                  )}
                  <span>{darkMode ? 'Atmósfera Nocturna' : 'Edición Clara'}</span>
                </span>
                <span className="text-[11px] text-zinc-500">Cambiar</span>
              </button>

              {currentUser && (
                <button
                  type="button"
                  onClick={async () => {
                    await onLogout();
                    onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Salir de mi cuenta</span>
                </button>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
