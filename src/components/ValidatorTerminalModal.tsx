import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  LogOut,
  Upload,
  X,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ValidatorTerminalModalProps {
  open: boolean;
  onClose?: () => void;
  standalonePage?: boolean;
}

interface ValidatorSession {
  serverUrl: string;
  token: string;
  userName: string;
  userEmail: string;
  events: {
    id: string;
    title: string;
    date: string;
    time: string;
    city: string;
    venue: string;
    paidConfirmedTickets: number;
    validatedAtDoorCount: number;
    unusedValidTicketsCount: number;
  }[];
}

export const ValidatorTerminalModal: React.FC<ValidatorTerminalModalProps> = ({
  open,
  onClose,
  standalonePage = false,
}) => {
  const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const [serverInput, setServerInput] = useState<string>(() => {
    try {
      return localStorage.getItem('lv_validador_server') || defaultOrigin;
    } catch {
      return defaultOrigin;
    }
  });
  const [emailInput, setEmailInput] = useState<string>(() => {
    try {
      return localStorage.getItem('lv_validador_email') || '';
    } catch {
      return '';
    }
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [session, setSession] = useState<ValidatorSession | null>(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState<{
    allowed: boolean;
    status: string;
    message: string;
    code: string;
    eventTitle: string;
  } | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      stopScannerCamera();
    }
    return () => stopScannerCamera();
  }, [open]);

  if (!open) return null;

  const normalizeServerUrl = (raw: string): string => {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (!trimmed) return defaultOrigin;
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setConnecting(true);

    const baseUrl = normalizeServerUrl(serverInput);
    try {
      const resp = await fetch(`${baseUrl}/api/validator/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: emailInput.trim(),
          email: emailInput.trim(),
          password: passwordInput,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.token) {
        throw new Error(data.error || 'No se pudo conectar con el servidor del Validador.');
      }

      try {
        localStorage.setItem('lv_validador_server', baseUrl);
        localStorage.setItem('lv_validador_email', emailInput.trim());
      } catch {
        // Ignore storage write error
      }

      setSession({
        serverUrl: baseUrl,
        token: data.token,
        userName: data.user?.name || 'Administrador',
        userEmail: data.user?.email || emailInput.trim(),
        events: Array.isArray(data.events) ? data.events : [],
      });
      setPasswordInput('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error de red al conectar con el servidor especificado.');
    } finally {
      setConnecting(false);
    }
  };

  const refreshEvents = async (activeSession: ValidatorSession) => {
    try {
      const resp = await fetch(`${activeSession.serverUrl}/api/validator/events`, {
        headers: { Authorization: `Bearer ${activeSession.token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.events)) {
          setSession((prev) => (prev ? { ...prev, events: data.events } : prev));
        }
      }
    } catch {
      // Ignore refresh error
    }
  };

  const performRemoteScan = async (rawQr: string) => {
    if (!session || !rawQr.trim()) return;
    try {
      const resp = await fetch(`${session.serverUrl}/api/validator/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          qr: rawQr.trim(),
          code: rawQr.trim(),
          eventId: selectedEventId,
          deviceLabel: `Validador (${session.userName})`,
        }),
      });
      const data = await resp.json();
      setScanResult({
        allowed: Boolean(data.allowed),
        status: String(data.log?.result || data.status || (data.allowed ? 'ENTRADA_VALIDA' : 'RECHAZADA')),
        message: String(data.log?.message || data.error || 'Respuesta procesada.'),
        code: String(data.log?.ticketCode || rawQr.trim()),
        eventTitle: String(data.log?.eventTitle || ''),
      });
      await refreshEvents(session);
    } catch (err: any) {
      setScanResult({
        allowed: false,
        status: 'ERROR_CONEXION',
        message: err?.message || 'Sin respuesta del servidor.',
        code: rawQr.trim(),
        eventTitle: '',
      });
    }
  };

  const stopScannerCamera = () => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startScannerCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 80);

      const Detector = (window as any).BarcodeDetector;
      if (Detector) {
        const detector = new Detector({ formats: ['qr_code'] });
        scanTimerRef.current = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              stopScannerCamera();
              performRemoteScan(codes[0].rawValue);
            }
          } catch {
            // Ignore frame error
          }
        }, 450);
      }
    } catch {
      setErrorMsg('No se pudo acceder a la cámara del dispositivo. Usa lector de imagen o código manual.');
    }
  };

  const scanFromImage = async (file: File) => {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setErrorMsg('Este navegador no soporta detección QR por archivo; ingresa el código LV-XXXX debajo.');
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new Detector({ formats: ['qr_code'] });
      const codes = await detector.detect(bitmap);
      if (codes && codes.length > 0 && codes[0].rawValue) {
        await performRemoteScan(codes[0].rawValue);
      } else {
        setErrorMsg('No se detectó un código QR nítido en la imagen seleccionada.');
      }
    } catch {
      setErrorMsg('No se pudo analizar la imagen.');
    }
  };

  return (
    <div
      className={`${
        standalonePage ? 'min-h-screen' : 'fixed inset-0 z-50 overflow-y-auto'
      } flex flex-col items-center justify-center bg-black px-5 py-8 text-white`}
    >
      {!standalonePage && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar Validador"
          className="fixed top-4 right-4 z-50 rounded-xl border border-white/15 bg-zinc-950/90 p-2.5 text-zinc-400 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* =========================================================
          SCREEN 1: EXACT "VALIDADOR" SERVER + CREDENTIALS CONNECTOR
          (Matches WhatsApp_Image_2026-10-31_at_7.02.36_AM)
      ========================================================= */}
      {!session ? (
        <div className="w-full max-w-[390px] py-4">
          <div className="flex flex-col items-center text-center">
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full p-1 shadow-[0_0_45px_rgba(229,9,20,0.55)]">
              <img
                src="/assets/lv-logo.png"
                alt="LA VUELTA SESSIONS"
                className="h-full w-full rounded-full border-2 border-white object-contain"
              />
            </div>

            <h1 className="mt-6 font-sans text-3xl font-extrabold tracking-[0.18em] text-white">
              VALIDADOR
            </h1>
            <p className="mt-2 text-sm text-zinc-400">Acceso solo para administradores</p>
          </div>

          <form onSubmit={handleConnect} className="mt-9 space-y-5">
            <div>
              <label className="mb-2 block text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                SERVIDOR
              </label>
              <input
                type="url"
                required
                value={serverInput}
                onChange={(e) => setServerInput(e.target.value)}
                placeholder="https://tu-servidor.com"
                className="w-full rounded-xl border border-zinc-800 bg-[#121214] px-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:border-[#E50914] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                CORREO
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="lavueltassessionsoficial@gmail.com"
                className="w-full rounded-xl border border-zinc-800 bg-[#121214] px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:border-[#E50914] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                CONTRASEÑA
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-zinc-800 bg-[#121214] px-4 py-3.5 pr-11 text-sm text-white placeholder-zinc-600 focus:border-[#E50914] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300"
                  aria-label="Mostrar u ocultar contraseña"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-xs text-red-200">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={connecting}
              className="mt-2 w-full rounded-xl bg-[#E50914] py-4 text-sm font-bold tracking-widest text-white uppercase transition-colors hover:bg-[#c80812] disabled:opacity-50"
            >
              {connecting ? 'CONECTANDO...' : 'ENTRAR'}
            </button>
          </form>
        </div>
      ) : (
        /* =========================================================
           SCREEN 2: CONNECTED MOBILE DOOR SCANNER
        ========================================================= */
        <div className="w-full max-w-md space-y-5 py-4">
          <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-[#101014] p-4">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/assets/lv-logo.png"
                alt="LV"
                className="h-11 w-11 shrink-0 rounded-full border border-white/20 object-contain"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">VALIDADOR ACTIVO</p>
                <p className="truncate font-mono-tabular text-[11px] text-zinc-400">
                  {session.serverUrl}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                stopScannerCamera();
                setSession(null);
                setScanResult(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Salir</span>
            </button>
          </div>

          {/* Event Filter & Live Counters */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-4 space-y-3">
            <label className="block text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
              SESIÓN EN PUERTA
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-black px-3.5 py-3 text-sm text-white focus:border-[#E50914] focus:outline-none"
            >
              <option value="">Todas las sesiones activas</option>
              {session.events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} · {ev.date}
                </option>
              ))}
            </select>

            {(() => {
              const targetList = selectedEventId
                ? session.events.filter((e) => e.id === selectedEventId)
                : session.events;
              const issued = targetList.reduce((a, b) => a + b.paidConfirmedTickets, 0);
              const validated = targetList.reduce((a, b) => a + b.validatedAtDoorCount, 0);
              const remaining = targetList.reduce((a, b) => a + b.unusedValidTicketsCount, 0);
              return (
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="rounded-xl bg-black p-2.5 border border-zinc-800/80">
                    <p className="font-mono-tabular text-lg font-bold text-white">{issued}</p>
                    <p className="text-[10px] text-zinc-400">Emitidas</p>
                  </div>
                  <div className="rounded-xl bg-black p-2.5 border border-zinc-800/80">
                    <p className="font-mono-tabular text-lg font-bold text-emerald-400">
                      {validated}
                    </p>
                    <p className="text-[10px] text-zinc-400">Adentro</p>
                  </div>
                  <div className="rounded-xl bg-black p-2.5 border border-zinc-800/80">
                    <p className="font-mono-tabular text-lg font-bold text-[#D4AF37]">
                      {remaining}
                    </p>
                    <p className="text-[10px] text-zinc-400">Por Entrar</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Camera & Manual Trigger */}
          <div className="rounded-2xl border border-zinc-800 bg-[#101014] p-4 space-y-4">
            <div className="flex gap-2">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startScannerCamera}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E50914] py-3.5 text-xs font-bold tracking-wider text-white uppercase hover:bg-[#c80812]"
                >
                  <Camera className="h-4 w-4" />
                  <span>ESCANEAR QR</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScannerCamera}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-800 py-3.5 text-xs font-bold text-white uppercase"
                >
                  <CameraOff className="h-4 w-4" />
                  <span>DETENER</span>
                </button>
              )}

              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-black px-4 py-3.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-900">
                <Upload className="h-4 w-4" />
                <span>Imagen</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) scanFromImage(f);
                  }}
                />
              </label>
            </div>

            {cameraActive && (
              <div className="relative h-64 overflow-hidden rounded-xl border border-zinc-700 bg-black">
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                <div className="pointer-events-none absolute inset-7 rounded-xl border-2 border-[#E50914]/80" />
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                performRemoteScan(manualCode);
                setManualCode('');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Código LV-XXXX o LVS1..."
                className="flex-1 rounded-xl border border-zinc-800 bg-black px-3.5 py-3 font-mono-tabular text-sm text-white placeholder-zinc-600 focus:border-[#E50914] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-white px-4 py-3 text-xs font-bold text-black hover:bg-zinc-200"
              >
                VALIDAR
              </button>
            </form>
          </div>

          {scanResult && (
            <div
              className={`rounded-2xl border-2 p-5 ${
                scanResult.allowed
                  ? 'border-emerald-500 bg-emerald-950/70 text-emerald-100'
                  : 'border-red-500 bg-red-950/70 text-red-100'
              }`}
            >
              <div className="flex items-center gap-2.5 text-lg font-extrabold">
                {scanResult.allowed ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400 shrink-0" />
                )}
                <span>{scanResult.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="mt-1.5 text-sm">{scanResult.message}</p>
              <p className="mt-2 font-mono-tabular text-xs opacity-80">
                Ticket: {scanResult.code}
                {scanResult.eventTitle ? ` · ${scanResult.eventTitle}` : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
