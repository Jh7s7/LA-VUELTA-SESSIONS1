import React, { useEffect, useState } from 'react';
import {
  Plus,
  Download,
  Eye,
  Edit3,
  Archive,
  CheckCircle2,
  X,
  RotateCcw,
  Sliders,
  Trash2,
  Sparkles,
  AlertTriangle,
  WalletCards,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import {
  EventComboItem,
  EventItem,
  EventStatsSummary,
  GalleryCategory,
  PaymentMethodsConfig,
  PermissionKey,
  SpecialCampaign,
} from '../../types';
import { apiRequest, downloadAuthenticatedCsv, fileToValidatedDataUrl } from '../../lib/api';
import { VenueStageMap } from '../VenueStageMap';

interface AdminStatsAndEventsProps {
  activeSection: PermissionKey;
  events: EventItem[];
  specialCampaigns: SpecialCampaign[];
  seasons: string[];
  initialStats: EventStatsSummary[];
  galleryCategories: GalleryCategory[];
  userPermissions: PermissionKey[];
  paymentMethods?: PaymentMethodsConfig | null;
  onRefresh: () => Promise<void>;
  onNavigateSection: (s: PermissionKey) => void;
  onOpenLiveUserPortal?: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminStatsAndEvents: React.FC<AdminStatsAndEventsProps> = ({
  activeSection,
  events,
  specialCampaigns,
  seasons,
  initialStats,
  galleryCategories,
  userPermissions,
  paymentMethods,
  onRefresh,
  onNavigateSection,
  onOpenLiveUserPortal,
  onNotify,
}) => {
  // Stats filters (Module 1.3)
  const [stats, setStats] = useState<EventStatsSummary[]>(initialStats);
  const [filterEventId, setFilterEventId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterTicketType, setFilterTicketType] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterTicketStatus, setFilterTicketStatus] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
  const [filterValidationStatus, setFilterValidationStatus] = useState('');
  const [detailStat, setDetailStat] = useState<EventStatsSummary | null>(null);

  // Event Form Modal (Module 2)
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evForm, setEvForm] = useState({
    title: '',
    description: '',
    category: 'Reggaetón · Urbano',
    date: '',
    isoDate: '',
    time: '8:00 PM',
    city: 'Maracay',
    venue: '',
    generalPrice: 15,
    generalCapacity: 100,
    vipPrice: 35,
    vipCapacity: 40,
    accessConditions: 'Mayores de 18 años con cédula laminada y código QR único.',
    promoInfo: '',
    galleryCategoryId: '',
    specialCampaignId: '',
    notifyOnPublish: true,
    imageUrl: '',
    posterTheme: 'crimson' as EventItem['posterTheme'],
    saleBadge: 'PREVENTA',
    seatMapEnabled: true,
    status: 'published' as EventItem['status'],
  });

  // Visual Capacity, Stage Map & Bar Combos Configurator (Cinex-style Admin Control)
  const [stageManagerEventId, setStageManagerEventId] = useState<string | null>(null);
  const [savingStageConfig, setSavingStageConfig] = useState(false);
  const [stageConfig, setStageConfig] = useState<{
    generalCapacity: number;
    generalPrice: number;
    vipCapacity: number;
    vipPrice: number;
    saleBadge: string;
    seatMapEnabled: boolean;
    blockedSeats: string[];
    combos: EventComboItem[];
  }>({
    generalCapacity: 100,
    generalPrice: 15,
    vipCapacity: 40,
    vipPrice: 35,
    saleBadge: 'PREVENTA',
    seatMapEnabled: true,
    blockedSeats: [],
    combos: [],
  });

  // Special Campaign Form (Module 2.1)
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [newSeasonInput, setNewSeasonInput] = useState('');
  const [campForm, setCampForm] = useState({
    name: '',
    season: seasons[0] || 'Halloween',
    promoText: '',
    imageUrl: '',
    accentPrimary: '#E50914',
    accentSecondary: '#FF5722',
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    active: true,
    published: true,
    eventIds: [] as string[],
  });

  // Delete confirmation modals (iframe-safe, zero window.confirm)
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<SpecialCampaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState(false);

  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  const applyStatsFilters = async () => {
    try {
      const qs = new URLSearchParams();
      if (filterEventId) qs.set('eventId', filterEventId);
      if (filterDateFrom) qs.set('dateFrom', filterDateFrom);
      if (filterDateTo) qs.set('dateTo', filterDateTo);
      if (filterTicketType) qs.set('ticketType', filterTicketType);
      if (filterPaymentStatus) qs.set('paymentStatus', filterPaymentStatus);
      if (filterTicketStatus) qs.set('ticketStatus', filterTicketStatus);
      if (filterPaymentMethod) qs.set('paymentMethod', filterPaymentMethod);
      if (filterValidationStatus) qs.set('validationStatus', filterValidationStatus);

      const resp = await apiRequest<{ stats: EventStatsSummary[] }>(
        'GET',
        `/api/admin/stats/events?${qs.toString()}`
      );
      setStats(resp.stats);
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  useEffect(() => {
    if (activeSection === PermissionKey.SALES_STATS) {
      applyStatsFilters();
    }
  }, [
    filterEventId,
    filterDateFrom,
    filterDateTo,
    filterTicketType,
    filterPaymentStatus,
    filterTicketStatus,
    filterPaymentMethod,
    filterValidationStatus,
  ]);

  const resetFilters = () => {
    setFilterEventId('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterTicketType('');
    setFilterPaymentStatus('');
    setFilterTicketStatus('');
    setFilterPaymentMethod('');
    setFilterValidationStatus('');
  };

  const openNewEventModal = () => {
    setEditingEventId(null);
    setEvForm({
      title: '',
      description: '',
      category: 'Reggaetón · Urbano',
      date: '30 NOV',
      isoDate: '2026-11-30',
      time: '8:00 PM',
      city: 'Maracay',
      venue: '',
      generalPrice: 15,
      generalCapacity: 100,
      vipPrice: 0,
      vipCapacity: 0,
      accessConditions: 'Mayores de 18 años con cédula laminada y código QR único.',
      promoInfo: '',
      galleryCategoryId: galleryCategories[0]?.id || '',
      specialCampaignId: '',
      notifyOnPublish: true,
      imageUrl: '',
      posterTheme: 'crimson',
      saleBadge: 'PREVENTA',
      seatMapEnabled: true,
      status: 'published',
    });
    setEventModalOpen(true);
  };

  const openEditEventModal = (ev: EventItem) => {
    setEditingEventId(ev.id);
    setEvForm({
      title: ev.title,
      description: ev.description,
      category: ev.category,
      date: ev.date,
      isoDate: ev.isoDate || '',
      time: ev.time,
      city: ev.city,
      venue: ev.venue,
      generalPrice: ev.generalPrice,
      generalCapacity: ev.generalCapacity,
      vipPrice: ev.vipPrice,
      vipCapacity: ev.vipCapacity,
      accessConditions: ev.accessConditions,
      promoInfo: ev.promoInfo,
      galleryCategoryId: ev.galleryCategoryId || '',
      specialCampaignId: ev.specialCampaignId || '',
      notifyOnPublish: ev.notifyOnPublish,
      imageUrl: ev.imageUrl || '',
      posterTheme: ev.posterTheme || 'crimson',
      saleBadge: ev.saleBadge || 'PREVENTA',
      seatMapEnabled: ev.seatMapEnabled !== false,
      status: ev.status,
    });
    setEventModalOpen(true);
  };

  const openStageManager = (ev: EventItem) => {
    setStageManagerEventId(ev.id);
    setStageConfig({
      generalCapacity: ev.generalCapacity,
      generalPrice: ev.generalPrice,
      vipCapacity: ev.vipCapacity,
      vipPrice: ev.vipPrice,
      saleBadge: ev.saleBadge || 'PREVENTA',
      seatMapEnabled: ev.seatMapEnabled !== false,
      blockedSeats: Array.isArray(ev.blockedSeats) ? [...ev.blockedSeats] : [],
      combos: Array.isArray(ev.combos) ? ev.combos.map((c) => ({ ...c })) : [],
    });
  };

  const toggleAdminSeatBlock = (seatId: string) => {
    setStageConfig((prev) => {
      const exists = prev.blockedSeats.includes(seatId);
      const nextBlocked = exists
        ? prev.blockedSeats.filter((s) => s !== seatId)
        : [...prev.blockedSeats, seatId];
      return { ...prev, blockedSeats: nextBlocked };
    });
  };

  const saveStageManagerConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageManagerEventId) return;
    setSavingStageConfig(true);
    try {
      await apiRequest('PUT', `/api/admin/events/${stageManagerEventId}`, {
        generalCapacity: stageConfig.generalCapacity,
        generalPrice: stageConfig.generalPrice,
        vipCapacity: stageConfig.vipCapacity,
        vipPrice: stageConfig.vipPrice,
        saleBadge: stageConfig.saleBadge,
        seatMapEnabled: stageConfig.seatMapEnabled,
        blockedSeats: stageConfig.blockedSeats,
        combos: stageConfig.combos,
      });
      onNotify('Aforo disponible, mapa de sala y combos actualizados en tiempo real.', 'success');
      setStageManagerEventId(null);
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSavingStageConfig(false);
    }
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEventId) {
        await apiRequest('PUT', `/api/admin/events/${editingEventId}`, evForm);
        onNotify('Evento actualizado correctamente.', 'success');
      } else {
        await apiRequest('POST', '/api/admin/events', evForm);
        onNotify('Evento creado correctamente.', 'success');
      }
      setEventModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const quickEventStatus = async (ev: EventItem, nextStatus: EventItem['status']) => {
    try {
      await apiRequest('PUT', `/api/admin/events/${ev.id}`, { status: nextStatus });
      onNotify(`Estado de "${ev.title}" cambiado a ${nextStatus}.`, 'info');
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    setDeletingEvent(true);
    try {
      const deletedId = eventToDelete.id;
      const deletedTitle = eventToDelete.title;
      await apiRequest('DELETE', `/api/admin/events/${deletedId}`);
      if (stageManagerEventId === deletedId) setStageManagerEventId(null);
      if (editingEventId === deletedId) {
        setEditingEventId(null);
        setEventModalOpen(false);
      }
      if (filterEventId === deletedId) setFilterEventId('');
      setEventToDelete(null);
      onNotify(`Evento "${deletedTitle}" eliminado permanentemente.`, 'success');
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setDeletingEvent(false);
    }
  };

  const confirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    setDeletingCampaign(true);
    try {
      const deletedId = campaignToDelete.id;
      const deletedName = campaignToDelete.name;
      await apiRequest('DELETE', `/api/admin/campaigns/${deletedId}`);
      if (editingCampaignId === deletedId) {
        setEditingCampaignId(null);
        setCampaignModalOpen(false);
      }
      setCampaignToDelete(null);
      onNotify(`Campaña "${deletedName}" eliminada.`, 'success');
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setDeletingCampaign(false);
    }
  };

  const handleCreateSeason = async () => {
    if (!newSeasonInput.trim()) return;
    try {
      await apiRequest('POST', '/api/admin/seasons', { name: newSeasonInput.trim() });
      setCampForm((prev) => ({ ...prev, season: newSeasonInput.trim() }));
      setNewSeasonInput('');
      onNotify('Nueva categoría de temporada añadida.', 'success');
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const openNewCampaignModal = () => {
    setEditingCampaignId(null);
    setCampForm({
      name: '',
      season: seasons[0] || 'Halloween',
      promoText: '',
      imageUrl: '',
      accentPrimary: '#E50914',
      accentSecondary: '#FF5722',
      startDate: '2026-10-31',
      endDate: '2026-12-31',
      active: true,
      published: true,
      eventIds: [],
    });
    setCampaignModalOpen(true);
  };

  const openEditCampaignModal = (c: SpecialCampaign) => {
    setEditingCampaignId(c.id);
    const linked = events.filter((ev) => ev.specialCampaignId === c.id).map((ev) => ev.id);
    setCampForm({
      name: c.name,
      season: c.season,
      promoText: c.promoText,
      imageUrl: c.imageUrl || '',
      accentPrimary: c.accentPrimary,
      accentSecondary: c.accentSecondary,
      startDate: c.startDate,
      endDate: c.endDate,
      active: c.active,
      published: c.published,
      eventIds: linked,
    });
    setCampaignModalOpen(true);
  };

  const saveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCampaignId) {
        await apiRequest('PUT', `/api/admin/campaigns/${editingCampaignId}`, campForm);
        onNotify('Campaña especial actualizada.', 'success');
      } else {
        await apiRequest('POST', '/api/admin/campaigns', campForm);
        onNotify('Campaña especial creada.', 'success');
      }
      setCampaignModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const inputCls =
    'w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#E50914] focus:outline-none';

  // =========================================================
  // 1. RESUMEN EJECUTIVO (Contextualizado por Evento)
  // =========================================================
  if (activeSection === PermissionKey.OVERVIEW) {
    const totalConfirmedNet = initialStats.reduce((a, b) => a + b.netConfirmedRevenue, 0);
    const totalPendingVouchers = initialStats.reduce((a, b) => a + b.pendingVouchersCount, 0);
    const totalPaidTickets = initialStats.reduce((a, b) => a + b.paidConfirmedTickets, 0);
    const totalValidated = initialStats.reduce((a, b) => a + b.validatedAtDoorCount, 0);
    const publishedEventsCount = events.filter((ev) => ev.status === 'published').length;
    const activeCampaignsCount = specialCampaigns.filter((c) => c.active && c.published).length;

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-[#D4AF37]">
              Comando Ejecutivo · Punto de Control
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Resumen Operativo y Supervisión de Temporada
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Control unificado de taquilla confirmada, verificación de comprobantes y experiencia pública del cliente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenLiveUserPortal && (
              <button
                type="button"
                onClick={onOpenLiveUserPortal}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-500/20 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/20 whitespace-nowrap"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Vista Usuario en Vivo</span>
              </button>
            )}
            {userPermissions.includes(PermissionKey.PENDING_VOUCHERS) && (
              <button
                type="button"
                onClick={() => onNavigateSection(PermissionKey.PENDING_VOUCHERS)}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
              >
                Revisar Comprobantes ({totalPendingVouchers})
              </button>
            )}
            {userPermissions.includes(PermissionKey.PAYMENT_METHODS) && (
              <button
                type="button"
                onClick={() => onNavigateSection(PermissionKey.PAYMENT_METHODS)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-[#E50914] transition-colors hover:bg-red-500/20 whitespace-nowrap"
              >
                <WalletCards className="h-3.5 w-3.5" />
                <span>Cargar Datos de Pago</span>
              </button>
            )}
            {userPermissions.includes(PermissionKey.EVENTS) && (
              <button
                type="button"
                onClick={() => onNavigateSection(PermissionKey.EVENTS)}
                className="rounded-xl bg-[#E50914] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#c80812] whitespace-nowrap"
              >
                Programar Evento
              </button>
            )}
          </div>
        </div>

        {/* Executive User-Portal Supervision Strip */}
        {onOpenLiveUserPortal && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-[#0D1017]">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                Espejo en Vivo del Portal de Usuario Normal
              </p>
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                Estado visible ahora mismo para clientes:{' '}
                <strong className="font-mono-tabular text-zinc-900 dark:text-white">
                  {publishedEventsCount}
                </strong>{' '}
                sesiones en cartelera ·{' '}
                <strong className="font-mono-tabular text-zinc-900 dark:text-white">
                  {activeCampaignsCount}
                </strong>{' '}
                campañas especiales ·{' '}
                <strong className="font-mono-tabular text-zinc-900 dark:text-white">
                  {galleryCategories.length}
                </strong>{' '}
                álbumes de galería (sin exponer opciones administrativas).
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenLiveUserPortal}
              className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 whitespace-nowrap"
            >
              Inspeccionar Portal de Usuario →
            </button>
          </div>
        )}

        {/* Clean Top KPI Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Ingresos Netos Confirmados
            </p>
            <p className="mt-2 font-mono-tabular text-2xl font-bold text-zinc-900 dark:text-white">
              ${totalConfirmedNet.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Solo pagos aprobados</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Comprobantes Pendientes
            </p>
            <p className="mt-2 font-mono-tabular text-2xl font-bold text-amber-600 dark:text-amber-400">
              {totalPendingVouchers}
            </p>
            <p className="mt-1 text-xs text-zinc-500">En espera de verificación</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Entradas Confirmadas Emitidas
            </p>
            <p className="mt-2 font-mono-tabular text-2xl font-bold text-zinc-900 dark:text-white">
              {totalPaidTickets}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Con QR único individual</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Accesos Validados en Puerta
            </p>
            <p className="mt-2 font-mono-tabular text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalValidated}
            </p>
            <p className="mt-1 text-xs text-zinc-500">De {totalPaidTickets} emitidas</p>
          </div>
        </div>

        {/* Cuentas Receptoras de Pago en Taquilla (Alta Visibilidad) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0D1017]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-[#E50914] dark:bg-red-500/15">
                <WalletCards className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                    Cuentas y Datos de Pago Oficiales para Compradores
                  </h2>
                  <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                    Taquilla Activa
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Estos son los datos bancarios y billeteras que los compradores ven en pantalla para transferir al comprar entradas.
                </p>
              </div>
            </div>
            {userPermissions.includes(PermissionKey.PAYMENT_METHODS) && (
              <button
                type="button"
                onClick={() => onNavigateSection(PermissionKey.PAYMENT_METHODS)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#c80812] whitespace-nowrap"
              >
                <span>Cargar y Editar Datos de Pago</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* 1. Pago Móvil */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  1. Pago Móvil
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    paymentMethods?.pago_movil?.enabled
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {paymentMethods?.pago_movil?.enabled ? 'Activo en Taquilla' : 'Inactivo'}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <p className="text-zinc-500 dark:text-zinc-400">
                  Banco:{' '}
                  <strong className="text-zinc-900 dark:text-white">
                    {paymentMethods?.pago_movil?.bank || 'No configurado'}
                  </strong>
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Teléfono:{' '}
                  <strong className="font-mono-tabular text-zinc-900 dark:text-white">
                    {paymentMethods?.pago_movil?.phone || 'No configurado'}
                  </strong>
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Cédula / RIF:{' '}
                  <strong className="font-mono-tabular text-zinc-900 dark:text-white">
                    {paymentMethods?.pago_movil?.documentId || 'No configurado'}
                  </strong>
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Titular:{' '}
                  <strong className="text-zinc-900 dark:text-white">
                    {paymentMethods?.pago_movil?.holderName || 'No configurado'}
                  </strong>
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Código QR:{' '}
                  <strong className={paymentMethods?.pago_movil?.qrImageUrl || paymentMethods?.pago_movil?.iconUrl ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>
                    {paymentMethods?.pago_movil?.qrImageUrl || paymentMethods?.pago_movil?.iconUrl ? 'Cargado' : 'Sin cargar'}
                  </strong>
                </p>
              </div>
            </div>

            {/* 2. Binance Pay */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  2. Binance Pay
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    paymentMethods?.binance?.enabled
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {paymentMethods?.binance?.enabled ? 'Activo en Taquilla' : 'Inactivo'}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <p className="text-zinc-500 dark:text-zinc-400">
                  Pay ID / Correo:{' '}
                  <strong className="font-mono-tabular text-zinc-900 dark:text-white">
                    {paymentMethods?.binance?.payIdOrEmail || 'No configurado'}
                  </strong>
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Red / Activo:{' '}
                  <strong className="text-zinc-900 dark:text-white">
                    {paymentMethods?.binance?.networkOrAsset || 'USDT'}
                  </strong>
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Código QR:{' '}
                  <strong className={paymentMethods?.binance?.qrImageUrl || paymentMethods?.binance?.iconUrl ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>
                    {paymentMethods?.binance?.qrImageUrl || paymentMethods?.binance?.iconUrl ? 'Cargado' : 'Sin cargar'}
                  </strong>
                </p>
              </div>
            </div>

            {/* 3. Transferencia Bancaria */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  3. Transferencia Bancaria
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    paymentMethods?.transferencia?.enabled
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {paymentMethods?.transferencia?.enabled ? 'Activo en Taquilla' : 'Inactivo'}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <p className="text-zinc-500 dark:text-zinc-400">
                  Banco:{' '}
                  <strong className="text-zinc-900 dark:text-white">
                    {paymentMethods?.transferencia?.bank || 'No configurado'}
                  </strong>
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Cuenta:{' '}
                  <strong className="font-mono-tabular text-zinc-900 dark:text-white">
                    {paymentMethods?.transferencia?.accountNumber || 'No configurada'}
                  </strong>
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Modalidad:{' '}
                  <strong className="text-zinc-700 dark:text-zinc-300">
                    Sin QR (Transferencia directa con número de cuenta)
                  </strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Per-Event Breakdown Table */}
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Estado Financiero y de Aforo por Sesión
            </h2>
            {userPermissions.includes(PermissionKey.SALES_STATS) && (
              <button
                type="button"
                onClick={() => onNavigateSection(PermissionKey.SALES_STATS)}
                className="text-xs font-semibold text-[#E50914] hover:underline"
              >
                Abrir analítica avanzada y exportar CSV
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Fecha · Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Disponibles</th>
                  <th className="px-4 py-3 text-right font-medium">Entradas Confirmadas</th>
                  <th className="px-4 py-3 text-right font-medium">Pendientes</th>
                  <th className="px-4 py-3 text-right font-medium">Puerta</th>
                  <th className="px-5 py-3 text-right font-medium">Ingreso Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {initialStats.map((s) => (
                  <tr key={s.eventId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">
                      <div>{s.eventTitle}</div>
                      {s.specialCampaignName && (
                        <div className="text-xs text-zinc-500">Campaña: {s.specialCampaignName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {s.eventDate} · {s.eventStatus}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular">
                      {s.availableTotal} / {s.totalCapacity}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular font-semibold">
                      {s.paidConfirmedTickets}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular text-amber-600 dark:text-amber-400">
                      {s.pendingPaymentTickets} ({s.pendingVouchersCount} comp.)
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular">
                      {s.validatedAtDoorCount} usadas · {s.unusedValidTicketsCount} libres
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-tabular font-semibold text-zinc-900 dark:text-white">
                      ${s.netConfirmedRevenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // 2. VENTAS Y ESTADÍSTICAS POR EVENTO (Modules 1.2 & 1.3)
  // =========================================================
  if (activeSection === PermissionKey.SALES_STATS) {
    const maxRevenue = Math.max(1, ...stats.map((s) => s.grossConfirmedRevenue));

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Ventas y Estadísticas por Evento
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Métricas derivadas en tiempo real de órdenes, comprobantes y validaciones de puerta.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Limpiar filtros</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await downloadAuthenticatedCsv({
                    eventId: filterEventId,
                    dateFrom: filterDateFrom,
                    dateTo: filterDateTo,
                    ticketType: filterTicketType,
                    paymentStatus: filterPaymentStatus,
                    ticketStatus: filterTicketStatus,
                    paymentMethod: filterPaymentMethod,
                    validationStatus: filterValidationStatus,
                  });
                  onNotify('Informe CSV descargado.', 'success');
                } catch (err: any) {
                  onNotify(err.message, 'error');
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c80812] whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* 7 Classification Filters (Module 1.3) */}
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Evento</label>
            <select
              value={filterEventId}
              onChange={(e) => setFilterEventId(e.target.value)}
              className={inputCls}
            >
              <option value="">Todos los eventos</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Fecha desde</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Fecha hasta</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Tipo de entrada</label>
            <select
              value={filterTicketType}
              onChange={(e) => setFilterTicketType(e.target.value)}
              className={inputCls}
            >
              <option value="">General y VIP</option>
              <option value="general">General</option>
              <option value="vip">VIP</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Estado de pago</label>
            <select
              value={filterPaymentStatus}
              onChange={(e) => setFilterPaymentStatus(e.target.value)}
              className={inputCls}
            >
              <option value="">Todos</option>
              <option value="approved">Confirmado / Aprobado</option>
              <option value="pending">Pendiente de revisión</option>
              <option value="rejected">Rechazado</option>
              <option value="refunded">Reembolsado</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Método de pago</label>
            <select
              value={filterPaymentMethod}
              onChange={(e) => setFilterPaymentMethod(e.target.value)}
              className={inputCls}
            >
              <option value="">Todos los métodos</option>
              <option value="pago_movil">Pago móvil</option>
              <option value="transferencia">Transferencia bancaria</option>
              <option value="binance">Binance</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Estado del ticket</label>
            <select
              value={filterTicketStatus}
              onChange={(e) => setFilterTicketStatus(e.target.value)}
              className={inputCls}
            >
              <option value="">Todos</option>
              <option value="valid">Válido (sin usar)</option>
              <option value="used">Utilizado</option>
              <option value="refunded">Reembolsado</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Validación en puerta</label>
            <select
              value={filterValidationStatus}
              onChange={(e) => setFilterValidationStatus(e.target.value)}
              className={inputCls}
            >
              <option value="">Todas</option>
              <option value="validated">Validadas en puerta</option>
              <option value="unvalidated">Pendientes por ingresar</option>
            </select>
          </div>
        </div>

        {/* Minimalist Data-Driven Charts (Confirmed Revenue + Ticket Distribution) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Recaudación Confirmada por Evento (USD)
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Excluye pagos pendientes de revisión y órdenes rechazadas.
            </p>
            <div className="mt-4 space-y-3.5">
              {stats.map((s) => {
                const widthPct = Math.round((s.grossConfirmedRevenue / maxRevenue) * 100);
                return (
                  <div key={s.eventId}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {s.eventTitle}
                      </span>
                      <span className="font-mono-tabular font-semibold text-zinc-900 dark:text-white">
                        Bruto ${s.grossConfirmedRevenue.toFixed(2)} · Neto ${s.netConfirmedRevenue.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-[#E50914] transition-all duration-200"
                        style={{ width: `${s.grossConfirmedRevenue > 0 ? Math.max(widthPct, 4) : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Distribución de Entradas Emitidas y Ocupación
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Proporción General vs. VIP y validación en puerta sobre capacidad total.
            </p>
            <div className="mt-4 space-y-3.5">
              {stats.map((s) => {
                const cap = Math.max(1, s.totalCapacity);
                const genPct = Math.min(100, (s.generalSold / cap) * 100);
                const vipPct = Math.min(100 - genPct, (s.vipSold / cap) * 100);
                return (
                  <div key={s.eventId}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {s.eventTitle}
                      </span>
                      <span className="font-mono-tabular text-zinc-600 dark:text-zinc-400">
                        Gen: {s.generalSold} · VIP: {s.vipSold} · Puerta: {s.validatedAtDoorCount}
                      </span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full bg-zinc-900 dark:bg-zinc-200"
                        style={{ width: `${genPct}%` }}
                        title={`General: ${s.generalSold}`}
                      />
                      <div
                        className="h-full bg-[#FF5722]"
                        style={{ width: `${vipPct}%` }}
                        title={`VIP: ${s.vipSold}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Full Per-Event Table with Detail Trigger */}
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-3 py-3 font-medium">Fecha</th>
                  <th className="px-3 py-3 text-right font-medium">Disp.</th>
                  <th className="px-3 py-3 text-right font-medium">Reserv.</th>
                  <th className="px-3 py-3 text-right font-medium">Pagadas</th>
                  <th className="px-3 py-3 text-right font-medium">Aforo Total</th>
                  <th className="px-3 py-3 text-right font-medium">Comp. (P/A/R)</th>
                  <th className="px-3 py-3 text-right font-medium">Bruto / Neto</th>
                  <th className="px-3 py-3 text-right font-medium">Validadas</th>
                  <th className="px-4 py-3 text-right font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {stats.map((s) => (
                  <tr key={s.eventId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                      {s.eventTitle}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {s.eventDate}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-tabular">{s.availableTotal}</td>
                    <td className="px-3 py-3 text-right font-mono-tabular">{s.reservedTickets}</td>
                    <td className="px-3 py-3 text-right font-mono-tabular font-semibold">
                      {s.paidConfirmedTickets}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-tabular text-xs">
                      {s.totalCapacity}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-tabular text-xs">
                      {s.pendingVouchersCount} / {s.approvedVouchersCount} / {s.rejectedVouchersCount}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-tabular">
                      ${s.grossConfirmedRevenue.toFixed(0)} / ${s.netConfirmedRevenue.toFixed(0)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-tabular">
                      {s.validatedAtDoorCount} / {s.paidConfirmedTickets}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailStat(s)}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Ficha</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Full Per-Event Detail Modal (All 17 metrics from Module 1.2) */}
        {detailStat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => setDetailStat(null)}
                className="absolute top-4 right-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                {detailStat.eventTitle}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Fecha: {detailStat.eventDate} · Estado: {detailStat.eventStatus}
                {detailStat.specialCampaignName ? ` · Campaña: ${detailStat.specialCampaignName}` : ''}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 text-sm">
                {[
                  ['Entradas disponibles', `${detailStat.availableTotal} (Gen ${detailStat.availableGeneral} · VIP ${detailStat.availableVip})`],
                  ['Entradas reservadas (en revisión)', detailStat.reservedTickets],
                  ['Entradas vendidas y confirmadas', detailStat.paidConfirmedTickets],
                  ['Entradas pendientes de pago', detailStat.pendingPaymentTickets],
                  ['Entradas generales vendidas', detailStat.generalSold],
                  ['Entradas VIP vendidas', detailStat.vipSold],
                  ['Comprobantes pendientes', detailStat.pendingVouchersCount],
                  ['Comprobantes aprobados', detailStat.approvedVouchersCount],
                  ['Comprobantes rechazados', detailStat.rejectedVouchersCount],
                  ['Ingresos brutos confirmados', `$${detailStat.grossConfirmedRevenue.toFixed(2)}`],
                  ['Reembolsos registrados', `$${detailStat.refundedAmount.toFixed(2)}`],
                  ['Ingresos netos calculados', `$${detailStat.netConfirmedRevenue.toFixed(2)}`],
                  ['Entradas validadas en puerta', detailStat.validatedAtDoorCount],
                  ['Entradas aún no utilizadas', detailStat.unusedValidTicketsCount],
                ].map(([label, val]) => (
                  <div
                    key={String(label)}
                    className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
                    <p className="mt-1 font-mono-tabular text-base font-semibold text-zinc-900 dark:text-white">
                      {val}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 3. GESTIÓN DE EVENTOS (Module 2)
  // =========================================================
  if (activeSection === PermissionKey.EVENTS) {
    const activeStageEvent = stageManagerEventId
      ? events.find((e) => e.id === stageManagerEventId) || null
      : null;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Gestión de Eventos, Aforo y Mapa de Tarima
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Define cuántas entradas General y VIP hay disponibles sin límites artificiales por orden, administra ubicaciones en sala y configura combos opcionales.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewEventModal}
            className="inline-flex items-center gap-2 rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c80812] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Crear Evento</span>
          </button>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              No hay eventos registrados en este momento
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Crea una nueva sesión para habilitar su cartelera, precios General / VIP y mapa de tarima.
            </p>
            <button
              type="button"
              onClick={openNewEventModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c80812] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Crear Primer Evento</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {events.map((ev) => {
              const camp = specialCampaigns.find((c) => c.id === ev.specialCampaignId);
              const evStat = initialStats.find((s) => s.eventId === ev.id);
              const blockedCount = Array.isArray(ev.blockedSeats) ? ev.blockedSeats.length : 0;
              const combosCount = Array.isArray(ev.combos) ? ev.combos.length : 0;

              return (
                <div
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold text-[#E50914]">
                        {ev.saleBadge || 'PREVENTA'}
                      </span>
                      <span>·</span>
                      <span>{ev.date}</span>
                      <span>·</span>
                      <span>{ev.time}</span>
                      <span>·</span>
                      <span>{ev.city} — {ev.venue}</span>
                      <span>·</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Estado: {ev.status}
                      </span>
                      {camp && (
                        <>
                          <span>·</span>
                          <span className="text-amber-700 dark:text-[#D4AF37]">Campaña: {camp.name}</span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                      {ev.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      General: <strong className="font-mono-tabular">${ev.generalPrice}</strong> (
                      <span className="font-mono-tabular font-semibold text-zinc-900 dark:text-white">
                        {evStat ? evStat.availableGeneral : ev.generalCapacity} disp.
                      </span>{' '}
                      de {ev.generalCapacity}) · VIP:{' '}
                      <strong className="font-mono-tabular">${ev.vipPrice}</strong> (
                      <span className="font-mono-tabular font-semibold text-amber-700 dark:text-[#D4AF37]">
                        {evStat ? evStat.availableVip : ev.vipCapacity} disp.
                      </span>{' '}
                      de {ev.vipCapacity}) · Mapa: {ev.seatMapEnabled !== false ? 'Activo' : 'Aforo abierto'}
                      {blockedCount > 0 ? ` · ${blockedCount} cortesías bloqueadas` : ''}
                      {combosCount > 0 ? ` · ${combosCount} combos barra` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openStageManager(ev)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-[#D4AF37] dark:text-zinc-950 dark:hover:bg-[#e0be4c] whitespace-nowrap shrink-0"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      <span>Configurar Aforo, Sala y Combos</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditEventModal(ev)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                    {ev.status !== 'published' ? (
                      <button
                        type="button"
                        onClick={() => quickEventStatus(ev, 'published')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 whitespace-nowrap shrink-0"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Publicar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => quickEventStatus(ev, 'unpublished')}
                        className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-500/10 dark:text-amber-400 whitespace-nowrap shrink-0"
                      >
                        Despublicar
                      </button>
                    )}
                    {ev.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => quickEventStatus(ev, 'archived')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span>Archivar</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEventToDelete(ev)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/60 whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =========================================================
            VISUAL STAGE, CAPACITY & COMBOS MANAGER MODAL
        ========================================================= */}
        {activeStageEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
            <div className="relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <button
                type="button"
                onClick={() => setStageManagerEventId(null)}
                className="absolute top-4 right-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>

              <p className="text-xs font-semibold text-amber-700 dark:text-[#D4AF37]">
                Control de Taquilla y Sala · Sin Límite Artificial por Orden
              </p>
              <h2 className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-white">
                {activeStageEvent.title} · {activeStageEvent.date}
              </h2>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                El comprador puede adquirir cualquier cantidad de entradas en una misma operación; el único tope es el cupo disponible que establezcas aquí.
              </p>

              <form onSubmit={saveStageManagerConfig} className="mt-6 space-y-6">
                {(() => {
                  const evStat = initialStats.find((s) => s.eventId === activeStageEvent.id);
                  const soldOrPendingGen = evStat
                    ? Math.max(
                        0,
                        activeStageEvent.generalCapacity -
                          evStat.availableGeneral -
                          (activeStageEvent.blockedSeats || []).filter((s) => s.startsWith('GEN-')).length
                      )
                    : 0;
                  const soldOrPendingVip = evStat
                    ? Math.max(
                        0,
                        activeStageEvent.vipCapacity -
                          evStat.availableVip -
                          (activeStageEvent.blockedSeats || []).filter((s) => s.startsWith('VIP-')).length
                      )
                    : 0;
                  const blockedGenCount = stageConfig.blockedSeats.filter((s) =>
                    s.startsWith('GEN-')
                  ).length;
                  const blockedVipCount = stageConfig.blockedSeats.filter((s) =>
                    s.startsWith('VIP-')
                  ).length;
                  const liveAvailGen = Math.max(
                    0,
                    stageConfig.generalCapacity - soldOrPendingGen - blockedGenCount
                  );
                  const liveAvailVip = Math.max(
                    0,
                    stageConfig.vipCapacity - soldOrPendingVip - blockedVipCount
                  );
                  const orderOccupiedOnly = (activeStageEvent.occupiedSeats || []).filter(
                    (s) => !(activeStageEvent.blockedSeats || []).includes(s)
                  );

                  return (
                    <>
                      {/* 1. Exact Capacity & Pricing Controls */}
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-zinc-900 dark:text-white">
                            Aforo Total y Precio de Entrada Oficial
                          </span>
                          <span className="font-mono-tabular text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            {liveAvailGen} disponibles para venta
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              Aforo total habilitado (Entradas)
                            </label>
                            <input
                              type="number"
                              min={soldOrPendingGen}
                              max={100000}
                              required
                              value={stageConfig.generalCapacity}
                              onChange={(e) =>
                                setStageConfig((prev) => ({
                                  ...prev,
                                  generalCapacity: Math.max(0, Math.floor(Number(e.target.value || 0))),
                                }))
                              }
                              className={`${inputCls} font-mono-tabular text-base font-bold`}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              Precio de entrada oficial (USD)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              required
                              value={stageConfig.generalPrice}
                              onChange={(e) =>
                                setStageConfig((prev) => ({
                                  ...prev,
                                  generalPrice: Math.max(0, Number(e.target.value || 0)),
                                }))
                              }
                              className={`${inputCls} font-mono-tabular text-base font-bold`}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-zinc-500 mr-1">Ajuste rápido de aforo:</span>
                          {[50, 100, 250, 500, 1000, 2500].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                setStageConfig((prev) => ({
                                  ...prev,
                                  generalCapacity: Math.max(soldOrPendingGen, preset),
                                }))
                              }
                              className={`rounded-md px-2.5 py-1 font-mono-tabular text-[11px] font-semibold transition-colors ${
                                stageConfig.generalCapacity === preset
                                  ? 'bg-[#E50914] text-white'
                                  : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Sale Phase Label & Interactive Stage Map Toggle */}
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Etiqueta de cartelera:
                          </label>
                          <select
                            value={stageConfig.saleBadge}
                            onChange={(e) =>
                              setStageConfig((prev) => ({ ...prev, saleBadge: e.target.value }))
                            }
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <option value="PREVENTA">PREVENTA</option>
                            <option value="ESTRENO">ESTRENO</option>
                            <option value="TAQUILLA ABIERTA">TAQUILLA ABIERTA</option>
                            <option value="EDICIÓN ESPECIAL">EDICIÓN ESPECIAL</option>
                            <option value="ÚLTIMAS LOCALIDADES">ÚLTIMAS LOCALIDADES</option>
                          </select>
                        </div>

                        <label className="flex items-center gap-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          <input
                            type="checkbox"
                            checked={stageConfig.seatMapEnabled}
                            onChange={(e) =>
                              setStageConfig((prev) => ({
                                ...prev,
                                seatMapEnabled: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#E50914]"
                          />
                          <span>Mostrar Mapa Interactivo de Tarima / Localidades en compra pública</span>
                        </label>
                      </div>

                      {/* 3. Interactive Admin Stage Map (Click to reserve/block courtesy spots) */}
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                              Mapa de Sala y Bloqueo de Cortesías / Patrocinantes
                            </h3>
                            <p className="text-xs text-zinc-500">
                              Haz clic sobre cualquier puesto libre para reservarlo por administración ({stageConfig.blockedSeats.length} bloqueados actualmente).
                            </p>
                          </div>
                          {stageConfig.blockedSeats.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setStageConfig((prev) => ({ ...prev, blockedSeats: [] }))
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Liberar cortesías bloqueadas</span>
                            </button>
                          )}
                        </div>

                        <VenueStageMap
                          mode="admin"
                          vipCapacity={stageConfig.vipCapacity}
                          generalCapacity={stageConfig.generalCapacity}
                          occupiedSeats={orderOccupiedOnly}
                          blockedSeats={stageConfig.blockedSeats}
                          onToggleAdminBlockSeat={toggleAdminSeatBlock}
                        />
                      </div>

                      {/* 4. Optional Club Bar & Combos Step (Cinex-inspired add-ons adapted to La Vuelta) */}
                      <div className="rounded-xl border border-zinc-200 p-4 space-y-3.5 dark:border-zinc-800">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                              Servicios de Barra y Combos Opcionales del Evento
                            </h3>
                            <p className="text-xs text-zinc-500">
                              Si agregas combos aquí, el comprador podrá sumarlos opcionalmente antes del pago.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {stageConfig.combos.length === 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setStageConfig((prev) => ({
                                    ...prev,
                                    combos: [
                                      {
                                        id: `cmb_${Date.now()}_1`,
                                        name: 'Combo Barra Urbana (4 Tragos)',
                                        description: '4 servicios nacionales + hielo y mezcladores en barra rápida.',
                                        price: 20,
                                        available: true,
                                      },
                                      {
                                        id: `cmb_${Date.now()}_2`,
                                        name: 'Servicio Mesa VIP',
                                        description: 'Botella destilado reserva + 4 energizantes + atención en zona VIP.',
                                        price: 65,
                                        available: true,
                                      },
                                    ],
                                  }))
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-[#D4AF37]"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Cargar plantilla de barra</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setStageConfig((prev) => ({
                                  ...prev,
                                  combos: [
                                    ...prev.combos,
                                    {
                                      id: `cmb_${Date.now()}_${prev.combos.length}`,
                                      name: '',
                                      description: '',
                                      price: 15,
                                      available: true,
                                    },
                                  ],
                                }))
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Añadir Combo</span>
                            </button>
                          </div>
                        </div>

                        {stageConfig.combos.length > 0 && (
                          <div className="space-y-2.5">
                            {stageConfig.combos.map((cmb, idx) => (
                              <div
                                key={cmb.id}
                                className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-200 p-3 sm:grid-cols-12 items-center dark:border-zinc-800"
                              >
                                <input
                                  type="text"
                                  placeholder="Nombre del combo o servicio"
                                  value={cmb.name}
                                  onChange={(e) => {
                                    const next = [...stageConfig.combos];
                                    next[idx] = { ...cmb, name: e.target.value };
                                    setStageConfig((prev) => ({ ...prev, combos: next }));
                                  }}
                                  className={`${inputCls} sm:col-span-4`}
                                />
                                <input
                                  type="text"
                                  placeholder="Descripción breve"
                                  value={cmb.description}
                                  onChange={(e) => {
                                    const next = [...stageConfig.combos];
                                    next[idx] = { ...cmb, description: e.target.value };
                                    setStageConfig((prev) => ({ ...prev, combos: next }));
                                  }}
                                  className={`${inputCls} sm:col-span-4`}
                                />
                                <div className="sm:col-span-2">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.5"
                                    value={cmb.price}
                                    onChange={(e) => {
                                      const next = [...stageConfig.combos];
                                      next[idx] = { ...cmb, price: Math.max(0, Number(e.target.value || 0)) };
                                      setStageConfig((prev) => ({ ...prev, combos: next }));
                                    }}
                                    className={`${inputCls} font-mono-tabular`}
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-2 sm:col-span-2">
                                  <label className="flex items-center gap-1 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={cmb.available}
                                      onChange={(e) => {
                                        const next = [...stageConfig.combos];
                                        next[idx] = { ...cmb, available: e.target.checked };
                                        setStageConfig((prev) => ({ ...prev, combos: next }));
                                      }}
                                      className="accent-[#E50914]"
                                    />
                                    <span>Activo</span>
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setStageConfig((prev) => ({
                                        ...prev,
                                        combos: prev.combos.filter((_, i) => i !== idx),
                                      }))
                                    }
                                    className="rounded-md p-1.5 text-red-500 hover:bg-red-500/10"
                                    aria-label="Eliminar combo"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2.5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setStageManagerEventId(null)}
                          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-xs font-medium dark:border-zinc-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={savingStageConfig}
                          className="rounded-lg bg-[#E50914] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#c80812] disabled:opacity-50"
                        >
                          {savingStageConfig ? 'Guardando configuración...' : 'Guardar Aforo y Sala'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </form>
            </div>
          </div>
        )}

        {/* Event Create/Edit Modal including EVENTOS ESPECIALES selector */}
        {eventModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="absolute top-4 right-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                {editingEventId ? 'Editar Evento' : 'Crear Nuevo Evento'}
              </h2>

              <form onSubmit={saveEvent} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium">Nombre del evento</label>
                    <input
                      type="text"
                      required
                      value={evForm.title}
                      onChange={(e) => setEvForm({ ...evForm, title: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium">Descripción</label>
                    <textarea
                      rows={2}
                      value={evForm.description}
                      onChange={(e) => setEvForm({ ...evForm, description: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Fecha visible (ej. 23 NOV)</label>
                    <input
                      type="text"
                      required
                      value={evForm.date}
                      onChange={(e) => setEvForm({ ...evForm, date: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Fecha calendario (filtro)</label>
                    <input
                      type="date"
                      value={evForm.isoDate}
                      onChange={(e) => setEvForm({ ...evForm, isoDate: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Hora</label>
                    <input
                      type="text"
                      required
                      value={evForm.time}
                      onChange={(e) => setEvForm({ ...evForm, time: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Ciudad</label>
                    <input
                      type="text"
                      required
                      value={evForm.city}
                      onChange={(e) => setEvForm({ ...evForm, city: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium">Lugar / Recinto</label>
                    <input
                      type="text"
                      required
                      value={evForm.venue}
                      onChange={(e) => setEvForm({ ...evForm, venue: e.target.value })}
                      className={inputCls}
                    />
                  </div>

                  {/* Ticket Types & Inventory */}
                  <div>
                    <label className="mb-1 block text-xs font-medium">Precio Entrada Oficial (USD)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      required
                      value={evForm.generalPrice}
                      onChange={(e) => setEvForm({ ...evForm, generalPrice: Number(e.target.value) })}
                      className={`${inputCls} font-mono-tabular`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Aforo Total de Entradas (Capacidad)</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={evForm.generalCapacity}
                      onChange={(e) => setEvForm({ ...evForm, generalCapacity: Number(e.target.value) })}
                      className={`${inputCls} font-mono-tabular`}
                    />
                  </div>

                  {/* EVENTOS ESPECIALES category inside event creation form (Module 2.1) */}
                  <div className="sm:col-span-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                    <label className="mb-1 block text-xs font-bold text-[#E50914]">
                      EVENTOS ESPECIALES (Campaña de temporada asociada)
                    </label>
                    <select
                      value={evForm.specialCampaignId}
                      onChange={(e) => setEvForm({ ...evForm, specialCampaignId: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">Evento regular independiente (sin campaña especial)</option>
                      {specialCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.season})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">Categoría musical</label>
                    <input
                      type="text"
                      value={evForm.category}
                      onChange={(e) => setEvForm({ ...evForm, category: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Galería relacionada</label>
                    <select
                      value={evForm.galleryCategoryId}
                      onChange={(e) => setEvForm({ ...evForm, galleryCategoryId: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">Sin enlace directo</option>
                      {galleryCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium">Condiciones de acceso</label>
                    <input
                      type="text"
                      value={evForm.accessConditions}
                      onChange={(e) => setEvForm({ ...evForm, accessConditions: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium">Información promocional</label>
                    <input
                      type="text"
                      value={evForm.promoInfo}
                      onChange={(e) => setEvForm({ ...evForm, promoInfo: e.target.value })}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">Estado de publicación</label>
                    <select
                      value={evForm.status}
                      onChange={(e) =>
                        setEvForm({ ...evForm, status: e.target.value as EventItem['status'] })
                      }
                      className={inputCls}
                    >
                      <option value="published">Publicado</option>
                      <option value="draft">Borrador</option>
                      <option value="unpublished">Despublicado</option>
                      <option value="archived">Archivado</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Flyer / Imagen del evento</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const dataUrl = await fileToValidatedDataUrl(f);
                          setEvForm((prev) => ({ ...prev, imageUrl: dataUrl }));
                        } catch (err: any) {
                          onNotify(err.message, 'error');
                        }
                      }}
                      className="block w-full text-xs text-zinc-500 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold dark:file:bg-zinc-800 dark:file:text-zinc-200"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={evForm.notifyOnPublish}
                    onChange={(e) => setEvForm({ ...evForm, notifyOnPublish: e.target.checked })}
                    className="accent-[#E50914]"
                  />
                  <span>Habilitar envío de recordatorios por correo para este evento</span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  {editingEventId ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = events.find((x) => x.id === editingEventId);
                        if (target) {
                          setEventModalOpen(false);
                          setEventToDelete(target);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/80 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/60 whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Eliminar Evento</span>
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEventModalOpen(false)}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium dark:border-zinc-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-[#E50914] px-5 py-2 text-xs font-semibold text-white hover:bg-[#c80812]"
                    >
                      Guardar Evento
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Event Confirmation Modal */}
        {eventToDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-event-title"
          >
            <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <button
                type="button"
                disabled={deletingEvent}
                onClick={() => setEventToDelete(null)}
                className="absolute top-4 right-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 id="delete-event-title" className="text-base font-bold text-zinc-900 dark:text-white">
                    ¿Eliminar evento permanentemente?
                  </h3>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Estás a punto de eliminar{' '}
                    <strong className="text-zinc-900 dark:text-white">{eventToDelete.title}</strong> (
                    {eventToDelete.date} · {eventToDelete.city}).
                  </p>
                </div>
              </div>

              {(() => {
                const delStat = initialStats.find((s) => s.eventId === eventToDelete.id);
                const hasActivity =
                  delStat && (delStat.paidConfirmedTickets > 0 || delStat.pendingVouchersCount > 0);

                return hasActivity ? (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                    Atención: Este evento registra{' '}
                    <strong className="font-mono-tabular">{delStat.paidConfirmedTickets}</strong> entrada(s)
                    confirmada(s) y{' '}
                    <strong className="font-mono-tabular">{delStat.pendingVouchersCount}</strong> comprobante(s)
                    pendiente(s). Al eliminarlo también se depurarán sus órdenes y pases QR asociados. Si solo
                    deseas ocultarlo conservando el historial, usa <strong>Archivar</strong>.
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                    Esta acción quitará el evento de la cartelera pública y del panel de producción de forma
                    definitiva. Si solo quieres ocultarlo temporalmente, puedes usar <strong>Archivar</strong> o{' '}
                    <strong>Despublicar</strong>.
                  </p>
                );
              })()}

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={deletingEvent}
                  onClick={() => setEventToDelete(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deletingEvent}
                  onClick={confirmDeleteEvent}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c80812] disabled:opacity-50 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{deletingEvent ? 'Eliminando...' : 'Sí, eliminar evento'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 4. EVENTOS ESPECIALES Y TEMPORADAS (Module 2.1)
  // =========================================================
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Campañas de Eventos Especiales
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Agrupa varios eventos bajo una misma celebración sin mezclar sus estadísticas financieras individuales.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewCampaignModal}
          className="inline-flex items-center gap-2 rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c80812] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Nueva Campaña Especial</span>
        </button>
      </div>

      {/* Dynamic Season Creator */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <p className="text-xs font-semibold text-zinc-900 dark:text-white">
          Temporadas y celebraciones configuradas ({seasons.length})
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {seasons.join(' · ')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={newSeasonInput}
            onChange={(e) => setNewSeasonInput(e.target.value)}
            placeholder="Añadir nueva temporada (ej. Feria de Maracay)..."
            className="max-w-xs flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={handleCreateSeason}
            className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Agregar Categoría
          </button>
        </div>
      </div>

      {/* Campaigns List */}
      {specialCampaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            No hay campañas especiales creadas
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Crea una campaña temática para agrupar sesiones especiales de temporada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {specialCampaigns.map((camp) => {
            const associatedEvents = events.filter((ev) => ev.specialCampaignId === camp.id);
            return (
              <div
                key={camp.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {camp.season} · {camp.startDate} al {camp.endDate}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {camp.active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <h3 className="mt-1.5 text-lg font-bold text-zinc-900 dark:text-white">
                  {camp.name}
                </h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{camp.promoText}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: camp.accentPrimary }}
                  />
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: camp.accentSecondary }}
                  />
                  <span>
                    {associatedEvents.length} evento(s) asociado(s):{' '}
                    {associatedEvents.map((e) => e.title).join(', ') || 'Ninguno aún'}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditCampaignModal(camp)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
                  >
                    Configurar Campaña
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignToDelete(camp)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/60 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {campaignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setCampaignModalOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              {editingCampaignId ? 'Editar Campaña Especial' : 'Crear Campaña Especial'}
            </h2>

            <form onSubmit={saveCampaign} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-medium">Nombre de la campaña</label>
                <input
                  type="text"
                  required
                  value={campForm.name}
                  onChange={(e) => setCampForm({ ...campForm, name: e.target.value })}
                  placeholder="Ej. Noche de Brujas · Edición Urbana"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Temporada o celebración</label>
                <select
                  value={campForm.season}
                  onChange={(e) => setCampForm({ ...campForm, season: e.target.value })}
                  className={inputCls}
                >
                  {seasons.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Fecha inicio</label>
                  <input
                    type="date"
                    value={campForm.startDate}
                    onChange={(e) => setCampForm({ ...campForm, startDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Fecha finalización</label>
                  <input
                    type="date"
                    value={campForm.endDate}
                    onChange={(e) => setCampForm({ ...campForm, endDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Color primario promocional</label>
                  <input
                    type="color"
                    value={campForm.accentPrimary}
                    onChange={(e) => setCampForm({ ...campForm, accentPrimary: e.target.value })}
                    className="h-9 w-full cursor-pointer rounded border border-zinc-300 dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Color secundario</label>
                  <input
                    type="color"
                    value={campForm.accentSecondary}
                    onChange={(e) => setCampForm({ ...campForm, accentSecondary: e.target.value })}
                    className="h-9 w-full cursor-pointer rounded border border-zinc-300 dark:border-zinc-700"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Texto promocional</label>
                <textarea
                  rows={2}
                  value={campForm.promoText}
                  onChange={(e) => setCampForm({ ...campForm, promoText: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Imagen principal (opcional)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const dataUrl = await fileToValidatedDataUrl(f);
                      setCampForm((prev) => ({ ...prev, imageUrl: dataUrl }));
                    } catch (err: any) {
                      onNotify(err.message, 'error');
                    }
                  }}
                  className="block w-full text-xs text-zinc-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium">
                  Eventos asociados (sus estadísticas permanecen independientes)
                </label>
                <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                  {events.map((ev) => {
                    const checked = campForm.eventIds.includes(ev.id);
                    return (
                      <label key={ev.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setCampForm((prev) => ({
                              ...prev,
                              eventIds: e.target.checked
                                ? [...prev.eventIds, ev.id]
                                : prev.eventIds.filter((id) => id !== ev.id),
                            }));
                          }}
                          className="accent-[#E50914]"
                        />
                        <span>
                          {ev.title} ({ev.date})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={campForm.active}
                  onChange={(e) =>
                    setCampForm({ ...campForm, active: e.target.checked, published: e.target.checked })
                  }
                  className="accent-[#E50914]"
                />
                <span>Campaña activa y visible en el sitio público</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCampaignModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium dark:border-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#E50914] px-5 py-2 text-xs font-semibold text-white hover:bg-[#c80812]"
                >
                  Guardar Campaña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Campaign Confirmation Modal */}
      {campaignToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
            <button
              type="button"
              disabled={deletingCampaign}
              onClick={() => setCampaignToDelete(null)}
              className="absolute top-4 right-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  ¿Eliminar campaña especial?
                </h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Se eliminará <strong className="text-zinc-900 dark:text-white">{campaignToDelete.name}</strong>.
                  Los eventos que estaban agrupados en esta campaña se mantendrán intactos como eventos regulares.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={deletingCampaign}
                onClick={() => setCampaignToDelete(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingCampaign}
                onClick={confirmDeleteCampaign}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c80812] disabled:opacity-50 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{deletingCampaign ? 'Eliminando...' : 'Sí, eliminar campaña'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
