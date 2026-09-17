import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { isAxiosError } from "axios";
import {
  AlertCircle, ArrowRight, Bus, CheckCircle2, Eye, EyeOff,
  LoaderCircle, Lock, Package, ShieldCheck, User,
} from "lucide-react";
import axiosClient from "../api/axiosClient";
import DashboardLoader from '../components/DashboardLoader';
export interface LoginResponse {
  token: string;
  nombreCompleto: string;
  rol: string;
}

interface LoginPageProps {
  /** Ruta interna de destino si no se proporciona onSuccess. */
  redirectTo?: string;
  /** Copia las imágenes proporcionadas dentro de public/images/. */
  logoSrc?: string;
  backgroundSrc?: string;
  /** Conecta aquí tu flujo real de recuperación, si existe. */
  onForgotPassword?: () => void;
  /** Se ejecuta DESPUÉS del splash. Actualiza aquí tu AuthContext y navega. */
  onSuccess?: (session: LoginResponse) => void;
}

const animations = `
  @keyframes jjr-enter {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes jjr-scenery {
    from { transform: scale(1.055); opacity: .6; }
    to { transform: scale(1); opacity: 1; }
  }
  @keyframes jjr-line {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }
  .jjr-login .jjr-enter { animation: jjr-enter .7s cubic-bezier(.22,1,.36,1) both; }
  .jjr-login .jjr-delay-1 { animation-delay: .12s; }
  .jjr-login .jjr-delay-2 { animation-delay: .22s; }
  .jjr-login .jjr-scenery { animation: jjr-scenery 1.8s ease-out both; }
  .jjr-login .jjr-line { transform-origin: left; animation: jjr-line 1s .35s ease-out both; }
  .jjr-login .jjr-error { animation: jjr-enter .25s ease-out both; }
  @media (prefers-reduced-motion: reduce) {
    .jjr-login *, .jjr-login *::before, .jjr-login *::after {
      animation: none !important; transition: none !important;
    }
  }
`;

const REMEMBERED_USERNAME_KEY = "jjr.rememberedUsername";

function isLoginResponse(value: unknown): value is LoginResponse {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.token === "string" && data.token.trim().length > 0
    && typeof data.nombreCompleto === "string" && typeof data.rol === "string";
}

export default function LoginPage({
  redirectTo = "/",
  onSuccess,
  logoSrc = "/images/Logo (1).png",
  backgroundSrc = "/images/Camioneta.png",
  onForgotPassword,
}: LoginPageProps) {
  const id = useId();
  const submitting = useRef(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [authenticatedSession, setAuthenticatedSession] = useState<LoginResponse | null>(null);
  const [rememberUsername, setRememberUsername] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const remembered = localStorage.getItem(REMEMBERED_USERNAME_KEY);
      if (remembered) {
        setUsername(remembered);
        setRememberUsername(true);
      }
    } catch { /* Recordar usuario es opcional. */ }
    return () => requestRef.current?.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || success) return;
    setError("");
    if (!username.trim() || !password) {
      setError("Ingresa tu usuario y contraseña para continuar.");
      return;
    }

    submitting.current = true;
    setLoading(true);
    const controller = new AbortController();
    requestRef.current = controller;
    let session: LoginResponse;
    try {
      const { data } = await axiosClient.post<unknown>(
        "/Auth/login",
        { username: username.trim(), password },
        { timeout: 15000, signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (!isLoginResponse(data)) {
        setError("El servidor devolvió una respuesta inesperada. Inténtalo nuevamente.");
        return;
      }
      session = data;

      // Conserva la sesión anterior si alguna escritura falla.
      try {
        const previousToken = localStorage.getItem("token");
        const previousUser = localStorage.getItem("user");
        try {
          localStorage.setItem("user", JSON.stringify({
            nombreCompleto: session.nombreCompleto,
            rol: session.rol,
          }));
          localStorage.setItem("token", session.token);
        } catch (storageError) {
          for (const [key, value] of [
            ["token", previousToken], ["user", previousUser],
          ] as const) {
            try {
              if (value === null) localStorage.removeItem(key);
              else localStorage.setItem(key, value);
            } catch { /* El navegador puede bloquear todo acceso. */ }
          }
          throw storageError;
        }
      } catch {
        setError("No se pudo guardar tu sesión. Habilita el almacenamiento del navegador e inténtalo otra vez.");
        return;
      }
    } catch (cause: unknown) {
      if (controller.signal.aborted) return;
      if (isAxiosError(cause)) {
        const status = cause.response?.status;
        setError(status === 401 || status === 403
          ? "Usuario o contraseña incorrectos. Verifica tus datos."
          : status === 429
            ? "Demasiados intentos. Espera un momento antes de volver a intentar."
            : !cause.response
              ? "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo nuevamente."
              : "No pudimos iniciar sesión. Inténtalo nuevamente en unos momentos.");
      } else {
        setError("Ocurrió un error inesperado. Inténtalo nuevamente.");
      }
      return;
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setLoading(false);
    }

    try {
      if (rememberUsername) localStorage.setItem(REMEMBERED_USERNAME_KEY, username.trim());
      else localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    } catch { /* No impide el inicio de sesión. */ }
    setPassword("");
    setSuccess(true);
    setAuthenticatedSession(session);
  }

  function handleSplashComplete() {
    if (!authenticatedSession) return;
    if (onSuccess) onSuccess(authenticatedSession);
    else {
      let destination = "/";
      try {
        const url = new URL(redirectTo, window.location.origin);
        if (url.origin === window.location.origin) destination = url.href;
      } catch { /* Ruta inválida: vuelve al inicio. */ }
      window.location.replace(destination);
    }
  }

  const busy = loading || success;
  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3.5 pl-12 pr-4 text-base text-[#1E293B] outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00A3E0] focus:bg-white focus:ring-4 focus:ring-[#00A3E0]/15 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

  if (authenticatedSession) {
    return (
      <DashboardLoader
        logoSrc={logoSrc}
        nombreCompleto={authenticatedSession.nombreCompleto}
        onComplete={handleSplashComplete}
      />
    );
  }

  return (
    <main className="jjr-login flex min-h-dvh items-center justify-center bg-[#F1F5FA] p-0 font-sans text-[#1E293B] sm:p-6 xl:p-10">
      <style>{animations}</style>
      <div className="jjr-enter grid w-full max-w-[1180px] overflow-hidden bg-white shadow-[0_28px_100px_-30px_rgba(15,35,75,0.3)] sm:rounded-[28px] lg:min-h-[760px] lg:grid-cols-[1fr_1.02fr]">
        <section aria-label="Transportes JJR: conectamos destinos" className="relative isolate flex min-h-[290px] flex-col overflow-hidden bg-[#062443] px-7 py-8 text-white sm:px-10 lg:min-h-[760px] lg:px-12 lg:py-11">
          <img src={backgroundSrc} alt="" className="jjr-scenery absolute inset-0 -z-20 size-full object-cover object-[68%_58%]" fetchPriority="high" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(3,22,45,0.12)_0%,rgba(3,24,49,0.48)_35%,rgba(3,24,49,0.6)_65%,#041E39_100%)]" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(3,22,45,0.5),transparent_85%)]" />
          <p className="jjr-enter flex items-center gap-2 text-[10px] font-semibold tracking-[0.23em] text-white/90 uppercase">
            <span className="h-1.5 w-5 rounded-full bg-[#F5B000]" /> Transportes JJR S.A.C.
          </p>
          <div className="jjr-enter jjr-delay-1 mt-10 lg:mt-36">
            <h1 className="max-w-[370px] text-[clamp(2rem,4.3vw,3.5rem)] leading-[1.08] font-bold tracking-[-0.045em] [text-shadow:0_2px_18px_rgba(0,0,0,0.25)]">
              Más que<br />transporte,<br />conectamos<br className="hidden lg:block" /> <span className="text-[#F5B000]">destinos.</span>
            </h1>
          </div>
          <div className="jjr-enter jjr-delay-2 mt-auto hidden pt-12 lg:block">
            <ul aria-label="Nuestros servicios y compromiso" className="grid max-w-[330px] grid-cols-3 gap-3">
              {[
                { icon: Bus, label: "Pasajeros" },
                { icon: Package, label: "Encomiendas" },
                { icon: ShieldCheck, label: "Seguridad" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="group flex flex-col items-center gap-2.5 text-xs text-white/90">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 transition duration-300 group-hover:-translate-y-1 group-hover:border-[#F5B000]/60 group-hover:bg-white/10 motion-reduce:transform-none"><Icon size={23} strokeWidth={1.5} aria-hidden="true" /></span>
                  {label}
                </li>
              ))}
            </ul>
            <div className="jjr-line mt-9 h-0.5 w-28 rounded-full bg-[linear-gradient(90deg,#F5B000_75%,rgba(245,176,0,0.15)_75%)]" />
            <p className="mt-4 max-w-[270px] text-sm leading-6 text-slate-200">Rutas que unen personas,<br />negocios y oportunidades.</p>
          </div>
        </section>

        <section aria-labelledby={`${id}-title`} className="relative flex flex-col justify-center bg-[radial-gradient(ellipse_at_top_right,#EDF5FC_0%,#FFFFFF_60%)] px-7 py-10 sm:px-12 lg:px-16 lg:py-12">
          <div className="mx-auto w-full max-w-[380px]">
            <img src={logoSrc} alt="JJR Empresa de Transportes. Seguridad y puntualidad en cada viaje." width={1536} height={1024} className="jjr-enter mx-auto mb-5 block h-auto w-[250px] max-w-full object-contain sm:w-[280px]" />
            <div className="jjr-enter jjr-delay-1">
              <h2 id={`${id}-title`} className="text-[34px] leading-tight font-bold tracking-[-0.04em] text-[#102D50]">Bienvenido</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Inicia sesión para continuar.</p>
            </div>

            <form onSubmit={handleSubmit} aria-busy={loading} className="jjr-enter jjr-delay-2 mt-7 space-y-5">
              <div>
                <label htmlFor={`${id}-username`} className="mb-2 block text-xs font-semibold text-[#344C68]">Usuario</label>
                <div className="group relative">
                  <User aria-hidden="true" size={19} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#00A3E0]" />
                  <input id={`${id}-username`} name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={busy} value={username} onChange={(event) => { setUsername(event.target.value); setError(""); }} placeholder="Ingresa tu usuario" className={inputClass} aria-describedby={error ? `${id}-error` : undefined} />
                </div>
              </div>
              <div>
                <label htmlFor={`${id}-password`} className="mb-2 block text-xs font-semibold text-[#344C68]">Contraseña</label>
                <div className="group relative">
                  <Lock aria-hidden="true" size={19} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#00A3E0]" />
                  <input id={`${id}-password`} name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required disabled={busy} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))} onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)} placeholder="Ingresa tu contraseña" className={`${inputClass} pr-14`} aria-describedby={[error ? `${id}-error` : "", capsLock ? `${id}-caps` : ""].filter(Boolean).join(" ") || undefined} />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} disabled={busy} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-controls={`${id}-password`} aria-pressed={showPassword} className="absolute top-1/2 right-1.5 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-sky-50 hover:text-[#1E2A78] focus-visible:outline-2 focus-visible:outline-[#00A3E0] disabled:cursor-not-allowed">
                    {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                  </button>
                </div>
                {capsLock && <p id={`${id}-caps`} role="status" className="mt-2 text-xs text-amber-800">Bloq Mayús está activado.</p>}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-slate-600">
                  <input type="checkbox" checked={rememberUsername} disabled={busy} onChange={(event) => {
                    const checked = event.target.checked;
                    setRememberUsername(checked);
                    if (!checked) {
                      try { localStorage.removeItem(REMEMBERED_USERNAME_KEY); } catch { /* Opcional. */ }
                    }
                  }} className="size-4 cursor-pointer rounded accent-[#1E2A78] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A3E0]" />
                  Recordar usuario
                </label>
                <button type="button" disabled={busy} aria-expanded={onForgotPassword ? undefined : showHelp} aria-controls={onForgotPassword ? undefined : `${id}-help`} onClick={() => onForgotPassword ? onForgotPassword() : setShowHelp((visible) => !visible)} className="min-h-11 cursor-pointer rounded px-1 font-semibold text-[#1E2A78] transition-colors hover:text-[#007AA8] focus-visible:outline-2 focus-visible:outline-[#00A3E0] disabled:opacity-60">¿Olvidaste tu contraseña?</button>
              </div>
              {showHelp && <p id={`${id}-help`} className="jjr-error rounded-xl border border-sky-100 bg-sky-50 p-3.5 text-sm leading-6 text-[#1E2A78]">Contacta al administrador de Transportes JJR para restablecer tu acceso.</p>}

              <div aria-live="polite" aria-atomic="true">
                {error && <div id={`${id}-error`} className="jjr-error flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-5 text-red-800"><AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0" /><p>{error}</p></div>}
                {success && <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={18} aria-hidden="true" /> Sesión iniciada correctamente.</p>}
              </div>
              <button type="submit" disabled={busy} className="group relative flex min-h-13 w-full cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-xl bg-[linear-gradient(110deg,#1E2A78,#075BC6)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_22px_-8px_rgba(7,91,198,0.55)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-7px_rgba(0,163,224,0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00A3E0] active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transform-none">
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#00A3E0]/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative">{loading ? "Iniciando sesión…" : success ? "Sesión iniciada" : "Ingresar"}</span>
                {loading ? <LoaderCircle size={19} aria-hidden="true" className="relative animate-spin" /> : success ? <CheckCircle2 size={19} aria-hidden="true" /> : <ArrowRight size={19} aria-hidden="true" className="relative transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none" />}
              </button>
            </form>

            <footer className="jjr-enter jjr-delay-2 mt-9 border-t border-slate-200/70 pt-6 text-center">
              <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><ShieldCheck size={14} aria-hidden="true" /> Acceso exclusivo para personal autorizado</p>
              <p className="mt-4 text-[11px] text-slate-500">© {new Date().getFullYear()} Transportes JJR S.A.C.</p>
              <p className="mt-1 text-[10px] text-slate-500">Seguridad y puntualidad en cada viaje.</p>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
