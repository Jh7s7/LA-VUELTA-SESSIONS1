import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Menu,
  Calendar,
  MapPin,
  Ticket,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Minus,
  Plus,
  ChevronDown,
  Copy,
  Check,
  RotateCcw,
  Megaphone,
  Sparkles,
  CreditCard,
  Instagram,
  Camera,
} from 'lucide-react';
import {
  AuthenticatedUser,
  EventItem,
  ExchangeRateConfig,
  GalleryCategory,
  GalleryPhoto,
  OrderRecord,
  PaymentMethodType,
  PromotionAd,
  PublicSection,
  SiteSettings,
  SpecialCampaign,
  TicketRecord,
  TicketTier,
} from '../types';
import { apiRequest, fileToValidatedDataUrl } from '../lib/api';
import {
  AnimatedBrandMark,
  EventPosterVisual,
  GalleryVisual,
  PromoBannerVisual,
  QrCodeBox,
  ThematicLogoBadge,
} from './VisualArtwork';
import { VenueStageMap, formatSeatDisplay } from './VenueStageMap';

export interface PublicPlatformProps {
  currentUser: AuthenticatedUser | null;
  activeSection: PublicSection;
  selectedEventId: string | null;
  events: (EventItem & {
    availableGeneral: number;
    availableVip: number;
    availableTotal: number;
  })[];
  specialCampaigns: SpecialCampaign[];
  promotions: PromotionAd[];
  galleryCategories: GalleryCategory[];
  galleryPhotos: GalleryPhoto[];
  activePaymentMethods: Record<string, any>;
  exchangeRate?: ExchangeRateConfig;
  myOrders: OrderRecord[];
  myTickets: TicketRecord[];
  settings: SiteSettings;
  embeddedInControlCenter?: boolean;
  onNavigate: (section: PublicSection, eventId?: string) => void;
  onOpenPanelDrawer: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onRefreshBootstrap: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const METHOD_TITLES: Record<PaymentMethodType, string> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia Bancaria',
  binance: 'Binance Pay',
};

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export const TikTokIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.12V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.47 6.27 6.27 0 0 0 1.86-4.47V8.73A8.18 8.18 0 0 0 20.48 10v-3.4a4.83 4.83 0 0 1-.89.09z" />
  </svg>
);

export const SiguienteParadaTeaser: React.FC<{
  city?: string;
  venue?: string;
  date?: string;
  hasEvent?: boolean;
  onExplore?: () => void;
}> = ({ city, venue, date, hasEvent, onExplore }) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-950 via-[#111016] to-zinc-950 p-6 sm:p-7 text-white shadow-xl dark:border-white/10">
      {/* Dynamic Ambient Auras */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#E50914]/25 blur-3xl animate-pulse"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-[#D4AF37]/15 blur-3xl"
      />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Animated Brand Logo Loader + Text */}
        <div className="flex items-center gap-4 sm:gap-5 w-full md:w-auto">
          {/* Circular Logo with radar glow and rotating dashed boundary */}
          <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center">
            {/* Outer spinning dashed ring */}
            <div
              className="absolute inset-0 rounded-full border-2 border-dashed border-[#E50914]/70 animate-spin"
              style={{ animationDuration: '9s' }}
            />
            {/* Middle pulsing glow */}
            <div
              className="absolute inset-1.5 rounded-full bg-[#E50914]/20 animate-ping"
              style={{ animationDuration: '2.4s' }}
            />
            {/* Center black disk with logo */}
            <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-black/90 border border-white/25 p-2 shadow-inner">
              <img
                src="/assets/lv-logo.png"
                alt="LA VUELTA SESSIONS"
                className="h-full w-full object-contain animate-pulse"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[#E50914] animate-ping" />
              <span className="font-mono-tabular text-xs font-extrabold tracking-widest text-[#E50914] uppercase">
                Siguiente Parada :
              </span>
            </div>
            <h3 className="mt-1 font-display text-2xl sm:text-3xl text-white tracking-wide">
              {hasEvent && city
                ? `${city.toUpperCase()} · ${(venue || 'RECINTO OFICIAL').toUpperCase()}`
                : 'PRÓXIMA CIUDAD EN PRODUCCIÓN'}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-400">
              {hasEvent && date
                ? `Fecha oficial: ${date} · Entradas disponibles en taquilla digital`
                : 'Cargando fecha, locación y alineación de la primera sesión oficial...'}
            </p>
          </div>
        </div>

        {/* Acoustic Equalizer Bars & Badge */}
        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-between md:justify-end border-t border-white/10 pt-4 md:border-0 md:pt-0">
          <div className="flex items-end gap-1 h-6" aria-hidden="true">
            {[14, 22, 10, 24, 16, 20, 12, 18].map((h, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-[#E50914]"
                style={{
                  height: `${h}px`,
                  animation: `pulse 1.2s ease-in-out infinite alternate ${(i * 0.15).toFixed(2)}s`,
                }}
              />
            ))}
          </div>

          {onExplore ? (
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#c80812] transition-colors whitespace-nowrap"
            >
              <span>{hasEvent ? 'Ver Sesión' : 'Explorar'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {hasEvent ? 'Taquilla Abierta' : 'Preparando Lanzamiento'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const PublicPlatform: React.FC<PublicPlatformProps> = ({
  currentUser,
  activeSection,
  selectedEventId,
  events,
  specialCampaigns,
  promotions,
  galleryCategories,
  galleryPhotos,
  activePaymentMethods,
  exchangeRate,
  myOrders,
  myTickets,
  settings,
  embeddedInControlCenter = false,
  onNavigate,
  onOpenPanelDrawer,
  onOpenAuth,
  onRefreshBootstrap,
  onNotify,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Hero & Commercial Billboard Switchers
  const [heroEventIdx, setHeroEventIdx] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [activeAdIdx, setActiveAdIdx] = useState(0);
  const [adPaused, setAdPaused] = useState(false);

  // User-triggered Brand Sponsorship Modal & Validated Lead Form
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);
  const [adLeadForm, setAdLeadForm] = useState({
    brandName: '',
    contactName: '',
    email: '',
    phone: '',
    packageInterest: 'Valla Digital + Presencia VIP en Sala',
    message: '',
  });
  const [adLeadSubmitting, setAdLeadSubmitting] = useState(false);
  const [adLeadSubmitted, setAdLeadSubmitted] = useState(false);
  const [adLeadError, setAdLeadError] = useState('');

  // 3-Step Box-Office Checkout State:
  // Step 1: Selección de entradas (General / VIP sin límite por orden)
  // Step 2: Datos de pago (Pago Móvil, Binance, Transferencia)
  // Step 3: Registro de comprobante (nombre, cédula, teléfono, correo, ref, comprobante)
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);
  const [generalQty, setGeneralQty] = useState<number>(1);
  const [vipQty, setVipQty] = useState<number>(0);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(true);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [comboQtys, setComboQtys] = useState<Record<string, number>>({});
  const [timerSeconds, setTimerSeconds] = useState<number>(600);

  const availableMethodKeys = (Object.keys(activePaymentMethods) as PaymentMethodType[]).filter(
    (k) => k === 'pago_movil' || k === 'transferencia' || k === 'binance'
  );
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(
    availableMethodKeys[0] || null
  );
  const [paymentRef, setPaymentRef] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payerName, setPayerName] = useState('');
  const [payerCedula, setPayerCedula] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [voucherDataUrl, setVoucherDataUrl] = useState('');
  const [voucherFileName, setVoucherFileName] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccessBanner, setOrderSuccessBanner] = useState<{
    orderId: string;
    qty: number;
    email: string;
  } | null>(null);

  // Gallery Filter & Lightbox State (Module 10)
  const [galCategoryFilter, setGalCategoryFilter] = useState('');
  const [galEventFilter, setGalEventFilter] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<GalleryPhoto | null>(null);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0] || null;
  const featuredEvent = events[heroEventIdx % Math.max(1, events.length)] || events[0] || null;
  const regularPromos = useMemo(() => promotions.filter((p) => !p.tribute), [promotions]);
  const tributes = useMemo(() => promotions.filter((p) => p.tribute), [promotions]);
  const activeBillboardAd =
    regularPromos[activeAdIdx % Math.max(1, regularPromos.length)] || regularPromos[0] || null;
  const validPassCount = myTickets.filter((t) => t.status === 'valid').length;

  useEffect(() => {
    if (availableMethodKeys.length > 0 && (!selectedMethod || !activePaymentMethods[selectedMethod])) {
      setSelectedMethod(availableMethodKeys[0]);
    }
  }, [availableMethodKeys.join(',')]);

  useEffect(() => {
    if (currentUser) {
      if (!payerName && currentUser.name) setPayerName(currentUser.name);
      if (!payerCedula && currentUser.cedulaMasked) setPayerCedula(currentUser.cedulaMasked);
      if (!payerPhone && currentUser.phone) setPayerPhone(currentUser.phone);
      if (!payerEmail && currentUser.email) setPayerEmail(currentUser.email);
    }
  }, [currentUser]);

  // Gentle auto-rotation for Hero Session Showcase (pauses on hover or reduced motion)
  useEffect(() => {
    if (activeSection !== 'home' || events.length <= 1 || heroPaused || prefersReducedMotion) {
      return;
    }
    const timer = window.setInterval(() => {
      setHeroEventIdx((prev) => (prev + 1) % events.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [activeSection, events.length, heroPaused, prefersReducedMotion]);

  // Gentle auto-rotation for Commercial Billboard (pauses on hover or reduced motion)
  useEffect(() => {
    if (activeSection !== 'home' || regularPromos.length <= 1 || adPaused || prefersReducedMotion) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveAdIdx((prev) => (prev + 1) % regularPromos.length);
    }, 5800);
    return () => window.clearInterval(timer);
  }, [activeSection, regularPromos.length, adPaused, prefersReducedMotion]);

  // Countdown timer active during box-office checkout
  useEffect(() => {
    if (activeSection !== 'event-detail') return;
    const iv = window.setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(iv);
  }, [activeSection]);

  const activeEventCombos = useMemo(
    () => (selectedEvent?.combos || []).filter((c) => c.available !== false),
    [selectedEvent]
  );

  // Kinetic Ticker Items combining commercial promos & live sessions
  const marqueeItems = useMemo(() => {
    const items: {
      id: string;
      kicker: string;
      headline: string;
      eventId?: string;
      section?: PublicSection;
      preferVip?: boolean;
    }[] = [];

    regularPromos.forEach((p) => {
      items.push({
        id: `p_${p.id}`,
        kicker: p.sponsorBrand || p.slogan || 'PUBLICIDAD OFICIAL',
        headline: `${p.title} · ${p.slogan || 'TEMPORADA ACTIVA'}`,
        eventId: p.eventId || undefined,
        section: p.eventId ? 'event-detail' : 'promos',
        preferVip: p.visualPreset === 'vip_bar',
      });
    });

    events.forEach((ev) => {
      items.push({
        id: `e_${ev.id}`,
        kicker: `${ev.date} · ${ev.city.toUpperCase()}`,
        headline: `${ev.title} · ${ev.availableTotal} CUPOS DISPONIBLES`,
        eventId: ev.id,
        section: 'event-detail',
      });
    });

    if (items.length === 0) {
      items.push({
        id: 'fallback_1',
        kicker: 'LA VUELTA SESSIONS',
        headline: 'TAQUILLA DIGITAL CON CÓDIGO QR ÚNICO NOMINATIVO',
        section: 'eventos',
      });
    }

    return items;
  }, [regularPromos, events]);

  const autoComputeSeatsForEvent = (
    ev: EventItem,
    targetGen: number,
    targetVip: number
  ): string[] => {
    if (ev.seatMapEnabled === false) return [];
    const unavailable = new Set([...(ev.occupiedSeats || []), ...(ev.blockedSeats || [])]);
    const assigned: string[] = [];
    let gotVip = 0;
    for (let i = 1; i <= ev.vipCapacity && gotVip < targetVip; i++) {
      const id = `VIP-${i}`;
      if (!unavailable.has(id)) {
        assigned.push(id);
        gotVip++;
      }
    }
    let gotGen = 0;
    for (let i = 1; i <= ev.generalCapacity && gotGen < targetGen; i++) {
      const id = `GEN-${i}`;
      if (!unavailable.has(id)) {
        assigned.push(id);
        gotGen++;
      }
    }
    return assigned;
  };

  const resetCheckoutForEvent = (
    ev: (EventItem & { availableGeneral: number; availableVip?: number; availableTotal?: number }) | null
  ) => {
    setCheckoutStep(1);
    if (ev) {
      setGeneralQty(ev.availableGeneral > 0 ? 1 : 0);
      setVipQty(0);
    } else {
      setGeneralQty(1);
      setVipQty(0);
    }
    setAcceptedTerms(true);
    setSelectedSeats([]);
    setComboQtys({});
    setTimerSeconds(600);
    setPaymentRef('');
    setPaidAmount('');
    setPayerName(currentUser?.name || '');
    setPayerCedula(currentUser?.cedulaMasked || '');
    setPayerPhone(currentUser?.phone || '');
    setPayerEmail(currentUser?.email || '');
    setVoucherDataUrl('');
    setVoucherFileName('');
    if (availableMethodKeys.length > 0) {
      setSelectedMethod(availableMethodKeys[0]);
    }
  };

  const openEventCheckout = (eventId: string) => {
    const targetEv = events.find((e) => e.id === eventId) || null;
    resetCheckoutForEvent(targetEv);
    onNavigate('event-detail', eventId);
  };

  const triggerPromoNavigation = (ad: PromotionAd) => {
    if (ad.eventId && events.some((e) => e.id === ad.eventId)) {
      openEventCheckout(ad.eventId);
      return;
    }
    if (ad.linkSection && ad.linkSection !== 'promos') {
      onNavigate(ad.linkSection);
      return;
    }
    onNavigate('eventos');
  };

  const submitBrandInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdLeadError('');
    const cleanBrand = adLeadForm.brandName.trim();
    const cleanContact = adLeadForm.contactName.trim();
    const cleanEmail = adLeadForm.email.trim();
    const cleanPhone = adLeadForm.phone.trim();

    if (cleanBrand.length < 2 || cleanContact.length < 2) {
      setAdLeadError('Indica el nombre comercial de la marca y la persona responsable.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAdLeadError('Ingresa un correo electrónico válido para recibir el tarifario.');
      return;
    }
    if (!/^\+?[0-9\s\-()]{7,20}$/.test(cleanPhone)) {
      setAdLeadError('Ingresa un número de WhatsApp o teléfono válido (ej. +58 412-1234567).');
      return;
    }

    setAdLeadSubmitting(true);
    try {
      await apiRequest('POST', '/api/ad-inquiries', {
        ...adLeadForm,
        brandName: cleanBrand,
        contactName: cleanContact,
        email: cleanEmail,
        phone: cleanPhone,
      });
      setAdLeadSubmitted(true);
      onNotify('Solicitud comercial registrada. Nuestro equipo de alianzas te contactará.', 'success');
    } catch (err: any) {
      setAdLeadError(err.message || 'No se pudo enviar la solicitud comercial.');
    } finally {
      setAdLeadSubmitting(false);
    }
  };

  const handleToggleCustomerSeat = (seatId: string, tier: 'vip' | 'general') => {
    setSelectedSeats((prev) => {
      if (prev.includes(seatId)) {
        return prev.filter((s) => s !== seatId);
      }
      const prefix = tier === 'vip' ? 'VIP-' : 'GEN-';
      const maxAllowed = tier === 'vip' ? vipQty : generalQty;
      if (maxAllowed <= 0) return prev;
      const currentTierSeats = prev.filter((s) => s.startsWith(prefix));
      const otherTierSeats = prev.filter((s) => !s.startsWith(prefix));
      if (currentTierSeats.length >= maxAllowed) {
        return [...otherTierSeats, ...currentTierSeats.slice(1), seatId];
      }
      return [...prev, seatId];
    });
  };

  const clampGeneralQty = (val: number) => {
    if (!selectedEvent) return;
    const maxAvail = Math.max(0, selectedEvent.availableGeneral);
    const clean = Math.min(maxAvail, Math.max(0, Math.floor(Number.isFinite(val) ? val : 0)));
    setGeneralQty(clean);
  };

  const clampVipQty = (val: number) => {
    if (!selectedEvent) return;
    const maxAvail = Math.max(0, selectedEvent.availableVip);
    const clean = Math.min(maxAvail, Math.max(0, Math.floor(Number.isFinite(val) ? val : 0)));
    setVipQty(clean);
  };

  const proceedFromStep1 = () => {
    if (!selectedEvent) return;
    if (generalQty < 1) {
      onNotify('Selecciona al menos 1 entrada disponible para continuar.', 'error');
      return;
    }
    if (!acceptedTerms) {
      onNotify('Debes aceptar las condiciones de acceso del evento para continuar.', 'error');
      return;
    }
    setCheckoutStep(2);
  };

  const proceedFromStep2 = () => {
    if (!selectedEvent) return;
    if (!selectedMethod || !activePaymentMethods[selectedMethod]) {
      onNotify('Selecciona el método de pago con el que vas a transferir.', 'error');
      return;
    }
    setCheckoutStep(3);
  };

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyPaymentValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2500);
      onNotify(`✓ ${label} copiado al portapapeles.`, 'info');
    } catch {
      onNotify(`${label}: ${value}`, 'info');
    }
  };

  const ticketsSubtotal = selectedEvent
    ? generalQty * selectedEvent.generalPrice
    : 0;
  const combosSubtotal = activeEventCombos.reduce(
    (sum, c) => sum + (comboQtys[c.id] || 0) * c.price,
    0
  );
  const grandTotal = Number((ticketsSubtotal + combosSubtotal).toFixed(2));

  const effectiveExchangeRate =
    exchangeRate?.rate ||
    (activePaymentMethods?.exchangeRate?.rate as number | undefined) ||
    896.12;

  const totalAmountBs = Number((grandTotal * effectiveExchangeRate).toFixed(2));
  const formattedTotalBs = totalAmountBs.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedExchangeRate = effectiveExchangeRate.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth('login');
      return;
    }
    if (!selectedEvent) return;
    if (generalQty + vipQty < 1) {
      onNotify('Selecciona al menos 1 entrada antes de reportar el pago.', 'error');
      return;
    }
    if (!selectedMethod || !activePaymentMethods[selectedMethod]) {
      onNotify('Selecciona un método de pago habilitado.', 'error');
      return;
    }
    if (!voucherDataUrl) {
      onNotify('Adjunta la imagen o PDF del comprobante de pago.', 'error');
      return;
    }

    const combosPayload = activeEventCombos
      .filter((c) => (comboQtys[c.id] || 0) > 0)
      .map((c) => ({ id: c.id, qty: comboQtys[c.id] }));

    const resolvedTier: TicketTier = 'general';

    const cleanPayerName = payerName.trim() || currentUser.name;
    const cleanPayerCedula = payerCedula.trim() || currentUser.cedulaMasked || '';
    const cleanPayerPhone = payerPhone.trim() || currentUser.phone || '';
    const cleanPayerEmail = payerEmail.trim().toLowerCase() || currentUser.email || '';

    if (!cleanPayerName || cleanPayerName.length < 2) {
      onNotify('Indica el nombre y apellido de la persona que realizó la transferencia o pago.', 'error');
      return;
    }
    if (!cleanPayerCedula) {
      onNotify('Indica el número de cédula o documento de quien transfirió.', 'error');
      return;
    }
    if (!cleanPayerPhone) {
      onNotify('Indica el teléfono de contacto de quien transfirió.', 'error');
      return;
    }

    setSubmittingOrder(true);
    try {
      const resp = await apiRequest('POST', '/api/orders', {
        eventId: selectedEvent.id,
        ticketType: resolvedTier,
        qty: generalQty,
        generalQty,
        vipQty: 0,
        selectedSeats: [],
        combos: combosPayload,
        paymentMethod: selectedMethod,
        reference: paymentRef.trim(),
        paidAmountReported: Number(paidAmount || grandTotal),
        paymentDate,
        payerName: cleanPayerName,
        payerCedula: cleanPayerCedula,
        payerPhone: cleanPayerPhone,
        payerEmail: cleanPayerEmail,
        voucherDataUrl,
      });

      const orderResult = resp?.order;
      setOrderSuccessBanner({
        orderId: orderResult?.id || 'ORD-EXITOSA',
        qty: generalQty + vipQty,
        email: cleanPayerEmail || currentUser.email,
      });

      onNotify(
        `¡Pago registrado exitosamente! Miles de gracias. En un lapso de 48 a 72 horas se estará verificando tu pago y te llegará la entrada con código QR a tu correo (${cleanPayerEmail || currentUser.email}).`,
        'success'
      );
      await onRefreshBootstrap();
      onNavigate('my-tickets');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // =========================================================
  // STRICT 3-ZONE TOP BAR CONTRACT:
  // [Brand Wordmark] — [5 single-line nav links] — [1 primary action]
  // =========================================================
  const renderTopBar = () => {
    const navItems: { id: PublicSection; label: string }[] = [
      { id: 'home', label: 'Temporada' },
      { id: 'eventos', label: 'Cartelera' },
      { id: 'especiales', label: 'Especiales' },
      { id: 'galeria', label: 'Galería' },
      { id: 'promos', label: 'Publicidad' },
    ];

    return (
      <header
        className={`${
          embeddedInControlCenter ? 'relative' : 'sticky top-0 z-30'
        } flex h-16 items-center justify-between gap-8 border-b border-zinc-200/90 bg-[#FAFAFA]/95 px-5 backdrop-blur-md md:px-10 dark:border-white/[0.08] dark:bg-[#070709]/95`}
      >
        {/* Zone 1: Animated Official Brand Seal + Single-line Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="group inline-flex items-center gap-3 text-left transition-opacity hover:opacity-95 whitespace-nowrap shrink-0"
        >
          <AnimatedBrandMark size="md" />
          <span className="font-display text-2xl tracking-wider text-zinc-950 transition-colors duration-200 group-hover:text-[#E50914] dark:text-white dark:group-hover:text-[#E50914]">
            LA VUELTA SESSIONS
          </span>
        </button>

        {/* Zone 2: 5 Concise Single-Line Nav Links with Motion Active Indicator */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {navItems.map((item) => {
            const active =
              activeSection === item.id ||
              (item.id === 'eventos' && activeSection === 'sessions');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-zinc-950 dark:text-white'
                    : 'hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {active && (
                  <motion.span
                    layoutId={embeddedInControlCenter ? 'ctrlPublicNavLine' : 'mainPublicNavLine'}
                    transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
                    className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-[#E50914]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          {embeddedInControlCenter ? (
            <button
              type="button"
              onClick={() => onNavigate('my-tickets')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-4 py-2 text-xs font-semibold text-white transition-transform duration-150 hover:-translate-y-0.5 hover:bg-[#c80812] whitespace-nowrap shrink-0"
            >
              <Ticket className="h-3.5 w-3.5" />
              <span>Billetera QR</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenPanelDrawer}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition-transform duration-150 hover:-translate-y-0.5 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 whitespace-nowrap shrink-0"
            >
              <Menu className="h-4 w-4" />
              <span>
                {currentUser
                  ? `Mi Pase · ${currentUser.name.split(' ')[0]}`
                  : 'Menú y Pases'}
              </span>
            </button>
          )}
        </div>
      </header>
    );
  };

  // =========================================================
  // NUMBERED EDITION EVENT RELEASE CARD (Zero-Pill Metadata + Motion)
  // =========================================================
  const renderEventCard = (
    ev: EventItem & { availableGeneral: number; availableVip: number; availableTotal: number },
    idx: number
  ) => {
    const soldOut = ev.availableTotal <= 0;
    const campaign = specialCampaigns.find((c) => c.id === ev.specialCampaignId);
    const editionNum = String(idx + 1).padStart(2, '0');

    return (
      <motion.article
        key={ev.id}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{
          duration: 0.45,
          delay: Math.min(idx * 0.07, 0.24),
          ease: EASE_OUT_EXPO,
        }}
        className="lv-luxury-sheen group flex flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 dark:border-white/[0.08] dark:bg-[#0D0D11]"
      >
        <div className="relative h-60 overflow-hidden">
          <div className="h-full w-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]">
            <EventPosterVisual
              imageUrl={ev.imageUrl}
              title={ev.title}
              subtitle={campaign ? campaign.season : ev.city}
              theme={ev.posterTheme}
              className="h-full w-full"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/92 via-black/35 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5">
            <p className="text-xs font-medium text-zinc-300">
              {ev.saleBadge || 'PREVENTA'} · Edición {editionNum} · {ev.date} · {ev.time}
            </p>
            <h3 className="mt-1 font-display text-3xl leading-none tracking-wide text-white">
              {ev.title}
            </h3>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between p-5">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {ev.venue} · {ev.category}
            </p>

            <div className="mt-4 flex items-center justify-between border-t border-zinc-200/80 pt-4 dark:border-white/[0.08]">
              <div>
                <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  Entrada Oficial
                </span>
                <span className="font-mono-tabular text-2xl font-black text-zinc-950 dark:text-white">
                  ${ev.generalPrice.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-zinc-500">USD</span>
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                  Aforo Disponible
                </span>
                <span className="font-mono-tabular text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {ev.availableGeneral} entradas
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={soldOut}
            onClick={() => openEventCheckout(ev.id)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[#c80812] disabled:cursor-not-allowed disabled:bg-zinc-700 whitespace-nowrap cursor-pointer"
          >
            <span>{soldOut ? 'Localidades Agotadas' : 'Adquirir Entrada Oficial'}</span>
            {!soldOut && (
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            )}
          </button>
        </div>
      </motion.article>
    );
  };

  // =========================================================
  // RENDER AD CTA BUTTON OR EXTERNAL LINK (Iframe-Safe, Zero window.open)
  // =========================================================
  const renderPromoCta = (ad: PromotionAd, className: string) => {
    const label = ad.ctaLabel || (ad.eventId ? 'Adquirir Pase' : 'Explorar Ahora');
    if (ad.externalUrl && /^https?:\/\//i.test(ad.externalUrl)) {
      return (
        <a
          href={ad.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          <span>{label}</span>
          <ArrowUpRight className="h-4 w-4 shrink-0" />
        </a>
      );
    }
    return (
      <button
        type="button"
        onClick={() => triggerPromoNavigation(ad)}
        className={className}
      >
        <span>{label}</span>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </button>
    );
  };

  // =========================================================
  // VALIDATED BRAND SPONSORSHIP FORM BLOCK
  // =========================================================
  const renderBrandLeadForm = (compact = false) => {
    if (adLeadSubmitted) {
      return (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center space-y-3">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-display text-3xl text-zinc-950 dark:text-white">
            Solicitud Comercial Recibida
          </h3>
          <p className="mx-auto max-w-md text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
            Hemos registrado los datos de <strong>{adLeadForm.brandName}</strong>. El equipo comercial de La Vuelta Sessions se comunicará contigo con las ubicaciones disponibles.
          </p>
          <button
            type="button"
            onClick={() => {
              setAdLeadSubmitted(false);
              setAdLeadForm({
                brandName: '',
                contactName: '',
                email: '',
                phone: '',
                packageInterest: 'Valla Digital + Presencia VIP en Sala',
                message: '',
              });
            }}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-white/15 dark:bg-zinc-900 dark:text-white whitespace-nowrap"
          >
            Enviar otra propuesta
          </button>
        </div>
      );
    }

    const fieldCls =
      'w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#E50914] focus:outline-none dark:border-white/15 dark:bg-[#070709] dark:text-white';

    return (
      <form onSubmit={submitBrandInquiry} className="space-y-4">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Marca o empresa
            </label>
            <input
              type="text"
              required
              value={adLeadForm.brandName}
              onChange={(e) => setAdLeadForm({ ...adLeadForm, brandName: e.target.value })}
              placeholder="Ej. Destilería Aragua / Studio Urbano"
              className={fieldCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Persona de contacto
            </label>
            <input
              type="text"
              required
              value={adLeadForm.contactName}
              onChange={(e) => setAdLeadForm({ ...adLeadForm, contactName: e.target.value })}
              placeholder="Nombre y apellido"
              className={fieldCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Correo corporativo
            </label>
            <input
              type="email"
              required
              value={adLeadForm.email}
              onChange={(e) => setAdLeadForm({ ...adLeadForm, email: e.target.value })}
              placeholder="alianzas@tumarca.com"
              className={fieldCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              WhatsApp directo
            </label>
            <input
              type="tel"
              required
              value={adLeadForm.phone}
              onChange={(e) => setAdLeadForm({ ...adLeadForm, phone: e.target.value })}
              placeholder="+58 412-0000000"
              className={fieldCls}
            />
          </div>
        </div>

        <div className={compact ? 'space-y-3.5' : 'grid grid-cols-1 gap-3.5 sm:grid-cols-2'}>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Formato publicitario de interés
            </label>
            <select
              value={adLeadForm.packageInterest}
              onChange={(e) => setAdLeadForm({ ...adLeadForm, packageInterest: e.target.value })}
              className={fieldCls}
            >
              <option value="Valla Digital + Presencia VIP en Sala">
                Valla Digital + Presencia VIP en Sala
              </option>
              <option value="Patrocinio Oficial de Barra y Coctelería">
                Patrocinio Oficial de Barra y Coctelería
              </option>
              <option value="Activación de Marca en Tarima y Pantalla">
                Activación de Marca en Tarima y Pantalla
              </option>
              <option value="Colaboración Streetwear / Merchandising">
                Colaboración Streetwear / Merchandising
              </option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Objetivo de la campaña (opcional)
            </label>
            <input
              type="text"
              value={adLeadForm.message}
              onChange={(e) => setAdLeadForm({ ...adLeadForm, message: e.target.value })}
              placeholder="Fechas estimadas o activación deseada..."
              className={fieldCls}
            />
          </div>
        </div>

        {adLeadError && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">{adLeadError}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Atención directa del equipo de producción · {settings.cityBase}
          </p>
          <button
            type="submit"
            disabled={adLeadSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-6 py-3 text-xs font-semibold text-white transition-colors hover:bg-[#c80812] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <span>{adLeadSubmitting ? 'Enviando solicitud...' : 'Solicitar Tarifario Oficial'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-zinc-900 dark:bg-[#070709] dark:text-zinc-100">
      {renderTopBar()}

      <main className="flex-1">
        {/* =========================================================
            HOME VIEW — ASYMMETRIC LUXURY STAGE EDITORIAL + ANIMATION + PUBLICIDAD
        ========================================================= */}
        {activeSection === 'home' && (
          <div>
            <section className="lv-stage-backdrop border-b border-zinc-200/90 dark:border-white/[0.08]">
              {/* Compositor-only ambient stage beam */}
              <div
                aria-hidden="true"
                className="lv-ambient-aura pointer-events-none absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-[#E50914]/12 blur-3xl dark:bg-[#E50914]/18"
              />
              <div
                aria-hidden="true"
                className="lv-ambient-aura pointer-events-none absolute top-12 right-12 h-72 w-72 rounded-full bg-[#D4AF37]/10 blur-3xl dark:bg-[#D4AF37]/14"
              />

              <div className="relative z-10 mx-auto max-w-[1280px] px-5 pt-12 pb-12 md:px-10 md:pt-16 md:pb-16">
                {/* 12-Column Asymmetric Hero Split (items-stretch) */}
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
                  {/* Left 7 Columns: Editorial Statement */}
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.48, ease: EASE_OUT_EXPO }}
                    className="flex flex-col justify-between lg:col-span-7 py-2"
                  >
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Temporada Oficial 2026 · {settings.cityBase}
                      </p>

                      <h1
                        className="mt-4 font-display text-zinc-950 dark:text-white"
                        style={{
                          fontSize: 'clamp(3rem, 5.8vw, 5.25rem)',
                          lineHeight: 0.94,
                          textWrap: 'balance',
                        }}
                      >
                        Cultura Urbana en Vivo Con{' '}
                        <span className="text-[#E50914]">Sello Propio</span>
                      </h1>

                      <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                        Sesiones curadas de reggaetón, rap venezolano y música electrónica en formato íntimo. Adquiere tus entradas oficiales y recibe tu pase digital con código QR único.
                      </p>

                      {/* Restrained Acoustic Equalizer Motif */}
                      <div
                        className="mt-7 flex h-6 items-end gap-1"
                        aria-hidden="true"
                      >
                        {Array.from({ length: 20 }).map((_, idx) => (
                          <span
                            key={idx}
                            className="eq-bar w-1 rounded-full bg-[#E50914]/80 dark:bg-[#D4AF37]/80"
                            style={{
                              height: `${8 + ((idx * 13) % 16)}px`,
                              animationDelay: `${(idx * 0.07).toFixed(2)}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="mt-9 flex flex-wrap items-center gap-3.5">
                      <button
                        type="button"
                        onClick={() => onNavigate('eventos')}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-6 py-3 text-sm font-semibold text-white transition-transform duration-150 hover:-translate-y-0.5 hover:bg-[#c80812] whitespace-nowrap shrink-0"
                      >
                        <span>Reservar Entradas</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          currentUser ? onNavigate('my-tickets') : onOpenAuth('login')
                        }
                        className="rounded-xl border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08] whitespace-nowrap shrink-0"
                      >
                        {currentUser
                          ? `Mis Pases QR (${validPassCount})`
                          : '¡¡¡Comencemos!!!'}
                      </button>
                    </div>
                  </motion.div>

                  {/* Right 5 Columns: Featured Session Release Showcase or Siguiente Parada Teaser */}
                  {featuredEvent ? (
                    <motion.div
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.52, delay: 0.08, ease: EASE_OUT_EXPO }}
                      className="lg:col-span-5"
                      onMouseEnter={() => setHeroPaused(true)}
                      onMouseLeave={() => setHeroPaused(false)}
                    >
                      <div className="lv-luxury-sheen relative flex h-full min-h-[395px] flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 p-6 text-white dark:border-white/10">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={featuredEvent.id}
                            initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.03 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                            transition={{ duration: 0.42, ease: EASE_OUT_EXPO }}
                            className="absolute inset-0"
                          >
                            <EventPosterVisual
                              imageUrl={featuredEvent.imageUrl}
                              title={featuredEvent.title}
                              subtitle={featuredEvent.city}
                              theme={featuredEvent.posterTheme}
                              className="h-full w-full object-cover"
                            />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/20" />
                          </motion.div>
                        </AnimatePresence>

                        {/* Interactive Session Selector in Top Row */}
                        <div className="relative z-10 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold tracking-wider text-[#D4AF37]">
                            {featuredEvent.saleBadge || 'PREVENTA'} · TAQUILLA OFICIAL
                          </span>
                          {events.length > 1 && (
                            <div className="flex items-center gap-1 rounded-lg bg-black/65 p-1 backdrop-blur-sm">
                              {events.slice(0, 5).map((evItem, idx) => (
                                <button
                                  key={evItem.id}
                                  type="button"
                                  onClick={() => setHeroEventIdx(idx)}
                                  className={`rounded px-2 py-0.5 font-mono-tabular text-[11px] font-semibold transition-colors ${
                                    heroEventIdx % events.length === idx
                                      ? 'bg-[#E50914] text-white'
                                      : 'text-zinc-300 hover:text-white'
                                  }`}
                                >
                                  0{idx + 1}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <AnimatePresence mode="wait">
                          <motion.div
                            key={`meta_${featuredEvent.id}`}
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                            className="relative z-10 space-y-3 pt-16"
                          >
                            <p className="text-xs font-medium text-zinc-300">
                              {featuredEvent.date} · {featuredEvent.time} · {featuredEvent.city}
                            </p>
                            <h2 className="font-display text-4xl leading-none tracking-wide text-white">
                              {featuredEvent.title}
                            </h2>
                            <p className="text-xs text-zinc-300">
                              {featuredEvent.venue} · {featuredEvent.availableTotal} entradas disponibles
                            </p>
                            <div className="flex items-center justify-between border-t border-white/15 pt-3.5">
                              <div className="text-xs text-zinc-300">
                                Entrada Oficial{' '}
                                <strong className="font-mono-tabular text-white">
                                  ${featuredEvent.generalPrice.toFixed(2)} USD
                                </strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => openEventCheckout(featuredEvent.id)}
                                className="rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#c80812] whitespace-nowrap shrink-0"
                              >
                                Comprar Entradas
                              </button>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.52, delay: 0.08, ease: EASE_OUT_EXPO }}
                      className="lg:col-span-5 flex flex-col justify-center"
                    >
                      <SiguienteParadaTeaser hasEvent={false} onExplore={() => onNavigate('eventos')} />
                    </motion.div>
                  )}
                </div>

                {/* Siguiente Parada Teaser Full Row */}
                <div className="mt-8">
                  <SiguienteParadaTeaser
                    hasEvent={Boolean(featuredEvent)}
                    city={featuredEvent?.city}
                    venue={featuredEvent?.venue}
                    date={featuredEvent?.date}
                    onExplore={() => onNavigate('eventos')}
                  />
                </div>

                {/* Full-Width 4-Column Architectural Proof Row with Thematic Brand Emblems */}
                <div className="mt-10 grid grid-cols-1 gap-5 border-t border-zinc-200/90 pt-8 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => onNavigate('eventos')}
                    className="group flex items-center gap-4 rounded-2xl p-3 -m-3 text-left transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.04]"
                  >
                    <ThematicLogoBadge variant="sessions" />
                    <div className="min-w-0">
                      <p className="font-mono-tabular text-2xl font-bold text-zinc-950 transition-colors group-hover:text-[#E50914] dark:text-white dark:group-hover:text-[#E50914]">
                        {String(events.length).padStart(2, '0')}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        01. Sesiones oficiales en cartelera
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      featuredEvent
                        ? openEventCheckout(featuredEvent.id)
                        : onNavigate('eventos')
                    }
                    className="group flex items-center gap-4 rounded-2xl p-3 -m-3 text-left transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.04]"
                  >
                    <ThematicLogoBadge variant="vip_zones" />
                    <div className="min-w-0">
                      <p className="font-mono-tabular text-2xl font-bold text-zinc-950 transition-colors group-hover:text-[#E50914] dark:text-white dark:group-hover:text-[#E50914] whitespace-nowrap">
                        Entradas Oficiales
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        02. Aforo y capacidad controlada
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      currentUser ? onNavigate('my-tickets') : onOpenAuth('login')
                    }
                    className="group flex items-center gap-4 rounded-2xl p-3 -m-3 text-left transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.04]"
                  >
                    <ThematicLogoBadge variant="qr_shield" />
                    <div className="min-w-0">
                      <p className="font-mono-tabular text-2xl font-bold text-zinc-950 transition-colors group-hover:text-[#E50914] dark:text-white dark:group-hover:text-[#E50914] whitespace-nowrap">
                        HMAC-256
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        03. Pase QR único intransferible
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('galeria')}
                    className="group flex items-center gap-4 rounded-2xl p-3 -m-3 text-left transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.04]"
                  >
                    <ThematicLogoBadge variant="gallery_archive" />
                    <div className="min-w-0">
                      <p className="font-mono-tabular text-2xl font-bold text-zinc-950 transition-colors group-hover:text-[#E50914] dark:text-white dark:group-hover:text-[#E50914]">
                        {String(galleryPhotos.length).padStart(2, '0')}+
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        04. Memorias en archivo fotográfico
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </section>

            {/* =========================================================
                NON-STICKY KINETIC ADVERTISING & CARTELERA MARQUEE RIBBON
            ========================================================= */}
            <div
              className="lv-marquee-viewport relative overflow-hidden border-b border-zinc-200/90 bg-zinc-950 py-3 text-white dark:border-white/[0.08] dark:bg-[#0B0B10]"
              aria-label="Cintillo de anuncios y fechas activas"
            >
              <div className="lv-marquee-track items-center">
                {[...marqueeItems, ...marqueeItems].map((item, idx) => (
                  <button
                    key={`${item.id}_${idx}`}
                    type="button"
                    onClick={() => {
                      if (item.eventId) {
                        openEventCheckout(item.eventId);
                      } else if (item.section) {
                        onNavigate(item.section);
                      }
                    }}
                    className="group inline-flex items-center gap-3 px-6 text-xs transition-opacity hover:opacity-85 whitespace-nowrap shrink-0"
                  >
                    <span className="font-semibold tracking-wider text-[#D4AF37]">
                      {item.kicker}
                    </span>
                    <span className="font-display text-lg tracking-wider text-white group-hover:text-[#E50914] transition-colors">
                      {item.headline}
                    </span>
                    <span className="text-zinc-600" aria-hidden="true">
                      ·
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Upcoming Sessions */}
            <section className="mx-auto max-w-[1280px] px-5 py-16 md:px-10 md:py-20">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Programación Confirmada
                  </p>
                  <h2
                    className="mt-1 font-display text-4xl tracking-wide text-zinc-950 md:text-5xl dark:text-white"
                    style={{ textWrap: 'balance' }}
                  >
                    Cartelera de Sesiones
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('eventos')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E50914] hover:underline whitespace-nowrap shrink-0"
                >
                  <span>Explorar todas las fechas</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {events.length === 0 ? (
                <div className="py-2">
                  <SiguienteParadaTeaser
                    hasEvent={false}
                    onExplore={() => onNavigate('eventos')}
                  />
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
                    {events.map((ev, i) => renderEventCard(ev, i))}
                  </div>
                  <div>
                    <SiguienteParadaTeaser
                      hasEvent={false}
                      city="Próxima Edición"
                      venue="En Producción"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Redes Sociales Oficiales: Instagram & TikTok */}
            <section className="mx-auto max-w-[1280px] px-5 pb-8 md:px-10">
              <div className="rounded-2xl border border-zinc-200/90 bg-gradient-to-r from-zinc-50 via-white to-zinc-50 p-6 sm:p-7 shadow-xs dark:border-white/10 dark:from-[#0E0E14] dark:via-[#111018] dark:to-[#0E0E14]">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-[#E50914] animate-ping" />
                      <span className="font-mono-tabular text-xs font-extrabold tracking-widest text-[#E50914] uppercase">
                        Comunidad Oficial en Vivo
                      </span>
                    </div>
                    <h3 className="font-display text-2xl sm:text-3xl text-zinc-950 dark:text-white tracking-wide">
                      SÍGUENOS EN NUESTRAS REDES SOCIALES
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Reels exclusivos, sets musicales en vivo, detrás de cámaras de cabina y avisos prioritarios de preventa de entradas.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <a
                      href={settings.instagramUrl || 'https://instagram.com/lavueltasessions'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 transition-transform duration-150 hover:-translate-y-0.5"
                    >
                      <Instagram className="h-4 w-4" />
                      <span>Instagram {settings.brandHandle || '@lavueltasessions'}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={settings.tiktokUrl || 'https://tiktok.com/@lavueltasessions'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 rounded-xl border border-zinc-300 bg-black px-4 py-2.5 text-xs font-bold text-white shadow-md hover:border-cyan-400 transition-all duration-150 hover:-translate-y-0.5 dark:border-white/20"
                    >
                      <TikTokIcon className="h-4 w-4 text-cyan-400" />
                      <span>TikTok {settings.brandHandle || '@lavueltasessions'}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* =========================================================
                ASYMMETRIC COMMERCIAL ADVERTISING & BRAND EXPERIENCES SHOWCASE
            ========================================================= */}
            <section className="border-t border-zinc-200/90 bg-white py-16 md:py-20 dark:border-white/[0.08] dark:bg-[#0A0A0E]">
              <div className="mx-auto max-w-[1280px] px-5 md:px-10">
                <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-[#D4AF37]">
                      Espacios Comerciales · Marcas Oficiales
                    </p>
                    <h2
                      className="mt-1 font-display text-4xl tracking-wide text-zinc-950 md:text-5xl dark:text-white"
                      style={{ textWrap: 'balance' }}
                    >
                      Publicidad y Experiencias de Marca
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAdLeadSubmitted(false);
                        setAdLeadError('');
                        setSponsorModalOpen(true);
                      }}
                      className="rounded-xl border border-zinc-300 bg-[#FAFAFA] px-4 py-2 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Anunciar mi Marca
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('promos')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E50914] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Ver todas las campañas</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {regularPromos.length === 0 ? (
                  <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-950 via-[#111016] to-zinc-950 p-8 sm:p-12 text-white shadow-2xl dark:border-white/10">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#E50914]/20 blur-3xl animate-pulse"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-[#D4AF37]/15 blur-3xl"
                    />
                    <div className="relative z-10 max-w-3xl space-y-4">
                      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#D4AF37]">
                        <Sparkles className="h-4 w-4" />
                        <span>Espacio Publicitario Exclusivo Disponible</span>
                      </div>
                      <h3 className="font-display text-3xl sm:text-4xl text-white tracking-wide">
                        IMPULSA TU MARCA ANTE LA COMUNIDAD MÁS VIBRANTE DE LA ESCENA URBANA
                      </h3>
                      <p className="text-sm leading-relaxed text-zinc-300">
                        Presencia digital en boletería interactiva, vallas publicitarias en sala, activaciones en vivo y hospitalidad oficial en cada sesión. Espacio disponible para tu empresa o marca aliada.
                      </p>
                      <div className="pt-2 flex flex-wrap items-center gap-3.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAdLeadSubmitted(false);
                            setAdLeadError('');
                            setSponsorModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-5 py-3 text-xs font-bold text-white shadow-lg hover:bg-[#c80812] transition-colors cursor-pointer"
                        >
                          <Megaphone className="h-4 w-4" />
                          <span>Solicitar Pauta Comercial</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                        <span className="text-xs text-zinc-400">
                          Pauta directa en sala y plataformas digitales oficiales
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {regularPromos.map((item, idx) => (
                      <motion.article
                        key={item.id}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                        whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.15 }}
                        transition={{ duration: 0.44, delay: Math.min(idx * 0.06, 0.24), ease: EASE_OUT_EXPO }}
                        className="lv-luxury-sheen group relative flex min-h-[340px] flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 p-6 text-white transition-transform duration-200 hover:-translate-y-1 dark:border-white/10"
                      >
                        <div className="absolute inset-0">
                          <PromoBannerVisual
                            imageUrl={item.imageUrl}
                            title={item.title}
                            preset={item.visualPreset}
                            fallbackIndex={idx}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="relative z-10">
                          <p className="text-xs font-semibold tracking-wider text-[#D4AF37]">
                            {(item.sponsorBrand || 'CAMPAÑA OFICIAL').toUpperCase()}
                          </p>
                        </div>
                        <div className="relative z-10 mt-auto max-w-xl space-y-2.5 pt-16">
                          {item.slogan && (
                            <p className="text-xs font-medium text-zinc-300">{item.slogan}</p>
                          )}
                          <h3 className="font-display text-3xl leading-none text-white">
                            {item.title}
                          </h3>
                          <p className="text-xs text-zinc-200">{item.text}</p>
                          <div className="pt-2">
                            {renderPromoCta(
                              item,
                              'inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#c80812] whitespace-nowrap shrink-0'
                            )}
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Seasonal Editions */}
            {specialCampaigns.length > 0 && (
              <section className="border-y border-zinc-200/90 bg-[#FAFAFA] py-16 dark:border-white/[0.08] dark:bg-[#070709]">
                <div className="mx-auto max-w-[1280px] px-5 md:px-10">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-amber-700 dark:text-[#D4AF37]">
                        Ediciones de Temporada
                      </p>
                      <h2 className="mt-1 font-display text-4xl text-zinc-950 md:text-5xl dark:text-white">
                        Eventos Especiales
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('especiales')}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08] whitespace-nowrap shrink-0"
                    >
                      Ver Ediciones Especiales
                    </button>
                  </div>

                  <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                    {specialCampaigns.map((c, idx) => {
                      const linked = events.filter((e) => e.specialCampaignId === c.id);
                      return (
                        <motion.div
                          key={c.id}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.2 }}
                          transition={{ duration: 0.42, delay: idx * 0.06, ease: EASE_OUT_EXPO }}
                          className="flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white p-6 transition-transform duration-200 hover:-translate-y-0.5 dark:border-white/[0.08] dark:bg-[#0D0D11]"
                        >
                          <div>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              {c.season} · Vigencia {c.startDate} — {c.endDate}
                            </p>
                            <h3 className="mt-2 font-display text-3xl text-zinc-950 dark:text-white">
                              {c.name}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                              {c.promoText}
                            </p>
                          </div>

                          {linked.length > 0 && (
                            <div className="mt-5 flex flex-wrap gap-4 border-t border-zinc-200 pt-4 dark:border-white/[0.08]">
                              {linked.map((ev) => (
                                <button
                                  key={ev.id}
                                  type="button"
                                  onClick={() => openEventCheckout(ev.id)}
                                  className="text-xs font-semibold text-[#E50914] hover:underline"
                                >
                                  {ev.title} · {ev.date} →
                                </button>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Official Tributes */}
            {tributes.length > 0 && (
              <section className="mx-auto max-w-[1280px] px-5 py-16 md:px-10 md:py-20">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Memoria Musical Venezolana
                </p>
                <h2 className="mt-1 font-display text-4xl text-zinc-950 md:text-5xl dark:text-white">
                  Tributos Oficiales
                </h2>
                <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
                  {tributes.map((t, index) => (
                    <motion.article
                      key={t.id}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.42, delay: index * 0.06, ease: EASE_OUT_EXPO }}
                      className="flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white p-6 transition-transform duration-200 hover:-translate-y-0.5 dark:border-white/[0.08] dark:bg-[#0D0D11]"
                    >
                      <div>
                        <p className="text-xs font-medium text-amber-700 dark:text-[#D4AF37]">
                          0{index + 1}. {t.slogan || 'Homenaje en Vivo'}
                        </p>
                        <h3 className="mt-2 font-display text-3xl text-zinc-950 dark:text-white">
                          {t.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {t.text}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          t.eventId ? openEventCheckout(t.eventId) : onNavigate('galeria')
                        }
                        className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#E50914] hover:underline whitespace-nowrap"
                      >
                        <span>
                          {t.eventId ? 'Reservar para este homenaje' : 'Ver galería de sesiones'}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </motion.article>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* =========================================================
            CARTELERA DE EVENTOS + COMMERCIAL SPOTLIGHT BANNER
        ========================================================= */}
        {(activeSection === 'eventos' || activeSection === 'sessions') && (
          <section className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 space-y-14">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Temporada Activa · Cupos en Tiempo Real
              </p>
              <h1 className="mt-1 font-display text-5xl text-zinc-950 dark:text-white">
                Cartelera de Sesiones
              </h1>
              {events.length === 0 ? (
                <div className="mt-8 space-y-6">
                  <SiguienteParadaTeaser
                    hasEvent={false}
                  />
                  <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-white/10 p-10 text-center">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      Estamos preparando las próximas fechas oficiales de la temporada.
                    </p>
                    <p className="mt-1.5 text-xs text-zinc-500">
                      Puedes crear tu primer evento oficial desde el panel administrativo para abrir taquilla inmediatamente.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-9 space-y-8">
                  <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
                    {events.map((ev, i) => renderEventCard(ev, i))}
                  </div>
                  <div>
                    <SiguienteParadaTeaser
                      hasEvent={false}
                      city="Próxima Edición"
                      venue="En Producción"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Integrated Horizontal Advertising Strip for Ticket Buyers */}
            {activeBillboardAd && (
              <div className="lv-luxury-sheen group relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 p-6 md:p-8 text-white dark:border-white/10">
                <div className="absolute inset-0">
                  <PromoBannerVisual
                    imageUrl={activeBillboardAd.imageUrl}
                    title={activeBillboardAd.title}
                    preset={activeBillboardAd.visualPreset || 'vip_bar'}
                    className="h-full w-full"
                  />
                </div>
                <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="max-w-2xl space-y-2">
                    <p className="text-xs font-semibold tracking-wider text-[#D4AF37]">
                      DESTACADO COMERCIAL · {(activeBillboardAd.sponsorBrand || 'OFICIAL LV').toUpperCase()}
                    </p>
                    <h2 className="font-display text-3xl md:text-4xl leading-none text-white">
                      {activeBillboardAd.title}
                    </h2>
                    <p className="text-xs md:text-sm text-zinc-200">{activeBillboardAd.text}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {renderPromoCta(
                      activeBillboardAd,
                      'inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-5 py-3 text-xs font-semibold text-white hover:bg-[#c80812] whitespace-nowrap shrink-0'
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate('promos')}
                      className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-xs font-semibold text-white backdrop-blur-xs hover:bg-white/20 whitespace-nowrap shrink-0"
                    >
                      Espacios Publicitarios
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* =========================================================
            EDICIONES DE EVENTOS ESPECIALES
        ========================================================= */}
        {activeSection === 'especiales' && (
          <section className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 space-y-10">
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-[#D4AF37]">
                Producciones Temáticas
              </p>
              <h1 className="mt-1 font-display text-5xl text-zinc-950 dark:text-white">
                Ediciones Especiales
              </h1>
            </div>

            {specialCampaigns.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-white/[0.08] dark:bg-[#0D0D11]">
                <p className="text-sm text-zinc-500">
                  Próximamente anunciaremos nuevas ediciones temáticas de temporada.
                </p>
              </div>
            ) : (
              specialCampaigns.map((camp) => {
                const campEvents = events.filter((e) => e.specialCampaignId === camp.id);
                return (
                  <div
                    key={camp.id}
                    className="rounded-2xl border border-zinc-200/90 bg-white p-6 md:p-8 space-y-6 dark:border-white/[0.08] dark:bg-[#0D0D11]"
                  >
                    <div>
                      <p className="text-xs font-semibold" style={{ color: camp.accentPrimary }}>
                        {camp.season} · {camp.startDate} — {camp.endDate}
                      </p>
                      <h2 className="mt-1 font-display text-4xl text-zinc-950 dark:text-white">
                        {camp.name}
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                        {camp.promoText}
                      </p>
                    </div>

                    {campEvents.length > 0 ? (
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {campEvents.map((ev, i) => renderEventCard(ev, i))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        Las fechas asociadas a esta edición se publicarán en breve.
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </section>
        )}

        {/* =========================================================
            EVENT DETAIL & 3-STEP BOX-OFFICE FLOW (Animated Stepper)
        ========================================================= */}
        {activeSection === 'event-detail' && selectedEvent && (
          <section className="mx-auto max-w-[1260px] px-5 py-10 md:px-10 space-y-6">
            {/* Top Bar: Back + Stepper Progress + Live Reservation Timer */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
              <button
                type="button"
                onClick={() => onNavigate('eventos')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white whitespace-nowrap"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Volver a la cartelera</span>
              </button>

              {/* Interactive Step Indicator */}
              <div className="flex items-center gap-1 rounded-xl bg-zinc-200/70 p-1 dark:bg-white/[0.05]">
                {[
                  { n: 1 as const, label: '01. Entradas' },
                  { n: 2 as const, label: '02. Datos de Pago' },
                  { n: 3 as const, label: '03. Registrar Comprobante' },
                ].map((st) => {
                  const active = checkoutStep === st.n;
                  const reachable =
                    st.n === 1 ||
                    (st.n === 2 && generalQty + vipQty >= 1) ||
                    (st.n === 3 && generalQty + vipQty >= 1 && selectedMethod);
                  return (
                    <button
                      key={st.n}
                      type="button"
                      disabled={!reachable}
                      onClick={() => {
                        if (st.n === 2) proceedFromStep1();
                        else if (st.n === 3) proceedFromStep2();
                        else setCheckoutStep(1);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#E50914] text-white'
                          : reachable
                          ? 'text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white'
                          : 'cursor-not-allowed text-zinc-400 opacity-50'
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>

              {/* Session Hold Countdown */}
              <div className="flex items-center gap-2 font-mono-tabular text-xs text-zinc-600 dark:text-zinc-300">
                <Clock className="h-4 w-4 text-[#D4AF37]" />
                <span>
                  Sesión activa:{' '}
                  <strong className={timerSeconds < 90 ? 'text-[#E50914]' : 'text-zinc-950 dark:text-white'}>
                    {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
                    {String(timerSeconds % 60).padStart(2, '0')}
                  </strong>
                </span>
                {timerSeconds === 0 && (
                  <button
                    type="button"
                    onClick={() => setTimerSeconds(600)}
                    className="text-[#E50914] underline"
                  >
                    Renovar
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
              {/* LEFT 8 COLUMNS: ACTIVE CHECKOUT WORKSPACE */}
              <div className="lg:col-span-8 space-y-6">
                <AnimatePresence mode="wait">
                  {/* =================================================
                      STEP 1: UNLIMITED TICKET QUANTITY STEPPERS
                  ================================================= */}
                  {checkoutStep === 1 && (
                    <motion.div
                      key="checkout-step-1"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
                      className="rounded-2xl border border-zinc-200/90 bg-white p-6 md:p-8 space-y-6 dark:border-white/[0.08] dark:bg-[#0D0D11]"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[#E50914]">
                          Paso 01 · Taquilla Digital Oficial
                        </p>
                        <h1 className="mt-1 font-display text-4xl text-zinc-950 dark:text-white">
                          Selecciona tus Entradas
                        </h1>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          Selecciona la cantidad de entradas que deseas adquirir. Cada pase aprobado generará un código QR único nominado para el acceso.
                        </p>
                      </div>

                      <div className="border-y border-zinc-200 dark:border-white/10 py-5">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="min-w-[200px] flex-1">
                            <p className="text-base font-bold text-zinc-950 dark:text-white">
                              Entrada General Oficial
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                              Acceso oficial a la sesión + código QR individual ·{' '}
                              <strong className="font-mono-tabular text-zinc-800 dark:text-zinc-200">
                                {selectedEvent.availableGeneral || selectedEvent.availableTotal || 100} disponibles
                              </strong>
                            </p>
                          </div>

                          <div className="text-right mr-2">
                            <span className="font-mono-tabular text-2xl font-bold text-zinc-950 dark:text-white">
                              ${selectedEvent.generalPrice.toFixed(2)}
                            </span>
                            <span className="block text-[10px] text-zinc-400">c/u USD</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center rounded-xl border border-zinc-300 bg-zinc-50 p-1 dark:border-white/15 dark:bg-zinc-900">
                              <button
                                type="button"
                                disabled={generalQty <= 1}
                                onClick={() => clampGeneralQty(generalQty - 1)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-35 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                aria-label="Restar entrada"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={selectedEvent.availableGeneral || 100}
                                value={generalQty}
                                onChange={(e) => clampGeneralQty(Number(e.target.value))}
                                aria-label="Cantidad de entradas"
                                className="w-16 bg-transparent text-center font-mono-tabular text-base font-bold text-zinc-950 focus:outline-none dark:text-white"
                              />
                              <button
                                type="button"
                                disabled={generalQty >= (selectedEvent.availableGeneral || 100)}
                                onClick={() => clampGeneralQty(generalQty + 1)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E50914] text-white transition-colors hover:bg-[#c80812] disabled:opacity-35"
                                aria-label="Sumar entrada"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>

                            {(selectedEvent.availableGeneral || 100) >= 10 && (
                              <button
                                type="button"
                                onClick={() => clampGeneralQty(generalQty + 5)}
                                disabled={generalQty >= (selectedEvent.availableGeneral || 100)}
                                className="rounded-lg border border-zinc-300 px-2.5 py-2 font-mono-tabular text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
                              >
                                +5
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Terms & Access Conditions */}
                      <div className="space-y-4">
                        {selectedEvent.accessConditions && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Condiciones del recinto: {selectedEvent.accessConditions}
                          </p>
                        )}
                        <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-[#E50914]"
                          />
                          <span>
                            Acepto las normas de acceso del evento y confirmo que cada entrada emitirá un código QR único nominado tras verificarse el pago.
                          </span>
                        </label>

                        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            disabled={generalQty < 1 || !acceptedTerms}
                            onClick={proceedFromStep1}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#c80812] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
                          >
                            <span>Continuar</span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* =================================================
                      STEP 2: PAYMENT METHOD DETAILS (PAGO MÓVIL, BINANCE, TRANSFERENCIA)
                  ================================================= */}
                  {checkoutStep === 2 && (
                    <motion.div
                      key="checkout-step-2"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
                      className="rounded-2xl border border-zinc-200/90 bg-white p-6 md:p-8 space-y-6 dark:border-white/[0.08] dark:bg-[#0D0D11]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-amber-700 dark:text-[#D4AF37]">
                            Paso 02 · Datos de Pago
                          </p>
                          <h2 className="mt-1 font-display text-4xl text-zinc-950 dark:text-white">
                            Datos para Realizar el Pago
                          </h2>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Selecciona la forma de pago (Pago Móvil, Binance Pay o Transferencia Bancaria), copia los datos y realiza el pago exacto.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setCheckoutStep(1)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 whitespace-nowrap"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          <span>Atrás (Entradas)</span>
                        </button>
                      </div>

                      {/* Total to pay highlighted banner with automated daily official exchange rate */}
                      <div className="overflow-hidden rounded-xl border border-red-500/25 bg-red-500/[0.04] p-4 text-xs dark:border-[#E50914]/30 dark:bg-[#E50914]/[0.05] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-zinc-900 dark:text-white">
                              Total a transferir: <strong className="font-mono-tabular text-base text-[#E50914]">${grandTotal.toFixed(2)} USD</strong>
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              {generalQty} entrada(s) seleccionada(s) · Entrada General Oficial
                            </p>
                          </div>
                          <span className="rounded-md bg-zinc-900/10 px-2.5 py-1 font-mono-tabular text-[11px] font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                            Tasa oficial del día: Bs. {formattedExchangeRate} / USD
                          </span>
                        </div>

                        {/* Monto exacto en Bolívares al cambio del día (sin tener que calcular nada) */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-3.5 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/[0.12]">
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <span className="text-[11px] font-medium text-emerald-950 dark:text-emerald-200">
                                Monto exacto en Bolívares (Pago Móvil / Transferencia):
                              </span>
                              <strong className="font-mono-tabular text-base sm:text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                                Bs. {formattedTotalBs}
                              </strong>
                            </div>
                            <p className="text-[10px] text-emerald-800/80 dark:text-emerald-300">
                              Calculado automáticamente a la tasa oficial del día ({exchangeRate?.source || 'Banco Central de Venezuela BCV'}).
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyPaymentValue('Monto en Bolívares', totalAmountBs.toFixed(2))}
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copiar Monto en Bs</span>
                          </button>
                        </div>
                      </div>

                      {availableMethodKeys.length === 0 ? (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-white/10 dark:bg-white/[0.03]">
                          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                            La recepción digital de pagos para esta sesión se habilitará en breve.
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Mantente atento a {settings.brandHandle} o comunícate con taquilla oficial.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            Elige una opción para ver los datos bancarios:
                          </p>

                          {availableMethodKeys.map((mKey) => {
                            const isSelected = selectedMethod === mKey;
                            const cfg = activePaymentMethods[mKey];
                            const qrPaymentPayload =
                              mKey === 'pago_movil'
                                ? `PAGO MOVIL | Banco: ${cfg.bank} | Tel: ${cfg.phone} | Doc: ${cfg.documentId} | Monto USD: ${grandTotal.toFixed(2)} | Bs: ${totalAmountBs.toFixed(2)}`
                                : mKey === 'transferencia'
                                ? `TRANSFERENCIA | Banco: ${cfg.bank} | Cuenta: ${cfg.accountNumber} | Doc: ${cfg.documentId} | Monto USD: ${grandTotal.toFixed(2)} | Bs: ${totalAmountBs.toFixed(2)}`
                                : `BINANCE PAY | ID: ${cfg.payIdOrEmail} | Red: ${cfg.networkOrAsset} | Monto USDT: ${grandTotal.toFixed(2)}`;

                            return (
                              <div
                                key={mKey}
                                className={`overflow-hidden rounded-xl border transition-all ${
                                  isSelected
                                    ? 'border-[#E50914] bg-zinc-50/80 shadow-xs dark:border-[#E50914] dark:bg-white/[0.04]'
                                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-white/10 dark:bg-transparent dark:hover:border-white/20'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedMethod(mKey)}
                                  className="flex w-full items-center justify-between px-5 py-4 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                        isSelected
                                          ? 'border-[#E50914] bg-[#E50914]'
                                          : 'border-zinc-400 dark:border-zinc-600'
                                      }`}
                                    >
                                      {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                                    </span>
                                    <div>
                                      <span className="text-sm font-bold text-zinc-950 dark:text-white">
                                        {METHOD_TITLES[mKey]}
                                      </span>
                                      <span className="block text-[11px] text-zinc-500">
                                        {mKey === 'pago_movil'
                                          ? `${cfg.bank || 'Banco'} · ${cfg.phone || ''} · Bs. ${formattedTotalBs}`
                                          : mKey === 'binance'
                                          ? `Binance Pay (${cfg.networkOrAsset || 'USDT'})`
                                          : `${cfg.bank || 'Banco'} · ${cfg.accountType || 'Corriente'} · Bs. ${formattedTotalBs}`}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isSelected && (
                                      <span className="hidden sm:inline-flex rounded-full bg-[#E50914]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#E50914]">
                                        Seleccionado
                                      </span>
                                    )}
                                    <ChevronDown
                                      className={`h-4 w-4 text-zinc-500 transition-transform ${
                                        isSelected ? 'rotate-180 text-[#E50914]' : ''
                                      }`}
                                    />
                                  </div>
                                </button>

                                {isSelected && cfg && (
                                  <div className="border-t border-zinc-200 px-5 py-4 dark:border-white/10">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                      <div className="space-y-2.5 text-xs flex-1">
                                        {mKey === 'pago_movil' && (
                                          <>
                                            {/* Conversión automática en Bolívares Pago Móvil */}
                                            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] p-3 dark:border-emerald-500/40 dark:bg-emerald-500/[0.12]">
                                              <div>
                                                <span className="block text-[11px] font-medium text-emerald-900 dark:text-emerald-200">
                                                  Monto exacto a transferir por Pago Móvil:
                                                </span>
                                                <span className="font-mono-tabular text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                                                  Bs. {formattedTotalBs}
                                                </span>
                                                <span className="block text-[10px] text-emerald-800/80 dark:text-emerald-300">
                                                  Tasa oficial del día: Bs. {formattedExchangeRate} / USD (BCV)
                                                </span>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => copyPaymentValue('Monto en Bs', totalAmountBs.toFixed(2))}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
                                              >
                                                {copiedField === 'Monto en Bs' ? (
                                                  <>
                                                    <Check className="h-3.5 w-3.5" />
                                                    <span>¡Copiado!</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="h-3.5 w-3.5" />
                                                    <span>Copiar Monto en Bs</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                              <span>
                                                <strong>Banco:</strong> {cfg.bank}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 p-2 dark:bg-white/[0.05]">
                                              <span className="font-mono-tabular">
                                                <strong>Teléfono:</strong> {cfg.phone}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => copyPaymentValue('Teléfono', cfg.phone)}
                                                className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-[#E50914] shadow-xs hover:bg-zinc-50 dark:bg-zinc-800"
                                              >
                                                {copiedField === 'Teléfono' ? (
                                                  <>
                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="h-3 w-3" />
                                                    <span>Copiar</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 p-2 dark:bg-white/[0.05]">
                                              <span className="font-mono-tabular">
                                                <strong>RIF / Cédula:</strong> {cfg.documentId}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => copyPaymentValue('Cédula', cfg.documentId)}
                                                className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-[#E50914] shadow-xs hover:bg-zinc-50 dark:bg-zinc-800"
                                              >
                                                {copiedField === 'Cédula' ? (
                                                  <>
                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="h-3 w-3" />
                                                    <span>Copiar</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                            {cfg.holderName && (
                                              <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 p-2 dark:bg-white/[0.05]">
                                                <span>
                                                  <strong>Beneficiario:</strong> {cfg.holderName}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => copyPaymentValue('Beneficiario', cfg.holderName)}
                                                  className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-[#E50914] shadow-xs hover:bg-zinc-50 dark:bg-zinc-800"
                                                >
                                                  {copiedField === 'Beneficiario' ? (
                                                    <>
                                                      <Check className="h-3 w-3 text-emerald-500" />
                                                      <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Copy className="h-3 w-3" />
                                                      <span>Copiar</span>
                                                    </>
                                                  )}
                                                </button>
                                              </div>
                                            )}
                                          </>
                                        )}

                                        {mKey === 'transferencia' && (
                                          <>
                                            {/* Conversión automática en Bolívares Transferencia */}
                                            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] p-3 dark:border-emerald-500/40 dark:bg-emerald-500/[0.12]">
                                              <div>
                                                <span className="block text-[11px] font-medium text-emerald-900 dark:text-emerald-200">
                                                  Monto exacto a transferir en Bolívares (Bs):
                                                </span>
                                                <span className="font-mono-tabular text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                                                  Bs. {formattedTotalBs}
                                                </span>
                                                <span className="block text-[10px] text-emerald-800/80 dark:text-emerald-300">
                                                  Tasa oficial del día: Bs. {formattedExchangeRate} / USD (BCV)
                                                </span>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => copyPaymentValue('Monto en Bs', totalAmountBs.toFixed(2))}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
                                              >
                                                {copiedField === 'Monto en Bs' ? (
                                                  <>
                                                    <Check className="h-3.5 w-3.5" />
                                                    <span>¡Copiado!</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="h-3.5 w-3.5" />
                                                    <span>Copiar Monto en Bs</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                              <p>
                                                <strong>Banco:</strong> {cfg.bank} ({cfg.accountType})
                                              </p>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 p-2 dark:bg-white/[0.05]">
                                              <span className="font-mono-tabular break-all">
                                                <strong>Cuenta:</strong> {cfg.accountNumber}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => copyPaymentValue('Número de Cuenta', cfg.accountNumber)}
                                                className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-[#E50914] shadow-xs hover:bg-zinc-50 dark:bg-zinc-800 shrink-0"
                                              >
                                                {copiedField === 'Número de Cuenta' ? (
                                                  <>
                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="h-3 w-3" />
                                                    <span>Copiar Cuenta</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 p-2 dark:bg-white/[0.05]">
                                              <span className="font-mono-tabular">
                                                <strong>Titular:</strong> {cfg.holderName}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => copyPaymentValue('Titular', cfg.holderName)}
                                                className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-[#E50914] shadow-xs hover:bg-zinc-50 dark:bg-zinc-800 shrink-0"
                                              >
                                                {copiedField === 'Titular' ? (
                                                  <>
                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="h-3 w-3" />
                                                    <span>Copiar Titular</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 p-2 dark:bg-white/[0.05]">
                                              <span className="font-mono-tabular">
                                                <strong>Cédula / RIF:</strong> {cfg.documentId}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => copyPaymentValue('Cédula Titular', cfg.documentId)}
                                                className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-[#E50914] shadow-xs hover:bg-zinc-50 dark:bg-zinc-800 shrink-0"
                                              >
                                                {copiedField === 'Cédula Titular' ? (
                                                  <>
                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="h-3 w-3" />
                                                    <span>Copiar Cédula</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                          </>
                                        )}

                                        {mKey === 'binance' && (
                                          <>
                                            <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 p-2 dark:bg-white/[0.05]">
                                              <span className="font-mono-tabular break-all">
                                                <strong>Binance Pay / Correo:</strong> {cfg.payIdOrEmail}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => copyPaymentValue('Binance ID', cfg.payIdOrEmail)}
                                                className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-[#E50914] shadow-xs hover:bg-zinc-50 dark:bg-zinc-800 shrink-0"
                                              >
                                                {copiedField === 'Binance ID' ? (
                                                  <>
                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="h-3 w-3" />
                                                    <span>Copiar</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                            <p>
                                              <strong>Activo / Red:</strong> {cfg.networkOrAsset}
                                            </p>
                                          </>
                                        )}

                                        {cfg.instructions && (
                                          <p className="pt-1 text-zinc-500 dark:text-zinc-400">
                                            {cfg.instructions}
                                          </p>
                                        )}
                                      </div>

                                      {/* Scannable Payment QR - Solo si showQr es verdadero y tiene imagen cargada */}
                                      {Boolean(cfg.showQr && cfg.qrImageUrl) && (
                                        <div className="flex flex-col items-center shrink-0 rounded-xl bg-white p-2.5 shadow-xs dark:bg-zinc-900 border border-zinc-200 dark:border-white/10">
                                          <img
                                            src={cfg.qrImageUrl}
                                            alt={mKey === 'binance' ? 'QR Binance Pay' : 'QR Pago'}
                                            className="h-28 w-28 rounded-lg object-contain bg-white"
                                          />
                                          <span className="mt-1 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                                            Escaneo rápido
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Optional Club Bar & Combos if configured */}
                      {activeEventCombos.length > 0 && (
                        <div className="space-y-3 border-t border-zinc-200 pt-5 dark:border-white/10">
                          <div>
                            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                              Barra Oficial y Combos de la Noche (Opcional)
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              Si deseas, puedes añadir combos o bebidas pre-pagadas para retirar sin fila.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {activeEventCombos.map((cmb) => {
                              const cQty = comboQtys[cmb.id] || 0;
                              return (
                                <div
                                  key={cmb.id}
                                  className="flex flex-col justify-between rounded-xl border border-zinc-200 p-3.5 dark:border-white/10"
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-bold text-zinc-950 dark:text-white">
                                        {cmb.name}
                                      </p>
                                      <span className="font-mono-tabular text-xs font-bold text-[#D4AF37]">
                                        ${cmb.price.toFixed(2)}
                                      </span>
                                    </div>
                                    {cmb.description && (
                                      <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                        {cmb.description}
                                      </p>
                                    )}
                                  </div>

                                  <div className="mt-3 flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      disabled={cQty <= 0}
                                      onClick={() =>
                                        setComboQtys((prev) => ({
                                          ...prev,
                                          [cmb.id]: Math.max(0, cQty - 1),
                                        }))
                                      }
                                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 disabled:opacity-35 dark:border-white/15 dark:text-zinc-200"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="w-6 text-center font-mono-tabular text-xs font-bold">
                                      {cQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setComboQtys((prev) => ({
                                          ...prev,
                                          [cmb.id]: Math.min(99, cQty + 1),
                                        }))
                                      }
                                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Navigation buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-5 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => setCheckoutStep(1)}
                          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-5 py-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/[0.06] whitespace-nowrap"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          <span>Atrás</span>
                        </button>

                        <button
                          type="button"
                          disabled={availableMethodKeys.length === 0}
                          onClick={proceedFromStep2}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-7 py-3.5 text-sm font-semibold text-white hover:bg-[#c80812] disabled:opacity-50 whitespace-nowrap"
                        >
                          <span>Siguiente: Registrar Pago</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* =================================================
                      STEP 3: REGISTRAR COMPROBANTE Y DATOS DEL EMISOR
                  ================================================= */}
                  {checkoutStep === 3 && (
                    <motion.div
                      key="checkout-step-3"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
                      className="rounded-2xl border border-zinc-200/90 bg-white p-6 md:p-8 space-y-6 dark:border-white/[0.08] dark:bg-[#0D0D11]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-amber-700 dark:text-[#D4AF37]">
                            Paso 03 · Registrar Comprobante
                          </p>
                          <h2 className="mt-1 font-display text-4xl text-zinc-950 dark:text-white">
                            Registrar Pago
                          </h2>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Registra tu pago con tu nombre y apellido, cédula, número de teléfono, correo electrónico, referencia y foto del comprobante.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCheckoutStep(2)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 whitespace-nowrap"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          <span>Atrás (Datos de Pago)</span>
                        </button>
                      </div>

                      {/* Selected payment method summary badge */}
                      {selectedMethod && activePaymentMethods[selectedMethod] && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <CreditCard className="h-4 w-4 text-[#E50914]" />
                            <span>
                              Método:{' '}
                              <strong className="text-zinc-900 dark:text-white">
                                {METHOD_TITLES[selectedMethod]}
                              </strong>
                              {activePaymentMethods[selectedMethod]?.bank && (
                                <span className="text-zinc-500">
                                  {' '}· {activePaymentMethods[selectedMethod].bank}
                                </span>
                              )}
                            </span>
                            <span className="font-mono-tabular font-bold text-[#E50914]">
                              ${grandTotal.toFixed(2)} USD
                            </span>
                            {(selectedMethod === 'pago_movil' || selectedMethod === 'transferencia') && (
                              <span className="font-mono-tabular rounded bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-400">
                                ⇄ Bs. {formattedTotalBs} (Tasa: Bs. {formattedExchangeRate})
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCheckoutStep(2)}
                            className="text-xs font-semibold text-[#E50914] hover:underline cursor-pointer"
                          >
                            Cambiar método
                          </button>
                        </div>
                      )}

                      {!currentUser ? (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-6 text-center space-y-3 dark:border-white/10 dark:bg-white/[0.03]">
                          <ShieldCheck className="mx-auto h-7 w-7 text-[#D4AF37]" />
                          <p className="text-sm font-bold text-zinc-950 dark:text-white">
                            Identifícate para registrar tu pago y emitir tus {generalQty + vipQty} pase(s) QR
                          </p>
                          <p className="mx-auto max-w-md text-xs text-zinc-500 dark:text-zinc-400">
                            Tu selección de entradas y método de pago se mantendrá guardada mientras inicias sesión o creas tu cuenta.
                          </p>
                          <div className="flex flex-wrap justify-center gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => onOpenAuth('login')}
                              className="rounded-xl bg-[#E50914] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#c80812] cursor-pointer whitespace-nowrap"
                            >
                              Iniciar Sesión
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenAuth('register')}
                              className="rounded-xl border border-zinc-300 bg-white px-6 py-2.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-white/15 dark:bg-zinc-900 dark:text-white cursor-pointer whitespace-nowrap"
                            >
                              Crear Cuenta Rápida
                            </button>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={submitOrder} className="space-y-5">
                          {/* 48-72 Hours Verification Notice as requested */}
                          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-xs text-zinc-800 dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/[0.05] dark:text-zinc-200">
                            <div className="flex items-start gap-2.5">
                              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#E50914] dark:text-[#D4AF37]" />
                              <div>
                                <strong className="text-zinc-950 dark:text-white">
                                  Notificación oficial (48 a 72 horas):
                                </strong>{' '}
                                Al confirmar tu pago, en un lapso de 48 a 72 horas se estará verificando la operación bancaria y recibirás tus entradas oficiales con código QR directamente en tu correo electrónico. ¡Miles de gracias!
                              </div>
                            </div>
                          </div>

                          {/* Payer Information Form */}
                          <div className="rounded-xl border border-zinc-200 p-5 space-y-4 dark:border-white/10">
                            <div>
                              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                                Registrar Pago
                              </h3>
                              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                Ingresa los datos solicitados para conciliar la transferencia o pago móvil.
                              </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-xs font-medium">
                                  Nombre y apellido *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={payerName}
                                  onChange={(e) => setPayerName(e.target.value)}
                                  placeholder="Ej. Juan Pérez"
                                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm dark:border-white/15 dark:bg-zinc-900"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium">
                                  Cédula o documento *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={payerCedula}
                                  onChange={(e) => setPayerCedula(e.target.value)}
                                  placeholder="Ej. V-18456789"
                                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm dark:border-white/15 dark:bg-zinc-900"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium">
                                  Número de teléfono *
                                </label>
                                <input
                                  type="tel"
                                  required
                                  value={payerPhone}
                                  onChange={(e) => setPayerPhone(e.target.value)}
                                  placeholder="Ej. 0412-1234567"
                                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm dark:border-white/15 dark:bg-zinc-900"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium">
                                  Correo electrónico (donde llegarán las entradas) *
                                </label>
                                <input
                                  type="email"
                                  required
                                  value={payerEmail}
                                  onChange={(e) => setPayerEmail(e.target.value)}
                                  placeholder="correo@ejemplo.com"
                                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm dark:border-white/15 dark:bg-zinc-900"
                                />
                              </div>
                            </div>

                            <div className="border-t border-zinc-200 pt-4 dark:border-white/10">
                              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider dark:text-zinc-200">
                                Referencia y Captura del Pago
                              </h4>
                            </div>

                            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-xs font-medium">
                                  Referencia de pago móvil o transacción *
                                </label>
                                <input
                                  type="text"
                                  required
                                  minLength={4}
                                  maxLength={64}
                                  value={paymentRef}
                                  onChange={(e) => setPaymentRef(e.target.value)}
                                  placeholder="Ej. 009482716"
                                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm dark:border-white/15 dark:bg-zinc-900"
                                />
                              </div>
                              <div>
                                <div className="mb-1 flex items-center justify-between">
                                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                    Monto transferido (USD)
                                  </label>
                                  <span className="inline-flex items-center gap-1 rounded bg-zinc-200/80 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                                    <ShieldCheck className="h-3 w-3 text-emerald-500" />
                                    <span>Fijo / No editable</span>
                                  </span>
                                </div>
                                <div className="relative">
                                  <input
                                    type="text"
                                    readOnly
                                    disabled
                                    value={`$${grandTotal.toFixed(2)} USD`}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-100/90 px-3.5 py-2.5 font-mono-tabular text-sm font-bold text-zinc-900 cursor-not-allowed select-none dark:border-white/10 dark:bg-zinc-800/80 dark:text-white"
                                  />
                                </div>
                                {(selectedMethod === 'pago_movil' || selectedMethod === 'transferencia') && (
                                  <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                    Equivalente oficial en Bs: <strong>Bs. {formattedTotalBs}</strong> (Tasa: Bs. {formattedExchangeRate})
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium">Fecha del pago</label>
                                <input
                                  type="date"
                                  required
                                  value={paymentDate}
                                  onChange={(e) => setPaymentDate(e.target.value)}
                                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm dark:border-white/15 dark:bg-zinc-900"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium">
                                  Adjunta foto o captura del pago móvil *
                                </label>
                                <input
                                  type="file"
                                  required
                                  accept="image/png,image/jpeg,image/webp,application/pdf"
                                  onChange={async (e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    try {
                                      const dataUrl = await fileToValidatedDataUrl(f, { allowPdf: true });
                                      setVoucherDataUrl(dataUrl);
                                      setVoucherFileName(f.name);
                                    } catch (err: any) {
                                      onNotify(err.message, 'error');
                                    }
                                  }}
                                  className="block w-full text-xs text-zinc-500 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-200 file:px-3 file:py-2 file:text-xs file:font-semibold dark:file:bg-white/10 dark:file:text-zinc-200 cursor-pointer"
                                />
                                {voucherFileName && (
                                  <p className="mt-1 truncate text-[11px] text-emerald-600 dark:text-emerald-400">
                                    Adjunto: {voucherFileName}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                              <button
                                type="button"
                                onClick={() => setCheckoutStep(2)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 px-4 py-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 whitespace-nowrap cursor-pointer"
                              >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                <span>Atrás a Datos de Pago</span>
                              </button>

                              <button
                                type="submit"
                                disabled={submittingOrder}
                                className="inline-flex items-center justify-center rounded-xl bg-[#E50914] px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#c80812] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                              >
                                {submittingOrder
                                  ? 'Registrando operación...'
                                  : `Confirmar Pago ($${grandTotal.toFixed(2)})`}
                              </button>
                            </div>
                          </div>
                        </form>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* RIGHT 4 COLUMNS: STICKY ORDER SUMMARY SIDEBAR */}
              <aside className="lg:col-span-4 lg:sticky lg:top-24 rounded-2xl border border-zinc-200/90 bg-white overflow-hidden dark:border-white/[0.08] dark:bg-[#0D0D11]">
                <div className="relative h-44 w-full">
                  <EventPosterVisual
                    imageUrl={selectedEvent.imageUrl}
                    title={selectedEvent.title}
                    subtitle={selectedEvent.city}
                    theme={selectedEvent.posterTheme}
                    className="h-full w-full"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <p className="text-[11px] font-medium text-[#D4AF37]">
                      {selectedEvent.saleBadge || 'TAQUILLA'} · {selectedEvent.category}
                    </p>
                    <h3 className="font-display text-2xl leading-none">{selectedEvent.title}</h3>
                  </div>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div className="space-y-1.5 border-b border-zinc-200 pb-4 dark:border-white/10">
                    <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                      <Calendar className="h-3.5 w-3.5 text-[#E50914] shrink-0" />
                      <span>
                        {selectedEvent.date} · {selectedEvent.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                      <MapPin className="h-3.5 w-3.5 text-[#E50914] shrink-0" />
                      <span>
                        {selectedEvent.venue} · {selectedEvent.city}
                      </span>
                    </div>
                  </div>

                  {/* Line-item Breakdown */}
                  <div className="space-y-2">
                    <p className="font-semibold text-zinc-900 dark:text-white">
                      Resumen de Compra ({generalQty + vipQty} entrada{generalQty + vipQty === 1 ? '' : 's'})
                    </p>

                    {generalQty > 0 && (
                      <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                        <span>{generalQty}x Localidad General</span>
                        <span className="font-mono-tabular font-semibold">
                          ${(generalQty * selectedEvent.generalPrice).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {vipQty > 0 && (
                      <div className="flex items-center justify-between text-amber-700 dark:text-[#D4AF37]">
                        <span>{vipQty}x Experiencia VIP</span>
                        <span className="font-mono-tabular font-semibold">
                          ${(vipQty * selectedEvent.vipPrice).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {generalQty + vipQty === 0 && (
                      <p className="text-zinc-400">Sin entradas seleccionadas aún.</p>
                    )}

                    {activeEventCombos.map((cmb) => {
                      const q = comboQtys[cmb.id] || 0;
                      if (q <= 0) return null;
                      return (
                        <div
                          key={cmb.id}
                          className="flex items-center justify-between text-zinc-600 dark:text-zinc-300"
                        >
                          <span>
                            {q}x {cmb.name}
                          </span>
                          <span className="font-mono-tabular font-semibold">
                            ${(q * cmb.price).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-zinc-200 pt-4 dark:border-white/10 space-y-2">
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="block text-[11px] text-zinc-500">Total a Pagar</span>
                        <span className="text-[10px] text-zinc-400">Impuestos incluidos</span>
                      </div>
                      <span className="font-mono-tabular text-3xl font-bold text-[#E50914]">
                        ${grandTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-emerald-500/[0.08] px-3 py-1.5 text-xs dark:bg-emerald-500/[0.12]">
                      <span className="text-[11px] font-medium text-emerald-950 dark:text-emerald-200">
                        Equivalente en Bs:
                      </span>
                      <span className="font-mono-tabular font-extrabold text-emerald-700 dark:text-emerald-400">
                        Bs. {formattedTotalBs}
                      </span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}

        {/* =========================================================
            COLLECTOR'S DIGITAL QR WALLET (Module 5)
        ========================================================= */}
        {activeSection === 'my-tickets' && (
          <section className="mx-auto max-w-[1160px] px-5 py-14 md:px-10 space-y-8">
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-[#D4AF37]">
                Billetera Nominativa
              </p>
              <h1 className="mt-1 font-display text-5xl text-zinc-950 dark:text-white">
                Mis Pases QR
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Presenta el código QR de cada pase en el acceso oficial del evento.
              </p>
            </div>

            {/* Client Requested 48-72 Hour Verification Notice */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-xs text-zinc-800 dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/[0.05] dark:text-zinc-200">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#E50914] dark:text-[#D4AF37]" />
                <div className="space-y-1">
                  <p className="font-bold text-zinc-950 dark:text-white">
                    Plazo de validación oficial: 48 a 72 horas
                  </p>
                  <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">
                    Una vez reportado tu pago, el equipo de administración concilia la referencia con la cuenta receptora. En un lapso estimado de <strong>48 a 72 horas</strong> se estará validando tu comprobante y se te enviarán las entradas oficiales con código QR directamente al correo electrónico registrado.
                  </p>
                </div>
              </div>
            </div>

            {orderSuccessBanner && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.08] p-5 text-xs text-zinc-900 dark:text-zinc-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        ¡Comprobante recibido con éxito! (Orden {orderSuccessBanner.orderId})
                      </p>
                      <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">
                        Se registraron {orderSuccessBanner.qty} entrada(s). En un lapso de 48 a 72 horas se estará validando el comprobante bancario y recibirás tus pases QR en <strong>{orderSuccessBanner.email}</strong>.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOrderSuccessBanner(null)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {!currentUser ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-white/[0.08] dark:bg-[#0D0D11]">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Inicia sesión para consultar tus pagos y visualizar tus pases QR activos.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="mt-4 rounded-xl bg-[#E50914] px-5 py-2.5 text-xs font-semibold text-white"
                >
                  Iniciar Sesión
                </button>
              </div>
            ) : (
              <>
                {myOrders.length > 0 && (
                  <div className="space-y-2.5">
                    <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      Historial de Operaciones Recientes
                    </h2>
                    {myOrders.map((o) => {
                      const g = o.generalQty ?? (o.ticketType === 'general' ? o.qty : 0);
                      const v = o.vipQty ?? (o.ticketType === 'vip' ? o.qty : 0);
                      const tierText =
                        g > 0 && v > 0
                          ? `${o.qty} pases (${g} Gen + ${v} VIP)`
                          : `${o.qty}x ${o.ticketType.toUpperCase()}`;

                      return (
                        <div
                          key={o.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white px-4 py-3.5 text-xs dark:border-white/[0.08] dark:bg-[#0D0D11]"
                        >
                          <div>
                            <span className="font-semibold text-zinc-950 dark:text-white">
                              {o.eventTitle}
                            </span>{' '}
                            · {tierText}
                            {o.combos && o.combos.length > 0
                              ? ` + ${o.combos.map((c) => `${c.qty}x ${c.name}`).join(', ')}`
                              : ''}{' '}
                            · <span className="font-mono-tabular">${o.totalAmount.toFixed(2)}</span> · Ref{' '}
                            <span className="font-mono-tabular">{o.reference}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-semibold">
                            {o.status === 'pending' && (
                              <>
                                <Clock className="h-4 w-4 text-amber-500" />
                                <span className="text-amber-600 dark:text-amber-400">
                                  En verificación (48 a 72 hrs · Se enviará al correo)
                                </span>
                              </>
                            )}
                            {o.status === 'approved' && (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  Verificado · Pases emitidos
                                </span>
                              </>
                            )}
                            {o.status === 'rejected' && (
                              <>
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-red-600 dark:text-red-400">
                                  Observado {o.reviewNotes ? `(${o.reviewNotes})` : ''}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {myTickets.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-200/90 bg-white p-12 text-center dark:border-white/[0.08] dark:bg-[#0D0D11]">
                    <Ticket className="mx-auto h-8 w-8 text-zinc-400" />
                    <p className="mt-3 text-sm font-semibold text-zinc-950 dark:text-white">
                      Aún no tienes pases QR emitidos
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Tus códigos QR únicos aparecerán en esta billetera en cuanto se valide tu comprobante.
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate('eventos')}
                      className="mt-5 rounded-xl bg-[#E50914] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#c80812]"
                    >
                      Explorar Cartelera
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {myTickets.map((t, idx) => (
                      <motion.div
                        key={t.id}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.36, delay: idx * 0.05, ease: EASE_OUT_EXPO }}
                        className={`lv-luxury-sheen flex flex-col sm:flex-row items-stretch overflow-hidden rounded-2xl border bg-white dark:bg-[#0D0D11] ${
                          t.status === 'valid'
                            ? 'border-zinc-200/90 dark:border-white/10'
                            : 'border-zinc-200 opacity-60 dark:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-center bg-zinc-50 p-5 dark:bg-white/[0.03]">
                          <QrCodeBox payload={t.qrPayload} size={138} />
                        </div>
                        <div className="hidden sm:block w-px lv-ticket-perforation" />
                        <div className="flex flex-1 flex-col justify-between p-5">
                          <div>
                            <p className="text-xs font-medium text-amber-700 dark:text-[#D4AF37]">
                              {t.status === 'valid' ? 'Pase Activo' : 'Pase Utilizado'} · Localidad{' '}
                              {t.ticketType.toUpperCase()}
                              {t.seatLabel ? ` · ${formatSeatDisplay(t.seatLabel)}` : ''} · #{t.seq}
                            </p>
                            <h3 className="mt-1.5 font-display text-3xl leading-none text-zinc-950 dark:text-white">
                              {t.eventTitle}
                            </h3>
                            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                              Titular: {t.userName}
                            </p>
                          </div>
                          <div className="mt-4 border-t border-zinc-200/80 pt-3 dark:border-white/[0.08]">
                            <span className="block text-[10px] text-zinc-400">
                              Código de verificación
                            </span>
                            <span className="font-mono-tabular text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                              {t.code}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* =========================================================
            EDITORIAL SQUARE PHOTO GALLERY (Module 10)
        ========================================================= */}
        {activeSection === 'galeria' && (
          <section className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Memoria Visual de la Comunidad
                </p>
                <h1 className="mt-1 font-display text-5xl text-zinc-950 dark:text-white">
                  Galería Oficial
                </h1>
              </div>

              <select
                value={galEventFilter}
                onChange={(e) => setGalEventFilter(e.target.value)}
                className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium dark:border-white/15 dark:bg-[#0D0D11]"
              >
                <option value="">Todas las sesiones</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5 rounded-xl bg-zinc-200/70 p-1.5 dark:bg-white/[0.04]">
              <button
                type="button"
                onClick={() => setGalCategoryFilter('')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  galCategoryFilter === ''
                    ? 'bg-white text-zinc-950 shadow-xs dark:bg-white dark:text-zinc-950'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                Todas
              </button>
              {galleryCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setGalCategoryFilter(cat.id)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    galCategoryFilter === cat.id
                      ? 'bg-white text-zinc-950 shadow-xs dark:bg-white dark:text-zinc-950'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:gap-5">
              {galleryPhotos
                .filter((p) => {
                  if (galCategoryFilter && p.categoryId !== galCategoryFilter) return false;
                  if (galEventFilter && p.eventId !== galEventFilter) return false;
                  return true;
                })
                .map((photo, idx) => (
                  <motion.button
                    key={photo.id}
                    type="button"
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
                    whileInView={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ duration: 0.35, delay: Math.min(idx * 0.04, 0.2), ease: EASE_OUT_EXPO }}
                    onClick={() => setLightboxPhoto(photo)}
                    className="lv-luxury-sheen group relative aspect-square overflow-hidden rounded-2xl border border-zinc-200/90 text-left focus-visible:ring-2 focus-visible:ring-[#E50914] dark:border-white/[0.08]"
                  >
                    <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]">
                      <GalleryVisual
                        imageUrl={photo.imageUrl}
                        title={photo.title}
                        preset={photo.visualPreset}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4">
                      <p className="text-[11px] text-zinc-300">
                        {photo.categoryName}
                        {photo.eventTitle ? ` · ${photo.eventTitle}` : ''}
                      </p>
                      <p className="truncate text-xs font-semibold text-white">{photo.title}</p>
                    </div>
                  </motion.button>
                ))}
            </div>

            <AnimatePresence>
              {lightboxPhoto && (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
                  onClick={() => setLightboxPhoto(null)}
                >
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.26, ease: EASE_OUT_EXPO }}
                    className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0B0B0F] text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxPhoto(null)}
                      aria-label="Cerrar fotografía"
                      className="absolute top-3 right-3 z-20 rounded-full bg-black/70 p-2 text-white hover:bg-black"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <div className="aspect-square max-h-[62vh] w-full">
                      <GalleryVisual
                        imageUrl={lightboxPhoto.imageUrl}
                        title={lightboxPhoto.title}
                        preset={lightboxPhoto.visualPreset}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="p-6 space-y-1.5">
                      <p className="text-xs text-zinc-400">
                        {lightboxPhoto.categoryName} · {lightboxPhoto.date}
                        {lightboxPhoto.eventTitle ? ` · ${lightboxPhoto.eventTitle}` : ''} ·{' '}
                        {lightboxPhoto.authorName}
                      </p>
                      <h3 className="text-lg font-bold">{lightboxPhoto.title}</h3>
                      {lightboxPhoto.description && (
                        <p className="text-sm text-zinc-300">{lightboxPhoto.description}</p>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* =========================================================
            PUBLICIDAD COMERCIAL, PATROCINANTES & TRIBUTOS OFICIALES
        ========================================================= */}
        {activeSection === 'promos' && (
          <div className="space-y-16 py-14">
            {/* 1. Asymmetric Commercial Advertising & Sponsors Grid */}
            <section className="mx-auto max-w-[1280px] px-5 md:px-10 space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-[#D4AF37]">
                    Marcas Aliadas · Promociones de Temporada
                  </p>
                  <h1
                    className="mt-1 font-display text-5xl text-zinc-950 dark:text-white"
                    style={{ textWrap: 'balance' }}
                  >
                    Publicidad y Experiencias Oficiales
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('lv-pauta-comercial');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Pautar con Nosotros</span>
                </button>
              </div>

              {regularPromos.length > 0 && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {regularPromos.map((item, idx) => {
                    const isFeaturedSpan = idx === 0;
                    return (
                      <motion.article
                        key={item.id}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                        whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.15 }}
                        transition={{ duration: 0.44, delay: Math.min(idx * 0.06, 0.24), ease: EASE_OUT_EXPO }}
                        className={`lv-luxury-sheen group relative flex min-h-[340px] flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 p-6 md:p-7 text-white transition-transform duration-200 hover:-translate-y-1 dark:border-white/10 ${
                          isFeaturedSpan ? 'md:col-span-2' : 'md:col-span-1'
                        }`}
                      >
                        <div className="absolute inset-0">
                          <PromoBannerVisual
                            imageUrl={item.imageUrl}
                            title={item.title}
                            preset={item.visualPreset}
                            fallbackIndex={idx}
                            className="h-full w-full"
                          />
                        </div>

                        <div className="relative z-10">
                          <p className="text-xs font-semibold tracking-wider text-[#D4AF37]">
                            0{idx + 1} · {(item.sponsorBrand || item.slogan || 'CAMPAÑA OFICIAL').toUpperCase()}
                          </p>
                        </div>

                        <div className="relative z-10 mt-auto max-w-xl space-y-2.5 pt-16">
                          {item.slogan && (
                            <p className="text-xs font-medium text-zinc-300">{item.slogan}</p>
                          )}
                          <h2 className="font-display text-3xl md:text-4xl leading-none text-white">
                            {item.title}
                          </h2>
                          <p className="text-xs md:text-sm leading-relaxed text-zinc-200">
                            {item.text}
                          </p>
                          <div className="pt-2">
                            {renderPromoCta(
                              item,
                              'inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#c80812] whitespace-nowrap shrink-0'
                            )}
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 2. Official Musical Tributes */}
            {tributes.length > 0 && (
              <section className="mx-auto max-w-[1280px] px-5 md:px-10 space-y-6">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Cultura y Comunidad
                  </p>
                  <h2 className="mt-1 font-display text-4xl text-zinc-950 dark:text-white">
                    Tributos · Venezuela Suena
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {tributes.map((item, idx) => (
                    <motion.article
                      key={item.id}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.42, delay: idx * 0.06, ease: EASE_OUT_EXPO }}
                      className="flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white p-6 transition-transform duration-200 hover:-translate-y-0.5 dark:border-white/[0.08] dark:bg-[#0D0D11]"
                    >
                      <div>
                        <p className="text-xs font-medium text-amber-700 dark:text-[#D4AF37]">
                          0{idx + 1}. {item.slogan || 'Homenaje Oficial'}
                        </p>
                        <h3 className="mt-2 font-display text-3xl text-zinc-950 dark:text-white">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {item.text}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          item.eventId ? openEventCheckout(item.eventId) : onNavigate('eventos')
                        }
                        className="mt-6 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08] whitespace-nowrap"
                      >
                        {item.eventId ? 'Adquirir Pase del Homenaje' : 'Ver Próximas Sesiones'}
                      </button>
                    </motion.article>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Validated Advertiser & Brand Sponsorship Capture Section */}
            <section
              id="lv-pauta-comercial"
              className="border-t border-zinc-200/90 bg-white py-16 dark:border-white/[0.08] dark:bg-[#0B0B10]"
            >
              <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-5 md:px-10 lg:grid-cols-12 lg:items-start">
                <div className="lg:col-span-5 space-y-5">
                  <p className="text-xs font-medium text-amber-700 dark:text-[#D4AF37]">
                    Alianzas Comerciales 2026
                  </p>
                  <h2
                    className="font-display text-4xl md:text-5xl leading-none text-zinc-950 dark:text-white"
                    style={{ textWrap: 'balance' }}
                  >
                    Conecta tu Marca con Nuestra Comunidad
                  </h2>
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Integramos marcas de bebidas espirituosas, moda urbana, gastronomía y tecnología dentro de nuestras sesiones en vivo y boletería digital.
                  </p>

                  <div className="space-y-3 border-t border-zinc-200 pt-5 text-xs dark:border-white/10">
                    <div>
                      <p className="font-semibold text-zinc-950 dark:text-white">
                        01. Vallas Digitales en Taquilla y Home
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400">
                        Visibilidad directa frente a compradores verificados con CTA personalizado.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-950 dark:text-white">
                        02. Activación en Barra VIP y Combos Oficiales
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400">
                        Inclusión de tu producto en los servicios pre-pagados frente a tarima.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-950 dark:text-white">
                        03. Cobertura Visual en Galería Oficial
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400">
                        Presencia editorial en el archivo fotográfico de cada edición.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 rounded-2xl border border-zinc-200/90 bg-[#FAFAFA] p-6 md:p-8 dark:border-white/[0.08] dark:bg-[#0D0D12]">
                  {renderBrandLeadForm(false)}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* User-Triggered Brand Advertising Modal */}
      <AnimatePresence>
        {sponsorModalOpen && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
            onClick={() => setSponsorModalOpen(false)}
          >
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.26, ease: EASE_OUT_EXPO }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 md:p-7 text-zinc-900 shadow-2xl dark:border-white/10 dark:bg-[#0D0D12] dark:text-white"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-[#D4AF37]">
                    Departamento Comercial · La Vuelta Sessions
                  </p>
                  <h2 className="mt-1 font-display text-3xl leading-none">
                    Pauta Publicitaria y Patrocinios
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSponsorModalOpen(false)}
                  aria-label="Cerrar ventana comercial"
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {renderBrandLeadForm(true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-zinc-200/90 bg-white px-5 py-10 text-xs text-zinc-500 md:px-10 dark:border-white/[0.08] dark:bg-[#050507] dark:text-zinc-400">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-6">
          <div className="group flex items-center gap-3">
            <AnimatedBrandMark size="sm" />
            <div>
              <p className="font-display text-lg text-zinc-950 dark:text-white">
                LA VUELTA SESSIONS
              </p>
              <p>{settings.cityBase}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => onNavigate('eventos')}
              className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap"
            >
              Cartelera
            </button>
            <button
              type="button"
              onClick={() => onNavigate('especiales')}
              className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap"
            >
              Especiales
            </button>
            <button
              type="button"
              onClick={() => onNavigate('promos')}
              className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap"
            >
              Publicidad y Alianzas
            </button>
            <button
              type="button"
              onClick={() => onNavigate('galeria')}
              className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap"
            >
              Galería
            </button>
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap"
            >
              Instagram ({settings.brandHandle})
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
