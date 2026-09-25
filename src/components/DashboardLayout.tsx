import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownLeft, ArrowRight, BarChart3, Bell, BrainCircuit, Bus, Check,
  ChevronDown, ChevronRight, ClipboardList, Clock3,
  Handshake, LayoutDashboard, LogOut, Menu, Package,
  ReceiptText, Search, Settings, ShieldCheck, Ticket, UserRound,
  Users, Wallet, Wrench, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ModuleId =
  | "inicio" | "viajes" | "pasajes" | "encomiendas" | "flota" | "conductores"
  | "socios" | "clientes" | "comprobantes" | "nomina" | "usuarios" | "tesoreria"
  | "liquidaciones" | "egresos" | "reportes" | "predicciones" | "configuracion";

export interface NavigationItem {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  href: string;
}

/** Configuración de navegación del panel con categorías */
export const DASHBOARD_NAVIGATION: { category: string; items: NavigationItem[] }[] = [
  { category: "General", items: [
    { id: "inicio", label: "Inicio", icon: LayoutDashboard, href: "/dashboard" },
  ] },
  { category: "Operativa", items: [
    { id: "viajes", label: "Viajes", icon: Bus, href: "/viajes" },
    { id: "pasajes", label: "Pasajes", icon: Ticket, href: "/pasajes" },
    { id: "encomiendas", label: "Encomiendas", icon: Package, href: "/encomiendas" },
  ] },
  { category: "Flota & personal", items: [
    { id: "flota", label: "Flota", icon: Bus, href: "/flota" },
    { id: "conductores", label: "Conductores", icon: UserRound, href: "/conductores" },
    { id: "socios", label: "Socios inversionistas", icon: Handshake, href: "/socios" },
  ] },
  { category: "Comercial & SUNAT", items: [
    { id: "clientes", label: "Clientes", icon: Users, href: "/clientes" },
    { id: "comprobantes", label: "Comprobantes", icon: ReceiptText, href: "/comprobantes" },
  ] },
  { category: "Gestión humana", items: [
    { id: "nomina", label: "Contratos & nómina", icon: ClipboardList, href: "/nomina" },
    { id: "usuarios", label: "Usuarios & Recepcionistas", icon: Users, href: "/usuarios" },
  ] },
  { category: "Finanzas", items: [
    { id: "tesoreria", label: "Tesorería", icon: Wallet, href: "/tesoreria" },
    { id: "liquidaciones", label: "Liquidación socios", icon: Handshake, href: "/liquidaciones" },
    { id: "egresos", label: "Egresos operativos", icon: ArrowDownLeft, href: "/egresos" },
  ] },
  { category: "Reportes e IA", items: [
    { id: "reportes", label: "Reportes financieros", icon: BarChart3, href: "/reportes" },
    { id: "predicciones", label: "Predicciones IA", icon: BrainCircuit, href: "/predicciones" },
  ] },
  { category: "Sistema", items: [
    { id: "configuracion", label: "Configuración", icon: Settings, href: "/configuracion" },
  ] },
];

export interface DashboardUser { nombreCompleto: string; rol: string; avatarUrl?: string }
export interface ActivityEvent {
  id: string;
  type: "viaje" | "encomienda" | "pasaje" | "mantenimiento";
  title: string;
  description: string;
  occurredAt: string;
  status: string;
  href?: string;
}
export interface DashboardData {
  counts: { viajes: number; pasajes: number; encomiendas: number; flota: number };
  fleet: { onRoute: number; inWorkshop: number; outOfService: number };
  activities: ActivityEvent[];
  updatedAt?: string;
}
export interface DashboardNotification {
  id: string; title: string; detail: string; read: boolean; href?: string;
}
export interface DashboardSearchResult { id: string; title: string; subtitle?: string; href: string }
export interface DashboardLayoutProps {
  user?: DashboardUser;
  data?: DashboardData;
  notifications?: DashboardNotification[];
  activeModule?: ModuleId;
  allowedModules?: ModuleId[];
  routes?: Partial<Record<ModuleId, string>>;
  logoSrc?: string;
  bannerSrc?: string;
  newEncomiendaHref?: string;
  activityHref?: string;
  securityHref?: string;
  loginHref?: string;
  onNavigate?: (href: string) => void;
  onLogout?: () => void | Promise<void>;
  onReadNotification?: (id: string) => void;
  onSearch?: (query: string, signal: AbortSignal) => Promise<DashboardSearchResult[]>;
  children?: ReactNode;
}

const DEMO_DATA: DashboardData = {
  counts: { viajes: 12, pasajes: 86, encomiendas: 24, flota: 8 },
  fleet: { onRoute: 4, inWorkshop: 3, outOfService: 1 },
  activities: [
    { id: "demo-1", type: "viaje", title: "Nuevo viaje registrado", description: "Trujillo → Chiclayo · Turno mañana", occurredAt: "2026-09-09T08:15:00-05:00", status: "Programado" },
    { id: "demo-2", type: "encomienda", title: "Encomienda entregada", description: "Guía ENC-00128 · Entrega en agencia", occurredAt: "2026-09-09T11:20:00-05:00", status: "Entregado" },
    { id: "demo-3", type: "pasaje", title: "Venta de pasaje", description: "Trujillo → Lima · Asiento 12", occurredAt: "2026-09-09T12:05:00-05:00", status: "Confirmado" },
    { id: "demo-4", type: "mantenimiento", title: "Mantenimiento programado", description: "Unidad JJR-008 · Revisión preventiva", occurredAt: "2026-09-09T14:30:00-05:00", status: "Pendiente" },
  ],
};

const ACTIVITY_STYLE = {
  viaje: { icon: Bus, color: "bg-blue-50 text-[#075BC6]", badge: "bg-blue-50 text-blue-800" },
  encomienda: { icon: Package, color: "bg-amber-50 text-amber-700", badge: "bg-emerald-50 text-emerald-800" },
  pasaje: { icon: Ticket, color: "bg-emerald-50 text-emerald-700", badge: "bg-emerald-50 text-emerald-800" },
  mantenimiento: { icon: Wrench, color: "bg-violet-50 text-violet-700", badge: "bg-amber-50 text-amber-800" },
};

const QUICK_CARDS = [
  { id: "viajes", label: "Viajes", caption: "Salidas programadas", icon: Bus, color: "bg-blue-50 text-[#075BC6]" },
  { id: "pasajes", label: "Pasajes", caption: "Ventas y reservas", icon: Ticket, color: "bg-amber-50 text-amber-700" },
  { id: "encomiendas", label: "Encomiendas", caption: "Guías y seguimiento", icon: Package, color: "bg-emerald-50 text-emerald-700" },
  { id: "flota", label: "Flota", caption: "Unidades registradas", icon: Bus, color: "bg-violet-50 text-violet-700" },
] as const;

const css = `
  @keyframes jjr-dashboard-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes jjr-dashboard-badge { 0%,100% { box-shadow: 0 0 0 0 rgba(245,176,0,.4); } 65% { box-shadow: 0 0 0 5px rgba(245,176,0,0); } }
  .jjr-dashboard .jjr-panel { animation: jjr-dashboard-enter .5s cubic-bezier(.22,1,.36,1) both; }
  .jjr-dashboard .jjr-badge { animation: jjr-dashboard-badge 1.6s ease-out 3; }
  .jjr-dashboard .jjr-scroll { scrollbar-width: thin; scrollbar-color: #37516b transparent; }
  .jjr-dashboard dialog::backdrop { background: rgba(3,20,38,.65); backdrop-filter: blur(3px); }
  @media (prefers-reduced-motion: reduce) { .jjr-dashboard *, .jjr-dashboard *::before, .jjr-dashboard *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
`;

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00A3E0]";
const number = (n: number) => new Intl.NumberFormat("es-PE").format(Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
const count = (n: number) => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function getStoredUser(): DashboardUser {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("user") || "null");
    if (value && typeof value === "object" && "nombreCompleto" in value && "rol" in value
      && typeof value.nombreCompleto === "string" && typeof value.rol === "string") {
      return { nombreCompleto: value.nombreCompleto, rol: value.rol };
    }
  } catch { /* El padre puede proporcionar user sin usar almacenamiento local. */ }
  return { nombreCompleto: "Usuario JJR", rol: "Colaborador" };
}

function safeHref(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u0020\u007f]/.test(value) ? value : "/dashboard";
}

function Avatar({ user }: { user: DashboardUser }) {
  const [failed, setFailed] = useState(false);
  const initials = user.nombreCompleto.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "JJ";
  return <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-[#102D50]">
    {user.avatarUrl && !failed ? <img src={user.avatarUrl} alt="" onError={() => setFailed(true)} className="size-full object-cover" /> : <span aria-hidden="true">{initials}</span>}
  </span>;
}

function FleetDonut({ fleet }: { fleet: DashboardData["fleet"] }) {
  const id = useId();
  const items = [
    { name: "En ruta", value: count(fleet.onRoute), color: "#059669" },
    { name: "En taller", value: count(fleet.inWorkshop), color: "#075BC6" },
    { name: "Fuera de servicio", value: count(fleet.outOfService), color: "#94A3B8" },
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  return <div className="flex flex-wrap items-center justify-center gap-6 py-5 sm:gap-8">
    <div className="relative size-[172px] shrink-0">
      <svg viewBox="0 0 180 180" role="img" aria-labelledby={`${id}-title ${id}-desc`} className="size-full -rotate-90">
        <title id={`${id}-title`}>{`Estado de la flota: ${total} vehículos`}</title>
        <desc id={`${id}-desc`}>{items.map(item => `${item.name}: ${item.value}`).join(". ")}</desc>
        <circle cx="90" cy="90" r="66" fill="none" stroke="#E2E8F0" strokeWidth="25" />
        {items.map(item => {
          const percent = total ? item.value / total * 100 : 0;
          const start = offset; offset += percent;
          return percent > 0 ? <circle key={item.name} cx="90" cy="90" r="66" pathLength="100" fill="none" stroke={item.color} strokeWidth="25" strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={-start} className="transition-[stroke-dasharray,stroke-dashoffset] duration-500" /> : null;
        })}
      </svg>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-3xl font-bold tracking-tight text-[#102D50]">{number(total)}</strong><span className="mt-1 text-xs text-slate-500">{total === 1 ? "Vehículo" : "Vehículos"}</span></div>
    </div>
    <ul className="min-w-[160px] flex-1 space-y-5">
      {items.map(item => <li key={item.name} className="flex items-center gap-2.5 text-xs"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="flex-1 text-slate-600">{item.name}</span><strong className="text-[#102D50] tabular-nums">{number(item.value)}</strong></li>)}
      {!total && <li className="text-xs text-slate-500">Aún no hay unidades registradas.</li>}
    </ul>
  </div>;
}

function DashboardLink({ href, children, className, label, current, onNavigate, onFollow }: {
  href: string; children: ReactNode; className?: string; label?: string; current?: boolean;
  onNavigate?: (href: string) => void; onFollow: () => void;
}) {
  return <a href={safeHref(href)} aria-label={label} aria-current={current ? "page" : undefined}
    className={`${focus} ${className ?? ""}`} onClick={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      onFollow();
      if (onNavigate) { event.preventDefault(); onNavigate(safeHref(href)); }
    }}>{children}</a>;
}

export default function DashboardLayout({
  user: suppliedUser, data, notifications = [], activeModule = "inicio", allowedModules,
  routes, logoSrc = "/images/Logo (1).png", bannerSrc = "/images/Dash (1).png",
  newEncomiendaHref = "/encomiendas/nueva", activityHref = "/actividad",
  securityHref = "/configuracion/seguridad", loginHref = "/login",
  onNavigate, onLogout, onReadNotification, onSearch, children,
}: DashboardLayoutProps) {
  const [storedUser] = useState(getStoredUser);
  const user = suppliedUser ?? storedUser;
  const values = data ?? DEMO_DATA;
  const uid = useId();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const profileRef = useRef<HTMLDetailsElement>(null);
  const notificationsRef = useRef<HTMLDetailsElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<DashboardSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  // Lógica de Permisos según el Rol
  const permitted = (id: ModuleId) => {
    if (allowedModules) return allowedModules.includes(id);

    // Módulos permitidos estrictamente para Recepcionistas
    if (user.rol === "Recepcionista") {
      const recepcionistaPermitidos: ModuleId[] = [
        "viajes",
        "pasajes",
        "encomiendas",
        "clientes",
        "reportes",
        "predicciones",
      ];
      return recepcionistaPermitidos.includes(id);
    }

    // Administrador, Gerente y otros roles mantienen acceso total
    return true;
  };

  const moduleHref = (id: ModuleId) => safeHref(routes?.[id] ?? DASHBOARD_NAVIGATION.flatMap(group => group.items).find(item => item.id === id)!.href);
  const unread = notifications.filter(item => !item.read && !readIds.has(item.id)).length;

  useEffect(() => {
    const close = (event: PointerEvent) => {
      for (const ref of [profileRef, notificationsRef]) {
        if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
      }
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSearchOpen(false);
      for (const ref of [profileRef, notificationsRef]) {
        if (ref.current?.open) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); }
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const close = () => { if (media.matches) drawerRef.current?.close(); };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [drawerOpen]);

  useEffect(() => {
    const controller = new AbortController();
    const text = query.trim();
    setResults([]); setSearchError("");
    if (!text) { setSearching(false); return () => controller.abort(); }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const matches = onSearch ? await onSearch(text, controller.signal) : DASHBOARD_NAVIGATION
          .flatMap(group => group.items)
          .filter(item => permitted(item.id) && item.label.toLocaleLowerCase("es").includes(text.toLocaleLowerCase("es")))
          .map(item => ({ id: item.id, title: item.label, subtitle: "Módulo del sistema", href: routes?.[item.id] ?? item.href }));
        if (!controller.signal.aborted) setResults(matches.slice(0, 8));
      } catch {
        if (!controller.signal.aborted) setSearchError("No se pudo completar la búsqueda. Inténtalo nuevamente.");
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, onSearch, allowedModules, routes, user.rol]);

  function closePanels() {
    drawerRef.current?.close(); setSearchOpen(false);
    if (profileRef.current) profileRef.current.open = false;
    if (notificationsRef.current) notificationsRef.current.open = false;
  }
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true); setLogoutError("");
    try {
      await onLogout?.();
      localStorage.removeItem("token"); localStorage.removeItem("user");
      if (onNavigate) onNavigate(safeHref(loginHref));
      else window.location.replace(safeHref(loginHref));
    } catch { setLogoutError("No se pudo cerrar la sesión. Inténtalo nuevamente."); setLoggingOut(false); }
  }

  function renderSidebar(mobile: boolean) {
    return <div className="flex h-full min-h-0 flex-col bg-[#062443] text-white">
      <div className="relative flex h-[118px] shrink-0 items-center justify-center border-b border-white/10 px-7">
        {logoFailed ? <p className="text-3xl font-black italic">JJR <span className="text-xs font-normal not-italic">Transportes</span></p> : <img src={logoSrc} alt="JJR Empresa de Transportes" onError={() => setLogoFailed(true)} className="h-24 w-full object-contain" />}
        {mobile && <button type="button" aria-label="Cerrar menú principal" onClick={() => drawerRef.current?.close()} className={`${focus} absolute top-2 right-2 rounded-lg p-2 text-slate-200 hover:bg-white/10`}><X size={20} /></button>}
      </div>
      <nav aria-label="Menú principal" className="jjr-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {DASHBOARD_NAVIGATION.map(group => {
          const items = group.items.filter(item => permitted(item.id));
          if (!items.length) return null;
          return <div key={group.category} className="mb-4 last:mb-0">
            {group.category !== "General" && <p className="mb-1.5 px-3 text-[9px] font-semibold tracking-[0.15em] text-slate-400 uppercase">{group.category}</p>}
            <ul className="space-y-0.5">{items.map(({ id, label, icon: Icon }) => <li key={id}>
              <DashboardLink onNavigate={onNavigate} onFollow={closePanels} href={moduleHref(id)} current={activeModule === id} className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-xs transition-all duration-300 hover:translate-x-0.5 ${activeModule === id ? "bg-[#075BC6] font-semibold text-white shadow-lg shadow-black/10 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r before:bg-[#F5B000]" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}><Icon size={18} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span></DashboardLink>
            </li>)}</ul>
          </div>;
        })}
      </nav>
      <div className="shrink-0 border-t border-white/10 p-4">
        <div className="flex items-center gap-3"><Avatar user={user} /><div className="min-w-0"><p className="truncate text-xs font-semibold" title={user.nombreCompleto}>{user.nombreCompleto}</p><p className="mt-1 truncate text-[10px] text-slate-400">{user.rol}</p></div></div>
        <button type="button" onClick={logout} disabled={loggingOut} className={`${focus} mt-3 flex min-h-10 w-full items-center gap-3 rounded-lg px-2 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60`}><LogOut size={17} aria-hidden="true" />{loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}</button>
      </div>
    </div>;
  }

  const heroLinks = [
    { label: "Pasajeros", icon: Bus, href: moduleHref("pasajes"), module: "pasajes" },
    { label: "Encomiendas", icon: Package, href: moduleHref("encomiendas"), module: "encomiendas" },
    { label: "Flota", icon: Bus, href: moduleHref("flota"), module: "flota" },
    { label: "Seguridad", icon: ShieldCheck, href: securityHref, module: "configuracion" },
  ] as const;

  return <div className="jjr-dashboard min-h-dvh bg-[#F4F7FB] font-sans text-[#102D50]">
    <style>{css}</style>
    <a href={`#${uid}-main`} className={`${focus} sr-only z-50 rounded-lg bg-white p-3 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3`}>Saltar al contenido</a>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[244px] lg:block">{renderSidebar(false)}</aside>
    <dialog ref={drawerRef} aria-label="Navegación principal" onClose={() => setDrawerOpen(false)} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(86vw,300px)] max-w-none border-0 bg-[#062443] p-0 text-white shadow-2xl">{renderSidebar(true)}</dialog>

    <div className="min-[#102D50] lg:pl-[244px]">
      <header className="relative z-30 flex min-h-[72px] items-center gap-3 border-b border-slate-200/70 bg-white px-4 sm:px-6 xl:px-8">
        <button type="button" aria-label="Abrir menú principal" aria-haspopup="dialog" aria-expanded={drawerOpen} onClick={() => { drawerRef.current?.showModal(); setDrawerOpen(true); }} className={`${focus} flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 lg:hidden`}><Menu size={22} /></button>
        <div ref={searchRef} className="relative min-w-0 flex-1 sm:max-w-xl">
          <form role="search" onSubmit={event => { event.preventDefault(); setSearchOpen(true); }}>
            <label htmlFor={`${uid}-search`} className="sr-only">Buscar pasaje, guía, cliente o módulo</label>
            <div className="relative"><Search size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" /><input id={`${uid}-search`} type="search" autoComplete="off" value={query} onChange={event => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Buscar pasaje, guía, cliente…" className="h-11 w-full rounded-xl border border-transparent bg-[#F1F5FA] pr-3 pl-10 text-sm outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-[#00A3E0]/50 focus:bg-white focus:ring-4 focus:ring-[#00A3E0]/10" /></div>
          </form>
          {searchOpen && <div className="absolute top-full right-0 left-0 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            <p className="px-3 py-2 text-[11px] text-slate-500">{onSearch ? "Búsqueda global" : "Búsqueda de módulos · Conecta onSearch para buscar registros"}</p>
            <p role="status" className="px-3 text-xs text-slate-500">{searching ? "Buscando…" : searchError || (!query.trim() ? "Escribe para comenzar." : !results.length ? "No se encontraron resultados." : `${results.length} resultados`)}</p>
            <ul className="mt-2 max-h-72 overflow-auto">{results.map(result => <li key={result.id}><DashboardLink onNavigate={onNavigate} onFollow={closePanels} href={result.href} className="flex items-center justify-between gap-2 rounded-lg p-3 hover:bg-blue-50"><span><span className="block text-sm font-medium">{result.title}</span>{result.subtitle && <span className="mt-1 block text-xs text-slate-500">{result.subtitle}</span>}</span><ChevronRight size={16} aria-hidden="true" /></DashboardLink></li>)}</ul>
          </div>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
          <details ref={notificationsRef} className="relative">
            <summary aria-label={`Notificaciones, ${unread} sin leer`} className={`${focus} relative flex size-11 cursor-pointer list-none items-center justify-center rounded-xl hover:bg-slate-100 [&::-webkit-details-marker]:hidden`}><Bell size={21} aria-hidden="true" />{unread > 0 && <span className="jjr-badge absolute top-1.5 right-1 min-w-4 rounded-full bg-[#F5B000] px-1 text-center text-[9px] leading-4 font-bold text-[#062443]">{unread > 9 ? "9+" : unread}</span>}</summary>
            <div className="absolute top-full right-[-52px] mt-2 w-[min(330px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:right-0">
              <p className="mb-3 text-sm font-bold">Notificaciones</p>
              {!notifications.length && <p className="py-4 text-sm text-slate-500">No tienes notificaciones nuevas.</p>}
              <ul className="max-h-80 space-y-2 overflow-y-auto">{notifications.map(item => <li key={item.id} className={`rounded-xl p-3 ${item.read || readIds.has(item.id) ? "bg-slate-50" : "bg-blue-50"}`}>
                {item.href ? <DashboardLink onNavigate={onNavigate} onFollow={closePanels} href={item.href} className="text-xs font-semibold hover:underline">{item.title}</DashboardLink> : <p className="text-xs font-semibold">{item.title}</p>}<p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                {!item.read && !readIds.has(item.id) && <button type="button" onClick={() => { setReadIds(previous => new Set(previous).add(item.id)); onReadNotification?.(item.id); }} className={`${focus} mt-2 flex min-h-8 items-center gap-1 text-[11px] font-medium text-[#075BC6]`}><Check size={13} aria-hidden="true" />Marcar como leída</button>}
              </li>)}</ul>
            </div>
          </details>
          <details ref={profileRef} className="relative">
            <summary aria-label={`Perfil de ${user.nombreCompleto}`} className={`${focus} flex cursor-pointer list-none items-center gap-2 rounded-xl py-2 [&::-webkit-details-marker]:hidden`}><Avatar user={user} /><span className="hidden max-w-36 text-left xl:block"><span className="block truncate text-xs font-semibold">{user.nombreCompleto}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{user.rol}</span></span><ChevronDown size={14} aria-hidden="true" className="hidden sm:block" /></summary>
            <div className="absolute top-full right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"><p className="truncate px-2 text-sm font-semibold">{user.nombreCompleto}</p><p className="mb-3 px-2 text-xs text-slate-500">{user.rol}</p>{permitted("configuracion") && <DashboardLink onNavigate={onNavigate} onFollow={closePanels} href={moduleHref("configuracion")} className="flex items-center gap-2 rounded-lg p-2 text-xs hover:bg-slate-50"><Settings size={16} />Configuración</DashboardLink>}<button type="button" onClick={logout} disabled={loggingOut} className={`${focus} flex min-h-10 w-full items-center gap-2 rounded-lg p-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60`}><LogOut size={16} aria-hidden="true" />{loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}</button></div>
          </details>
        </div>
      </header>
      {logoutError && <p role="alert" className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-800">{logoutError}</p>}

      <main id={`${uid}-main`} tabIndex={-1} className="outline-none">
        {children ?? <>
          <section aria-labelledby={`${uid}-hero`} className="jjr-panel relative isolate overflow-hidden bg-[#062443] text-white lg:aspect-[5.35/1]">
            <h1 id={`${uid}-hero`} className="sr-only">Más que transporte, conectamos destinos</h1>
            {!bannerFailed && <img src={bannerSrc} alt="Flota JJR: bus, camioneta y furgón en una carretera de montaña" onError={() => setBannerFailed(true)} fetchPriority="high" className="absolute inset-0 -z-10 hidden size-full object-cover object-center lg:block" />}
            {!bannerFailed && <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden lg:hidden">
              <img src={bannerSrc} alt="" className="absolute top-1/2 left-1/2 h-[200%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,36,67,0.97),rgba(6,36,67,0.7))]" />
            </div>}
            {bannerFailed && <div className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,#062443,#075BC6)]" />}
            <div className={`${bannerFailed ? "flex" : "flex lg:hidden"} min-h-64 flex-col justify-center px-6 py-8 sm:px-8`}>
              <p aria-hidden="true" className="max-w-lg text-3xl leading-tight font-bold tracking-tight">Más que transporte,<br />conectamos <span className="text-[#F5B000]">destinos</span></p>
              <span aria-hidden="true" className="mt-4 h-1 w-20 rounded-full bg-[#F5B000]" />
              <div className="mt-7 flex flex-wrap gap-2">{heroLinks.filter(item => permitted(item.module)).map(({ label, icon: Icon, href }) => <DashboardLink onNavigate={onNavigate} onFollow={closePanels} key={label} href={href} className="flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-xs transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/15"><Icon size={17} aria-hidden="true" />{label}</DashboardLink>)}</div>
            </div>
            {!bannerFailed && <div className="absolute top-[16%] right-[2.3%] bottom-[14%] hidden w-[10.7%] grid-rows-4 lg:grid">{heroLinks.map(({ label, href, module }) => permitted(module) ? <DashboardLink onNavigate={onNavigate} onFollow={closePanels} key={label} href={href} label={label} className="rounded-md transition-colors duration-300 hover:bg-white/15"><span className="sr-only">{label}</span></DashboardLink> : <span key={label} />)}</div>}
          </section>

          <div className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6 xl:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">Tu operación, en un solo lugar.</p>{!data ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-800">Datos de demostración</span> : data.updatedAt ? <p className="flex items-center gap-1.5 text-[10px] text-slate-500"><Clock3 size={12} aria-hidden="true" />Actualizado: {formatDate(data.updatedAt)}</p> : null}</div>
            <section aria-label="Accesos directos" className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 xl:grid-cols-4">
              {QUICK_CARDS.filter(card => permitted(card.id)).map(({ id, label, caption, icon: Icon, color }) => <DashboardLink onNavigate={onNavigate} onFollow={closePanels} key={id} href={moduleHref(id)} className="jjr-panel group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"><span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${color}`}><Icon size={25} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-2"><span className="text-sm font-semibold">{label}</span><strong className="text-lg font-bold tabular-nums">{number(values.counts[id])}</strong></span><span className="mt-1 block text-[10px] text-slate-500">{caption}</span></span><ChevronRight size={16} aria-hidden="true" className="shrink-0 text-slate-400 transition-transform duration-300 group-hover:translate-x-0.5" /></DashboardLink>)}
            </section>

            <div className="grid items-stretch gap-5 xl:grid-cols-[1.15fr_1fr]">
              <section aria-labelledby={`${uid}-activity`} className="jjr-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3"><h2 id={`${uid}-activity`} className="text-sm font-bold">Actividad reciente</h2><DashboardLink onNavigate={onNavigate} onFollow={closePanels} href={activityHref} className="flex min-h-8 items-center gap-1.5 text-xs font-semibold text-[#075BC6] hover:underline">Ver todos <ArrowRight size={14} aria-hidden="true" /></DashboardLink></div>
                <ul className="divide-y divide-slate-100">{values.activities.slice(0, 4).map(event => {
                  const style = ACTIVITY_STYLE[event.type]; const Icon = style.icon;
                  return <li key={event.id} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0"><span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${style.color}`}><Icon size={19} aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">{event.href ? <DashboardLink onNavigate={onNavigate} onFollow={closePanels} href={event.href} className="text-xs font-medium hover:text-[#075BC6] hover:underline">{event.title}</DashboardLink> : <p className="text-xs font-medium">{event.title}</p>}<time dateTime={event.occurredAt} className="text-[10px] text-slate-500">{formatDate(event.occurredAt)}</time></div><p className="mt-1 text-[10px] leading-5 text-slate-500">{event.description}</p><span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-medium ${style.badge}`}>{event.status}</span></div></li>;
                })}</ul>
                {!values.activities.length && <div className="py-12 text-center"><ClipboardList size={26} aria-hidden="true" className="mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-500">Aún no hay actividad registrada.</p></div>}
              </section>
              <section aria-labelledby={`${uid}-fleet`} className="jjr-panel flex min-w-0 flex-col rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><h2 id={`${uid}-fleet`} className="text-sm font-bold">Estado de la flota</h2><Bus size={18} aria-hidden="true" className="text-slate-400" /></div><div className="my-auto"><FleetDonut fleet={values.fleet} /></div><p className="border-t border-slate-100 pt-3 text-[10px] leading-5 text-slate-500">Distribución de unidades según su estado operativo.</p></section>
            </div>

            {permitted("encomiendas") && <section aria-labelledby={`${uid}-parcel`} className="jjr-panel flex flex-wrap items-center gap-4 rounded-2xl border border-blue-100 bg-[linear-gradient(100deg,#E8F3FF,#F1F7FE)] p-5 shadow-sm sm:p-6"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-[#075BC6]"><Package size={26} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h2 id={`${uid}-parcel`} className="text-base font-bold">Gestiona tus encomiendas</h2><p className="mt-1 text-xs text-slate-500">Rápido, seguro y confiable. De origen a destino.</p></div><DashboardLink onNavigate={onNavigate} onFollow={closePanels} href={newEncomiendaHref} className="flex min-h-11 w-full items-center justify-center gap-4 rounded-xl bg-[#075BC6] px-5 py-3 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#102D50] hover:shadow-lg sm:w-auto">Nueva encomienda <ChevronRight size={17} aria-hidden="true" /></DashboardLink></section>}
            <footer className="flex flex-wrap justify-between gap-2 pb-2 text-[10px] text-slate-500"><span>© {new Date().getFullYear()} Transportes JJR S.A.C.</span><span className="flex items-center gap-1.5"><ShieldCheck size={12} aria-hidden="true" />Seguridad y puntualidad en cada viaje.</span></footer>
          </div>
        </>}
      </main>
    </div>
  </div>;
}