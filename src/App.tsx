/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AuthenticatedUser,
  ExchangeRateConfig,
  PermissionKey,
  PublicSection,
  SiteSettings,
} from './types';
import { apiRequest, setStoredToken } from './lib/api';
import { signOutFirebase, testFirestoreConnection } from './lib/firebase';
import { PublicPlatform } from './components/PublicPlatform';
import { AdminWorkspace, ControlSectionKey } from './components/AdminWorkspace';
import { SlidePanelDrawer } from './components/SlidePanelDrawer';
import { AuthModalMode, AuthModals } from './components/AuthModals';
import { ValidatorTerminalModal } from './components/ValidatorTerminalModal';
import { AnimatedBrandMark } from './components/VisualArtwork';
import { ShieldCheck } from 'lucide-react';

const DEFAULT_SETTINGS: SiteSettings = {
  brandHandle: '@lavueltasessions',
  instagramUrl: 'https://instagram.com',
  tiktokUrl: 'https://tiktok.com',
  youtubeUrl: 'https://youtube.com',
  whatsappContact: '',
  cityBase: 'Maracay, Aragua · Venezuela',
  timezone: 'America/Caracas',
  refundFeePercent: 0,
  emailNotificationsEnabled: true,
};

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lv_dark_mode');
      return saved ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [bootstrapping, setBootstrapping] = useState(true);
  const initialRouteResolved = useRef(false);
  const isStandaloneValidator =
    typeof window !== 'undefined' &&
    (window.location.pathname.replace(/\/+$/, '') === '/validador' ||
      new URLSearchParams(window.location.search).get('mode') === 'validador');

  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [specialCampaigns, setSpecialCampaigns] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [galleryCategories, setGalleryCategories] = useState<any[]>([]);
  const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
  const [activePaymentMethods, setActivePaymentMethods] = useState<Record<string, any>>({});
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateConfig | undefined>(undefined);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [securityStatus, setSecurityStatus] = useState({
    httpsActive: false,
    protocol: 'http',
    origin: '',
    googleAuthConfigured: true,
    emailProviderConfigured: false,
  });

  // Navigation State
  const [inAdminWorkspace, setInAdminWorkspace] = useState(false);
  const [activePublicSection, setActivePublicSection] = useState<PublicSection>('home');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeAdminSection, setActiveAdminSection] = useState<ControlSectionKey>(
    PermissionKey.OVERVIEW
  );

  // Slide Panel Drawer & Auth Modals
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>(null);
  const [pendingVerifyHint, setPendingVerifyHint] = useState<string | undefined>(undefined);

  // Toast Notification
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('lv_dark_mode', String(darkMode));
    } catch {
      // Ignore storage error
    }
  }, [darkMode]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const loadBootstrap = async () => {
    try {
      const data = await apiRequest('GET', '/api/bootstrap');
      const user: AuthenticatedUser | null = data.currentUser || null;
      setCurrentUser(user);
      const loadedEvents = data.events || [];
      setEvents(loadedEvents);
      setSelectedEventId((prev) =>
        prev && loadedEvents.some((e: any) => e.id === prev)
          ? prev
          : loadedEvents[0]?.id || null
      );
      setSpecialCampaigns(data.specialCampaigns || []);
      setPromotions(data.promotions || []);
      setGalleryCategories(data.galleryCategories || []);
      setGalleryPhotos(data.galleryPhotos || []);
      setActivePaymentMethods(data.activePaymentMethods || {});
      if (data.exchangeRate) {
        setExchangeRate(data.exchangeRate);
      } else if (data.activePaymentMethods?.exchangeRate) {
        setExchangeRate(data.activePaymentMethods.exchangeRate);
      }
      setMyOrders(data.myOrders || []);
      setMyTickets(data.myTickets || []);
      if (data.settings) setSettings(data.settings);
      if (data.securityStatus) setSecurityStatus(data.securityStatus);

      // Automatically place Staff/Admin inside Punto de Control on initial load
      if (!user || user.permissions.length === 0) {
        setInAdminWorkspace(false);
      } else if (!initialRouteResolved.current) {
        setActiveAdminSection(user.permissions[0] || PermissionKey.OVERVIEW);
        setInAdminWorkspace(true);
      }
      initialRouteResolved.current = true;
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBootstrapping(false);
    }
  };

  useEffect(() => {
    testFirestoreConnection();
    loadBootstrap();
  }, []);

  const handleNavigatePublic = (section: PublicSection, eventId?: string) => {
    if (eventId) setSelectedEventId(eventId);
    setActivePublicSection(section);
    setInAdminWorkspace(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigatePublicInsideControl = (section: PublicSection, eventId?: string) => {
    if (eventId) setSelectedEventId(eventId);
    setActivePublicSection(section);
  };

  const handleNavigateAdmin = (section: ControlSectionKey) => {
    if (!currentUser || currentUser.permissions.length === 0) {
      showToast('No tienes permisos para acceder a esa sección.', 'error');
      return;
    }
    if (section !== 'user_portal_live' && !currentUser.permissions.includes(section)) {
      showToast('No tienes permisos para acceder a ese módulo.', 'error');
      return;
    }
    setActiveAdminSection(section);
    setInAdminWorkspace(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      await signOutFirebase();
    } catch {
      // Ignore logout network error
    }
    setStoredToken('');
    setCurrentUser(null);
    setInAdminWorkspace(false);
    setActivePublicSection('home');
    await loadBootstrap();
    showToast('Sesión cerrada correctamente.', 'info');
  };

  if (isStandaloneValidator) {
    return <ValidatorTerminalModal open={true} standalonePage={true} />;
  }

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070709] text-white">
        <div className="group text-center space-y-3">
          <AnimatedBrandMark size="lg" className="mx-auto" />
          <p className="font-display text-2xl tracking-wider">LA VUELTA SESSIONS</p>
        </div>
      </div>
    );
  }

  const isStaffOrAdmin = Boolean(currentUser && currentUser.permissions.length > 0);
  const myValidTicketsCount = myTickets.filter((t) => t.status === 'valid').length;
  const myPendingOrdersCount = myOrders.filter((o) => o.status === 'pending').length;

  return (
    <>
      {inAdminWorkspace && isStaffOrAdmin && currentUser ? (
        <AdminWorkspace
          currentUser={currentUser}
          activeSection={activeAdminSection}
          onSelectSection={setActiveAdminSection}
          onExitToFullPublic={() => setInAdminWorkspace(false)}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((v) => !v)}
          securityStatus={securityStatus}
          publicPortalData={{
            activePublicSection,
            selectedEventId,
            events,
            specialCampaigns,
            promotions,
            galleryCategories,
            galleryPhotos,
            activePaymentMethods,
            myOrders,
            myTickets,
            settings,
            onNavigatePublic: handleNavigatePublicInsideControl,
            onOpenAuth: (mode) => setAuthModalMode(mode),
          }}
          onOpenSlideDrawer={() => setDrawerOpen(true)}
          onRefreshPublicBootstrap={loadBootstrap}
          onLogout={handleLogout}
          onNotify={showToast}
        />
      ) : (
        <>
          <PublicPlatform
            currentUser={currentUser}
            activeSection={activePublicSection}
            selectedEventId={selectedEventId}
            events={events}
            specialCampaigns={specialCampaigns}
            promotions={promotions}
            galleryCategories={galleryCategories}
            galleryPhotos={galleryPhotos}
            activePaymentMethods={activePaymentMethods}
            exchangeRate={exchangeRate}
            myOrders={myOrders}
            myTickets={myTickets}
            settings={settings}
            onNavigate={handleNavigatePublic}
            onOpenPanelDrawer={() => setDrawerOpen(true)}
            onOpenAuth={(mode) => setAuthModalMode(mode)}
            onRefreshBootstrap={loadBootstrap}
            onNotify={showToast}
          />

          {/* Floating Return Pill ONLY for authenticated Admin/Staff previewing full-bleed Public Mode */}
          {isStaffOrAdmin && currentUser && (
            <button
              type="button"
              onClick={() => setInAdminWorkspace(true)}
              className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#090B10]/95 px-4 py-2.5 text-xs font-semibold text-[#D4AF37] shadow-2xl backdrop-blur-md transition-colors hover:bg-[#141824]"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Volver al Punto de Control</span>
            </button>
          )}
        </>
      )}

      {/* Strictly Separated Consumer vs Executive Slide-Over Drawer */}
      <SlidePanelDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentUser={currentUser}
        activePublicSection={activePublicSection}
        inAdminWorkspace={inAdminWorkspace}
        activeAdminSection={activeAdminSection}
        myValidTicketsCount={myValidTicketsCount}
        myPendingOrdersCount={myPendingOrdersCount}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((v) => !v)}
        onNavigatePublic={(sec) => handleNavigatePublic(sec)}
        onNavigateAdmin={(sec) => handleNavigateAdmin(sec)}
        onOpenAuth={(mode) => setAuthModalMode(mode)}
        onLogout={handleLogout}
      />

      {/* Authentication, Google Complementary Profile & Verification Modals */}
      <AuthModals
        mode={authModalMode}
        currentUser={currentUser}
        pendingVerifyHint={pendingVerifyHint}
        onClose={() => setAuthModalMode(null)}
        onAuthSuccess={async (authedUser, nextModal, codeHint) => {
          setPendingVerifyHint(codeHint);
          await loadBootstrap();
          // Route Staff/Admin into Punto de Control ONLY if they logged in with admin credentials, NEVER for Google users
          if (
            authedUser.permissions &&
            authedUser.permissions.length > 0 &&
            authedUser.authProvider !== 'google' &&
            !nextModal
          ) {
            setActiveAdminSection(authedUser.permissions[0] || PermissionKey.OVERVIEW);
            setInAdminWorkspace(true);
          } else {
            setInAdminWorkspace(false);
          }
          setAuthModalMode(nextModal ?? null);
        }}
        onSwitchMode={(m) => setAuthModalMode(m)}
        onNotify={showToast}
      />

      {/* Accessible Non-Blocking Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed right-4 bottom-4 z-50 max-w-sm rounded-xl border px-4 py-3 text-xs font-medium shadow-xl transition-opacity ${
            toast.type === 'error'
              ? 'border-red-500/40 bg-red-950 text-red-100'
              : toast.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950 text-emerald-100'
              : 'border-slate-700 bg-slate-900 text-slate-100'
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
