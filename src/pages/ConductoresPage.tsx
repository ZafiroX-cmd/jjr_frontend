import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { isAxiosError } from "axios";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Eye, FileCheck2, LoaderCircle, Pencil, Plus, RefreshCw, Search, ShieldCheck, ToggleLeft, UserRound, Users, X } from "lucide-react";
import axiosClient from "../api/axiosClient";

export type EstadoConductor = "Disponible" | "En Ruta" | "Inactivo";
export interface Conductor {
  conductorId: string | number;
  numeroDocumento: string;
  nombreCompleto: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  numeroLicencia: string;
  categoriaLicencia: string;
  fechaVencimientoLicencia: string;
  telefono: string | null;
  activo: boolean;
  licenciaPorVencer: boolean;
  /** Campo opcional para una futura ampliación del GET. */
  estado?: EstadoConductor;
}
export interface ConductorDto {
  numeroDocumento: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  numeroLicencia: string;
  categoriaLicencia: string;
  fechaVencimientoLicencia: string;
  telefono: string | null;
}
export interface ConductoresPageProps {
  /** Se detecta si axiosClient.baseURL ya incluye /api. */
  apiRoot?: string;
  /** Debe persistir la edición. Sin callback, Editar queda deshabilitado. */
  onUpdate?: (id: Conductor["conductorId"], data: ConductorDto, signal: AbortSignal) => Promise<void>;
  /** Debe persistir el estado. El controlador compartido no tiene este endpoint. */
  onChangeEstado?: (conductor: Conductor, estado: EstadoConductor, signal: AbortSignal) => Promise<void>;
  /** Estado procedente de asignaciones/viajes reales; no se deduce de activo=true. */
  getEstado?: (conductor: Conductor) => EstadoConductor | undefined;
}
type ModalState = { kind: "create" } | { kind: "edit" | "view" | "state"; conductor: Conductor } | null;

const css = `
  @keyframes jjr-conductores-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes jjr-conductores-modal { from { opacity: 0; transform: translateY(10px) scale(.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .jjr-conductores .jjr-enter { animation: jjr-conductores-enter .4s cubic-bezier(.16,1,.3,1) both; }
  .jjr-conductores dialog[open] { animation: jjr-conductores-modal .2s cubic-bezier(.16,1,.3,1) both; }
  .jjr-conductores dialog::backdrop { background: rgb(15 23 42 / .4); backdrop-filter: blur(4px); }
  @media (prefers-reduced-motion: reduce) { .jjr-conductores *, .jjr-conductores *::before, .jjr-conductores *::after { animation: none !important; transition: none !important; } }
`;
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A3E0]";
const input = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-[#102D50] outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-[#00A3E0] focus:bg-white focus:ring-4 focus:ring-[#00A3E0]/10 disabled:opacity-60";
const primary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#075BC6] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#062443] hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;
const secondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#102D50] transition-all duration-300 hover:bg-blue-50 disabled:opacity-60 ${focus}`;
const fmt = (value: number) => new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(value);
const textMatch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();


function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("La API devolvió un registro inválido.");
  // Admite también PascalCase si se desactivó la política camelCase del servidor.
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.charAt(0).toLowerCase() + key.slice(1), item]));
}
function str(r: Record<string, unknown>, key: string): string {
  const value = r[key]; if (typeof value !== "string") throw new Error(`La respuesta no contiene ${key} válido.`); return value;
}
function identifier(r: Record<string, unknown>, key: string): string | number {
  const value = r[key];
  if (typeof value === "string" || (typeof value === "number" && Number.isSafeInteger(value))) return value;
  throw new Error(`Identificador ${key} inválido.`);
}
function nullableStr(r: Record<string, unknown>, key: string): string | null { return r[key] === null ? null : str(r, key); }

function bool(r: Record<string, unknown>, key: string): boolean {
  const value = r[key]; if (typeof value !== "boolean") throw new Error(`La respuesta no contiene ${key} válido.`); return value;
}

function decodeConductor(value: unknown): Conductor {
  const r = record(value);
  const estado = r.estado === "Disponible" || r.estado === "En Ruta" || r.estado === "Inactivo" ? r.estado : undefined;
  return { estado, conductorId: identifier(r, "conductorId"), numeroDocumento: str(r, "numeroDocumento"), nombreCompleto: str(r, "nombreCompleto"),
    nombres: str(r, "nombres"), apellidoPaterno: str(r, "apellidoPaterno"), apellidoMaterno: str(r, "apellidoMaterno"),
    numeroLicencia: str(r, "numeroLicencia"), categoriaLicencia: str(r, "categoriaLicencia"), fechaVencimientoLicencia: str(r, "fechaVencimientoLicencia"),
    telefono: nullableStr(r, "telefono"), activo: bool(r, "activo"), licenciaPorVencer: bool(r, "licenciaPorVencer") };
}

function authHeaders(): Record<string, string> {
  try { const token = localStorage.getItem("token"); return token ? { Authorization: `Bearer ${token}` } : {}; }
  catch { return {}; } // Se conserva la configuración de axiosClient si no hay almacenamiento.
}
function errorMessage(cause: unknown, writing = false): string {
  if (isAxiosError(cause)) {
    const status = cause.response?.status;
    if (status === 401) return "Tu sesión venció o no es válida. Inicia sesión nuevamente.";
    if (status === 403) return "No tienes permisos para realizar esta operación.";
    if (status === 429) return "Hay demasiadas solicitudes. Espera un momento e inténtalo otra vez.";
    if (status === 400 || status === 409 || status === 422) {
      const data: unknown = cause.response?.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const r = record(data);
        if (typeof r.mensaje === "string") return r.mensaje;
        if (r.errors && typeof r.errors === "object") {
          const errors = Object.values(r.errors).flatMap(value => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
          if (errors.length) return errors.slice(0, 4).join(" ");
        }
      }
      return "Revisa los campos del formulario y vuelve a intentarlo.";
    }
    if (writing && (!cause.response || (status ?? 0) >= 500)) return "No se pudo confirmar la operación. Cierra este formulario y actualiza la lista antes de volver a intentarlo.";
    return "No se pudo conectar con el servidor. Comprueba tu conexión y vuelve a intentar.";
  }
  return cause instanceof Error ? cause.message : "Ocurrió un error inesperado.";
}
function useList<T>(url: string, decode: (value: unknown) => T) {
  const [items, setItems] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void axiosClient.get<unknown>(url, { signal: controller.signal, timeout: 15000, headers: authHeaders() })
      .then(({ data }) => {
        if (!Array.isArray(data)) throw new Error("Se esperaba una lista JSON de conductores.");
        const parsed = data.map(decode);
        if (!controller.signal.aborted) setItems(parsed);
      }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url, decode, revision]);
  return { items, loading, error, reload };
}


// DateOnly: comparación por días de calendario, sin desfases por zona horaria.
function dayNumber(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return Math.floor(date.getTime() / 86400000);
}
function limaToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function displayDate(value: string | null): string {
  if (dayNumber(value) === null || !value) return "Sin fecha válida";
  const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`;
}
function expiry(value: string | null, today: string, threshold: number) {
  const day = dayNumber(value); const now = dayNumber(today);
  const days = day === null || now === null ? null : day - now;
  const kind = days === null ? "unknown" : days < 0 ? "expired" : days <= threshold ? "soon" : "valid";
  return { days, kind } as const;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block min-w-0"><span className="mb-2 block text-xs font-semibold text-[#102D50]">{label}</span>{children}{hint && <span className="mt-1.5 block text-[10px] leading-4 text-slate-500">{hint}</span>}</label>;
}

function Skeletons() {
  return <div role="status" aria-label="Cargando registros" className="space-y-4 p-6"><span className="sr-only">Cargando registros…</span>{[0, 1, 2, 3].map(key => <div key={key} aria-hidden="true" className="flex animate-pulse items-center gap-4"><span className="size-10 rounded-xl bg-slate-100" /><span className="h-10 flex-1 rounded-xl bg-slate-100" /></div>)}</div>;
}
function Modal({ title, description, busy, onClose, children }: { title: string; description: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null); const id = useId();
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-2xl overflow-y-auto rounded-3xl border-0 bg-white p-0 text-[#102D50] shadow-2xl">
    <div className="p-6 sm:p-8"><div className="mb-6 flex items-start justify-between gap-4"><div><h2 id={`${id}-title`} className="text-xl font-bold tracking-tight">{title}</h2><p id={`${id}-description`} className="mt-2 text-xs leading-5 text-slate-500">{description}</p></div><button type="button" aria-label="Cerrar modal" disabled={busy} onClick={onClose} className={`shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 ${focus}`}><X size={20} /></button></div>{children}</div>
  </dialog>;
}


function LicenseBadge({ date, today }: { date: string; today: string }) {
  const { kind, days } = expiry(date, today, 30);
  const label = kind === "valid" ? "Vigente" : kind === "soon" ? days === 0 ? "Por vencer · hoy" : `Por vencer · ${days} días` : kind === "expired" ? "Vencido" : "Sin fecha válida";
  const color = { valid: "bg-emerald-50 text-emerald-800", soon: "bg-amber-50 text-amber-800", expired: "bg-red-50 text-red-800", unknown: "bg-slate-100 text-slate-600" }[kind];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${color}`}>
    {kind === "soon" || kind === "expired" ? <AlertTriangle size={12} aria-hidden="true" className="animate-pulse" /> : kind === "valid" ? <CheckCircle2 size={12} aria-hidden="true" /> : <CalendarDays size={12} aria-hidden="true" />}{label}
  </span>;
}
function OperationBadge({ state }: { state: EstadoConductor | "Activo" }) {
  const color = state === "Inactivo" ? "bg-slate-100 text-slate-500" : state === "En Ruta" ? "bg-blue-50 text-[#075BC6]" : "bg-emerald-50 text-emerald-800";
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${color}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{state}</span>;
}
function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("") || "JJ";
  return <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-100 text-xs font-bold text-[#075BC6]">{initials.toUpperCase()}</span>;
}

/** GET y POST están implementados con el contrato del FlotaController compartido. */
export default function ConductoresPage({ apiRoot, onUpdate, onChangeEstado, getEstado }: ConductoresPageProps) {
  const root = (apiRoot ?? (/\/api\/?$/i.test(axiosClient.defaults.baseURL ?? "") ? "/Flota" : "/api/Flota")).replace(/\/$/, "");
  const endpoint = `${root}/conductores`;
  const { items, loading, error, reload } = useList(endpoint, decodeConductor);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [today, setToday] = useState(limaToday);
  const [modal, setModal] = useState<ModalState>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [success, setSuccess] = useState("");
  const [nextState, setNextState] = useState<EstadoConductor | "">("");
  const lock = useRef(false);
  const writeRef = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const id = useId();

  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => setToday(limaToday()), 60000);
    return () => { mounted.current = false; writeRef.current?.abort(); window.clearInterval(timer); };
  }, []);

  function operation(conductor: Conductor): EstadoConductor | "Activo" {
    if (!conductor.activo) return "Inactivo";
    return getEstado?.(conductor) ?? conductor.estado ?? "Activo";
  }
  function open(value: ModalState) {
    setSaveError(""); setUncertain(false); setNextState(""); setModal(value);
  }
  function close() {
    if (lock.current) return;
    setModal(null);
    if (uncertain) reload();
  }
  const active = items?.filter(conductor => conductor.activo).length ?? 0;
  const licenses = items?.map(conductor => ({ conductor, ...expiry(conductor.fechaVencimientoLicencia, today, 30) }));
  const valid = licenses?.filter(item => item.conductor.activo && item.days !== null && item.days >= 0).length ?? 0;
  const expiring = licenses?.filter(item => item.kind === "soon").length ?? 0;
  const expired = licenses?.filter(item => item.kind === "expired").length ?? 0;
  const unknown = licenses?.filter(item => item.kind === "unknown").length ?? 0;
  const filtered = items?.filter(conductor => {
    const matches = textMatch(`${conductor.numeroDocumento} ${conductor.nombreCompleto} ${conductor.numeroLicencia}`).includes(textMatch(query.trim()));
    return matches && (filter === "all" || expiry(conductor.fechaVencimientoLicencia, today, 30).kind === filter);
  });
  const edited = modal?.kind === "edit" ? modal.conductor : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || uncertain || !modal || modal.kind === "view") return;
    const action = modal;
    setSaveError("");
    let payload: ConductorDto | undefined;
    if (action.kind === "state") {
      if (!onChangeEstado) { setSaveError("El cambio de estado no está habilitado."); return; }
      if (!nextState) { setSaveError("Selecciona el nuevo estado."); return; }
      if (nextState === operation(action.conductor)) { setSaveError("Selecciona un estado diferente al actual."); return; }
    } else {
      if (action.kind === "edit" && !onUpdate) { setSaveError("La edición no está habilitada."); return; }
      const form = new FormData(event.currentTarget);
      const field = (key: string) => String(form.get(key) ?? "").trim();
      if (!/^\d{8}$/.test(field("numeroDocumento"))) { setSaveError("El DNI debe contener exactamente 8 dígitos."); return; }
      if (!["nombres", "apellidoPaterno", "apellidoMaterno", "numeroLicencia", "categoriaLicencia"].every(key => field(key))) { setSaveError("Completa todos los campos obligatorios."); return; }
      if (dayNumber(field("fechaVencimientoLicencia")) === null) { setSaveError("Ingresa una fecha válida de vencimiento."); return; }
      payload = { numeroDocumento: field("numeroDocumento"), nombres: field("nombres"), apellidoPaterno: field("apellidoPaterno"), apellidoMaterno: field("apellidoMaterno"), numeroLicencia: field("numeroLicencia").toUpperCase(), categoriaLicencia: field("categoriaLicencia").toUpperCase(), fechaVencimientoLicencia: field("fechaVencimientoLicencia"), telefono: field("telefono") || null };
    }
    lock.current = true; setSaving(true);
    const controller = new AbortController(); writeRef.current = controller;
    try {
      if (action.kind === "create" && payload) {
        await axiosClient.post<unknown>(endpoint, payload, { timeout: 15000, signal: controller.signal, headers: authHeaders() });
      } else if (action.kind === "edit" && payload && onUpdate) {
        await onUpdate(action.conductor.conductorId, payload, controller.signal);
      } else if (action.kind === "state" && nextState && onChangeEstado) {
        await onChangeEstado(action.conductor, nextState, controller.signal);
      }
      if (!mounted.current) return;
      setModal(null);
      setSuccess(action.kind === "create" ? "Conductor registrado correctamente." : action.kind === "edit" ? "Datos del conductor actualizados." : "Estado del conductor actualizado.");
      reload(); // Un fallo de esta lectura no se presenta como fallo del registro.
    } catch (cause: unknown) {
      if (!mounted.current || controller.signal.aborted) return;
      setSaveError(errorMessage(cause, true));
      if (isAxiosError(cause) && (!cause.response || cause.response.status >= 500)) setUncertain(true);
    } finally { lock.current = false; if (mounted.current) setSaving(false); }
  }

  return <div className="jjr-conductores mx-auto max-w-[1600px] space-y-6 p-4 font-sans text-[#102D50] sm:p-6 xl:p-8">
    <style>{css}</style>
    <header className="jjr-enter flex flex-wrap items-center justify-between gap-4">
      <div><p className="mb-2 flex items-center gap-1 text-[10px] font-medium text-slate-500">Flota & personal <ChevronRight size={12} aria-hidden="true" />Conductores</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Conductores & Licencias</h1><p className="mt-2 max-w-2xl text-xs leading-6 text-slate-500">Control de personal operativo, licencias de conducir y vigencias de brevetes.</p></div>
      <button type="button" onClick={reload} disabled={loading} className={secondary}><RefreshCw size={16} aria-hidden="true" className={loading ? "animate-spin" : ""} />{loading ? "Actualizando…" : "Actualizar datos"}</button>
    </header>

    <section aria-label="Indicadores de conductores" className="grid gap-4 lg:grid-cols-3">
      <article className="jjr-enter rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-slate-500">Total conductores</p><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#075BC6]"><Users size={20} aria-hidden="true" /></span></div><p className="mt-2 text-3xl font-bold tabular-nums">{items ? fmt(items.length) : "—"}</p><p className="mt-3 text-[11px] text-slate-500">{items ? `${active} activos · ${items.length - active} inactivos` : "Esperando datos del servidor"}</p></article>
      <article className="jjr-enter rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-slate-500">Licencias vigentes</p><span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={20} aria-hidden="true" /></span></div><p className="mt-2 text-3xl font-bold tabular-nums">{items ? fmt(valid) : "—"}</p><p className="mt-3 text-[11px] text-slate-500">Activos con licencia no vencida; incluye próximas a vencer.</p></article>
      <article className="jjr-enter rounded-2xl border border-amber-200/70 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-slate-500">Alertas críticas</p><span className={`flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ${expiring + expired > 0 ? "animate-pulse" : ""}`}><AlertTriangle size={20} aria-hidden="true" /></span></div><p className="mt-2 text-3xl font-bold tabular-nums">{items ? fmt(expiring + expired) : "—"}</p><div className="mt-3 flex flex-wrap gap-2 text-[10px]">{items ? <><span className="rounded-full bg-red-50 px-2 py-1 font-medium text-red-800">{expired} vencidas</span><span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-800">{expiring} por vencer ≤ 30 días</span>{unknown > 0 && <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{unknown} sin fecha válida</span>}</> : <span className="text-slate-500">Verificando vencimientos</span>}</div></article>
    </section>

    <div aria-live="polite" aria-atomic="true">{success && <div className="jjr-enter flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"><CheckCircle2 size={17} aria-hidden="true" /><span className="flex-1">{success}</span><button type="button" aria-label="Cerrar confirmación" onClick={() => setSuccess("")} className={`rounded p-1 ${focus}`}><X size={16} /></button></div>}</div>
    {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs leading-6 text-red-800"><p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} aria-hidden="true" />No se pudieron actualizar los conductores</p><p>{error}</p>{items && <p>Se conserva la última información cargada.</p>}<button type="button" onClick={reload} disabled={loading} className={`mt-2 rounded px-1 py-2 font-semibold underline ${focus}`}>Reintentar carga</button></div>}

    <section aria-labelledby={`${id}-table-title`} className="jjr-enter overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 id={`${id}-table-title`} className="flex items-center gap-2 text-sm font-bold"><UserRound size={18} aria-hidden="true" className="text-[#075BC6]" />Personal operativo</h2><p className="mt-1 text-[10px] text-slate-500">Información y documentación de tus conductores.</p></div><button type="button" onClick={() => open({ kind: "create" })} className={primary}><Plus size={17} aria-hidden="true" />Registrar Conductor</button></div>
      <div className="flex flex-wrap items-center gap-3 p-5"><label className="relative min-w-[220px] flex-1 sm:max-w-sm"><span className="sr-only">Buscar por DNI, nombres o número de licencia</span><Search size={17} aria-hidden="true" className="absolute top-3.5 left-3 text-slate-400" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar DNI, nombres o N° licencia…" className={`${input} pl-10`} /></label><label className="w-full sm:w-auto"><span className="sr-only">Filtrar estado de licencia</span><select value={filter} onChange={event => setFilter(event.target.value)} className={input}><option value="all">Todas las licencias</option><option value="valid">Vigente</option><option value="soon">Por Vencer</option><option value="expired">Vencido</option><option value="unknown">Sin fecha válida</option></select></label>{(query || filter !== "all") && <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className={`rounded-lg px-2 py-3 text-xs font-medium text-[#075BC6] hover:bg-blue-50 ${focus}`}>Limpiar filtros</button>}</div>
      {loading && !items ? <Skeletons /> : !filtered || !filtered.length ? <div className="px-6 py-14 text-center"><Users size={32} aria-hidden="true" className="mx-auto mb-3 text-slate-300" /><h3 className="text-sm font-semibold">{!items ? "Datos no disponibles" : items.length ? "No se encontraron coincidencias" : "Aún no hay conductores"}</h3><p className="mt-2 text-xs text-slate-500">{!items ? "Reintenta la carga para consultar al personal." : items.length ? "Prueba otra búsqueda o cambia el filtro de licencia." : "Registra el primer conductor para comenzar."}</p></div> : <div role="region" aria-label="Tabla de conductores, desplazable horizontalmente" tabIndex={0} className={`overflow-x-auto ${focus}`}>
        <table className="w-full min-w-[1050px] text-left text-xs"><caption className="sr-only">Conductores registrados, licencias, teléfono y estado operativo</caption><thead className="border-y border-slate-100 bg-slate-50 text-[10px] tracking-wide text-slate-500 uppercase"><tr>{["Conductor", "Licencia & categoría", "Vencimiento de licencia", "Teléfono", "Estado", "Acciones"].map(label => <th scope="col" key={label} className="px-5 py-3.5 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{filtered.map(conductor => <tr key={conductor.conductorId} className="transition-colors duration-300 hover:bg-blue-50/50"><th scope="row" className="px-5 py-5"><div className="flex items-center gap-3"><Avatar name={conductor.nombreCompleto} /><div><p className="max-w-52 text-xs font-semibold leading-5">{conductor.nombreCompleto}</p><p className="mt-1 text-[10px] font-normal text-slate-500">DNI {conductor.numeroDocumento}</p></div></div></th><td className="px-5 py-5"><p className="font-semibold tracking-wide">{conductor.numeroLicencia}</p><span className="mt-1.5 inline-block rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600">{conductor.categoriaLicencia}</span></td><td className="px-5 py-5"><p className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-600"><CalendarDays size={13} aria-hidden="true" />{displayDate(conductor.fechaVencimientoLicencia)}</p><LicenseBadge date={conductor.fechaVencimientoLicencia} today={today} /></td><td className="px-5 py-5 text-[11px] text-slate-600">{conductor.telefono || "No registrado"}</td><td className="px-5 py-5"><OperationBadge state={operation(conductor)} /></td><td className="px-5 py-5"><div className="flex items-center gap-1">
            <button type="button" disabled={!onUpdate} title={onUpdate ? "Editar conductor" : "Edición no habilitada"} aria-label={`Editar ${conductor.nombreCompleto}`} onClick={() => open({ kind: "edit", conductor })} className={`rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-blue-100 hover:text-[#075BC6] disabled:cursor-not-allowed disabled:opacity-30 ${focus}`}><Pencil size={17} /></button>
            <button type="button" title="Ver ficha" aria-label={`Ver ficha de ${conductor.nombreCompleto}`} onClick={() => open({ kind: "view", conductor })} className={`rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-blue-100 hover:text-[#075BC6] ${focus}`}><Eye size={17} /></button>
            <button type="button" disabled={!onChangeEstado} title={onChangeEstado ? "Cambiar estado" : "Cambio de estado no habilitado"} aria-label={`Cambiar estado de ${conductor.nombreCompleto}`} onClick={() => open({ kind: "state", conductor })} className={`rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-30 ${focus}`}><ToggleLeft size={18} /></button>
          </div></td></tr>)}</tbody>
        </table>
      </div>}
      <p role="status" className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500">{items ? `Mostrando ${filtered?.length ?? 0} de ${items.length} conductores` : "Esperando datos del servidor"}{loading && items ? " · Actualizando…" : ""}</p>
    </section>
    <p className="flex items-start gap-2 text-[10px] leading-5 text-slate-500"><FileCheck2 size={14} aria-hidden="true" className="mt-0.5 shrink-0" />Las alertas incluyen vencimientos de hoy y de los próximos 30 días. Las fechas se evalúan con el calendario de Lima.</p>

    {modal && <Modal title={modal.kind === "create" ? "Registrar Conductor" : modal.kind === "edit" ? "Editar conductor" : modal.kind === "state" ? "Cambiar estado" : "Ficha del conductor"} description={modal.kind === "view" ? "Información y documentación registrada en Transportes JJR S.A.C." : modal.kind === "state" ? "Confirma el estado operativo que se guardará para este conductor." : "Completa los datos personales y la vigencia de su licencia. Los campos con * son obligatorios."} busy={saving} onClose={close}>
      {saveError && <p role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"><AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />{saveError}</p>}
      {modal.kind === "view" ? <>
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4"><Avatar name={modal.conductor.nombreCompleto} /><div><p className="text-sm font-bold">{modal.conductor.nombreCompleto}</p><p className="mt-1 text-xs text-slate-500">DNI {modal.conductor.numeroDocumento}</p></div></div>
        <dl className="grid gap-4 sm:grid-cols-2">{[["N° licencia", modal.conductor.numeroLicencia], ["Categoría", modal.conductor.categoriaLicencia], ["Vencimiento", displayDate(modal.conductor.fechaVencimientoLicencia)], ["Teléfono", modal.conductor.telefono || "No registrado"], ["Estado", operation(modal.conductor)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] text-slate-500">{label}</dt><dd className="mt-1 break-words text-xs font-semibold">{value}</dd></div>)}</dl><div className="mt-4"><LicenseBadge date={modal.conductor.fechaVencimientoLicencia} today={today} /></div><div className="mt-6 flex justify-end"><button type="button" onClick={close} className={secondary}>Cerrar ficha <ArrowRight size={15} aria-hidden="true" /></button></div>
      </> : <form onSubmit={event => void submit(event)} aria-busy={saving}>
        {modal.kind === "state" ? <fieldset disabled={saving || uncertain} className="space-y-5"><div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">{modal.conductor.nombreCompleto}</p><p className="mt-2 text-xs text-slate-500">Estado actual: {operation(modal.conductor)}</p></div><Field label="Nuevo estado *"><select autoFocus required value={nextState} onChange={event => setNextState(event.target.value as EstadoConductor | "")} className={input}><option value="">Selecciona un estado</option>{(["Disponible", "En Ruta", "Inactivo"] as const).map(state => <option key={state} value={state}>{state}</option>)}</select></Field></fieldset> : <fieldset disabled={saving || uncertain} className="grid gap-4 sm:grid-cols-2">
          <Field label="DNI *"><input autoFocus name="numeroDocumento" required inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} defaultValue={edited?.numeroDocumento ?? ""} placeholder="8 dígitos" className={input} /></Field>
          <Field label="Nombres *"><input name="nombres" required maxLength={100} autoComplete="given-name" defaultValue={edited?.nombres ?? ""} className={input} /></Field>
          <Field label="Apellido paterno *"><input name="apellidoPaterno" required maxLength={100} defaultValue={edited?.apellidoPaterno ?? ""} className={input} /></Field>
          <Field label="Apellido materno *"><input name="apellidoMaterno" required maxLength={100} defaultValue={edited?.apellidoMaterno ?? ""} className={input} /></Field>
          <Field label="N° licencia *"><input name="numeroLicencia" required maxLength={30} autoCapitalize="characters" defaultValue={edited?.numeroLicencia ?? ""} className={`${input} uppercase`} /></Field>
          <Field label="Categoría *"><input name="categoriaLicencia" required maxLength={15} placeholder="A-IIIa / A-IIIc" defaultValue={edited?.categoriaLicencia ?? ""} className={input} /></Field>
          <Field label="Fecha de vencimiento *"><input name="fechaVencimientoLicencia" type="date" required defaultValue={edited?.fechaVencimientoLicencia ?? ""} className={input} /></Field>
          <Field label="Teléfono"><input name="telefono" type="tel" maxLength={25} autoComplete="tel" placeholder="Ej. 999 123 456" defaultValue={edited?.telefono ?? ""} className={input} /></Field>
        </fieldset>}
        <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" disabled={saving} onClick={close} className={secondary}>{uncertain ? "Cerrar y verificar lista" : "Cancelar"}</button><button type="submit" disabled={saving || uncertain} className={primary}>{saving ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}{saving ? "Guardando…" : modal.kind === "create" ? "Guardar conductor" : "Guardar cambios"}</button></div>
      </form>}
    </Modal>}
  </div>;
}
