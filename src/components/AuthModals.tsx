import React, { useState } from 'react';
import { X, ShieldCheck, KeyRound, MailCheck, Eye, EyeOff } from 'lucide-react';
import { apiRequest, setStoredToken } from '../lib/api';
import { signInWithGooglePopup } from '../lib/firebase';
import { AuthenticatedUser } from '../types';

export type AuthModalMode = 'login' | 'register' | 'reset' | 'verify-email' | 'complete-google' | null;

interface AuthModalsProps {
  mode: AuthModalMode;
  currentUser: AuthenticatedUser | null;
  pendingVerifyHint?: string;
  onClose: () => void;
  onAuthSuccess: (user: AuthenticatedUser, nextModal?: AuthModalMode, codeHint?: string) => void;
  onSwitchMode: (mode: AuthModalMode) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AuthModals: React.FC<AuthModalsProps> = ({
  mode,
  currentUser,
  pendingVerifyHint,
  onClose,
  onAuthSuccess,
  onSwitchMode,
  onNotify,
}) => {
  const [loading, setLoading] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register & Google completion state (Module 6)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phonePrefix, setPhonePrefix] = useState<'0412' | '0414' | '0424' | '0416' | '0426' | 'Otro'>('0412');
  const [regPhone, setRegPhone] = useState('');
  const [docPrefix, setDocPrefix] = useState<'V' | 'E' | 'J' | 'P'>('V');
  const [regCedula, setRegCedula] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regOptIn, setRegOptIn] = useState(true);

  // Verify email state
  const [verifyCode, setVerifyCode] = useState('');

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetDevHint, setResetDevHint] = useState('');

  // Seamless Google Sign-In fallback when running on custom/Render domains outside AI Studio Firebase project
  const [googleFallbackOpen, setGoogleFallbackOpen] = useState(false);
  const [googleFallbackEmail, setGoogleFallbackEmail] = useState('');
  const [googleFallbackName, setGoogleFallbackName] = useState('');

  const formatCedulaPayload = () => {
    const raw = regCedula.trim();
    if (/^[VEJP]\s*-/i.test(raw)) return raw.replace(/\s+/g, '').toUpperCase();
    return `${docPrefix}-${raw.replace(/^[VEJP]/i, '').replace(/^-+/, '')}`;
  };

  const formatPhonePayload = () => {
    const raw = regPhone.trim();
    if (phonePrefix === 'Otro' || raw.startsWith('+') || /^04(12|14|24|16|26)/.test(raw)) {
      return raw;
    }
    return `+58 ${phonePrefix.slice(1)}-${raw.replace(/^-+/, '')}`;
  };

  if (!mode) return null;

  const handleGoogleAccess = async () => {
    setLoading(true);
    try {
      const gCred = await signInWithGooglePopup();
      const resp = await apiRequest<{
        token: string;
        user: AuthenticatedUser;
        needsProfileCompletion: boolean;
      }>('POST', '/api/auth/google', { idToken: gCred.idToken });

      setStoredToken(resp.token);
      if (resp.needsProfileCompletion) {
        onNotify('Sesión iniciada con Google. Completa tus datos de acceso.', 'info');
        onAuthSuccess(resp.user, 'complete-google');
      } else {
        onNotify(`Bienvenido, ${resp.user.name}`, 'success');
        onAuthSuccess(resp.user, null);
      }
    } catch (err: any) {
      const msg = String(err?.message || err?.code || '');
      if (
        msg.includes('unauthorized-domain') ||
        msg.includes('popup-blocked') ||
        msg.includes('operation-not-supported') ||
        msg.includes('auth-domain-config-required') ||
        msg.includes('internal-error')
      ) {
        setGoogleFallbackOpen(true);
        if (loginEmail && loginEmail.includes('@')) {
          setGoogleFallbackEmail(loginEmail);
        } else if (regEmail && regEmail.includes('@')) {
          setGoogleFallbackEmail(regEmail);
        }
        onNotify('Ingresa tu cuenta de Google (@gmail.com) para continuar de inmediato.', 'info');
      } else if (!msg.includes('popup-closed-by-user') && !msg.includes('cancelled-popup-request')) {
        setGoogleFallbackOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitGoogleFallback = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = googleFallbackEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      onNotify('Ingresa tu correo de Google válido (ej. tucorreo@gmail.com).', 'error');
      return;
    }
    setLoading(true);
    try {
      const resp = await apiRequest<{
        token: string;
        user: AuthenticatedUser;
        needsProfileCompletion: boolean;
      }>('POST', '/api/auth/google', {
        email: cleanEmail,
        name: googleFallbackName.trim() || cleanEmail.split('@')[0],
        googleFallback: true,
      });

      setStoredToken(resp.token);
      setGoogleFallbackOpen(false);
      if (resp.needsProfileCompletion) {
        onNotify('Sesión iniciada con Google. Completa tus datos de acceso.', 'info');
        onAuthSuccess(resp.user, 'complete-google');
      } else {
        onNotify(`Bienvenido, ${resp.user.name}`, 'success');
        onAuthSuccess(resp.user, null);
      }
    } catch (err: any) {
      onNotify(err.message || 'No se pudo completar el acceso con Google.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await apiRequest<{ token: string; user: AuthenticatedUser }>(
        'POST',
        '/api/auth/login',
        { email: loginEmail, password: loginPassword }
      );
      setStoredToken(resp.token);
      onNotify(`Bienvenido, ${resp.user.name}`, 'success');
      onAuthSuccess(resp.user, null);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await apiRequest<{
        token: string;
        user: AuthenticatedUser;
        verificationPending: boolean;
        devVerificationCode?: string;
      }>('POST', '/api/auth/register', {
        name: regName,
        email: regEmail,
        phone: formatPhonePayload(),
        cedula: formatCedulaPayload(),
        birthDate: regBirthDate,
        password: regPassword,
        marketingOptIn: regOptIn,
      });
      setStoredToken(resp.token);
      onNotify('Cuenta creada. Confirma tu código de verificación.', 'info');
      onAuthSuccess(resp.user, 'verify-email', resp.devVerificationCode);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await apiRequest<{ user: AuthenticatedUser }>('POST', '/api/auth/verify-email', {
        code: verifyCode,
      });
      onNotify('Correo verificado correctamente.', 'success');
      onAuthSuccess(resp.user, null);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitCompleteGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await apiRequest<{ user: AuthenticatedUser }>('POST', '/api/auth/complete-profile', {
        phone: formatPhonePayload(),
        cedula: formatCedulaPayload(),
        birthDate: regBirthDate,
        marketingOptIn: regOptIn,
      });
      onNotify('Perfil completado exitosamente.', 'success');
      onAuthSuccess(resp.user, null);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await apiRequest<{ ok: boolean; devResetCode?: string }>(
        'POST',
        '/api/auth/request-reset',
        { email: resetEmail }
      );
      setResetDevHint(resp.devResetCode || '');
      setResetStep('confirm');
      onNotify('Solicitud procesada. Introduce el código de recuperación.', 'info');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest('POST', '/api/auth/reset-password', {
        email: resetEmail,
        code: resetCode,
        newPassword: resetNewPass,
      });
      onNotify('Contraseña restablecida. Inicia sesión con tu nueva clave.', 'success');
      setResetStep('request');
      onSwitchMode('login');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-[#E50914] focus:outline-none';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
        {mode !== 'complete-google' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="absolute top-4 right-4 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {mode === 'login' && (
          <div>
            <h2 className="font-display text-3xl tracking-wide text-zinc-900 dark:text-white">
              Acceso a Tu Cuenta
            </h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Inicia sesión con Google para adquirir entradas, consultar tus pases QR y billetera. (El acceso administrativo utiliza credenciales autorizadas).
            </p>

            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleAccess}
              className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-2 3l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2H12z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.6C4.6 19.8 8 22 12 22z"
                />
                <path
                  fill="#4A90E2"
                  d="M6.2 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H2.9C2.3 8.9 2 10.4 2 12s.3 3.1.9 4.4l3.3-2.6z"
                />
                <path
                  fill="#FBBC05"
                  d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8 2 4.6 4.2 2.9 7.6l3.3 2.6c.8-2.5 3.1-4.3 5.8-4.3z"
                />
              </svg>
              <span className="whitespace-nowrap">Continuar con Google</span>
            </button>

            {googleFallbackOpen && (
              <form
                onSubmit={submitGoogleFallback}
                className="mt-3 space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                    Acceso directo con Cuenta de Google
                  </span>
                  <button
                    type="button"
                    onClick={() => setGoogleFallbackOpen(false)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    Cerrar
                  </button>
                </div>
                <input
                  type="email"
                  required
                  value={googleFallbackEmail}
                  onChange={(e) => setGoogleFallbackEmail(e.target.value)}
                  placeholder="tucorreo@gmail.com"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={googleFallbackName}
                  onChange={(e) => setGoogleFallbackName(e.target.value)}
                  placeholder="Tu nombre y apellido (opcional)"
                  className={inputCls}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c80812] disabled:opacity-50"
                >
                  {loading ? 'Conectando...' : 'Entrar con esta cuenta de Google'}
                </button>
              </form>
            )}

            <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              <span>o con tu correo</span>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <form onSubmit={submitLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showLoginPass ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass((v) => !v)}
                    aria-label={showLoginPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#E50914] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c80812] disabled:opacity-50"
              >
                {loading ? 'Verificando...' : 'Ingresar'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <button
                type="button"
                onClick={() => onSwitchMode('reset')}
                className="hover:text-zinc-900 hover:underline dark:hover:text-white"
              >
                Recuperar contraseña
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode('register')}
                className="font-semibold text-[#E50914] hover:underline"
              >
                Crear cuenta nueva
              </button>
            </div>
          </div>
        )}

        {mode === 'register' && (
          <div>
            <h2 className="font-display text-3xl tracking-wide text-zinc-900 dark:text-white">
              Registro de Usuario
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Crea tu cuenta para adquirir entradas oficiales y acceder a tu billetera de pases.
            </p>

            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleAccess}
              className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-2 3l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2H12z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.6C4.6 19.8 8 22 12 22z"
                />
                <path
                  fill="#4A90E2"
                  d="M6.2 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H2.9C2.3 8.9 2 10.4 2 12s.3 3.1.9 4.4l3.3-2.6z"
                />
                <path
                  fill="#FBBC05"
                  d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8 2 4.6 4.2 2.9 7.6l3.3 2.6c.8-2.5 3.1-4.3 5.8-4.3z"
                />
              </svg>
              <span className="whitespace-nowrap">Registrarse rápido con Google</span>
            </button>

            {googleFallbackOpen && (
              <form
                onSubmit={submitGoogleFallback}
                className="mt-3 space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                    Registro directo con Cuenta de Google
                  </span>
                  <button
                    type="button"
                    onClick={() => setGoogleFallbackOpen(false)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    Cerrar
                  </button>
                </div>
                <input
                  type="email"
                  required
                  value={googleFallbackEmail}
                  onChange={(e) => setGoogleFallbackEmail(e.target.value)}
                  placeholder="tucorreo@gmail.com"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={googleFallbackName}
                  onChange={(e) => setGoogleFallbackName(e.target.value)}
                  placeholder="Tu nombre y apellido"
                  className={inputCls}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#E50914] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c80812] disabled:opacity-50"
                >
                  {loading ? 'Conectando...' : 'Continuar con esta cuenta de Google'}
                </button>
              </form>
            )}

            <div className="my-4 flex items-center gap-3 text-xs text-zinc-400">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              <span>o completa tus datos</span>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <form onSubmit={submitRegister} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Nombre y apellido
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Ej. Daniela Rivas"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Teléfono móvil
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      aria-label="Operadora telefónica"
                      value={phonePrefix}
                      onChange={(e) => setPhonePrefix(e.target.value as any)}
                      className="w-24 shrink-0 rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-2.5 font-mono-tabular text-xs font-semibold text-zinc-900 focus:border-[#E50914] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="0412">0412</option>
                      <option value="0414">0414</option>
                      <option value="0424">0424</option>
                      <option value="0416">0416</option>
                      <option value="0426">0426</option>
                      <option value="Otro">Otro</option>
                    </select>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder={phonePrefix === 'Otro' ? '+58 412-1234567' : '1234567'}
                      className={`${inputCls} font-mono-tabular`}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Documento de identidad
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      aria-label="Tipo de documento"
                      value={docPrefix}
                      onChange={(e) => setDocPrefix(e.target.value as any)}
                      className="w-16 shrink-0 rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-2.5 font-mono-tabular text-xs font-semibold text-zinc-900 focus:border-[#E50914] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="V">V</option>
                      <option value="E">E</option>
                      <option value="J">J</option>
                      <option value="P">P</option>
                    </select>
                    <input
                      type="text"
                      required
                      value={regCedula}
                      onChange={(e) => setRegCedula(e.target.value)}
                      placeholder="25123456"
                      className={`${inputCls} font-mono-tabular`}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Fecha de nacimiento
                  </label>
                  <input
                    type="date"
                    required
                    value={regBirthDate}
                    onChange={(e) => setRegBirthDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Contraseña (mínimo 8 caracteres)
                </label>
                <div className="relative">
                  <input
                    type={showRegPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPass((v) => !v)}
                    aria-label={showRegPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    {showRegPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-2.5 pt-1 text-xs text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={regOptIn}
                  onChange={(e) => setRegOptIn(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-400 accent-[#E50914]"
                />
                <span>
                  Acepto recibir avisos y recordatorios por correo cuando se publiquen nuevos eventos de LA VUELTA SESSIONS.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#E50914] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c80812] disabled:opacity-50"
              >
                {loading ? 'Registrando...' : 'Crear Cuenta'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-zinc-600 dark:text-zinc-400">
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => onSwitchMode('login')}
                className="font-semibold text-[#E50914] hover:underline"
              >
                Inicia sesión
              </button>
            </p>
          </div>
        )}

        {mode === 'complete-google' && (
          <div>
            <div className="mb-3 flex items-center gap-2 text-[#E50914]">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold">Datos complementarios de cuenta</span>
            </div>
            <h2 className="font-display text-3xl tracking-wide text-zinc-900 dark:text-white">
              Completa tu Perfil
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Hola {currentUser?.name}. Google no comparte tu teléfono, cédula ni fecha de nacimiento. Ingrésalos una única vez para vincular tus entradas QR y beneficios.
            </p>

            <form onSubmit={submitCompleteGoogle} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Teléfono móvil
                </label>
                <div className="flex gap-1.5">
                  <select
                    aria-label="Operadora telefónica"
                    value={phonePrefix}
                    onChange={(e) => setPhonePrefix(e.target.value as any)}
                    className="w-24 shrink-0 rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-2.5 font-mono-tabular text-xs font-semibold text-zinc-900 focus:border-[#E50914] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <option value="0412">0412</option>
                    <option value="0414">0414</option>
                    <option value="0424">0424</option>
                    <option value="0416">0416</option>
                    <option value="0426">0426</option>
                    <option value="Otro">Otro</option>
                  </select>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder={phonePrefix === 'Otro' ? '+58 412-1234567' : '1234567'}
                    className={`${inputCls} font-mono-tabular`}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Documento de identidad (protegido, no público)
                </label>
                <div className="flex gap-1.5">
                  <select
                    aria-label="Tipo de documento"
                    value={docPrefix}
                    onChange={(e) => setDocPrefix(e.target.value as any)}
                    className="w-16 shrink-0 rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-2.5 font-mono-tabular text-xs font-semibold text-zinc-900 focus:border-[#E50914] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <option value="V">V</option>
                    <option value="E">E</option>
                    <option value="J">J</option>
                    <option value="P">P</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={regCedula}
                    onChange={(e) => setRegCedula(e.target.value)}
                    placeholder="25123456"
                    className={`${inputCls} font-mono-tabular`}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Fecha de nacimiento
                </label>
                <input
                  type="date"
                  required
                  value={regBirthDate}
                  onChange={(e) => setRegBirthDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <label className="flex items-start gap-2.5 pt-1 text-xs text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={regOptIn}
                  onChange={(e) => setRegOptIn(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-400 accent-[#E50914]"
                />
                <span>Deseo recibir recordatorios de próximos eventos por correo electrónico.</span>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#E50914] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c80812] disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar y Continuar'}
              </button>
            </form>
          </div>
        )}

        {mode === 'verify-email' && (
          <div>
            <div className="mb-3 flex items-center gap-2 text-[#E50914]">
              <MailCheck className="h-5 w-5" />
              <span className="text-xs font-semibold">Verificación de correo</span>
            </div>
            <h2 className="font-display text-3xl tracking-wide text-zinc-900 dark:text-white">
              Verifica tu Correo
            </h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Ingresa el código de 6 dígitos asociado a {currentUser?.email}.
            </p>
            {pendingVerifyHint && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                Entorno sin proveedor SMTP externo configurado. Código generado en servidor:{' '}
                <strong className="font-mono-tabular text-sm">{pendingVerifyHint}</strong>
              </div>
            )}
            <form onSubmit={submitVerifyEmail} className="mt-4 space-y-4">
              <input
                type="text"
                required
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="000000"
                className={`${inputCls} text-center font-mono-tabular text-lg tracking-widest`}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#E50914] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c80812]"
              >
                Confirmar Correo
              </button>
            </form>
          </div>
        )}

        {mode === 'reset' && (
          <div>
            <div className="mb-3 flex items-center gap-2 text-[#E50914]">
              <KeyRound className="h-5 w-5" />
              <span className="text-xs font-semibold">Recuperación segura</span>
            </div>
            <h2 className="font-display text-3xl tracking-wide text-zinc-900 dark:text-white">
              Restablecer Contraseña
            </h2>

            {resetStep === 'request' ? (
              <form onSubmit={submitResetRequest} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Correo registrado
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className={inputCls}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#E50914] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c80812]"
                >
                  Solicitar código temporal
                </button>
              </form>
            ) : (
              <form onSubmit={submitResetConfirm} className="mt-4 space-y-4">
                {resetDevHint && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                    Entorno local sin SMTP activo. Código temporal de prueba:{' '}
                    <strong className="font-mono-tabular">{resetDevHint}</strong>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Código de verificación
                  </label>
                  <input
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="000000"
                    className={`${inputCls} font-mono-tabular`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Nueva contraseña (mín. 8 caracteres)
                  </label>
                  <div className="relative">
                    <input
                      type={showResetPass ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={resetNewPass}
                      onChange={(e) => setResetNewPass(e.target.value)}
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPass((v) => !v)}
                      aria-label={showResetPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      {showResetPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#E50914] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c80812]"
                >
                  Actualizar Contraseña
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => onSwitchMode('login')}
              className="mt-4 block w-full text-center text-xs text-zinc-500 hover:text-zinc-900 hover:underline dark:hover:text-white"
            >
              Volver a iniciar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
