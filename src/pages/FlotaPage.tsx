import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { isAxiosError } from "axios";
import { AlertTriangle, ArrowRight, Bus, CalendarDays, CheckCircle2, ChevronRight, Eye, Handshake, LoaderCircle, Pencil, Plus, RefreshCw, Search, ShieldCheck, ToggleLeft, Truck, X } from "lucide-react";
import axiosClient from "../api/axiosClient";

export type EstadoVehiculo = "Disponible" | "En Ruta" | "Mantenimiento" | "Fuera de Servicio";
export interface Vehiculo {
  vehiculoId: string;
  placa: string;
  marca: string;
  modelo: string;
  capacidadAsientos: number;
  capacidadCargaKg: number;
  soatVencimiento: string | null;
  revisionTecnicaVencimiento: string | null;
  estado: string;
  activo: boolean;
  socioPropietario: string;
  socioId: string | null;
  soatPorVencer: boolean;
  revisionPorVencer: boolean;
}
export interface VehiculoDto {
  placa: string;
  marca: string;
  modelo: string;
  capacidadAsientos: number;
  capacidadCargaKg: number;
  socioId: string | null;
  soatVencimiento: string | null;
  revisionTecnicaVencimiento: string | null;
}
export interface Socio {
  socioId: string;
  rucDni: string;
  razonSocialNombre: string;
  porcentajeGanancia: number | null;
  activo: boolean;
  cantidadVehiculos: number;
}
export interface FlotaPageProps {
  /** Detecta /api en axiosClient.baseURL para evitar duplicarlo. */
  apiRoot?: string;
  /** Sobrescribe el PUT del controlador. Debe persistir y rechazar si falla. */
  onUpdate?: (id: string, payload: VehiculoDto, signal: AbortSignal) => Promise<void>;
  /** Sobrescribe el PATCH del controlador. Debe persistir y rechazar si falla. */
  onChangeEstado?: (vehicle: Vehiculo, estado: EstadoVehiculo, signal: AbortSignal) => Promise<void>;
}
type ModalState = { kind: "create" } | { kind: "edit" | "view" | "state"; vehicle: Vehiculo } | null;
const STATES: EstadoVehiculo[] = ["Disponible", "En Ruta", "Mantenimiento", "Fuera de Servicio"];

const css = `
  @keyframes jjr-flota-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes jjr-flota-modal { from { opacity: 0; transform: translateY(10px) scale(.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .jjr-flota .jjr-enter { animation: jjr-flota-enter .4s cubic-bezier(.16,1,.3,1) both; }
  .jjr-flota dialog[open] { animation: jjr-flota-modal .2s cubic-bezier(.16,1,.3,1) both; }
  .jjr-flota dialog::backdrop { background: rgb(15 23 42 / .4); backdrop-filter: blur(4px); }
  @media (prefers-reduced-motion: reduce) { .jjr-flota *, .jjr-flota *::before, .jjr-flota *::after { animation: none !important; transition: none !important; } }
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
function nullableStr(r: Record<string, unknown>, key: string): string | null { return r[key] === null ? null : str(r, key); }
function num(r: Record<string, unknown>, key: string): number {
  const value = r[key]; if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`La respuesta no contiene ${key} válido.`); return value;
}
function bool(r: Record<string, unknown>, key: string): boolean {
  const value = r[key]; if (typeof value !== "boolean") throw new Error(`La respuesta no contiene ${key} válido.`); return value;
}
function decodeVehiculo(value: unknown): Vehiculo {
  const r = record(value);
  return { vehiculoId: str(r, "vehiculoId"), placa: str(r, "placa"), marca: str(r, "marca"), modelo: str(r, "modelo"),
    capacidadAsientos: num(r, "capacidadAsientos"), capacidadCargaKg: num(r, "capacidadCargaKg"),
    soatVencimiento: nullableStr(r, "soatVencimiento"), revisionTecnicaVencimiento: nullableStr(r, "revisionTecnicaVencimiento"),
    estado: str(r, "estado"), activo: bool(r, "activo"), socioPropietario: str(r, "socioPropietario"), socioId: nullableStr(r, "socioId"),
    soatPorVencer: bool(r, "soatPorVencer"), revisionPorVencer: bool(r, "revisionPorVencer") };
}

function decodeSocio(value: unknown): Socio {
  const r = record(value);
  const percentage = r.porcentajeGanancia === null ? null : num(r, "porcentajeGanancia");
  if (percentage !== null && percentage > 100) throw new Error("El porcentaje de un socio excede 100%.");
  return { socioId: str(r, "socioId"), rucDni: str(r, "rucDni"), razonSocialNombre: str(r, "razonSocialNombre"),
    porcentajeGanancia: percentage, activo: bool(r, "activo"), cantidadVehiculos: num(r, "cantidadVehiculos") };
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
    if (status === 400 || status === 404 || status === 409 || status === 422) {
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
    if (writing && (!cause.response || (status ?? 0) >= 500)) return "No se pudo confirmar la operación. Cierra el formulario y actualiza la lista antes de volver a intentarlo.";
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
        if (!Array.isArray(data)) throw new Error("Se esperaba una lista JSON del controlador Flota.");
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
function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="py-14 text-center"><Bus size={30} aria-hidden="true" className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-semibold text-[#102D50]">{title}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>;
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


function operation(vehicle: Vehiculo): EstadoVehiculo | "Estado sin definir" {
  if (!vehicle.activo) return "Fuera de Servicio";
  const state = textMatch(vehicle.estado).replace(/\s/g, "");
  return STATES.find(item => textMatch(item).replace(/\s/g, "") === state) ?? "Estado sin definir";
}
function StateBadge({ vehicle }: { vehicle: Vehiculo }) {
  const state = operation(vehicle);
  const palette = state === "Disponible" ? "bg-emerald-50 text-emerald-800" : state === "En Ruta" ? "bg-blue-50 text-[#075BC6]" : state === "Mantenimiento" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${palette}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{state}</span>;
}
function DocumentBadge({ label, date, today }: { label: string; date: string | null; today: string }) {
  const { kind, days } = expiry(date, today, 15);
  const palette = { valid: "bg-emerald-50 text-emerald-800", soon: "bg-amber-50 text-amber-800", expired: "bg-red-50 text-red-800", unknown: "bg-slate-100 text-slate-600" }[kind];
  const message = kind === "valid" ? "Vigente" : kind === "expired" ? "Vencido" : kind === "soon" ? days === 0 ? "Vence hoy" : `Por vencer · ${days} d` : "Sin fecha válida";
  return <span title={displayDate(date)} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${palette}`}>
    {kind === "expired" || kind === "soon" ? <AlertTriangle size={12} aria-hidden="true" className="animate-pulse" /> : kind === "valid" ? <CheckCircle2 size={12} aria-hidden="true" /> : <CalendarDays size={12} aria-hidden="true" />}{label}: {message}
  </span>;
}
function Plate({ text, large = false }: { text: string; large?: boolean }) {
  return <span className={`inline-flex overflow-hidden rounded-lg border border-blue-200 bg-white font-bold tracking-[0.12em] text-[#062443] shadow-sm ${large ? "text-xl" : "text-xs"}`}><span aria-hidden="true" className="flex w-2 shrink-0 bg-[#075BC6]" /><span className={large ? "px-5 py-3" : "px-2.5 py-2"}>{text}</span></span>;
}

/** Pantalla exclusiva de vehículos. No consulta conductores ni contiene pestañas. */
export default function FlotaPage({ apiRoot, onUpdate, onChangeEstado }: FlotaPageProps) {
  const root = (apiRoot ?? (/\/api\/?$/i.test(axiosClient.defaults.baseURL ?? "") ? "/Flota" : "/api/Flota")).replace(/\/$/, "");
  const vehicles = useList(`${root}/vehiculos`, decodeVehiculo);
  const partners = useList(`${root}/socios`, decodeSocio);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [today, setToday] = useState(limaToday);
  const [modal, setModal] = useState<ModalState>(null);
  const [owner, setOwner] = useState("");
  const [nextState, setNextState] = useState<EstadoVehiculo | "">("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [success, setSuccess] = useState("");
  const writeLock = useRef(false);
  const writeRef = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const id = useId();
  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => setToday(limaToday()), 60000);
    return () => { mounted.current = false; writeRef.current?.abort(); window.clearInterval(timer); };
  }, []);
  function refresh() { vehicles.reload(); partners.reload(); }
  function open(value: ModalState) {
    setSaveError(""); setUncertain(false); setNextState("");
    const currentId = value && value.kind !== "create" ? value.vehicle.socioId ?? "" : "";
    setOwner(partners.items?.find(partner => partner.socioId.toLowerCase() === currentId.toLowerCase())?.socioId ?? currentId);
    setModal(value);
  }
  function close() {
    if (writeLock.current) return;
    setModal(null); if (uncertain) refresh();
  }
  const edited = modal?.kind === "edit" ? modal.vehicle : undefined;
  const findPartner = (socioId: string | null) => partners.items?.find(item => item.socioId.toLowerCase() === socioId?.toLowerCase());
  const selectedPartner = findPartner(owner);
  const ownCount = vehicles.items?.filter(vehicle => !vehicle.socioId).length ?? 0;
  const stateCount = (state: EstadoVehiculo) => vehicles.items?.filter(vehicle => operation(vehicle) === state).length ?? 0;
  const docs = vehicles.items?.flatMap(vehicle => [vehicle.soatVencimiento, vehicle.revisionTecnicaVencimiento]).map(date => expiry(date, today, 15));
  const expiring = docs?.filter(item => item.kind === "soon").length ?? 0;
  const expired = docs?.filter(item => item.kind === "expired").length ?? 0;
  const unknown = docs?.filter(item => item.kind === "unknown").length ?? 0;
  const filtered = vehicles.items?.filter(vehicle => textMatch(`${vehicle.placa} ${vehicle.marca} ${vehicle.modelo}`).includes(textMatch(query.trim())) && (stateFilter === "all" || operation(vehicle) === stateFilter));
  const availablePartners = partners.items?.filter(partner => partner.activo || partner.socioId.toLowerCase() === edited?.socioId?.toLowerCase()) ?? [];
  const keepOriginalOwner = Boolean(edited?.socioId && !availablePartners.some(partner => partner.socioId.toLowerCase() === edited.socioId?.toLowerCase()));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (writeLock.current || uncertain || !modal || modal.kind === "view") return;
    const action = modal;
    setSaveError("");
    let payload: VehiculoDto | undefined;
    if (action.kind === "state") {
      if (!nextState || !STATES.includes(nextState)) { setSaveError("Selecciona un estado válido."); return; }
      if (nextState === operation(action.vehicle)) { setSaveError("Selecciona un estado distinto al actual."); return; }
    } else {
      const form = new FormData(event.currentTarget);
      const field = (key: string) => String(form.get(key) ?? "").trim();
      if (!["placa", "marca", "modelo"].every(key => field(key))) { setSaveError("Completa placa, marca y modelo."); return; }
      const seats = Number(field("capacidadAsientos"));
      const cargo = Number(field("capacidadCargaKg"));
      if (!Number.isSafeInteger(seats) || seats < 0 || seats > 2147483647 || !Number.isFinite(cargo) || cargo < 0 || (seats === 0 && cargo === 0)) {
        setSaveError("Indica capacidades válidas: asientos enteros y carga no negativa. Al menos una capacidad debe ser mayor a cero."); return;
      }
      const socioId = field("socioId") || null;
      // Conserva el propietario original si está inactivo o falla su consulta.
      const isOriginal = action.kind === "edit" && socioId?.toLowerCase() === action.vehicle.socioId?.toLowerCase();
      if (socioId && !isOriginal && !partners.items?.some(partner => partner.socioId === socioId && partner.activo)) { setSaveError("Selecciona un socio activo de la lista."); return; }
      const soat = field("soatVencimiento") || null; const revision = field("revisionTecnicaVencimiento") || null;
      if ((soat && dayNumber(soat) === null) || (revision && dayNumber(revision) === null)) { setSaveError("Revisa las fechas de vencimiento."); return; }
      payload = { placa: field("placa").toUpperCase(), marca: field("marca"), modelo: field("modelo"), capacidadAsientos: seats, capacidadCargaKg: cargo, socioId, soatVencimiento: soat, revisionTecnicaVencimiento: revision };
    }
    writeLock.current = true; setSaving(true);
    const controller = new AbortController(); writeRef.current = controller;
    const config = { timeout: 15000, signal: controller.signal, headers: authHeaders() };
    try {
      if (action.kind === "create" && payload) {
        await axiosClient.post<unknown>(`${root}/vehiculos`, payload, config);
      } else if (action.kind === "edit" && payload) {
        if (onUpdate) await onUpdate(action.vehicle.vehiculoId, payload, controller.signal);
        else await axiosClient.put<unknown>(`${root}/vehiculos/${encodeURIComponent(action.vehicle.vehiculoId)}`, payload, config);
      } else if (action.kind === "state" && nextState) {
        if (onChangeEstado) await onChangeEstado(action.vehicle, nextState, controller.signal);
        else await axiosClient.patch<unknown>(`${root}/vehiculos/${encodeURIComponent(action.vehicle.vehiculoId)}/estado`, { estado: nextState }, config);
      }
      if (!mounted.current) return;
      setModal(null);
      setSuccess(action.kind === "create" ? "Vehículo registrado correctamente." : action.kind === "edit" ? "Vehículo actualizado correctamente." : "Estado del vehículo actualizado correctamente.");
      refresh(); // GETs independientes: sus errores no se confunden con el éxito de la escritura.
    } catch (cause: unknown) {
      if (!mounted.current || controller.signal.aborted) return;
      setSaveError(errorMessage(cause, true));
      if (isAxiosError(cause) && (!cause.response || cause.response.status >= 500)) setUncertain(true);
    } finally { writeLock.current = false; if (mounted.current) setSaving(false); }
  }

  return <div className="jjr-flota mx-auto max-w-[1600px] space-y-6 p-4 font-sans text-[#102D50] sm:p-6 xl:p-8">
    <style>{css}</style>
    <header className="jjr-enter flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 flex items-center gap-1 text-[10px] font-medium text-slate-500">Flota & personal <ChevronRight size={12} aria-hidden="true" />Flota</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Flota de Vehículos</h1><p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500">Control de unidades de transporte, capacidades, propietarios y alertas documentarias (SOAT y Revisión Técnica).</p></div><button type="button" onClick={refresh} disabled={vehicles.loading || partners.loading} className={secondary}><RefreshCw size={16} aria-hidden="true" className={vehicles.loading || partners.loading ? "animate-spin" : ""} />{vehicles.loading || partners.loading ? "Actualizando…" : "Actualizar datos"}</button></header>

    <section aria-label="Indicadores de flota" className="grid gap-4 lg:grid-cols-3">
      <article className="jjr-enter rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500">Total unidades</p><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#075BC6]"><Bus size={20} aria-hidden="true" /></span></div><p className="mt-2 text-3xl font-bold tabular-nums">{vehicles.items ? fmt(vehicles.items.length) : "—"}</p><p className="mt-3 text-[11px] leading-5 text-slate-500">{vehicles.items ? `${stateCount("Disponible")} disponibles · ${stateCount("En Ruta")} en ruta · ${stateCount("Mantenimiento")} en mantenimiento` : "Esperando datos del servidor"}</p>{stateCount("Fuera de Servicio") > 0 && <p className="mt-1 text-[10px] text-slate-500">{stateCount("Fuera de Servicio")} fuera de servicio</p>}</article>
      <article className="jjr-enter rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500">Vehículos propios vs. socios</p><span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Handshake size={20} aria-hidden="true" /></span></div><div className="mt-3 flex items-baseline gap-3"><strong className="text-3xl tabular-nums">{vehicles.items ? fmt(ownCount) : "—"}</strong><span className="text-xs text-slate-500">propios</span><span aria-hidden="true" className="text-slate-300">/</span><strong className="text-3xl text-[#075BC6] tabular-nums">{vehicles.items ? fmt(vehicles.items.length - ownCount) : "—"}</strong><span className="text-xs text-slate-500">socios</span></div><div aria-hidden="true" className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#F5B000]/40"><div className="h-full rounded-full bg-[#075BC6] transition-all duration-300" style={{ width: `${vehicles.items?.length ? ownCount / vehicles.items.length * 100 : 0}%` }} /></div><p className="mt-2 text-[10px] text-slate-500">Distribución de propiedad de todas las unidades.</p></article>
      <article className="jjr-enter rounded-2xl border border-amber-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500">Alertas de documentos</p><span className={`flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ${expired + expiring > 0 ? "animate-pulse" : ""}`}><AlertTriangle size={20} aria-hidden="true" /></span></div><p className="mt-2 text-3xl font-bold tabular-nums">{docs ? fmt(expired + expiring) : "—"}</p><div className="mt-3 flex flex-wrap gap-2 text-[10px]">{docs ? <><span className="rounded-full bg-red-50 px-2 py-1 font-medium text-red-800">{expired} vencidos</span><span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-800">{expiring} por vencer ≤ 15 días</span>{unknown > 0 && <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">{unknown} sin fecha</span>}</> : <span className="text-slate-500">Consultando SOAT y revisión técnica</span>}</div></article>
    </section>

    <div aria-live="polite" aria-atomic="true">{success && <div className="jjr-enter flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"><CheckCircle2 size={17} aria-hidden="true" /><span className="flex-1">{success}</span><button type="button" aria-label="Cerrar confirmación" onClick={() => setSuccess("")} className={`rounded p-1 ${focus}`}><X size={16} /></button></div>}</div>
    {vehicles.error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs leading-6 text-red-800"><p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} aria-hidden="true" />No se pudo actualizar la flota</p><p>{vehicles.error}</p>{vehicles.items && <p>Se conserva la última información cargada.</p>}<button type="button" onClick={vehicles.reload} disabled={vehicles.loading} className={`mt-2 rounded px-1 py-2 font-semibold underline ${focus}`}>Reintentar vehículos</button></div>}
    {partners.error && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900"><p className="font-semibold">No se pudo actualizar la lista de socios</p><p>{partners.error}</p><p>{partners.items ? "Se conserva la última lista de propietarios cargada." : "Puedes registrar unidades propias. Al editar, se conserva el propietario original."}</p><button type="button" onClick={partners.reload} disabled={partners.loading} className={`mt-2 rounded px-1 py-2 font-semibold underline ${focus}`}>Reintentar socios</button></div>}

    <section aria-labelledby={`${id}-table-title`} className="jjr-enter overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 id={`${id}-table-title`} className="flex items-center gap-2 text-sm font-bold"><Truck size={18} aria-hidden="true" className="text-[#075BC6]" />Unidades de transporte</h2><p className="mt-1 text-[10px] text-slate-500">Disponibilidad, capacidades y documentación de cada vehículo.</p></div><button type="button" onClick={() => open({ kind: "create" })} className={primary}><Plus size={17} aria-hidden="true" />Registrar Vehículo</button></div>
      <div className="flex flex-wrap items-center gap-3 p-5"><label className="relative min-w-[220px] flex-1 sm:max-w-sm"><span className="sr-only">Buscar por placa, marca o modelo</span><Search size={17} aria-hidden="true" className="absolute top-3.5 left-3 text-slate-400" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar placa, marca o modelo…" className={`${input} pl-10`} /></label><label className="w-full sm:w-auto"><span className="sr-only">Filtrar estado del vehículo</span><select value={stateFilter} onChange={event => setStateFilter(event.target.value)} className={input}><option value="all">Todos los estados</option>{STATES.map(state => <option key={state} value={state}>{state}</option>)}</select></label>{(query || stateFilter !== "all") && <button type="button" onClick={() => { setQuery(""); setStateFilter("all"); }} className={`rounded-lg px-2 py-3 text-xs font-medium text-[#075BC6] hover:bg-blue-50 ${focus}`}>Limpiar filtros</button>}</div>
      {vehicles.loading && !vehicles.items ? <Skeletons /> : !filtered ? <Empty title="Datos de flota no disponibles" detail="Reintenta la carga para consultar las unidades." /> : !filtered.length ? <Empty title={vehicles.items?.length ? "No se encontraron coincidencias" : "Tu flota comienza aquí"} detail={vehicles.items?.length ? "Prueba otra búsqueda o cambia el filtro de estado." : "Registra el primer vehículo para comenzar."} /> : <div role="region" aria-label="Tabla de vehículos, desplazable horizontalmente" tabIndex={0} className={`overflow-x-auto ${focus}`}>
        <table className="w-full min-w-[1160px] text-left text-xs"><caption className="sr-only">Vehículos, propietarios, documentos y estados operativos</caption><thead className="border-y border-slate-100 bg-slate-50 text-[10px] tracking-wide text-slate-500 uppercase"><tr>{["Placa", "Marca y modelo", "Capacidad", "Propietario", "Documentos", "Estado", "Acciones"].map(label => <th key={label} scope="col" className="px-4 py-3.5 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(vehicle => {
          const partner = findPartner(vehicle.socioId);
          return <tr key={vehicle.vehiculoId} className="transition-colors duration-300 hover:bg-blue-50/50"><th scope="row" className="px-4 py-5"><Plate text={vehicle.placa} /></th><td className="px-4 py-5"><p className="font-semibold">{vehicle.marca}</p><p className="mt-1 text-[10px] text-slate-500">{vehicle.modelo}</p></td><td className="px-4 py-5"><p>{fmt(vehicle.capacidadAsientos)} asientos</p><p className="mt-1 text-[10px] text-slate-500">{fmt(vehicle.capacidadCargaKg)} kg de carga</p></td><td className="max-w-48 px-4 py-5"><p className="text-[11px] leading-5">{vehicle.socioId ? vehicle.socioPropietario : "Vehículo Propio JJR"}</p>{vehicle.socioId && <p className="mt-1 text-[10px] font-medium text-[#075BC6]">{partner ? `${fmt(partner.porcentajeGanancia ?? 70)}% socio` : "Porcentaje no disponible"}</p>}</td><td className="px-4 py-5"><div className="flex flex-col items-start gap-2"><DocumentBadge label="SOAT" date={vehicle.soatVencimiento} today={today} /><DocumentBadge label="RT" date={vehicle.revisionTecnicaVencimiento} today={today} /></div></td><td className="px-4 py-5"><StateBadge vehicle={vehicle} /></td><td className="px-4 py-5"><div className="flex items-center gap-0.5">
            <button type="button" title="Editar vehículo" aria-label={`Editar vehículo ${vehicle.placa}`} onClick={() => open({ kind: "edit", vehicle })} className={`rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-blue-100 hover:text-[#075BC6] ${focus}`}><Pencil size={17} /></button>
            <button type="button" title="Ver ficha técnica" aria-label={`Ver ficha de ${vehicle.placa}`} onClick={() => open({ kind: "view", vehicle })} className={`rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-blue-100 hover:text-[#075BC6] ${focus}`}><Eye size={17} /></button>
            <button type="button" title="Cambiar estado" aria-label={`Cambiar estado de ${vehicle.placa}`} onClick={() => open({ kind: "state", vehicle })} className={`rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-700 ${focus}`}><ToggleLeft size={18} /></button>
          </div></td></tr>;
        })}</tbody></table>
      </div>}
      <p role="status" className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500">{vehicles.items ? `Mostrando ${filtered?.length ?? 0} de ${vehicles.items.length} vehículos` : "Esperando datos del servidor"}{vehicles.loading && vehicles.items ? " · Actualizando…" : ""}</p>
    </section>
    <p className="flex items-start gap-2 text-[10px] leading-5 text-slate-500"><ShieldCheck size={14} aria-hidden="true" className="mt-0.5 shrink-0" />Las alertas cuentan documentos, no vehículos. Se incluyen vencimientos de hoy y de los próximos 15 días, según el calendario de Lima.</p>

    {modal && <Modal key={modal.kind} title={modal.kind === "create" ? "Registrar Vehículo" : modal.kind === "edit" ? "Editar Vehículo" : modal.kind === "state" ? "Cambiar estado operativo" : "Ficha técnica del vehículo"} description={modal.kind === "create" ? "La unidad se registrará como Disponible y Activa. Los campos con * son obligatorios." : modal.kind === "edit" ? "Actualiza los datos de la unidad. La edición conserva su estado operativo." : modal.kind === "state" ? "Selecciona el estado operativo que se guardará para esta unidad." : "Capacidades, propietario y documentación de la unidad."} busy={saving} onClose={close}>
      {saveError && <p role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"><AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />{saveError}</p>}
      {modal.kind === "view" ? <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><div><Plate text={modal.vehicle.placa} large /><p className="mt-3 text-xs font-semibold">{modal.vehicle.marca} {modal.vehicle.modelo}</p></div><StateBadge vehicle={modal.vehicle} /></div>
        <dl className="grid gap-4 sm:grid-cols-2">{[["Capacidad de pasajeros", `${fmt(modal.vehicle.capacidadAsientos)} asientos`], ["Capacidad de carga", `${fmt(modal.vehicle.capacidadCargaKg)} kg`], ["Propietario", modal.vehicle.socioId ? modal.vehicle.socioPropietario : "Vehículo Propio JJR"], ["Participación del socio", modal.vehicle.socioId ? findPartner(modal.vehicle.socioId) ? `${fmt(findPartner(modal.vehicle.socioId)?.porcentajeGanancia ?? 70)}%` : "No disponible" : "No aplica"], ["Vencimiento SOAT", displayDate(modal.vehicle.soatVencimiento)], ["Revisión técnica", displayDate(modal.vehicle.revisionTecnicaVencimiento)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] text-slate-500">{label}</dt><dd className="mt-1 break-words text-xs font-semibold">{value}</dd></div>)}</dl>
        <div className="mt-4 flex flex-wrap gap-2"><DocumentBadge label="SOAT" date={modal.vehicle.soatVencimiento} today={today} /><DocumentBadge label="RT" date={modal.vehicle.revisionTecnicaVencimiento} today={today} /></div>
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={() => open({ kind: "edit", vehicle: modal.vehicle })} className={secondary}><Pencil size={15} aria-hidden="true" />Editar datos</button><button type="button" onClick={() => open({ kind: "state", vehicle: modal.vehicle })} className={secondary}><ToggleLeft size={17} aria-hidden="true" />Cambiar estado</button><button type="button" onClick={close} className={primary}>Cerrar ficha <ArrowRight size={15} aria-hidden="true" /></button></div>
      </> : <form onSubmit={event => void submit(event)} aria-busy={saving}>
        {modal.kind === "state" ? <fieldset disabled={saving || uncertain} className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><Plate text={modal.vehicle.placa} /><StateBadge vehicle={modal.vehicle} /></div><Field label="Nuevo estado *"><select autoFocus required value={nextState} onChange={event => setNextState(event.target.value as EstadoVehiculo | "")} className={input}><option value="">Selecciona un estado</option>{STATES.map(state => <option key={state} value={state}>{state}</option>)}</select></Field>{nextState === "Fuera de Servicio" && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">La unidad quedará inactiva. Podrás reactivarla asignándole otro estado.</p>}</fieldset> : <fieldset disabled={saving || uncertain} className="grid gap-4 sm:grid-cols-2">
          <Field label="Placa *"><input autoFocus name="placa" required maxLength={15} autoCapitalize="characters" defaultValue={edited?.placa ?? ""} placeholder="TJJ-701" className={`${input} uppercase`} /></Field>
          <Field label="Marca *"><input name="marca" required maxLength={100} defaultValue={edited?.marca ?? ""} placeholder="Toyota" className={input} /></Field>
          <Field label="Modelo *"><input name="modelo" required maxLength={100} defaultValue={edited?.modelo ?? ""} placeholder="Hilux 4x4" className={input} /></Field>
          <Field label="Capacidad de asientos *"><input name="capacidadAsientos" required type="number" min={0} max={2147483647} step={1} defaultValue={edited?.capacidadAsientos ?? 0} className={input} /></Field>
          <Field label="Capacidad de carga (kg) *"><input name="capacidadCargaKg" required type="number" min={0} step="0.01" defaultValue={edited?.capacidadCargaKg ?? 0} className={input} /></Field>
          <Field label="Socio propietario" hint={partners.loading ? "Actualizando lista de socios…" : partners.error ? "Lista de socios no actualizada; el propietario original se conserva." : "Opcional. Selecciona un socio activo o una unidad propia."}><select name="socioId" value={owner} onChange={event => setOwner(event.target.value)} className={input}><option value="">Vehículo Propio JJR</option>{keepOriginalOwner && edited?.socioId && <option value={edited.socioId}>{edited.socioPropietario} (propietario actual)</option>}{availablePartners.map(partner => <option key={partner.socioId} value={partner.socioId}>{partner.razonSocialNombre}{!partner.activo ? " (socio inactivo actual)" : ""}</option>)}</select></Field>
          <Field label="Vencimiento SOAT" hint="Opcional. Una fecha vacía se muestra como Sin fecha válida."><input name="soatVencimiento" type="date" defaultValue={edited?.soatVencimiento ?? ""} className={input} /></Field>
          <Field label="Vencimiento revisión técnica"><input name="revisionTecnicaVencimiento" type="date" defaultValue={edited?.revisionTecnicaVencimiento ?? ""} className={input} /></Field>
        </fieldset>}
        {modal.kind !== "state" && owner && selectedPartner && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-[#075BC6]">Participación: {fmt(selectedPartner.porcentajeGanancia ?? 70)}% socio / {fmt(100 - (selectedPartner.porcentajeGanancia ?? 70))}% empresa.</p>}
        <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" disabled={saving} onClick={close} className={secondary}>{uncertain ? "Cerrar y verificar lista" : "Cancelar"}</button><button type="submit" disabled={saving || uncertain} className={primary}>{saving ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}{saving ? "Guardando…" : modal.kind === "create" ? "Guardar vehículo" : "Guardar cambios"}</button></div>
      </form>}
    </Modal>}
  </div>;
}
