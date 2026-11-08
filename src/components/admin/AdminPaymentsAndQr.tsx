import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  CheckCircle2,
  XCircle,
  Eye,
  Camera,
  CameraOff,
  Upload,
  X,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Copy,
  Wifi,
  WalletCards,
  CreditCard,
  Check,
  AlertCircle,
  ArrowRight,
  QrCode,
  Mail,
  Send,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  AccessValidationLog,
  EventItem,
  OrderRecord,
  PaymentMethodsConfig,
  PermissionKey,
  TicketRecord,
} from '../../types';
import { apiRequest, fileToValidatedDataUrl } from '../../lib/api';
import { QrCodeBox } from '../VisualArtwork';
import { ValidatorTerminalModal } from '../ValidatorTerminalModal';
import { formatSeatDisplay } from '../VenueStageMap';

interface AdminPaymentsAndQrProps {
  activeSection: PermissionKey;
  orders: OrderRecord[];
  tickets: TicketRecord[];
  accessLogs: AccessValidationLog[];
  events: EventItem[];
  paymentMethods: PaymentMethodsConfig | null;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const METHOD_NAMES: Record<string, string> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia Bancaria',
  binance: 'Binance',
};

export const AdminPaymentsAndQr: React.FC<AdminPaymentsAndQrProps> = ({
  activeSection,
  orders,
  tickets,
  accessLogs,
  events,
  paymentMethods,
  onRefresh,
  onNotify,
}) => {
  // Private Voucher Modal State
  const [voucherModal, setVoucherModal] = useState<{
    order: OrderRecord;
    dataUrl: string;
  } | null>(null);
  const [reviewNotesMap, setReviewNotesMap] = useState<Record<string, string>>({});
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // Ticket search & QR modal
  const [ticketQuery, setTicketQuery] = useState('');
  const [selectedTicketQr, setSelectedTicketQr] = useState<TicketRecord | null>(null);

  // Email Test Simulator & Door Validation State
  const [testEmailTarget, setTestEmailTarget] = useState('forgen122@gmail.com');
  const [selectedTestTicketId, setSelectedTestTicketId] = useState<string>('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{
    ok: boolean;
    sentRealSmtp?: boolean;
    mode: string;
    recipient: string;
    subject: string;
    ticketCode: string;
    ticketId: string;
    qrPayload: string;
    qrDataUrl?: string;
    emailHtml?: string;
    providerNote?: string;
    ticket?: TicketRecord;
  } | null>(null);
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false);
  const [testingDoorValidation, setTestingDoorValidation] = useState(false);
  const [doorTestFeedback, setDoorTestFeedback] = useState<{
    tested: boolean;
    allowed: boolean;
    message: string;
    ticketCode: string;
    timestamp: string;
  } | null>(null);

  // QR Scanner State (Module 5)
  const [scannerEventId, setScannerEventId] = useState('');
  const [manualQrInput, setManualQrInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [validatorTerminalOpen, setValidatorTerminalOpen] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [lastScanOutcome, setLastScanOutcome] = useState<{
    allowed: boolean;
    log: AccessValidationLog;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const formatOrderTierSummary = (ord: OrderRecord): string => {
    const g = ord.generalQty ?? (ord.ticketType === 'general' ? ord.qty : 0);
    const v = ord.vipQty ?? (ord.ticketType === 'vip' ? ord.qty : 0);
    if (g > 0 && v > 0) {
      return `${ord.qty} entradas (${g} General + ${v} VIP)`;
    }
    if (v > 0) return `${v}x VIP`;
    return `${g || ord.qty}x GENERAL`;
  };

  const copyField = async (label: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      onNotify(`${label} copiado al portapapeles.`, 'info');
    } catch {
      onNotify(`${label}: ${val}`, 'info');
    }
  };

  const testValidatorPing = async () => {
    setTestingPing(true);
    try {
      const start = performance.now();
      const resp = await apiRequest<{ ok: boolean; service: string }>('GET', '/api/validator/ping');
      const ms = Math.max(1, Math.round(performance.now() - start));
      if (resp.ok) {
        onNotify(`Servidor Validador en línea (${ms} ms) · Listo para recibir escaneos.`, 'success');
      }
    } catch (err: any) {
      onNotify(err.message || 'No se pudo verificar el conector del Validador.', 'error');
    } finally {
      setTestingPing(false);
    }
  };

  // Payment Methods Editable State (Module 3)
  const [pmState, setPmState] = useState<PaymentMethodsConfig>(
    paymentMethods || {
      pago_movil: {
        enabled: false,
        bank: '',
        phone: '',
        documentId: '',
        holderName: '',
        instructions: '',
        iconUrl: '',
      },
      transferencia: {
        enabled: false,
        bank: '',
        holderName: '',
        documentId: '',
        accountNumber: '',
        accountType: 'Corriente',
        currency: 'VES',
        instructions: '',
        iconUrl: '',
      },
      binance: {
        enabled: false,
        payIdOrEmail: '',
        networkOrAsset: 'USDT (Binance Pay)',
        instructions: '',
        iconUrl: '',
      },
    }
  );

  useEffect(() => {
    if (paymentMethods) {
      setPmState(paymentMethods);
    }
  }, [paymentMethods]);

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, [activeSection]);

  const executeScanValidation = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    try {
      const resp = await apiRequest<{ allowed: boolean; log: AccessValidationLog }>(
        'POST',
        '/api/validator/scan',
        { code: clean, eventId: scannerEventId }
      );
      setLastScanOutcome(resp);
      onNotify(resp.log.message, resp.allowed ? 'success' : 'error');
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = jsQR(imgData.data, imgData.width, imgData.height);
            if (decoded?.data) {
              stopCamera();
              executeScanValidation(decoded.data);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      onNotify(
        'No se pudo acceder a la cámara. Puedes escanear desde una imagen o introducir el código.',
        'error'
      );
    }
  };

  const scanFromImageFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(data.data, data.width, data.height);
        if (decoded?.data) {
          executeScanValidation(decoded.data);
        } else {
          onNotify('No se detectó un código QR legible en la imagen.', 'error');
        }
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleSendTicketEmail = async (
    overrideTicketId?: string,
    overrideOrderId?: string,
    overrideEmail?: string
  ) => {
    const targetTicketId = overrideTicketId || selectedTestTicketId;
    setSendingTestEmail(true);
    setDoorTestFeedback(null);
    try {
      const resp = await apiRequest<{
        ok: boolean;
        sentRealSmtp?: boolean;
        mode: string;
        recipient: string;
        subject: string;
        ticketCode: string;
        ticketId: string;
        qrPayload: string;
        qrDataUrl?: string;
        emailHtml?: string;
        providerNote?: string;
        hmacVerified?: boolean;
        ticket?: TicketRecord;
      }>('POST', '/api/tickets/resend', {
        ticketId: targetTicketId || undefined,
        orderId: overrideOrderId || undefined,
        email: (overrideEmail || testEmailTarget || 'forgen122@gmail.com').trim(),
        createDemoIfMissing: !targetTicketId && !overrideOrderId,
      });

      setEmailTestResult(resp);
      setShowEmailPreviewModal(true);
      if (resp.hmacVerified !== false) {
        setDoorTestFeedback({
          tested: true,
          allowed: true,
          message:
            'Firma criptográfica HMAC-SHA256 verificada · Pase VÁLIDO (sin usar) listo para escanear en puerta.',
          ticketCode: resp.ticketCode,
          timestamp: new Date().toLocaleTimeString(),
        });
      }

      if (resp.sentRealSmtp) {
        onNotify(`Pase ${resp.ticketCode} enviado exitosamente a ${resp.recipient} por correo electrónico.`, 'success');
      } else {
        onNotify(
          `Simulación de envío exitosa para ${resp.recipient}. Vista previa de correo digital lista.`,
          'success'
        );
      }

      await onRefresh();
    } catch (err: any) {
      onNotify(err.message || 'Error al procesar el pase para correo.', 'error');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleQuickDoorValidation = async (codeOrPayload: string) => {
    setTestingDoorValidation(true);
    try {
      const resp = await apiRequest<{ allowed: boolean; log: AccessValidationLog }>(
        'POST',
        '/api/validator/scan',
        { code: codeOrPayload }
      );
      setDoorTestFeedback({
        tested: true,
        allowed: resp.allowed,
        message: resp.log.message,
        ticketCode: resp.log.ticketCode,
        timestamp: new Date().toLocaleTimeString(),
      });
      onNotify(resp.log.message, resp.allowed ? 'success' : 'error');
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message || 'Error al validar en puerta.', 'error');
    } finally {
      setTestingDoorValidation(false);
    }
  };

  const openProtectedVoucher = async (order: OrderRecord) => {
    try {
      const resp = await apiRequest<{ dataUrl: string }>(
        'GET',
        `/api/admin/orders/${order.id}/voucher`
      );
      setVoucherModal({ order, dataUrl: resp.dataUrl });
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleDecision = async (orderId: string, action: 'approve' | 'reject') => {
    setProcessingOrderId(orderId);
    try {
      const notes = reviewNotesMap[orderId] || '';
      const resp = await apiRequest<{
        order: OrderRecord;
        issuedTickets?: TicketRecord[];
        emailDispatch?: any;
      }>('POST', `/api/admin/orders/${orderId}/${action}`, { notes });

      if (action === 'approve' && resp.emailDispatch) {
        setEmailTestResult(resp.emailDispatch);
      }

      onNotify(
        action === 'approve'
          ? `Pago aprobado, entradas QR emitidas y pase enviado/simulado a ${resp.emailDispatch?.recipient || 'correo del comprador'}.`
          : 'Pago rechazado y registrado en auditoría.',
        action === 'approve' ? 'success' : 'info'
      );
      setVoucherModal(null);
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleRefund = async (orderId: string) => {
    setProcessingOrderId(orderId);
    try {
      await apiRequest('POST', `/api/admin/orders/${orderId}/refund`, {
        notes: 'Reembolso aplicado desde Órdenes y Pagos.',
      });
      onNotify('Orden reembolsada y tickets invalidados.', 'info');
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const [savingPm, setSavingPm] = useState(false);

  const savePaymentMethods = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPm(true);
    try {
      await apiRequest('PUT', '/api/admin/payment-methods', pmState);
      onNotify('¡Datos de pago guardados y sincronizados con éxito en la taquilla!', 'success');
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSavingPm(false);
    }
  };

  const [syncingRate, setSyncingRate] = useState(false);
  const syncOfficialExchangeRate = async () => {
    setSyncingRate(true);
    try {
      const res = await apiRequest<{ ok: boolean; exchangeRate: any }>('POST', '/api/admin/exchange-rate/sync');
      if (res.exchangeRate) {
        setPmState((prev) => ({ ...prev, exchangeRate: res.exchangeRate }));
        onNotify(`Tasa oficial del BCV sincronizada: Bs. ${Number(res.exchangeRate.rate).toFixed(2)} por USD`, 'success');
      }
      await onRefresh();
    } catch (err: any) {
      onNotify(err.message || 'Error al sincronizar la tasa del BCV', 'error');
    } finally {
      setSyncingRate(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#E50914] focus:outline-none';

  // =========================================================
  // 1. COMPROBANTES PENDIENTES (Module 4.3)
  // =========================================================
  if (activeSection === PermissionKey.PENDING_VOUCHERS) {
    const pending = orders.filter((o) => o.status === 'pending');

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Comprobantes Pendientes de Revisión
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Revisa el comprobante privado antes de decidir. Los códigos QR se emiten únicamente tras aprobar el pago.
          </p>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              No hay comprobantes pendientes por revisar en este momento.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((ord) => (
              <div
                key={ord.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-mono-tabular text-xs text-zinc-500">
                      {ord.id} · Enviado {new Date(ord.createdAt).toLocaleString('es-VE')}
                    </p>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                      {ord.eventTitle} — {formatOrderTierSummary(ord)}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Comprador: <strong>{ord.userName}</strong> ({ord.userEmail})
                    </p>
                    {(ord.payerName || ord.payerCedula || ord.payerPhone || ord.payerEmail) && (
                      <p className="rounded-lg bg-zinc-100 p-2 text-xs text-zinc-800 dark:bg-white/[0.04] dark:text-zinc-200">
                        <strong className="text-[#E50914]">Datos de quien transfirió:</strong>{' '}
                        {ord.payerName || 'N/A'} · C.I./Doc: {ord.payerCedula || 'N/A'} · Tel:{' '}
                        {ord.payerPhone || 'N/A'} · Correo: {ord.payerEmail || 'N/A'}
                      </p>
                    )}
                    {ord.selectedSeats && ord.selectedSeats.length > 0 && (
                      <p className="font-mono-tabular text-xs text-zinc-600 dark:text-zinc-400">
                        Ubicaciones: {ord.selectedSeats.slice(0, 8).map(formatSeatDisplay).join(', ')}
                        {ord.selectedSeats.length > 8 ? ` (+${ord.selectedSeats.length - 8})` : ''}
                      </p>
                    )}
                    {ord.combos && ord.combos.length > 0 && (
                      <p className="text-xs text-amber-700 dark:text-[#D4AF37]">
                        Barra / Combos:{' '}
                        {ord.combos.map((c) => `${c.qty}x ${c.name}`).join(' · ')}
                      </p>
                    )}
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Método: <strong>{METHOD_NAMES[ord.paymentMethod]}</strong> · Referencia bancaria:{' '}
                      <code className="font-mono-tabular font-semibold text-zinc-900 dark:text-white">
                        {ord.reference}
                      </code>{' '}
                      · Fecha pago: {ord.paymentDate}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Importe orden / reportado</p>
                    <p className="font-mono-tabular text-xl font-bold text-zinc-900 dark:text-white">
                      ${ord.totalAmount.toFixed(2)} / ${ord.paidAmountReported.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => openProtectedVoucher(ord)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Abrir Comprobante Privado</span>
                  </button>

                  <input
                    type="text"
                    value={reviewNotesMap[ord.id] || ''}
                    onChange={(e) =>
                      setReviewNotesMap((prev) => ({ ...prev, [ord.id]: e.target.value }))
                    }
                    placeholder="Observación de auditoría (opcional)..."
                    className="min-w-[220px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  />

                  <button
                    type="button"
                    disabled={processingOrderId === ord.id}
                    onClick={() => handleDecision(ord.id, 'approve')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 whitespace-nowrap"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>APROBAR PAGO</span>
                  </button>

                  <button
                    type="button"
                    disabled={processingOrderId === ord.id}
                    onClick={() => handleDecision(ord.id, 'reject')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50 whitespace-nowrap"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>RECHAZAR PAGO</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Protected Voucher Viewer Modal */}
        {voucherModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => setVoucherModal(null)}
                className="absolute top-4 right-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Comprobante Privado · {voucherModal.order.id}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Referencia: <strong className="font-mono-tabular">{voucherModal.order.reference}</strong> ·{' '}
                {METHOD_NAMES[voucherModal.order.paymentMethod]} · ${voucherModal.order.totalAmount.toFixed(2)}
              </p>
              <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 p-2 dark:border-zinc-800">
                {voucherModal.dataUrl.startsWith('data:application/pdf') ? (
                  <iframe
                    src={voucherModal.dataUrl}
                    title="Comprobante PDF"
                    className="h-96 w-full rounded"
                  />
                ) : (
                  <img
                    src={voucherModal.dataUrl}
                    alt="Comprobante de pago"
                    className="mx-auto max-h-[60vh] object-contain"
                  />
                )}
              </div>
              {voucherModal.order.status === 'pending' && (
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecision(voucherModal.order.id, 'reject')}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500"
                  >
                    RECHAZAR PAGO
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision(voucherModal.order.id, 'approve')}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                  >
                    APROBAR PAGO
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 2. ÓRDENES Y PAGOS (Historial Completo + Reembolsos)
  // =========================================================
  if (activeSection === PermissionKey.ORDERS_PAYMENTS) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Órdenes y Pagos Registrados
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Registro auditable de compras, métodos utilizados, decisiones administrativas y reembolsos.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Orden</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Evento · Tipo</th>
                  <th className="px-4 py-3 font-medium">Método · Ref.</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Estado · Revisión</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-zinc-500">
                      Aún no se han registrado órdenes de compra.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-mono-tabular text-xs font-semibold">
                        {o.id}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium text-zinc-900 dark:text-white">{o.userName}</div>
                        <div className="text-zinc-500">{o.userEmail}</div>
                        {(o.payerName || o.payerCedula || o.payerPhone) && (
                          <div className="text-[11px] text-amber-700 dark:text-[#D4AF37]">
                            Transfirió: {o.payerName || ''} {o.payerCedula ? `(${o.payerCedula})` : ''} {o.payerPhone ? `· ${o.payerPhone}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium text-zinc-900 dark:text-white">{o.eventTitle}</div>
                        <div className="text-zinc-500">
                          {formatOrderTierSummary(o)}
                          {o.combos && o.combos.length > 0 ? ` + ${o.combos.length} combo(s)` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div>{METHOD_NAMES[o.paymentMethod]}</div>
                        <div className="font-mono-tabular text-zinc-500">Ref: {o.reference}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono-tabular font-semibold">
                        ${o.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {o.status.toUpperCase()}
                        </span>
                        {o.reviewedBy && (
                          <div className="text-zinc-500">Por {o.reviewedBy}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openProtectedVoucher(o)}
                          className="text-xs font-medium text-[#E50914] hover:underline"
                        >
                          Comprobante
                        </button>
                        {o.status === 'approved' && (
                          <>
                            <button
                              type="button"
                              disabled={sendingTestEmail}
                              onClick={() => handleSendTicketEmail(undefined, o.id, o.payerEmail || o.userEmail)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                              title="Enviar o simular envío de entrada por correo"
                            >
                              <Mail className="h-3 w-3" />
                              <span>Enviar Pase</span>
                            </button>
                            <button
                              type="button"
                              disabled={processingOrderId === o.id}
                              onClick={() => handleRefund(o.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Reembolsar</span>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {voucherModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => setVoucherModal(null)}
                className="absolute top-4 right-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-base font-bold">Comprobante · {voucherModal.order.id}</h3>
              <img
                src={voucherModal.dataUrl}
                alt="Comprobante"
                className="mt-4 mx-auto max-h-[65vh] rounded object-contain"
              />
            </div>
          </div>
        )}

        {showEmailPreviewModal && emailTestResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative flex flex-col h-[90vh] w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E50914] text-white">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">
                      Vista Previa de Correo Digital · {emailTestResult.ticketCode}
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Para: <span className="font-medium text-zinc-800 dark:text-zinc-200">{emailTestResult.recipient}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailPreviewModal(false)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 bg-zinc-900 p-2 overflow-hidden">
                <iframe
                  title="Ticket Email Preview"
                  srcDoc={emailTestResult.emailHtml || ''}
                  className="h-full w-full rounded-lg border-0 bg-zinc-950"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 3. ENTRADAS Y CÓDIGOS QR (Module 5)
  // =========================================================
  if (activeSection === PermissionKey.TICKETS_QR) {
    const filteredTickets = tickets.filter((t) => {
      if (!ticketQuery.trim()) return true;
      const q = ticketQuery.toLowerCase();
      return (
        t.code.toLowerCase().includes(q) ||
        t.userName.toLowerCase().includes(q) ||
        t.eventTitle.toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Entradas Emitidas, Códigos QR y Envíos a Correo
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Cada entrada posee un identificador único firmado con HMAC-SHA256. Simula el envío de pases al correo configurado y valida su acceso en puerta.
            </p>
          </div>
          <input
            type="search"
            value={ticketQuery}
            onChange={(e) => setTicketQuery(e.target.value)}
            placeholder="Buscar por código, titular o evento..."
            className="w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {/* =====================================================
            SIMULADOR DE ENVÍO DE TICKETS Y VALIDACIÓN EN PUERTA
            ===================================================== */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#0E0E14]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-[#E50914]">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Simulador de Envío de Entradas a Correo Electrónico
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Valida la plantilla de correo, generación de código QR firmado y prueba la validación del pase en puerta.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Endpoint /api/tickets/resend activo
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Correo Electrónico de Destino (Prueba)
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={testEmailTarget}
                  onChange={(e) => setTestEmailTarget(e.target.value)}
                  placeholder="forgen122@gmail.com"
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 focus:border-[#E50914] focus:outline-none dark:border-zinc-700 dark:bg-black/50 dark:text-white"
                />
              </div>
              <span className="mt-1 block text-[11px] text-zinc-500">
                Dirección a la cual se despachará o simulará el ticket digital.
              </span>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Pase a Enviar
              </label>
              <select
                value={selectedTestTicketId}
                onChange={(e) => setSelectedTestTicketId(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 focus:border-[#E50914] focus:outline-none dark:border-zinc-700 dark:bg-black/50 dark:text-white"
              >
                <option value="">(Generar Entrada Demo Oficial Automática)</option>
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} · {t.userName} ({t.ticketType.toUpperCase()})
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-zinc-500">
                {tickets.length > 0
                  ? `${tickets.length} entradas emitidas disponibles.`
                  : 'Se creará un pase demo si no hay entradas.'}
              </span>
            </div>

            <div className="flex items-end md:col-span-3">
              <button
                type="button"
                disabled={sendingTestEmail}
                onClick={() => handleSendTicketEmail()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#c80812] disabled:opacity-50 transition-colors"
              >
                {sendingTestEmail ? (
                  <>
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    <span>Generando Pase...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Simular / Enviar Ticket</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Resultado de la simulación / envío */}
          {emailTestResult && (
            <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-black/60">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                    {emailTestResult.sentRealSmtp
                      ? 'Ticket Enviado vía SMTP'
                      : 'Simulación de Ticket Exitosa'}
                  </span>
                  <span className="rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-mono font-semibold dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {emailTestResult.ticketCode}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {emailTestResult.emailHtml && (
                    <button
                      type="button"
                      onClick={() => setShowEmailPreviewModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#E50914]" />
                      <span>Ver Correo Digital (HTML)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={testingDoorValidation}
                    onClick={() =>
                      handleQuickDoorValidation(
                        emailTestResult.qrPayload || emailTestResult.ticketCode
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {testingDoorValidation ? (
                      <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    <span>Probar Validación en Puerta con este QR</span>
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                <div>
                  <span className="text-zinc-500">Destinatario:</span>
                  <p className="font-semibold text-zinc-900 dark:text-white break-all">
                    {emailTestResult.recipient}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Asunto del Correo:</span>
                  <p className="font-semibold text-zinc-900 dark:text-white truncate">
                    {emailTestResult.subject}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Estado Conector:</span>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    {emailTestResult.providerNote || 'Pase emitido y listo para validación.'}
                  </p>
                </div>
              </div>

              {/* Banner de feedback de validación en puerta inmediata */}
              {doorTestFeedback && (
                <div
                  className={`mt-3 flex items-center justify-between rounded-lg p-3 text-xs font-medium ${
                    doorTestFeedback.allowed
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                      : 'border border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {doorTestFeedback.allowed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                    )}
                    <span>
                      <strong>
                        {doorTestFeedback.allowed ? 'ACCESO PERMITIDO:' : 'ACCESO DENEGADO:'}
                      </strong>{' '}
                      {doorTestFeedback.message}
                    </span>
                  </div>
                  <span className="text-[11px] opacity-75 shrink-0 ml-2">
                    {doorTestFeedback.timestamp}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TABLA DE ENTRADAS EMITIDAS */}
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Código Ticket</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Titular</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-zinc-500">
                      No hay entradas emitidas que coincidan con el filtro.
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-mono-tabular text-xs font-semibold">
                        {t.code}
                      </td>
                      <td className="px-4 py-3 text-xs">{t.eventTitle}</td>
                      <td className="px-4 py-3 text-xs">{t.userName}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="uppercase font-semibold">
                          {t.ticketType === 'vip' ? 'OFICIAL' : t.ticketType.toUpperCase()}
                        </span>
                        {t.seatLabel && (
                          <span className="ml-1.5 font-mono-tabular text-zinc-500">
                            · {formatSeatDisplay(t.seatLabel).replace('VIP-', 'GEN-')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {t.status === 'valid' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Válido (sin usar)
                          </span>
                        ) : t.status === 'used' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                            Usado ({t.validatedBy || 'Puerta'})
                          </span>
                        ) : (
                          t.status
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleSendTicketEmail(t.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                            title="Simular o reenviar a correo"
                          >
                            <Mail className="h-3.5 w-3.5 text-[#E50914]" />
                            <span>Enviar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedTicketQr(t)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#E50914] hover:underline"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            <span>Ver QR</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL VER CÓDIGO QR */}
        {selectedTicketQr && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <div className="relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => setSelectedTicketQr(null)}
                className="absolute top-4 right-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {selectedTicketQr.eventTitle}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Pase #{selectedTicketQr.seq} · {selectedTicketQr.ticketType.toUpperCase()}
                {selectedTicketQr.seatLabel ? ` (${formatSeatDisplay(selectedTicketQr.seatLabel)})` : ''} ·{' '}
                {selectedTicketQr.userName}
              </p>
              <div className="my-5 flex justify-center">
                <QrCodeBox payload={selectedTicketQr.qrPayload} size={180} />
              </div>
              <p className="font-mono-tabular text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {selectedTicketQr.code}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={testingDoorValidation}
                  onClick={() => {
                    handleQuickDoorValidation(selectedTicketQr.qrPayload || selectedTicketQr.code);
                    setSelectedTicketQr(null);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Probar Validación en Puerta con este Pase</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSendTicketEmail(selectedTicketQr.id);
                    setSelectedTicketQr(null);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Mail className="h-4 w-4 text-[#E50914]" />
                  <span>Enviar este Pase al Correo</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL VISTA PREVIA DEL CORREO ELECTRÓNICO (HTML) */}
        {showEmailPreviewModal && emailTestResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative flex flex-col h-[90vh] w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
              {/* Header tipo cliente de correo */}
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E50914] text-white">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">
                      Vista Previa de Correo Digital · {emailTestResult.ticketCode}
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Para: <span className="font-medium text-zinc-800 dark:text-zinc-200">{emailTestResult.recipient}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={testingDoorValidation}
                    onClick={() => {
                      handleQuickDoorValidation(
                        emailTestResult.qrPayload || emailTestResult.ticketCode
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Validar Pase en Puerta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmailPreviewModal(false)}
                    className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Iframe con el HTML real del correo */}
              <div className="flex-1 bg-zinc-900 p-2 overflow-hidden">
                <iframe
                  title="Ticket Email Preview"
                  srcDoc={emailTestResult.emailHtml || ''}
                  className="h-full w-full rounded-lg border-0 bg-zinc-950"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 4. VALIDADOR DE PUERTA Y CONECTOR LB VALIDADOR (Module 5)
  // =========================================================
  if (activeSection === PermissionKey.VALIDATOR) {
    const serverOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const mobileWebTerminalUrl = `${serverOrigin}/validador`;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Validador de Puerta y Conexión App Móvil
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Conecta la aplicación móvil VALIDADOR con tu servidor y credenciales de administrador, o valida entradas desde este terminal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={testingPing}
              onClick={testValidatorPing}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              <Wifi className="h-4 w-4 text-emerald-500" />
              <span>{testingPing ? 'Verificando...' : 'Probar Conexión Servidor'}</span>
            </button>
            <button
              type="button"
              onClick={() => setValidatorTerminalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#c80812] whitespace-nowrap"
            >
              <Smartphone className="h-4 w-4" />
              <span>Abrir App VALIDADOR</span>
            </button>
          </div>
        </div>

        {/* Exact Connection Parameters Card for Mobile App VALIDADOR */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0D0D12]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <img
                src="/assets/lv-logo.png"
                alt="LA VUELTA SESSIONS VALIDADOR"
                className="h-11 w-11 rounded-full border border-zinc-300 object-contain dark:border-white/20"
              />
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Datos de Conexión para App Móvil VALIDADOR
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Introduce estos datos exactamente en los campos SERVIDOR, CORREO y CONTRASEÑA de la app de puerta.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-black/60">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-500">1. CAMPO SERVIDOR</span>
                <button
                  type="button"
                  onClick={() => copyField('URL del Servidor', serverOrigin)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E50914] hover:underline"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copiar</span>
                </button>
              </div>
              <p className="mt-1.5 break-all font-mono-tabular text-xs font-semibold text-zinc-900 dark:text-white">
                {serverOrigin}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-black/60">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-500">2. CAMPO CORREO (ADMIN)</span>
                <button
                  type="button"
                  onClick={() => copyField('Correo Admin', 'lavueltassessionsoficial@gmail.com')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E50914] hover:underline"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copiar</span>
                </button>
              </div>
              <p className="mt-1.5 break-all font-mono-tabular text-xs font-semibold text-zinc-900 dark:text-white">
                lavueltassessionsoficial@gmail.com
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-black/60">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-500">3. TERMINAL WEB EN CELULAR</span>
                <button
                  type="button"
                  onClick={() => copyField('Enlace Terminal Móvil', mobileWebTerminalUrl)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E50914] hover:underline"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copiar</span>
                </button>
              </div>
              <p className="mt-1.5 break-all font-mono-tabular text-xs font-semibold text-zinc-900 dark:text-white">
                {mobileWebTerminalUrl}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Active Scanner Box */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Filtrar puerta por evento específico (opcional)
              </label>
              <select
                value={scannerEventId}
                onChange={(e) => setScannerEventId(e.target.value)}
                className={inputCls}
              >
                <option value="">Aceptar cualquier evento activo</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({ev.date})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#E50914] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#c80812] whitespace-nowrap"
                >
                  <Camera className="h-4 w-4" />
                  <span>Iniciar Cámara QR</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-700 whitespace-nowrap"
                >
                  <CameraOff className="h-4 w-4" />
                  <span>Detener Cámara</span>
                </button>
              )}

              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap">
                <Upload className="h-4 w-4" />
                <span>Escanear Imagen</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) scanFromImageFile(f);
                  }}
                />
              </label>
            </div>

            {cameraActive && (
              <div className="relative h-64 overflow-hidden rounded-xl border border-zinc-300 bg-black dark:border-zinc-700">
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/40" />
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeScanValidation(manualQrInput);
                setManualQrInput('');
              }}
              className="flex gap-2 pt-2"
            >
              <input
                type="text"
                value={manualQrInput}
                onChange={(e) => setManualQrInput(e.target.value)}
                placeholder="Código LV-XXXX o token LVS1..."
                className={`${inputCls} font-mono-tabular`}
              />
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 whitespace-nowrap"
              >
                Validar
              </button>
            </form>

            {/* Immediate High-Contrast Result Banner */}
            {lastScanOutcome && (
              <div
                className={`rounded-xl border p-4 ${
                  lastScanOutcome.allowed
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-bold">
                  {lastScanOutcome.allowed ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0" />
                  )}
                  <span>{lastScanOutcome.log.result.replace(/_/g, ' ')}</span>
                </div>
                <p className="mt-1 text-xs">{lastScanOutcome.log.message}</p>
                <p className="mt-1 font-mono-tabular text-[11px] opacity-80">
                  Código: {lastScanOutcome.log.ticketCode} · Evento: {lastScanOutcome.log.eventTitle}
                </p>
              </div>
            )}
          </div>

          {/* Mobile Endpoints & Access Log */}
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <ShieldCheck className="h-4 w-4 text-[#E50914]" />
                <span>Rutas Activas del Servidor VALIDADOR</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                El servidor responde tanto a la aplicación móvil administrativa (con campos <code className="font-mono-tabular">correo</code> / <code className="font-mono-tabular">contraseña</code> y token Bearer) como a lectores externos mediante <code className="font-mono-tabular">X-LB-Api-Key</code>:
              </p>
              <div className="mt-3 rounded-lg bg-zinc-100 p-3 font-mono-tabular text-[11px] text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                POST /api/validator/login · POST /api/validador/login{'\n'}
                GET  /api/validator/events · GET  /api/validator/ping{'\n'}
                POST /api/validator/scan · POST /api/lb-validador/verify
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Bitácora Reciente de Puerta ({accessLogs.length})
              </h2>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {accessLogs.length === 0 ? (
                  <p className="text-xs text-zinc-500">Sin escaneos registrados aún.</p>
                ) : (
                  accessLogs.slice(0, 20).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          {log.result.replace(/_/g, ' ')} ·{' '}
                          <span className="font-mono-tabular">{log.ticketCode}</span>
                        </p>
                        <p className="truncate text-zinc-500">
                          {log.message} · Por {log.validatedBy}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono-tabular text-[11px] text-zinc-400">
                        {new Date(log.timestamp).toLocaleTimeString('es-VE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <ValidatorTerminalModal
          open={validatorTerminalOpen}
          onClose={() => setValidatorTerminalOpen(false)}
        />
      </div>
    );
  }

  // =========================================================
  // 5. MÉTODOS DE PAGO ADMINISTRABLES (Module 3)
  // =========================================================
  return (
    <form onSubmit={savePaymentMethods} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-[#E50914] dark:bg-red-500/15">
              <WalletCards className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                Taquilla Oficial · Finanzas
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Cuentas y Datos de Pago Oficiales
              </h1>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            Carga y actualiza aquí los datos reales donde los compradores transferirán el monto de sus entradas. Al guardar, los clientes verán estos mismos datos de inmediato en el Paso 2 del proceso de compra.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={savingPm}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-5 py-2.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-[#c80812] disabled:opacity-50 whitespace-nowrap"
          >
            {savingPm ? (
              <span>Guardando en Servidor...</span>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Guardar Datos de Pago</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Callout */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <p className="font-semibold">
              ¿Cómo funciona la recepción de pagos para los compradores?
            </p>
            <p className="text-blue-800/90 dark:text-blue-300">
              1. En la taquilla pública, el comprador selecciona la cantidad de entradas y hace clic en <strong>Siguiente</strong>.
            </p>
            <p className="text-blue-800/90 dark:text-blue-300">
              2. El sistema le muestra en el <strong>Paso 2</strong> únicamente las opciones marcadas como <strong>Activo</strong> con los números de teléfono, bancos, cédulas y Pay IDs que ingreses aquí.
            </p>
            <p className="text-blue-800/90 dark:text-blue-300">
              3. En el <strong>Paso 3</strong>, el cliente adjunta su comprobante y su cédula, quedando en espera de tu aprobación en <strong>Revisión de Comprobantes</strong> para emitirle sus pases QR.
            </p>
          </div>
        </div>
      </div>

      {/* Tasa Oficial del Día (BCV) - Conversión Automática en Bolívares */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5 dark:border-emerald-500/30 dark:bg-emerald-500/[0.08] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  Tasa Oficial Automatizada · Banco Central de Venezuela
                </span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                  {pmState.exchangeRate?.mode === 'manual' ? 'Modo Manual' : 'Sincronización BCV Activa'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
                Tasa del Día para Pago Móvil y Bolívares (Bs.)
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={syncingRate}
              onClick={syncOfficialExchangeRate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-xs hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${syncingRate ? 'animate-spin' : ''}`} />
              <span>{syncingRate ? 'Consultando BCV...' : 'Sincronizar BCV Ahora'}</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
          A la hora de comprar entradas con <strong>Pago Móvil</strong> o <strong>Transferencia en Bolívares</strong>, los clientes ven el monto exacto convertido en Bolívares automáticamente debajo del total en USD, sin que tengan que hacer nada ni calcular manualmente.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-white/80 p-3.5 dark:bg-zinc-900/80 border border-emerald-500/20 dark:border-emerald-500/20">
            <span className="text-[11px] font-medium text-zinc-500">Tasa actual aplicada</span>
            <div className="mt-1 flex items-baseline gap-1 font-mono-tabular">
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                Bs. {Number(pmState.exchangeRate?.rate || 896.12).toFixed(2)}
              </span>
              <span className="text-xs font-medium text-zinc-500">/ USD</span>
            </div>
          </div>

          <div className="rounded-lg bg-white/80 p-3.5 dark:bg-zinc-900/80 border border-emerald-500/20 dark:border-emerald-500/20">
            <span className="text-[11px] font-medium text-zinc-500">Fuente oficial</span>
            <p className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate">
              {pmState.exchangeRate?.source || 'Banco Central de Venezuela (BCV Oficial)'}
            </p>
            <p className="text-[10px] text-zinc-400">
              Actualizado: {pmState.exchangeRate?.lastUpdated ? new Date(pmState.exchangeRate.lastUpdated).toLocaleDateString('es-VE') : 'Hoy'}
            </p>
          </div>

          <div className="rounded-lg bg-white/80 p-3.5 dark:bg-zinc-900/80 border border-emerald-500/20 dark:border-emerald-500/20">
            <label className="text-[11px] font-medium text-zinc-500 block mb-1">
              Ajuste manual de tasa (Opcional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="1"
                value={pmState.exchangeRate?.rate || 896.12}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPmState((prev) => ({
                    ...prev,
                    exchangeRate: {
                      rate: val,
                      currency: 'VES',
                      source: 'Ajuste manual administrativo',
                      lastUpdated: new Date().toISOString(),
                      mode: 'manual',
                    },
                  }));
                }}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-mono-tabular"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 3.1 Pago Móvil */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">1. Pago Móvil</h2>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={pmState.pago_movil.enabled}
                onChange={(e) =>
                  setPmState({
                    ...pmState,
                    pago_movil: { ...pmState.pago_movil, enabled: e.target.checked },
                  })
                }
                className="accent-[#E50914]"
              />
              <span>{pmState.pago_movil.enabled ? 'Activo' : 'Inactivo'}</span>
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Banco receptor</label>
            <input
              type="text"
              value={pmState.pago_movil.bank}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  pago_movil: { ...pmState.pago_movil, bank: e.target.value },
                })
              }
              placeholder="Ej. Banco Mercantil (0105)"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Teléfono de pago</label>
            <input
              type="text"
              value={pmState.pago_movil.phone}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  pago_movil: { ...pmState.pago_movil, phone: e.target.value },
                })
              }
              placeholder="0412-0000000"
              className={`${inputCls} font-mono-tabular`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">RIF o Cédula del titular</label>
            <input
              type="text"
              value={pmState.pago_movil.documentId}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  pago_movil: { ...pmState.pago_movil, documentId: e.target.value },
                })
              }
              placeholder="J-00000000-0 / V-00000000"
              className={`${inputCls} font-mono-tabular`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Nombre del titular</label>
            <input
              type="text"
              value={pmState.pago_movil.holderName}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  pago_movil: { ...pmState.pago_movil, holderName: e.target.value },
                })
              }
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Información adicional al comprador</label>
            <textarea
              rows={2}
              value={pmState.pago_movil.instructions}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  pago_movil: { ...pmState.pago_movil, instructions: e.target.value },
                })
              }
              placeholder="Tasa aplicable o instrucciones..."
              className={inputCls}
            />
          </div>
          {/* Carga del Código QR de Pago Móvil */}
          <div className="rounded-xl border border-dashed border-red-500/30 bg-red-50/20 p-3.5 dark:border-red-500/20 dark:bg-red-950/10">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-[#E50914]" />
                <span>Código QR de Pago Móvil</span>
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pmState.pago_movil.showQr !== false}
                    onChange={(e) =>
                      setPmState((prev) => ({
                        ...prev,
                        pago_movil: { ...prev.pago_movil, showQr: e.target.checked },
                      }))
                    }
                    className="accent-[#E50914]"
                  />
                  <span>Mostrar QR</span>
                </label>
                {(pmState.pago_movil.qrImageUrl || pmState.pago_movil.iconUrl) && (
                  <button
                    type="button"
                    onClick={() =>
                      setPmState((prev) => ({
                        ...prev,
                        pago_movil: { ...prev.pago_movil, qrImageUrl: '', iconUrl: '' },
                      }))
                    }
                    className="text-[10px] font-semibold text-red-600 hover:underline"
                  >
                    Quitar QR
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2.5">
              {pmState.pago_movil.showQr !== false
                ? 'El código QR se mostrará en la taquilla para que los clientes escaneen directamente.'
                : 'QR desactivado: Los clientes verán los datos bancarios copiables (teléfono, cédula, banco) sin código QR.'}
            </p>
            {pmState.pago_movil.showQr !== false && (
              pmState.pago_movil.qrImageUrl || pmState.pago_movil.iconUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <img
                    src={pmState.pago_movil.qrImageUrl || pmState.pago_movil.iconUrl}
                    alt="QR Pago Móvil"
                    className="h-20 w-20 rounded-md border border-zinc-200 bg-white object-contain p-1 shadow-xs dark:border-zinc-700"
                  />
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> QR Activo en Taquilla
                    </span>
                    <label className="block text-[11px] font-semibold text-[#E50914] cursor-pointer hover:underline">
                      <span>Cambiar imagen de QR</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const url = await fileToValidatedDataUrl(f);
                            setPmState((prev) => ({
                              ...prev,
                              pago_movil: { ...prev.pago_movil, qrImageUrl: url, iconUrl: url },
                            }));
                            onNotify('Código QR de Pago Móvil actualizado.', 'success');
                          } catch (err: any) {
                            onNotify(err.message, 'error');
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-300 p-3 text-center dark:border-zinc-700">
                  <label className="inline-flex items-center gap-2 rounded-lg bg-[#E50914] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer hover:bg-[#c80812]">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Cargar Código QR de Pago Móvil</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const url = await fileToValidatedDataUrl(f);
                          setPmState((prev) => ({
                            ...prev,
                            pago_movil: { ...prev.pago_movil, qrImageUrl: url, iconUrl: url },
                          }));
                          onNotify('Código QR de Pago Móvil cargado exitosamente.', 'success');
                        } catch (err: any) {
                          onNotify(err.message, 'error');
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )
            )}
          </div>
        </div>

        {/* 3.2 Transferencia Bancaria */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              2. Transferencia Bancaria
            </h2>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={pmState.transferencia.enabled}
                onChange={(e) =>
                  setPmState({
                    ...pmState,
                    transferencia: { ...pmState.transferencia, enabled: e.target.checked },
                  })
                }
                className="accent-[#E50914]"
              />
              <span>{pmState.transferencia.enabled ? 'Activo' : 'Inactivo'}</span>
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Banco</label>
            <input
              type="text"
              value={pmState.transferencia.bank}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  transferencia: { ...pmState.transferencia, bank: e.target.value },
                })
              }
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Nombre del titular</label>
            <input
              type="text"
              value={pmState.transferencia.holderName}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  transferencia: { ...pmState.transferencia, holderName: e.target.value },
                })
              }
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Documento titular</label>
              <input
                type="text"
                value={pmState.transferencia.documentId}
                onChange={(e) =>
                  setPmState({
                    ...pmState,
                    transferencia: { ...pmState.transferencia, documentId: e.target.value },
                  })
                }
                className={`${inputCls} font-mono-tabular`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Tipo y Moneda</label>
              <input
                type="text"
                value={`${pmState.transferencia.accountType} (${pmState.transferencia.currency})`}
                onChange={(e) =>
                  setPmState({
                    ...pmState,
                    transferencia: { ...pmState.transferencia, accountType: e.target.value },
                  })
                }
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Número de cuenta (20 dígitos)</label>
            <input
              type="text"
              value={pmState.transferencia.accountNumber}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  transferencia: { ...pmState.transferencia, accountNumber: e.target.value },
                })
              }
              className={`${inputCls} font-mono-tabular`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Instrucciones de pago</label>
            <textarea
              rows={2}
              value={pmState.transferencia.instructions}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  transferencia: { ...pmState.transferencia, instructions: e.target.value },
                })
              }
              className={inputCls}
            />
          </div>
          {/* Transferencia QR opcional */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 space-y-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(pmState.transferencia.showQr)}
                  onChange={(e) =>
                    setPmState((prev) => ({
                      ...prev,
                      transferencia: { ...prev.transferencia, showQr: e.target.checked },
                    }))
                  }
                  className="accent-[#E50914]"
                />
                <span>Mostrar Código QR en Transferencias (Opcional)</span>
              </label>
              {pmState.transferencia.showQr && pmState.transferencia.qrImageUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setPmState((prev) => ({
                      ...prev,
                      transferencia: { ...prev.transferencia, qrImageUrl: '', iconUrl: '' },
                    }))
                  }
                  className="text-[10px] font-semibold text-red-600 hover:underline"
                >
                  Quitar QR
                </button>
              )}
            </div>
            {!pmState.transferencia.showQr ? (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-500 mr-1" />
                No es necesario código QR para transferencias. Los clientes copian directamente el número de cuenta de 20 dígitos y datos del titular.
              </p>
            ) : (
              <div className="pt-2">
                {pmState.transferencia.qrImageUrl ? (
                  <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <img
                      src={pmState.transferencia.qrImageUrl}
                      alt="QR Transferencia"
                      className="h-20 w-20 rounded-md border border-zinc-200 bg-white object-contain p-1 shadow-xs dark:border-zinc-700"
                    />
                    <label className="block text-[11px] font-semibold text-[#E50914] cursor-pointer hover:underline">
                      <span>Cambiar imagen de QR</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const url = await fileToValidatedDataUrl(f);
                            setPmState((prev) => ({
                              ...prev,
                              transferencia: { ...prev.transferencia, qrImageUrl: url, iconUrl: url },
                            }));
                            onNotify('QR de transferencia actualizado.', 'success');
                          } catch (err: any) {
                            onNotify(err.message, 'error');
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-3 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800/60">
                    <Upload className="h-4 w-4 text-zinc-400" />
                    <span className="mt-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Cargar QR opcional para transferencia
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const url = await fileToValidatedDataUrl(f);
                          setPmState((prev) => ({
                            ...prev,
                            transferencia: { ...prev.transferencia, qrImageUrl: url, iconUrl: url },
                          }));
                          onNotify('QR de transferencia cargado.', 'success');
                        } catch (err: any) {
                          onNotify(err.message, 'error');
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3.3 Binance */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">3. Binance</h2>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={pmState.binance.enabled}
                onChange={(e) =>
                  setPmState({
                    ...pmState,
                    binance: { ...pmState.binance, enabled: e.target.checked },
                  })
                }
                className="accent-[#E50914]"
              />
              <span>{pmState.binance.enabled ? 'Activo' : 'Inactivo'}</span>
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              Binance Pay ID o correo receptor
            </label>
            <input
              type="text"
              value={pmState.binance.payIdOrEmail}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  binance: { ...pmState.binance, payIdOrEmail: e.target.value },
                })
              }
              placeholder="Pay ID o correo verificado"
              className={`${inputCls} font-mono-tabular`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Red o activo admitido</label>
            <input
              type="text"
              value={pmState.binance.networkOrAsset}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  binance: { ...pmState.binance, networkOrAsset: e.target.value },
                })
              }
              placeholder="USDT · Binance Pay"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Instrucciones para el comprador</label>
            <textarea
              rows={3}
              value={pmState.binance.instructions}
              onChange={(e) =>
                setPmState({
                  ...pmState,
                  binance: { ...pmState.binance, instructions: e.target.value },
                })
              }
              placeholder="Indica qué colocar en la nota o cómo copiar el Order ID..."
              className={inputCls}
            />
          </div>
          {/* Carga del Código QR de Binance Pay */}
          <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-50/20 p-3.5 dark:border-amber-500/20 dark:bg-amber-950/10">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-amber-500" />
                <span>Código QR de Binance Pay</span>
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(pmState.binance.showQr)}
                    onChange={(e) =>
                      setPmState((prev) => ({
                        ...prev,
                        binance: { ...prev.binance, showQr: e.target.checked },
                      }))
                    }
                    className="accent-amber-500"
                  />
                  <span>Mostrar QR</span>
                </label>
                {(pmState.binance.qrImageUrl || pmState.binance.iconUrl) && (
                  <button
                    type="button"
                    onClick={() =>
                      setPmState((prev) => ({
                        ...prev,
                        binance: { ...prev.binance, qrImageUrl: '', iconUrl: '' },
                      }))
                    }
                    className="text-[10px] font-semibold text-red-600 hover:underline"
                  >
                    Quitar QR
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2.5">
              {pmState.binance.showQr
                ? 'El código QR de Binance Pay se mostrará en la taquilla para escanear directamente con la app de Binance.'
                : 'QR desactivado: Los clientes verán los datos copiables (Pay ID / Correo y Red) sin código QR.'}
            </p>
            {pmState.binance.showQr && (
              pmState.binance.qrImageUrl || pmState.binance.iconUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <img
                    src={pmState.binance.qrImageUrl || pmState.binance.iconUrl}
                    alt="QR Binance Pay"
                    className="h-20 w-20 rounded-md border border-zinc-200 bg-white object-contain p-1 shadow-xs dark:border-zinc-700"
                  />
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> QR Activo en Taquilla
                    </span>
                    <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 cursor-pointer hover:underline">
                      <span>Cambiar imagen de QR</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const url = await fileToValidatedDataUrl(f);
                            setPmState((prev) => ({
                              ...prev,
                              binance: { ...prev.binance, qrImageUrl: url, iconUrl: url },
                            }));
                            onNotify('Código QR de Binance Pay actualizado.', 'success');
                          } catch (err: any) {
                            onNotify(err.message, 'error');
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-3.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800/60 transition-colors">
                    <Upload className="h-5 w-5 text-zinc-400" />
                    <span className="mt-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Cargar Imagen del QR Binance Pay
                    </span>
                    <span className="text-[10px] text-zinc-400">PNG, JPG o WEBP</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const url = await fileToValidatedDataUrl(f);
                          setPmState((prev) => ({
                            ...prev,
                            binance: { ...prev.binance, qrImageUrl: url, iconUrl: url },
                          }));
                          onNotify('Código QR de Binance Pay cargado con éxito.', 'success');
                        } catch (err: any) {
                          onNotify(err.message, 'error');
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Live Preview: How buyers see the payment data on checkout */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-[#0D1017]">
        <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>Vista Previa: Así ven los compradores los datos al pagar entradas</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Paso 2 de Taquilla
              </span>
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Verifica que tus números y titulares sean legibles antes de guardar.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Pago Móvil Preview */}
          <div className={`rounded-xl border p-4 ${pmState.pago_movil.enabled ? 'border-red-500/30 bg-white dark:bg-zinc-900' : 'border-zinc-200 bg-zinc-100/50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 dark:text-white">Pago Móvil</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pmState.pago_movil.enabled ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                {pmState.pago_movil.enabled ? 'Se mostrará' : 'Oculto'}
              </span>
            </div>
            {pmState.pago_movil.enabled ? (
              <div className="mt-3 space-y-1.5 text-xs">
                <div>
                  <span className="text-zinc-400 block text-[10px]">Banco:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{pmState.pago_movil.bank || '(Sin banco)'}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Teléfono:</span>
                  <span className="font-mono-tabular font-bold text-[#E50914]">{pmState.pago_movil.phone || '(Sin teléfono)'}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Cédula / RIF:</span>
                  <span className="font-mono-tabular font-semibold text-zinc-800 dark:text-zinc-200">{pmState.pago_movil.documentId || '(Sin documento)'}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Titular:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{pmState.pago_movil.holderName || '(Sin titular)'}</span>
                </div>
                {pmState.pago_movil.instructions && (
                  <p className="mt-2 text-[11px] italic text-zinc-500 border-t border-zinc-100 pt-1 dark:border-zinc-800">
                    "{pmState.pago_movil.instructions}"
                  </p>
                )}
                {pmState.pago_movil.qrImageUrl || pmState.pago_movil.iconUrl ? (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-1.5 dark:border-zinc-800 dark:bg-zinc-800/60">
                    <img
                      src={pmState.pago_movil.qrImageUrl || pmState.pago_movil.iconUrl}
                      alt="QR Pago Móvil"
                      className="h-12 w-12 rounded object-contain bg-white p-0.5 border border-zinc-200 dark:border-zinc-700"
                    />
                    <div className="text-[10px]">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> QR Cargado
                      </span>
                      <span className="text-zinc-500">Se mostrará en checkout</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">
                    ⚠️ Sin imagen de QR cargada (carga una arriba para escaneo directo).
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-400 italic">Desactivado · Los clientes no verán esta opción en el carrito.</p>
            )}
          </div>

          {/* Transferencia Bancaria Preview */}
          <div className={`rounded-xl border p-4 ${pmState.transferencia.enabled ? 'border-red-500/30 bg-white dark:bg-zinc-900' : 'border-zinc-200 bg-zinc-100/50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 dark:text-white">Transferencia</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pmState.transferencia.enabled ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                {pmState.transferencia.enabled ? 'Se mostrará' : 'Oculto'}
              </span>
            </div>
            {pmState.transferencia.enabled ? (
              <div className="mt-3 space-y-1.5 text-xs">
                <div>
                  <span className="text-zinc-400 block text-[10px]">Banco:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{pmState.transferencia.bank || '(Sin banco)'}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Cuenta (20 dígitos):</span>
                  <span className="font-mono-tabular font-bold text-zinc-800 dark:text-zinc-200 break-all">{pmState.transferencia.accountNumber || '(Sin cuenta)'}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Titular y Cédula:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{pmState.transferencia.holderName} · {pmState.transferencia.documentId}</span>
                </div>
                {pmState.transferencia.instructions && (
                  <p className="mt-2 text-[11px] italic text-zinc-500 border-t border-zinc-100 pt-1 dark:border-zinc-800">
                    "{pmState.transferencia.instructions}"
                  </p>
                )}
                <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/40 text-[10px] text-zinc-600 dark:text-zinc-400">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span>Sin código QR en taquilla (los compradores solo copian el número de cuenta).</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-400 italic">Desactivado · Los clientes no verán esta opción en el carrito.</p>
            )}
          </div>

          {/* Binance Pay Preview */}
          <div className={`rounded-xl border p-4 ${pmState.binance.enabled ? 'border-red-500/30 bg-white dark:bg-zinc-900' : 'border-zinc-200 bg-zinc-100/50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 dark:text-white">Binance Pay</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pmState.binance.enabled ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                {pmState.binance.enabled ? 'Se mostrará' : 'Oculto'}
              </span>
            </div>
            {pmState.binance.enabled ? (
              <div className="mt-3 space-y-1.5 text-xs">
                <div>
                  <span className="text-zinc-400 block text-[10px]">Pay ID o Correo:</span>
                  <span className="font-mono-tabular font-bold text-amber-600 dark:text-amber-400">{pmState.binance.payIdOrEmail || '(Sin Pay ID)'}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Red / Activo:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{pmState.binance.networkOrAsset || 'USDT'}</span>
                </div>
                {pmState.binance.instructions && (
                  <p className="mt-2 text-[11px] italic text-zinc-500 border-t border-zinc-100 pt-1 dark:border-zinc-800">
                    "{pmState.binance.instructions}"
                  </p>
                )}
                {pmState.binance.qrImageUrl || pmState.binance.iconUrl ? (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-1.5 dark:border-zinc-800 dark:bg-zinc-800/60">
                    <img
                      src={pmState.binance.qrImageUrl || pmState.binance.iconUrl}
                      alt="QR Binance Pay"
                      className="h-12 w-12 rounded object-contain bg-white p-0.5 border border-zinc-200 dark:border-zinc-700"
                    />
                    <div className="text-[10px]">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> QR Binance Cargado
                      </span>
                      <span className="text-zinc-500">Se mostrará en checkout</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">
                    ⚠️ Sin imagen de QR cargada (carga una arriba para escaneo directo).
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-400 italic">Desactivado · Los clientes no verán esta opción en el carrito.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Save Action Bar */}
      <div className="flex items-center justify-end gap-3 pt-3">
        <button
          type="submit"
          disabled={savingPm}
          className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-6 py-3 text-xs font-semibold text-white shadow-md transition-all hover:bg-[#c80812] disabled:opacity-50 whitespace-nowrap"
        >
          {savingPm ? (
            <span>Guardando en Servidor...</span>
          ) : (
            <>
              <Check className="h-4 w-4" />
              <span>Guardar Todos los Métodos de Pago</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
