import React, { useEffect, useState } from 'react';
import {
  Trash2,
  Plus,
  Send,
  ShieldCheck,
  Download,
  Lock,
  ShieldAlert,
  KeyRound,
  Activity,
  AlertTriangle,
  RefreshCw,
  FileCheck,
  CheckCircle2,
  Upload,
  Database,
  Save,
} from 'lucide-react';
import {
  AdFormatType,
  AdInquiryRecord,
  AdVisualPreset,
  AuditLogEntry,
  BirthdayEntry,
  DEFAULT_ROLE_PERMISSIONS,
  EventItem,
  GalleryCategory,
  GalleryPhoto,
  NotificationDispatchLog,
  PermissionKey,
  PromotionAd,
  ROLE_LABELS,
  SecurityAuditLog,
  SecurityMetrics,
  SiteSettings,
  UserRole,
} from '../../types';
import { apiRequest, fileToValidatedDataUrl, downloadAuthenticatedBackup } from '../../lib/api';
import { getFirebaseProjectInfo } from '../../lib/firebase';
import { ADMIN_NAV_ITEMS } from './AdminNavConfig';
import { PromoBannerVisual } from '../VisualArtwork';

interface AdminContentAndUsersProps {
  activeSection: PermissionKey;
  promotions: PromotionAd[];
  adInquiries?: AdInquiryRecord[];
  galleryCategories: GalleryCategory[];
  galleryPhotos: GalleryPhoto[];
  events: EventItem[];
  users: any[];
  auditLogs: AuditLogEntry[];
  notificationLogs: NotificationDispatchLog[];
  settings: SiteSettings | null;
  securityStatus: {
    httpsActive: boolean;
    protocol: string;
    origin: string;
    googleAuthConfigured: boolean;
    emailProviderConfigured: boolean;
  };
  securityAuditLogs?: SecurityAuditLog[];
  securityMetrics?: SecurityMetrics;
  currentUserRole: UserRole;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const AD_FORMAT_LABELS: Record<AdFormatType, string> = {
  billboard: 'Valla Principal (Billboard)',
  sponsor: 'Patrocinante / Marca Aliada',
  spotlight: 'Destacado de Temporada',
  tribute: 'Tributo Oficial',
};

export const AdminContentAndUsers: React.FC<AdminContentAndUsersProps> = ({
  activeSection,
  promotions,
  adInquiries = [],
  galleryCategories,
  galleryPhotos,
  events,
  users,
  auditLogs,
  notificationLogs,
  settings,
  securityStatus,
  securityAuditLogs = [],
  securityMetrics,
  currentUserRole,
  onRefresh,
  onNotify,
}) => {
  // Promo / Advertising form
  const [promoForm, setPromoForm] = useState<{
    title: string;
    slogan: string;
    text: string;
    eventId: string;
    linkSection: string;
    adFormat: AdFormatType;
    sponsorBrand: string;
    ctaLabel: string;
    externalUrl: string;
    visualPreset: AdVisualPreset;
    imageUrl: string;
  }>({
    title: '',
    slogan: '',
    text: '',
    eventId: '',
    linkSection: 'eventos',
    adFormat: 'billboard',
    sponsorBrand: '',
    ctaLabel: 'Reservar Ahora',
    externalUrl: '',
    visualPreset: 'vip_bar',
    imageUrl: '',
  });

  // Gallery form (Module 10)
  const [newCatName, setNewCatName] = useState('');
  const [photoForm, setPhotoForm] = useState({
    title: '',
    description: '',
    categoryId: galleryCategories[0]?.id || '',
    eventId: '',
    date: new Date().toISOString().slice(0, 10),
    imageUrl: '',
    visualPreset: 'night',
  });

  // Staff RBAC form (Module 9)
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    role: UserRole.DOOR_STAFF,
    useCustomPerms: false,
    customPermissions: DEFAULT_ROLE_PERMISSIONS[UserRole.DOOR_STAFF],
  });
  const [editingPermUser, setEditingPermUser] = useState<any | null>(null);

  // Birthdays state (Module 7)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [birthdaySearch, setBirthdaySearch] = useState('');
  const [birthdaysData, setBirthdaysData] = useState<BirthdayEntry[]>([]);

  // Notifications state (Module 8)
  const [notifEventId, setNotifEventId] = useState(events[0]?.id || '');
  const [notifKind, setNotifKind] = useState<'new_event' | 'upcoming_reminder'>('new_event');

  // Site settings state
  const [siteForm, setSiteForm] = useState<SiteSettings>(
    settings || {
      brandHandle: '@lavueltasessions',
      instagramUrl: 'https://instagram.com',
      tiktokUrl: 'https://tiktok.com',
      youtubeUrl: 'https://youtube.com',
      whatsappContact: '',
      cityBase: 'Maracay, Aragua · Venezuela',
      timezone: 'America/Caracas',
      refundFeePercent: 0,
      emailNotificationsEnabled: true,
    }
  );

  useEffect(() => {
    if (settings) setSiteForm(settings);
  }, [settings]);

  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    try {
      await downloadAuthenticatedBackup();
      onNotify('Copia de seguridad descargada exitosamente en formato JSON.', 'success');
    } catch (err: any) {
      onNotify(err.message || 'Error al descargar respaldo.', 'error');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !confirm(
        '¿Deseas restaurar el sistema desde este archivo de respaldo? Esta acción actualizará los datos del sistema con los contenidos del archivo.'
      )
    ) {
      e.target.value = '';
      return;
    }
    setRestoringBackup(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const resp = await apiRequest<{ ok: boolean; message: string }>('POST', '/api/admin/backup/restore', {
        backupData: parsed,
      });
      onNotify(resp.message || 'Copia de seguridad restaurada.', 'success');
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message || 'Error al procesar archivo de respaldo.', 'error');
    } finally {
      setRestoringBackup(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (activeSection === PermissionKey.BIRTHDAYS) {
      apiRequest<{ birthdays: BirthdayEntry[] }>(
        'GET',
        `/api/admin/birthdays?month=${selectedMonth}`
      )
        .then((r) => setBirthdaysData(r.birthdays))
        .catch((err) => onNotify(err.message, 'error'));
    }
  }, [activeSection, selectedMonth]);

  const inputCls =
    'w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#E50914] focus:outline-none';

  // =========================================================
  // 1. PUBLICIDAD, VALLAS, PATROCINADORES Y TRIBUTOS
  // =========================================================
  if (activeSection === PermissionKey.PROMOS_FLYERS) {
    const createPromo = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await apiRequest('POST', '/api/admin/promotions', {
          ...promoForm,
          tribute: promoForm.adFormat === 'tribute',
        });
        setPromoForm({
          title: '',
          slogan: '',
          text: '',
          eventId: '',
          linkSection: 'eventos',
          adFormat: 'billboard',
          sponsorBrand: '',
          ctaLabel: 'Reservar Ahora',
          externalUrl: '',
          visualPreset: 'vip_bar',
          imageUrl: '',
        });
        onNotify('Pauta publicitaria o anuncio publicado.', 'success');
        await onRefresh();
      } catch (err: any) {
        onNotify(err.message, 'error');
      }
    };

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Publicidad Comercial, Patrocinantes y Tributos
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Administra las vallas principales, marcas aliadas, promociones de barra VIP y tarjetas de homenaje visibles en el sitio público.
          </p>
        </div>

        <form
          onSubmit={createPromo}
          className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900/60"
        >
          <div>
            <label className="mb-1 block text-xs font-medium">Formato de ubicación</label>
            <select
              value={promoForm.adFormat}
              onChange={(e) =>
                setPromoForm({ ...promoForm, adFormat: e.target.value as AdFormatType })
              }
              className={inputCls}
            >
              <option value="billboard">Valla Principal (Billboard Home)</option>
              <option value="sponsor">Marca Patrocinante / Aliado</option>
              <option value="spotlight">Destacado de Temporada</option>
              <option value="tribute">Tributo Oficial · Venezuela Suena</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Marca o anunciante</label>
            <input
              type="text"
              value={promoForm.sponsorBrand}
              onChange={(e) => setPromoForm({ ...promoForm, sponsorBrand: e.target.value })}
              placeholder="Ej. Ron Santa Teresa · Barra Oficial LV"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Eslogan superior</label>
            <input
              type="text"
              value={promoForm.slogan}
              onChange={(e) => setPromoForm({ ...promoForm, slogan: e.target.value })}
              placeholder="Ej. EXPERIENCIA FRENTE A TARIMA"
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">Titular principal</label>
            <input
              type="text"
              required
              value={promoForm.title}
              onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })}
              placeholder="Ej. RESERVA VIP & SERVICIO EN MESA"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Texto del botón CTA</label>
            <input
              type="text"
              value={promoForm.ctaLabel}
              onChange={(e) => setPromoForm({ ...promoForm, ctaLabel: e.target.value })}
              placeholder="Ej. Reservar Mesa VIP"
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-xs font-medium">Mensaje comercial</label>
            <input
              type="text"
              required
              value={promoForm.text}
              onChange={(e) => setPromoForm({ ...promoForm, text: e.target.value })}
              placeholder="Describe el beneficio, patrocinio o experiencia para los asistentes..."
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Vincular a evento en taquilla</label>
            <select
              value={promoForm.eventId}
              onChange={(e) => setPromoForm({ ...promoForm, eventId: e.target.value })}
              className={inputCls}
            >
              <option value="">Cartelera general / Sin evento fijo</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.date})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Enlace externo del patrocinante (opcional)</label>
            <input
              type="url"
              value={promoForm.externalUrl}
              onChange={(e) => setPromoForm({ ...promoForm, externalUrl: e.target.value })}
              placeholder="https://instagram.com/marca"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Atmósfera fotográfica base</label>
            <select
              value={promoForm.visualPreset}
              onChange={(e) =>
                setPromoForm({ ...promoForm, visualPreset: e.target.value as AdVisualPreset })
              }
              className={inputCls}
            >
              <option value="vip_bar">Lounge VIP & Coctelería</option>
              <option value="streetwear">Moda Urbana & Streetwear</option>
              <option value="stage">Tarima Principal en Vivo</option>
              <option value="rooftop">Terraza Nocturna Panorámica</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">
              Arte o banner personalizado desde dispositivo (opcional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const imageUrl = await fileToValidatedDataUrl(f);
                  setPromoForm((prev) => ({ ...prev, imageUrl }));
                } catch (err: any) {
                  onNotify(err.message, 'error');
                }
              }}
              className="block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold dark:file:bg-zinc-800 dark:file:text-zinc-200"
            />
          </div>

          <div className="flex items-end justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E50914] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#c80812] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Publicar Pauta</span>
            </button>
          </div>
        </form>

        {/* Active Advertising & Tributes Inventory */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
            Piezas Activas e Inventario Publicitario ({promotions.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {promotions.map((p, idx) => {
              const fmt: AdFormatType = p.tribute ? 'tribute' : p.adFormat || 'billboard';
              return (
                <div
                  key={p.id}
                  className="flex items-stretch overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="w-28 shrink-0">
                    <PromoBannerVisual
                      imageUrl={p.imageUrl}
                      title={p.title}
                      preset={p.visualPreset}
                      fallbackIndex={idx}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-3.5 text-xs">
                    <div>
                      <p className="text-[11px] font-medium text-amber-700 dark:text-[#D4AF37]">
                        {AD_FORMAT_LABELS[fmt]}
                        {p.sponsorBrand ? ` · ${p.sponsorBrand}` : ''}
                        {!p.published ? ' · OCULTO' : ''}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-zinc-900 dark:text-white">
                        {p.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-zinc-500 dark:text-zinc-400">
                        {p.text}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-3 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest('PUT', `/api/admin/promotions/${p.id}`, {
                            published: !p.published,
                          });
                          await onRefresh();
                        }}
                        className="font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
                      >
                        {p.published ? 'Ocultar' : 'Publicar'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest('DELETE', `/api/admin/promotions/${p.id}`);
                          onNotify('Anuncio eliminado.', 'info');
                          await onRefresh();
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-red-600 hover:text-red-500 dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Brand & Sponsor Inquiries Captured from Public Portal */}
        <div className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Solicitudes de Marcas y Patrocinantes ({adInquiries.length})
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Prospectos comerciales recibidos desde el formulario público de alianzas.
            </p>
          </div>

          {adInquiries.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
              Aún no se han recibido solicitudes de pauta comercial.
            </div>
          ) : (
            <div className="space-y-2.5">
              {adInquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">
                      {inq.brandName}{' '}
                      <span className="font-normal text-amber-700 dark:text-[#D4AF37]">
                        · {inq.packageInterest}
                      </span>
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-300">
                      Contacto: <strong>{inq.contactName}</strong> · {inq.email} ·{' '}
                      <span className="font-mono-tabular">{inq.phone}</span>
                    </p>
                    {inq.message && (
                      <p className="text-zinc-500 dark:text-zinc-400">“{inq.message}”</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest('DELETE', `/api/admin/ad-inquiries/${inq.id}`);
                      await onRefresh();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Archivar</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================
  // 2. GALERÍA ADMINISTRATIVA (Module 10)
  // =========================================================
  if (activeSection === PermissionKey.GALLERY_ADMIN) {
    const addCategory = async () => {
      if (!newCatName.trim()) return;
      try {
        await apiRequest('POST', '/api/admin/gallery/categories', { name: newCatName.trim() });
        setNewCatName('');
        onNotify('Categoría de galería añadida.', 'success');
        await onRefresh();
      } catch (err: any) {
        onNotify(err.message, 'error');
      }
    };

    const addPhoto = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await apiRequest('POST', '/api/admin/gallery/photos', photoForm);
        setPhotoForm({
          ...photoForm,
          title: '',
          description: '',
          imageUrl: '',
        });
        onNotify('Fotografía incorporada a la galería.', 'success');
        await onRefresh();
      } catch (err: any) {
        onNotify(err.message, 'error');
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Gestión de Galería y Categorías
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Sube únicamente fotografías autorizadas por la organización, clasifícalas por sesión y categoría.
          </p>
        </div>

        {/* Category Creator */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <p className="text-xs font-semibold text-zinc-900 dark:text-white">
            Categorías activas: {galleryCategories.map((c) => c.name).join(' · ')}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nueva categoría (ej. Zona VIP)..."
              className="max-w-xs flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              onClick={addCategory}
              className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Crear Categoría
            </button>
          </div>
        </div>

        {/* Upload Photo Form */}
        <form
          onSubmit={addPhoto}
          className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-5 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900/60"
        >
          <div>
            <label className="mb-1 block text-xs font-medium">Título breve</label>
            <input
              type="text"
              required
              value={photoForm.title}
              onChange={(e) => setPhotoForm({ ...photoForm, title: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Categoría</label>
            <select
              value={photoForm.categoryId}
              onChange={(e) => setPhotoForm({ ...photoForm, categoryId: e.target.value })}
              className={inputCls}
            >
              {galleryCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Evento relacionado</label>
            <select
              value={photoForm.eventId}
              onChange={(e) => setPhotoForm({ ...photoForm, eventId: e.target.value })}
              className={inputCls}
            >
              <option value="">General / Archivo</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Fotografía</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const imageUrl = await fileToValidatedDataUrl(f);
                  setPhotoForm((prev) => ({ ...prev, imageUrl }));
                } catch (err: any) {
                  onNotify(err.message, 'error');
                }
              }}
              className="block w-full text-xs text-zinc-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">Descripción</label>
            <input
              type="text"
              value={photoForm.description}
              onChange={(e) => setPhotoForm({ ...photoForm, description: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c80812]"
            >
              Subir a Galería
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {galleryPhotos.map((ph) => {
            const cat = galleryCategories.find((c) => c.id === ph.categoryId)?.name || 'General';
            return (
              <div
                key={ph.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <div>
                  <p className="text-[11px] text-zinc-500">
                    {cat} · {ph.date} · {ph.published ? 'Publicada' : 'Retirada'}
                  </p>
                  <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">{ph.title}</p>
                  <p className="mt-1 text-zinc-500">{ph.description}</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest('PUT', `/api/admin/gallery/photos/${ph.id}`, {
                        published: !ph.published,
                      });
                      await onRefresh();
                    }}
                    className="font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
                  >
                    {ph.published ? 'Retirar' : 'Publicar'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest('DELETE', `/api/admin/gallery/photos/${ph.id}`);
                      await onRefresh();
                    }}
                    className="text-red-500 hover:text-red-400"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================
  // 3. USUARIOS REGISTRADOS
  // =========================================================
  if (activeSection === PermissionKey.USERS) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Directorio de Usuarios
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Cédulas enmascaradas por protección de datos personales.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Correo · Teléfono</th>
                  <th className="px-4 py-3 font-medium">Cédula (Protegida)</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Avisos Correo</th>
                  <th className="px-4 py-3 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{u.email}</div>
                      <div className="text-zinc-500">{u.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-xs">
                      {u.cedulaMasked || 'Pendiente'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {ROLE_LABELS[u.role as UserRole] || u.role}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.marketingOptIn ? 'Autorizado' : 'No autorizado'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiRequest('POST', `/api/admin/users/${u.id}/block`);
                            await onRefresh();
                          } catch (err: any) {
                            onNotify(err.message, 'error');
                          }
                        }}
                        className="text-xs font-semibold text-[#E50914] hover:underline"
                      >
                        {u.blocked ? 'Reactivar' : 'Suspender'}
                      </button>
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
  // 4. PERSONAL, ROLES RBAC Y AUDITORÍA (Module 9)
  // =========================================================
  if (activeSection === PermissionKey.STAFF_RBAC) {
    const createStaff = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await apiRequest('POST', '/api/admin/staff', {
          name: staffForm.name,
          email: staffForm.email,
          password: staffForm.password,
          role: staffForm.role,
          customPermissions: staffForm.useCustomPerms ? staffForm.customPermissions : undefined,
        });
        setStaffForm({
          name: '',
          email: '',
          password: '',
          role: UserRole.DOOR_STAFF,
          useCustomPerms: false,
          customPermissions: DEFAULT_ROLE_PERMISSIONS[UserRole.DOOR_STAFF],
        });
        onNotify('Cuenta de personal creada bajo privilegio mínimo.', 'success');
        await onRefresh();
      } catch (err: any) {
        onNotify(err.message, 'error');
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Personal, Roles y Permisos Granulares
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Principio de privilegio mínimo verificado en cada endpoint del servidor y registrado en auditoría.
          </p>
        </div>

        {currentUserRole === UserRole.SUPER_ADMIN && (
          <form
            onSubmit={createStaff}
            className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Registrar Nueva Cuenta de Personal
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                required
                placeholder="Nombre del empleado"
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                className={inputCls}
              />
              <input
                type="email"
                required
                placeholder="correo@personal.com"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                className={inputCls}
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Clave inicial (mín. 8)"
                value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                className={inputCls}
              />
              <select
                value={staffForm.role}
                onChange={(e) => {
                  const nextRole = e.target.value as UserRole;
                  setStaffForm({
                    ...staffForm,
                    role: nextRole,
                    customPermissions: DEFAULT_ROLE_PERMISSIONS[nextRole],
                  });
                }}
                className={inputCls}
              >
                <option value={UserRole.EVENT_MANAGER}>Administrador de eventos</option>
                <option value={UserRole.PROMO_DESIGNER}>Diseñador / Promociones</option>
                <option value={UserRole.PAYMENT_REVIEWER}>Revisor de pagos</option>
                <option value={UserRole.DOOR_STAFF}>Personal de puerta</option>
                <option value={UserRole.GALLERY_EDITOR}>Editor de galería</option>
                <option value={UserRole.SUPER_ADMIN}>Administrador principal</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={staffForm.useCustomPerms}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, useCustomPerms: e.target.checked })
                }
                className="accent-[#E50914]"
              />
              <span>Personalizar permisos individuales para este empleado</span>
            </label>

            {staffForm.useCustomPerms && (
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 p-3 sm:grid-cols-4 dark:border-zinc-800">
                {ADMIN_NAV_ITEMS.map((item) => {
                  const checked = staffForm.customPermissions.includes(item.key);
                  return (
                    <label key={item.key} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setStaffForm((prev) => ({
                            ...prev,
                            customPermissions: e.target.checked
                              ? [...prev.customPermissions, item.key]
                              : prev.customPermissions.filter((k) => k !== item.key),
                          }));
                        }}
                        className="accent-[#E50914]"
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c80812]"
              >
                Crear Cuenta de Personal
              </button>
            </div>
          </form>
        )}

        {/* Active Staff List */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="mb-3 text-sm font-bold text-zinc-900 dark:text-white">
            Equipo y Asignación de Permisos
          </h2>
          <div className="space-y-2.5">
            {users
              .filter((u) => u.role !== UserRole.CLIENT)
              .map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800"
                >
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-white">
                      {u.name} ({u.email}) — {ROLE_LABELS[u.role as UserRole]}
                    </p>
                    <p className="mt-0.5 text-zinc-500">
                      Permisos activos: {(u.permissions || []).join(', ')}
                    </p>
                  </div>
                  {currentUserRole === UserRole.SUPER_ADMIN && (
                    <button
                      type="button"
                      onClick={() => setEditingPermUser(u)}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      Ajustar Permisos
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Administrative Audit Log */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="mb-3 text-sm font-bold text-zinc-900 dark:text-white">
            Auditoría de Acciones Sensibles ({auditLogs.length})
          </h2>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-zinc-500">No hay eventos registrados aún.</p>
            ) : (
              auditLogs.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2 text-xs dark:border-zinc-800/80"
                >
                  <div>
                    <span className="font-mono-tabular font-semibold text-[#E50914]">
                      {a.action}
                    </span>{' '}
                    · <span className="font-medium">{a.actorName}</span> ({a.actorRole}) —{' '}
                    <span className="text-zinc-600 dark:text-zinc-400">{a.details}</span>
                  </div>
                  <span className="font-mono-tabular text-[11px] text-zinc-400">
                    {new Date(a.timestamp).toLocaleString('es-VE')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {editingPermUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Permisos de {editingPermUser.name}
              </h3>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium">Rol base</label>
                <select
                  value={editingPermUser.role}
                  onChange={(e) => {
                    const r = e.target.value as UserRole;
                    setEditingPermUser({
                      ...editingPermUser,
                      role: r,
                      permissions: DEFAULT_ROLE_PERMISSIONS[r],
                    });
                  }}
                  className={inputCls}
                >
                  {Object.entries(ROLE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                {ADMIN_NAV_ITEMS.map((item) => {
                  const checked = (editingPermUser.permissions || []).includes(item.key);
                  return (
                    <label key={item.key} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...editingPermUser.permissions, item.key]
                            : editingPermUser.permissions.filter((k: string) => k !== item.key);
                          setEditingPermUser({ ...editingPermUser, permissions: next });
                        }}
                        className="accent-[#E50914]"
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPermUser(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs dark:border-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiRequest('PUT', `/api/admin/staff/${editingPermUser.id}/permissions`, {
                        role: editingPermUser.role,
                        customPermissions: editingPermUser.permissions,
                      });
                      onNotify('Permisos actualizados.', 'success');
                      setEditingPermUser(null);
                      await onRefresh();
                    } catch (err: any) {
                      onNotify(err.message, 'error');
                    }
                  }}
                  className="rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 5. CUMPLEAÑOS DEL MES (Module 7)
  // =========================================================
  if (activeSection === PermissionKey.BIRTHDAYS) {
    const filteredBirthdays = birthdaysData.filter((b) => {
      if (!birthdaySearch.trim()) return true;
      const q = birthdaySearch.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        (b.email || '').toLowerCase().includes(q)
      );
    });

    const exportBirthdaysCsv = () => {
      const headers = ['Nombre', 'Día', 'Mes', 'Correo', 'Teléfono', 'Acepta Comunicaciones'];
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = filteredBirthdays.map((b) =>
        [
          b.name,
          b.displayDayInSelectedYear,
          MONTH_NAMES[b.birthMonth - 1],
          b.email || 'Restringido',
          b.phone || 'Restringido',
          b.marketingOptIn ? 'Sí' : 'No',
        ]
          .map(esc)
          .join(',')
      );
      const blob = new Blob(['\uFEFF' + [headers.map(esc).join(','), ...rows].join('\n')], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cumpleanos_${MONTH_NAMES[selectedMonth - 1].toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Cumpleaños del Mes
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Consulta mensual con soporte para nacidos el 29 de febrero y protección de fecha completa.
            </p>
          </div>
          <button
            type="button"
            onClick={exportBirthdaysCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar Mes CSV</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={birthdaySearch}
            onChange={(e) => setBirthdaySearch(e.target.value)}
            placeholder="Buscar cumpleañero por nombre o correo..."
            className="min-w-[240px] flex-1 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Día y Mes</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Contacto Autorizado</th>
                  <th className="px-4 py-3 font-medium">Preferencia Comunicaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredBirthdays.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-zinc-500">
                      No hay cumpleaños registrados para {MONTH_NAMES[selectedMonth - 1]}.
                    </td>
                  </tr>
                ) : (
                  filteredBirthdays.map((b) => (
                    <tr key={b.userId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-mono-tabular font-semibold text-zinc-900 dark:text-white">
                        {b.displayDayInSelectedYear} de {MONTH_NAMES[b.birthMonth - 1]}
                        {b.isLeapDayBirthday && (
                          <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                            (Nacido 29 Feb)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{b.name}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {b.email ? `${b.email} · ${b.phone || '—'}` : 'Solo visible para rol autorizado'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {b.marketingOptIn ? 'Aceptó avisos' : 'Sin consentimiento promocional'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // 6. NOTIFICACIONES Y RECORDATORIOS POR CORREO (Module 8)
  // =========================================================
  if (activeSection === PermissionKey.NOTIFICATIONS) {
    const dispatchEmailReminder = async () => {
      try {
        const resp = await apiRequest<{ log: NotificationDispatchLog }>(
          'POST',
          '/api/admin/notifications/dispatch',
          { eventId: notifEventId, kind: notifKind }
        );
        onNotify(resp.log.providerNote, resp.log.status === 'sent' ? 'success' : 'info');
        await onRefresh();
      } catch (err: any) {
        onNotify(err.message, 'error');
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Recordatorios de Eventos por Correo
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Envía avisos exclusivamente a usuarios con consentimiento activo, evitando envíos duplicados.
          </p>
        </div>

        {!securityStatus.emailProviderConfigured && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-300">
            <strong>Proveedor de correo externo pendiente de credenciales:</strong> Configura{' '}
            <code className="font-mono-tabular">RESEND_API_KEY</code> y{' '}
            <code className="font-mono-tabular">EMAIL_FROM</code> en las variables de entorno del servidor para despachar correos reales. Mientras no exista clave configurada, las órdenes de envío se encolan y registran honestamente sin simular envíos exitosos.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div>
            <label className="mb-1 block text-xs font-medium">Seleccionar evento</label>
            <select
              value={notifEventId}
              onChange={(e) => setNotifEventId(e.target.value)}
              className={inputCls}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.notifyOnPublish ? 'Avisos activos' : 'Avisos desactivados'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Tipo de comunicación</label>
            <select
              value={notifKind}
              onChange={(e) => setNotifKind(e.target.value as any)}
              className={inputCls}
            >
              <option value="new_event">Aviso de nuevo evento publicado</option>
              <option value="upcoming_reminder">Recordatorio previo al evento</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={dispatchEmailReminder}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c80812]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Procesar Comunicación</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="mb-3 text-sm font-bold text-zinc-900 dark:text-white">
            Historial de Cola y Envíos ({notificationLogs.length})
          </h2>
          <div className="space-y-2.5">
            {notificationLogs.length === 0 ? (
              <p className="text-xs text-zinc-500">Sin despachos registrados aún.</p>
            ) : (
              notificationLogs.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800"
                >
                  <div className="flex flex-wrap justify-between gap-2 font-semibold">
                    <span>
                      {n.eventTitle} · {n.kind === 'new_event' ? 'Nuevo Evento' : 'Recordatorio'}
                    </span>
                    <span className="font-mono-tabular uppercase">{n.status}</span>
                  </div>
                  <p className="mt-1 text-zinc-500">
                    Destinatarios con consentimiento: {n.recipientCount} · Omitidos sin permiso:{' '}
                    {n.skippedNoConsentCount} · Duplicados prevenidos: {n.skippedDuplicateCount}
                  </p>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{n.providerNote}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // 7. CENTRO DE SEGURIDAD ROBUSTA Y PARÁMETROS OPERATIVOS
  // =========================================================
  const fbInfo = getFirebaseProjectInfo();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Seguridad de Grado Bancario Activa</span>
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Centro de Seguridad Robusta y Parámetros
          </h1>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Monitoreo en tiempo real de criptografía HMAC-SHA256, defensa contra fuerza bruta, aislamiento de PII y auditoría de eventos.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Actualizar Telemetría</span>
        </button>
      </div>

      {/* Security Metrics Dashboard Grid */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Algoritmo de Firma
            </span>
            <Lock className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-mono-tabular text-sm font-bold text-zinc-900 dark:text-white">
            HMAC-SHA256 (32 Bytes)
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Timing-safe equal anti-ataques
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Escudo Rate Limiting
            </span>
            <Activity className="h-4 w-4 text-[#E50914]" />
          </div>
          <p className="mt-2 font-mono-tabular text-sm font-bold text-zinc-900 dark:text-white">
            Sliding-Window Activo
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Anti fuerza bruta en auth y órdenes
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Aislamiento PII y Cédula
            </span>
            <KeyRound className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 font-mono-tabular text-sm font-bold text-zinc-900 dark:text-white">
            Zero-Trust ABAC
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Cédula enmascarada · Datos privados
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Eventos de Auditoría
            </span>
            <FileCheck className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 font-mono-tabular text-sm font-bold text-zinc-900 dark:text-white">
            {securityAuditLogs.length} Registros
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Trazabilidad continua en servidor
          </p>
        </div>
      </div>

      {/* Centro de Respaldo, Memoria y Protección Permanente de Datos */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-[#0D1017]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  Memoria Permanente y Protección de la Información
                </h2>
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Base de Datos Persistente Activa
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                Todo dato que cargues (cuentas de pago, eventos, precios, compras, comprobantes y entradas) queda protegido y almacenado de forma independiente al código visual del sitio.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={downloadingBackup}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{downloadingBackup ? 'Generando Respaldo...' : 'Descargar Respaldo Completo (JSON)'}</span>
            </button>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap">
              <Upload className="h-3.5 w-3.5 text-zinc-500" />
              <span>{restoringBackup ? 'Restaurando...' : 'Restaurar desde Respaldo'}</span>
              <input
                type="file"
                accept=".json,application/json"
                disabled={restoringBackup}
                onChange={handleRestoreBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40 space-y-1.5">
            <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Memoria Continua en Servidor</span>
            </span>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
              No necesitas volver a editar nada a cada momento. Cuando pides mejoras estéticas o animaciones, el servidor preserva intactos tus datos en <code className="font-mono-tabular">db.json</code> y reglas de Firestore.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40 space-y-1.5">
            <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0" />
              <span>Blindaje contra Modificaciones No Autorizadas</span>
            </span>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
              El control de acceso por roles (RBAC) impide que el personal de puerta o revisores modifiquen cuentas bancarias, precios o parámetros del club. Solo tú tienes control total.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40 space-y-1.5">
            <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <Save className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Copias de Seguridad Portátiles</span>
            </span>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Puedes descargar un archivo de copia de seguridad cuando quieras y guardarlo en tu computadora o Google Drive. Si algún día deseas restaurar el sistema, lo haces en 1 clic.
            </p>
          </div>
        </div>
      </div>

      {/* 6 Pillars of Active Cyber Defense */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
            Arquitectura de Defensa Activa
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Medidas de seguridad implementadas y activas en producción para proteger fondos, usuarios y entradas.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3 text-xs">
          <div className="rounded-lg border border-zinc-200 p-3.5 space-y-1.5 dark:border-zinc-800">
            <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Criptografía HMAC-SHA256</span>
            </div>
            <p className="text-zinc-500 leading-relaxed">
              Cada pase QR posee un digest criptográfico generado con salt aleatorio secreto de 32 bytes y comparado usando <code className="font-mono-tabular">crypto.timingSafeEqual</code> para impedir ataques de canal lateral o falsificación de entradas.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3.5 space-y-1.5 dark:border-zinc-800">
            <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Bloqueo Atómico Anti-Replay</span>
            </div>
            <p className="text-zinc-500 leading-relaxed">
              Mutex atómico de sincronización en escaneo de puerta. Una vez validada, la entrada se sella de inmediato como <code className="font-mono-tabular">used</code> con marca temporal y operador responsable, imposibilitando re-escaneos o duplicados.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3.5 space-y-1.5 dark:border-zinc-800">
            <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Escudo Contra Fuerza Bruta</span>
            </div>
            <p className="text-zinc-500 leading-relaxed">
              Módulo de rate limiting de ventana deslizante: 5 intentos fallidos en login activan un bloqueo temporal de 10 minutos. Límite de 8 registros y 20 órdenes por IP para impedir ataques de denegación o spam de comprobantes.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3.5 space-y-1.5 dark:border-zinc-800">
            <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Desinfección Profunda Anti-XSS</span>
            </div>
            <p className="text-zinc-500 leading-relaxed">
              Middleware recursivo que purga etiquetas ejecutables, scripts HTML, URLs <code className="font-mono-tabular">javascript:</code> y null-bytes en todas las cargas entrantes, neutralizando inyecciones en referencias y nombres.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3.5 space-y-1.5 dark:border-zinc-800">
            <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>MIME Guard en Comprobantes</span>
            </div>
            <p className="text-zinc-500 leading-relaxed">
              Validación binaria de cabecera en archivos adjuntos de pago. Solo se permiten formatos válidos (PNG, JPEG, WEBP y PDF) con tope estricto de 5MB, denegando ejecutables o scripts camuflados como imágenes.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3.5 space-y-1.5 dark:border-zinc-800">
            <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Cabeceras HTTP de Alta Seguridad</span>
            </div>
            <p className="text-zinc-500 leading-relaxed">
              Protección activa mediante <code className="font-mono-tabular">X-Frame-Options: SAMEORIGIN</code>, <code className="font-mono-tabular">X-Content-Type-Options: nosniff</code>, <code className="font-mono-tabular">X-XSS-Protection</code> y <code className="font-mono-tabular">Cache-Control: no-store</code> en todos los endpoints de API.
            </p>
          </div>
        </div>
      </div>

      {/* Live Security Audit Log Viewer */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Registro de Auditoría de Ciberseguridad en Tiempo Real
            </h2>
            <p className="text-xs text-zinc-500">
              Eventos de autenticación, escaneos en puerta, transacciones bancarias y bloqueos defensivos.
            </p>
          </div>
          <span className="font-mono-tabular text-xs text-zinc-400">
            {securityAuditLogs.length} eventos registrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <th className="py-2.5 font-semibold">Timestamp</th>
                <th className="py-2.5 font-semibold">Severidad</th>
                <th className="py-2.5 font-semibold">Evento</th>
                <th className="py-2.5 font-semibold">IP / Actor</th>
                <th className="py-2.5 font-semibold">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono-tabular">
              {securityAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-zinc-400 font-sans">
                    Sin incidentes ni alertas registradas. El sistema opera de forma segura.
                  </td>
                </tr>
              ) : (
                securityAuditLogs.slice(0, 25).map((log) => {
                  const badgeColor =
                    log.severity === 'critical'
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                      : log.severity === 'high'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : log.severity === 'warning'
                      ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';

                  return (
                    <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="py-2.5 whitespace-nowrap text-zinc-500">
                        {new Date(log.timestamp).toLocaleTimeString('es-VE')} ·{' '}
                        {new Date(log.timestamp).toLocaleDateString('es-VE')}
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${badgeColor}`}>
                          {log.severity}
                        </span>
                      </td>
                      <td className="py-2.5 font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                        {log.event}
                      </td>
                      <td className="py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                        {log.actorEmail || log.ip || 'Sistema'}
                      </td>
                      <td className="py-2.5 font-sans text-zinc-700 dark:text-zinc-300 min-w-[280px]">
                        {log.details}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Parameters & Operational Configuration */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
            Parámetros de la Plataforma y Redes Oficiales
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Ajustes generales de identidad, redes sociales y comisiones operativas.
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiRequest('PUT', '/api/admin/settings', siteForm);
              onNotify('Configuración general y parámetros guardados correctamente.', 'success');
              await onRefresh();
            } catch (err: any) {
              onNotify(err.message, 'error');
            }
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-xs font-medium">Usuario oficial en redes</label>
            <input
              type="text"
              value={siteForm.brandHandle}
              onChange={(e) => setSiteForm({ ...siteForm, brandHandle: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Sede principal de operaciones</label>
            <input
              type="text"
              value={siteForm.cityBase}
              onChange={(e) => setSiteForm({ ...siteForm, cityBase: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Instagram Oficial (URL https)</label>
            <input
              type="url"
              value={siteForm.instagramUrl}
              onChange={(e) => setSiteForm({ ...siteForm, instagramUrl: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">TikTok Oficial (URL https)</label>
            <input
              type="url"
              value={siteForm.tiktokUrl}
              onChange={(e) => setSiteForm({ ...siteForm, tiktokUrl: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">YouTube Oficial (URL https)</label>
            <input
              type="url"
              value={siteForm.youtubeUrl}
              onChange={(e) => setSiteForm({ ...siteForm, youtubeUrl: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              Comisión operativa sobre ingresos netos (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={siteForm.refundFeePercent}
              onChange={(e) => setSiteForm({ ...siteForm, refundFeePercent: Number(e.target.value) })}
              className={`${inputCls} font-mono-tabular`}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-xl bg-[#E50914] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#c80812] cursor-pointer whitespace-nowrap"
            >
              Guardar Parámetros y Políticas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
