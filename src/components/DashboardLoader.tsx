import { useEffect, useId, useRef, useState } from "react";
import { Bus, Check, ShieldCheck } from "lucide-react";

export interface DashboardLoaderProps {
  /** Se ejecuta una vez por montaje, después de 2.5 s + 300 ms de cierre. */
  onComplete?: () => void;
  /** Usa el mismo archivo que el LoginPage. */
  logoSrc?: string;
  nombreCompleto?: string;
}

const DURATION_MS = 2500;
const COMPLETION_HOLD_MS = 300;
const STATUS = [
  "Credenciales verificadas",
  "Preparando tu espacio de trabajo…",
  "Abriendo tu panel de gestión…",
  "¡Bienvenido a Transportes JJR!",
] as const;

const styles = `
  @keyframes jjr-splash-enter {
    from { opacity: 0; transform: translateY(12px) scale(.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes jjr-splash-glow {
    0%, 100% { opacity: .35; transform: scale(.95); }
    50% { opacity: .65; transform: scale(1.06); }
  }
  @keyframes jjr-splash-progress {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }
  @keyframes jjr-splash-route {
    to { stroke-dashoffset: -180; }
  }
  @keyframes jjr-splash-streak {
    from { transform: translateX(-100%); opacity: 0; }
    20%, 70% { opacity: .5; }
    to { transform: translateX(450%); opacity: 0; }
  }
  .jjr-splash .jjr-splash-enter {
    animation: jjr-splash-enter .75s cubic-bezier(.22,1,.36,1) both;
  }
  .jjr-splash .jjr-splash-glow {
    animation: jjr-splash-glow 2.8s ease-in-out infinite;
  }
  .jjr-splash .jjr-splash-fill {
    transform-origin: left;
    animation: jjr-splash-progress 2500ms cubic-bezier(.333333,0,.666667,1) both;
  }
  .jjr-splash .jjr-splash-route {
    stroke-dasharray: 8 22;
    animation: jjr-splash-route 6s linear infinite;
  }
  .jjr-splash .jjr-splash-streak {
    animation: jjr-splash-streak 4s linear infinite;
  }
  .jjr-splash .jjr-splash-status {
    animation: jjr-splash-enter .28s ease-out both;
  }
  .jjr-splash[data-complete="true"] .jjr-splash-glow,
  .jjr-splash[data-complete="true"] .jjr-splash-route,
  .jjr-splash[data-complete="true"] .jjr-splash-streak {
    animation-play-state: paused;
  }
  @media (prefers-reduced-motion: reduce) {
    .jjr-splash *, .jjr-splash *::before, .jjr-splash *::after {
      animation: none !important;
      transition: none !important;
    }
    .jjr-splash .jjr-splash-streak { display: none; }
  }
  @media (forced-colors: active) {
    .jjr-splash .jjr-splash-track { border: 1px solid CanvasText; }
    .jjr-splash .jjr-splash-fill { background: Highlight; }
  }
`;

/**
 * Transición visual posterior a la autenticación, no progreso de una petición.
 * Montar solamente después de que /Auth/login y el guardado de sesión tengan éxito.
 * El padre debe desmontarla o navegar en onComplete. No valida permisos ni tokens.
 */
export default function DashboardLoader({
  onComplete,
  logoSrc = "/images/Logo (1).png",
  nombreCompleto,
}: DashboardLoaderProps) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const callbackRef = useRef(onComplete);
  const completedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // Un callback inline nuevo no reinicia el reloj.
  useEffect(() => { callbackRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - startedAt) / DURATION_MS);
      // La misma curva suave que cubic-bezier(1/3, 0, 2/3, 1) del CSS.
      setProgress(Math.min(99, Math.round((3 * t * t - 2 * t * t * t) * 100)));
    }, 50);
    const finish = window.setTimeout(() => {
      window.clearInterval(interval);
      setProgress(100);
    }, DURATION_MS);
    const complete = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      callbackRef.current?.();
    }, DURATION_MS + COMPLETION_HOLD_MS);

    // Evita callbacks tardíos y temporizadores duplicados bajo React StrictMode.
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(finish);
      window.clearTimeout(complete);
    };
  }, []);

  const phase = progress < 30 ? 0 : progress < 65 ? 1 : progress < 92 ? 2 : 3;
  // Sin movimiento: avance discreto; ni zoom, ni pulso, ni desplazamientos.
  const visibleProgress = reducedMotion
    ? (progress === 100 ? 100 : [0, 30, 65, 92][phase])
    : progress;
  const isComplete = progress === 100;

  return (
    <main
      className="jjr-splash relative isolate flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#062443] px-6 py-10 font-sans text-white sm:px-10"
      data-complete={isComplete}
      aria-labelledby={`${id}-title`}
    >
      <style>{styles}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_50%_35%,#102D50_0%,#062443_55%,#03172D_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-52 -right-52 -z-10 size-[600px] rounded-full bg-[#075BC6]/10 blur-[100px]" />

      <svg aria-hidden="true" focusable="false" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 -z-10 size-full opacity-20">
        <g fill="none" strokeWidth="1">
          <path d="M-150 770 C230 760 200 420 620 480 S1160 780 1570 180" stroke="#00A3E0" />
          <path d="M-150 795 C230 785 200 445 620 505 S1160 805 1570 205" stroke="#00A3E0" className="jjr-splash-route" />
          <path d="M-100 300 C250 120 340 370 730 245 S1100 100 1500 280" stroke="#F5B000" opacity=".4" />
          <path d="M-100 320 C250 140 340 390 730 265 S1100 120 1500 300" stroke="#F5B000" className="jjr-splash-route" opacity=".5" />
        </g>
        <g fill="#00A3E0"><circle cx="620" cy="480" r="4" /><circle cx="1130" cy="588" r="3" /></g>
        <circle cx="730" cy="245" r="4" fill="#F5B000" />
      </svg>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[19%] -z-10 overflow-hidden">
        <div className="jjr-splash-streak h-px w-1/3 bg-[linear-gradient(90deg,transparent,#00A3E0,transparent)]" />
      </div>

      <section className="relative w-full max-w-[420px] text-center">
        <p className="jjr-splash-enter mb-9 flex items-center justify-center gap-2 text-[10px] font-semibold tracking-[0.24em] text-slate-300 uppercase">
          <span className="size-1.5 rounded-full bg-[#F5B000]" /> Transportes JJR S.A.C.
        </p>

        <div className="jjr-splash-enter relative mx-auto w-[230px] max-w-full sm:w-[280px]">
          <div aria-hidden="true" className="jjr-splash-glow pointer-events-none absolute -inset-6 -z-10 rounded-full bg-[radial-gradient(ellipse,rgba(0,163,224,0.45),rgba(245,176,0,0.08)_50%,transparent_70%)] blur-2xl" />
          <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-[#F8FAFC] px-4 py-1 shadow-[0_20px_70px_-20px_rgba(0,163,224,0.4)]">
            {logoFailed ? (
              <div className="flex aspect-[3/2] items-center justify-center gap-3 text-[#102D50]"><Bus size={42} aria-hidden="true" /><span className="text-5xl font-black italic">JJR</span></div>
            ) : (
              <img src={logoSrc} alt="JJR Empresa de Transportes" width={1536} height={1024} onError={() => setLogoFailed(true)} fetchPriority="high" className="block h-auto w-full object-contain" />
            )}
          </div>
        </div>

        <div className="jjr-splash-enter mt-9" style={{ animationDelay: "120ms" }}>
          <h1 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="text-[clamp(1.6rem,5vw,2.1rem)] leading-tight font-semibold tracking-tight outline-none">Tu próximo destino,<br /><span className="text-[#F5B000]">todo bajo control.</span></h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{nombreCompleto?.trim() ? `Qué gusto verte, ${nombreCompleto.trim()}.` : "Seguridad y puntualidad en cada viaje."}</p>
        </div>

        <div className="jjr-splash-enter mt-10" style={{ animationDelay: "180ms" }}>
          <div className="mb-3 flex items-center justify-between text-[10px] font-semibold tracking-[0.16em] text-slate-300 uppercase">
            <span id={`${id}-progress-label`}>Accediendo al Dashboard</span>
            <span aria-hidden="true" className="text-[#F5B000] tabular-nums">{visibleProgress}%</span>
          </div>
          <div
            role="progressbar"
            aria-labelledby={`${id}-progress-label`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={visibleProgress}
            aria-valuetext={`${visibleProgress}%. ${STATUS[phase]}`}
            aria-busy={!isComplete}
            className="jjr-splash-track h-1.5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10"
          >
            <div className="jjr-splash-fill h-full w-full rounded-full bg-[linear-gradient(90deg,#F5B000_0%,#F9D477_35%,#75D4DF_70%,#00A3E0_100%)]" style={{ transform: `scaleX(${visibleProgress / 100})` }} />
          </div>
          {/* Fuera del contenedor aria-busy para anunciar cada etapa a tiempo. */}
          <div role="status" aria-live="polite" aria-atomic="true" className="mt-5 min-h-12 text-sm leading-6 text-slate-200">
            <p key={phase} className="jjr-splash-status flex items-start justify-center gap-2">
              {phase === 3 && <Check size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[#F5B000]" />}
              {STATUS[phase]}
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-10 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-slate-400 sm:mt-14">
        <ShieldCheck size={15} aria-hidden="true" className="shrink-0 text-[#00A3E0]" />
        <span>Personas, negocios y oportunidades. Siempre conectados.</span>
      </footer>
    </main>
  );
}
