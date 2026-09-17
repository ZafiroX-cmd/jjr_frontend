import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { isAxiosError } from "axios";
import { AlertCircle, ArrowRight, CalendarDays, CarFront, Check, ChevronRight, LoaderCircle, MapPin, Plus, RefreshCw, Search, Users, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, Armchair, ShieldCheck, Route as RouteIcon } from "lucide-react";
import axiosClient from "../api/axiosClient";

/** Adaptado al ViajesController con oficinas y RutaParadas.
 * POST: fechaSalida UTC con Z. GET: fechaHoraSalida UTC, mostrado en Lima.
 * usuario prop: recomendado desde AuthContext. Alternativa: localStorage.user/token.
 * Tras cambiar localStorage en la misma ventana, emitir jjr:session-changed.
 * Los claims del JWT se leen para la interfaz, NO se verifica su firma aquí.
 * El servidor debe autorizar cada consulta y cambio de estado por oficina.
 */
export type EstadoViaje = "Programado" | "En Ruta" | "Finalizado" | "Cancelado";
export interface Viaje {
  viajeId: string; rutaNombre: string; rutaId: number;
  oficinaOrigenId: number | null; oficinaOrigenNombre: string;
  vehiculoId: string; placa: string; conductorId: string; conductorNombre: string;
  fechaHoraSalida: string; precioPasaje: number; manifiestoCerrado: boolean;
  asientosOcupados: number; asientosDisponibles: number; estado: EstadoViaje;
}
export interface Parada { paradaId: number; nombreParada: string; orden: number; esOficina: boolean }
export interface Ruta { rutaId: number; origen: string; destino: string; nombre: string; precioSugerido: number; paradas: Parada[] }
export interface RecursosViaje {
  rutas: Ruta[];
  vehiculos: { vehiculoId: string; placa: string; marca: string }[];
  conductores: { conductorId: string; nombre: string }[];
  oficinas: { oficinaId: number; nombre: string; direccion: string | null }[];
}
export interface ProgramarViajeDto {
  rutaId: number; oficinaOrigenId: number; vehiculoId: string;
  conductorId: string; fechaSalida: string; precioPasaje: number;
}
export interface PerfilViajes { rol: string; oficinaId: number | null; nombreCompleto?: string }
export interface ViajesPageProps { apiRoot?: string; usuario?: PerfilViajes }
const AFORO = 4;
const ESTADOS: EstadoViaje[] = ["Programado", "En Ruta", "Finalizado", "Cancelado"];
const SIGUIENTES: Record<EstadoViaje, EstadoViaje[]> = {
  Programado: ["En Ruta", "Cancelado"],
  "En Ruta": ["Finalizado", "Cancelado"],
  Finalizado: [], Cancelado: [],
};
const COLOR: Record<EstadoViaje, string> = {
  Programado: "bg-blue-50 text-[#075BC6]", "En Ruta": "bg-emerald-50 text-emerald-800",
  Finalizado: "bg-slate-100 text-slate-600", Cancelado: "bg-red-50 text-red-800",
};
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A3E0]";
const input = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-[#062443] outline-none transition duration-300 focus:border-[#075BC6] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60";
const primary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#075BC6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-[#062443] hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const secondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium transition duration-300 hover:bg-blue-50 disabled:opacity-50 ${focus}`;
const CSS = `
@keyframes jjr-trip-enter { from {opacity:0;transform:translateY(12px)} to {opacity:1;transform:translateY(0)} }
@keyframes jjr-trip-modal { from {opacity:0;transform:translateY(12px) scale(.96)} to {opacity:1;transform:translateY(0) scale(1)} }
.jjr-viajes .jjr-enter {animation:jjr-trip-enter .45s cubic-bezier(.16,1,.3,1) both}
.jjr-viajes dialog[open] {animation:jjr-trip-modal .25s cubic-bezier(.16,1,.3,1) both}
.jjr-viajes dialog::backdrop {background:rgb(6 36 67 / .45);backdrop-filter:blur(5px)}
@media(prefers-reduced-motion:reduce){.jjr-viajes *,.jjr-viajes *::before,.jjr-viajes *::after{animation:none!important;transition:none!important}}
`;
function headers(): Record<string, string> {
  try { const token = localStorage.getItem("token"); return token ? { Authorization: `Bearer ${token}` } : {}; }
  catch { return {}; }
}
function message(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 401) return "Tu sesión venció. Inicia sesión nuevamente.";
    if (error.response?.status === 403) return "No tienes permiso para realizar esta operación.";
    const data: unknown = error.response?.data;
    if (data && typeof data === "object" && "mensaje" in data && typeof data.mensaje === "string") return data.mensaje;
    if (error.response?.status === 409) return "Los datos cambiaron o el recurso ya está asignado. Actualiza la información.";
    return "No se pudo completar la solicitud. Revisa tu conexión e inténtalo nuevamente.";
  }
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("La API devolvió un registro inválido.");
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.charAt(0).toLowerCase() + key.slice(1), item]));
}
function textValue(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("La API devolvió un texto requerido vacío o inválido.");
  return value;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("La API debe devolver una lista JSON.");
  return value;
}
function instant(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) throw new Error("Fecha de salida inválida en la API.");
  const result = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
  if (Number.isNaN(result.getTime())) throw new Error("Fecha de salida inválida en la API.");
  return result;
}
function limaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function limaInput(date: Date): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return `${limaDate(date)}T${time}`;
}
const dateLabel = (value: string) => new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric" }).format(instant(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).format(instant(value));
function nonnegative(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("La API devolvió un número inválido.");
  return value;
}
function routeId(value: unknown): number {
  const result = nonnegative(value);
  if (!Number.isInteger(result) || result < 1) throw new Error("RutaId debe ser un entero positivo.");
  return result;
}
function booleanValue(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("La API devolvió un indicador inválido.");
  return value;
}
function decodeViaje(raw: unknown): Viaje {
  const r = object(raw); const estado = textValue(r.estado);
  if (!ESTADOS.includes(estado as EstadoViaje)) throw new Error("Estado de viaje desconocido.");
  const occupied = nonnegative(r.asientosOcupados);
  if (!Number.isInteger(occupied) || occupied > AFORO || r.asientosDisponibles !== AFORO - occupied) throw new Error("La ocupación recibida no coincide con el aforo de 4 pasajeros.");
  const fechaHoraSalida = textValue(r.fechaHoraSalida); instant(fechaHoraSalida);
  return { viajeId: textValue(r.viajeId), rutaNombre: textValue(r.rutaNombre), rutaId: routeId(r.rutaId),
    oficinaOrigenId: r.oficinaOrigenId == null ? null : routeId(r.oficinaOrigenId), oficinaOrigenNombre: textValue(r.oficinaOrigenNombre),
    vehiculoId: textValue(r.vehiculoId), placa: textValue(r.placa), conductorId: textValue(r.conductorId), conductorNombre: textValue(r.conductorNombre),
    fechaHoraSalida, precioPasaje: nonnegative(r.precioPasaje), manifiestoCerrado: booleanValue(r.manifiestoCerrado),
    asientosOcupados: occupied, asientosDisponibles: AFORO - occupied, estado: estado as EstadoViaje };
}
function decodeRecursos(raw: unknown): RecursosViaje {
  const r = object(raw);
  return {
    rutas: array(r.rutas).map(raw => { const v = object(raw); return { rutaId: routeId(v.rutaId), nombre: textValue(v.nombre), origen: textValue(v.origen), destino: textValue(v.destino), precioSugerido: nonnegative(v.precioSugerido),
      paradas: array(v.paradas).map(raw => { const p = object(raw); return { paradaId: routeId(p.paradaId), nombreParada: textValue(p.nombreParada), orden: nonnegative(p.orden), esOficina: booleanValue(p.esOficina) }; }).sort((a,b) => a.orden-b.orden) }; }),
    vehiculos: array(r.vehiculos).map(raw => { const v = object(raw); return { vehiculoId: textValue(v.vehiculoId), placa: textValue(v.placa), marca: typeof v.marca === "string" ? v.marca : "" }; }),
    conductores: array(r.conductores).map(raw => { const v = object(raw); return { conductorId: textValue(v.conductorId), nombre: textValue(v.nombre) }; }),
    oficinas: array(r.oficinas).map(raw => { const v = object(raw); return { oficinaId: routeId(v.oficinaId), nombre: textValue(v.nombre), direccion: typeof v.direccion === "string" ? v.direccion : null }; }),
  };
}
function Alert({ children }: { children: ReactNode }) {
  return <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><AlertCircle size={18} className="mt-1 shrink-0" aria-hidden="true" /><div>{children}</div></div>;
}
function Modal({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (!busy && event.target === event.currentTarget) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-xl overflow-y-auto rounded-3xl border-0 bg-white p-6 text-[#062443] shadow-2xl sm:p-8"><div className="mb-6 flex items-start justify-between gap-3"><h2 id={titleId} className="text-xl font-bold">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar modal" className={`rounded-lg p-2 hover:bg-slate-100 ${focus}`}><X size={20} /></button></div>{children}</dialog>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label>;
}
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
function readProfile(): PerfilViajes | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem("user") ?? "{}");
    const user = object(stored); let jwt: Record<string, unknown> = {};
    const token = localStorage.getItem("token");
    if (token) {
      const part = token.split(".")[1];
      if (part) {
        const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
        const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), c => c.charCodeAt(0));
        jwt = object(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
      }
    }
    const role: unknown = jwt.role ?? jwt["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ?? user.rol ?? user.role;
    const rawOffice = jwt.oficinaId ?? user.oficinaId;
    const office = Number(rawOffice);
    if (typeof role !== "string") return null;
    return { rol: role, oficinaId: rawOffice != null && Number.isInteger(office) && office > 0 ? office : null };
  } catch { return null; }
}
function useProfile(explicit?: PerfilViajes) {
  const [stored, setStored] = useState(readProfile);
  useEffect(() => {
    const refresh = () => setStored(readProfile());
    window.addEventListener("storage", refresh); window.addEventListener("jjr:session-changed", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("jjr:session-changed", refresh); };
  }, []);
  return explicit ?? stored;
}
function Itinerary({ ruta, oficinas }: { ruta: Ruta; oficinas: RecursosViaje["oficinas"] }) {
  const reduced = useReducedMotion(); const [selected, setSelected] = useState<string | null>(null);
  // RutaParadas puede incluir los extremos; solo se añaden si no están presentes.
  const nodes = ruta.paradas.map(p => ({ key: `p-${p.paradaId}`, name: p.nombreParada, office: p.esOficina, order: p.orden }));
  const endpoint = (name: string, key: string) => ({ key, name, office: oficinas.some(o => normalize(o.nombre) === normalize(name)), order: null });
  const ordered: { key: string; name: string; office: boolean; order: number | null }[] = [...nodes];
  if (!nodes.length || normalize(nodes[0].name) !== normalize(ruta.origen)) ordered.unshift(endpoint(ruta.origen, "origin"));
  if (!nodes.length || normalize(nodes[nodes.length - 1].name) !== normalize(ruta.destino)) ordered.push(endpoint(ruta.destino, "destination"));
  const active = ordered.find(node => node.key === selected);
  return <section aria-label={`Recorrido ${ruta.nombre}`} className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white p-4">
    <div className="mb-4 flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><RouteIcon size={17} className="text-[#075BC6]" aria-hidden="true" />Recorrido de la ruta</h3><span className="text-xs text-slate-500">{ordered.length} puntos</span></div>
    <ol className="max-h-72 overflow-y-auto pr-2">{ordered.map((node, index) => {
      const edge = index === 0 || index === ordered.length - 1;
      return <motion.li key={node.key} initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : Math.min(index, 18) * .035, duration: .25 }} className="relative pb-4 pl-10 last:pb-0">
        {index < ordered.length - 1 && <span aria-hidden="true" className="absolute top-7 bottom-0 left-3.5 border-l-2 border-dashed border-blue-200" />}
        <button type="button" aria-pressed={selected === node.key} onClick={() => setSelected(selected === node.key ? null : node.key)} className={`w-full rounded-xl px-2 py-2 text-left transition hover:bg-white ${selected === node.key ? "bg-white ring-1 ring-blue-200" : ""} ${focus}`}>
          <span className={`absolute top-2 left-0 flex size-7 items-center justify-center rounded-full ${edge ? "bg-[#075BC6] text-white" : node.office ? "bg-[#F5B000]/20 text-amber-800" : "bg-white text-slate-500 ring-1 ring-blue-100"}`}>
            {edge && !reduced && <motion.span aria-hidden="true" className="absolute inset-0 rounded-full border border-[#075BC6]" animate={{ scale: [1, 1.5], opacity: [.45, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }} />}
            {node.office ? <Building2 size={14} aria-hidden="true" /> : <MapPin size={13} aria-hidden="true" />}
          </span>
          <span className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{index + 1}. {node.name}</span>{node.office && <span className="rounded-full bg-[#F5B000]/20 px-2 py-0.5 text-[10px] font-bold text-amber-900">Oficina</span>}</span>
          <span className="text-[11px] text-slate-500">{index === 0 ? "Origen de la ruta" : index === ordered.length - 1 ? "Destino de la ruta" : "Parada intermedia"}</span>
        </button>
      </motion.li>;
    })}</ol>
    <p role="status" className="mt-3 border-t border-blue-100 pt-3 text-xs text-slate-500">{active ? `${active.name} · ${active.office ? "Oficina de atención" : "Punto del recorrido"}` : "Selecciona un punto para consultar su detalle."}</p>
  </section>;
}
function Seats({ count }: { count: number }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Aforo de pasajeros</span><span className={`rounded-full px-2 py-1 text-xs font-bold ${count === 4 ? "bg-[#F5B000]/20 text-amber-900" : "bg-blue-50 text-[#075BC6]"}`}>{count === 4 ? "Lleno · 4/4" : `${count}/4 ocupados`}</span></div><div aria-label={`${count} ocupados y ${4 - count} libres, de 4 asientos`} className="flex items-center justify-between gap-3"><div aria-hidden="true" className="flex gap-2">{[0,1,2,3].map(i => <span key={i} className={`rounded-lg border p-2 transition-colors duration-300 ${i < count ? "border-[#075BC6] bg-[#075BC6] text-white" : "border-slate-200 bg-white text-slate-400"}`}><Armchair size={19} /></span>)}</div><span className="text-xs font-medium">{4-count} libres</span></div><p className="mt-2 text-[10px] text-slate-500">Ocupación total; no indica la ubicación de cada pasajero.</p></div>;
}

export default function ViajesPage({ apiRoot, usuario }: ViajesPageProps) {
  const profile = useProfile(usuario); const reduced = useReducedMotion();
  const role = normalize(profile?.rol ?? ""); const manager = role === "administrador" || role === "gerente";
  const office = profile?.oficinaId ?? null;
  const allowed = manager || (role === "recepcionista" && office !== null && Number.isInteger(office) && office > 0);
  const endpoint = (apiRoot ?? (/\/api\/?$/i.test(axiosClient.defaults.baseURL ?? "") ? "/Viajes" : "/api/Viajes")).replace(/\/$/, "");
  const [officeFilter, setOfficeFilter] = useState("");
  const scope = `${endpoint}:${role}:${office ?? ""}:${manager ? officeFilter : office}`;
  const [snapshot, setSnapshot] = useState<{ scope: string; rows: Viaje[] } | null>(null);
  const [resources, setResources] = useState<{ scope: string; data: RecursosViaje } | null>(null);
  const [loading, setLoading] = useState(true); const [resourceLoading, setResourceLoading] = useState(true);
  const [error, setError] = useState(""); const [resourceError, setResourceError] = useState("");
  const [revision, setRevision] = useState(0); const [now, setNow] = useState(() => new Date());
  const [date, setDate] = useState(() => limaDate(new Date())); const [query, setQuery] = useState(""); const [status, setStatus] = useState("");
  const [modal, setModal] = useState<{ scope: string; kind: "create" } | { scope: string; kind: "state"; viaje: Viaje; estado: EstadoViaje } | { scope: string; kind: "route"; ruta: Ruta } | null>(null);
  const [route, setRoute] = useState(""); const [origin, setOrigin] = useState(""); const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false); const [writeError, setWriteError] = useState(""); const [uncertain, setUncertain] = useState(false);
  const [toast, setToast] = useState(""); const lock = useRef(false); const alive = useRef(true); const mutation = useRef<AbortController | null>(null);
  const currentScope = useRef(scope); currentScope.current = scope;
  const rows = allowed && snapshot?.scope === scope ? snapshot.rows : null;
  const recursos = allowed && resources?.scope === scope ? resources.data : null;
  const activeModal = modal?.scope === scope && allowed ? modal : null;
  const selectedRoute = recursos?.rutas.find(r => r.rutaId === Number(route));
  const reload = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; mutation.current?.abort(); }; }, []);
  useEffect(() => { const timer = window.setInterval(() => { setNow(new Date()); reload(); }, 60000); return () => window.clearInterval(timer); }, [reload]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 6500); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!allowed) { setLoading(false); setResourceLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setResourceLoading(true); setError(""); setResourceError("");
    const params = { oficinaId: manager ? (officeFilter ? Number(officeFilter) : undefined) : office };
    void axiosClient.get<unknown>(endpoint, { params, signal: controller.signal, headers: headers(), timeout: 15000 })
      .then(({data}) => {
        const parsed = array(data).map(decodeViaje);
        // Defensa adicional de interfaz: nunca mostrar otra oficina a Recepción.
        const safe = parsed.filter(v => manager ? (!officeFilter || v.oficinaOrigenId === Number(officeFilter)) : v.oficinaOrigenId === office);
        if (!controller.signal.aborted) setSnapshot({scope, rows: safe});
      }).catch((e: unknown) => { if (!controller.signal.aborted) setError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    void axiosClient.get<unknown>(`${endpoint}/recursos`, { signal: controller.signal, headers: headers(), timeout: 15000 })
      .then(({data}) => { const parsed = decodeRecursos(data); if (!controller.signal.aborted) setResources({scope, data: parsed}); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setResourceError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setResourceLoading(false); });
    return () => controller.abort();
  }, [endpoint, allowed, manager, office, officeFilter, scope, revision]);
  function openCreate() { setRoute(""); setPrice(""); setOrigin(manager ? officeFilter : String(office)); setWriteError(""); setUncertain(false); setModal({scope, kind:"create"}); }
  function close() { if (!lock.current) { setModal(null); if (uncertain) reload(); } }
  function openState(viaje: Viaje, estado: EstadoViaje) { setWriteError(""); setUncertain(false); setModal({scope, kind:"state", viaje, estado}); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current || uncertain || !allowed || !activeModal || activeModal.kind === "route") return;
    setWriteError(""); const requestedScope = scope;
    let payload: ProgramarViajeDto | {estado: EstadoViaje};
    if (activeModal.kind === "create") {
      if (!recursos || !selectedRoute) return;
      const data = new FormData(event.currentTarget); const get = (key: string) => String(data.get(key) ?? "").trim();
      const originId = manager ? Number(origin) : office;
      const departure = get("fechaSalida"); const departureDate = new Date(`${departure}:00-05:00`);
      if (!originId || !recursos.oficinas.some(o => o.oficinaId === originId)) { setWriteError("Selecciona una oficina de origen activa."); return; }
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(departure) || !Number.isFinite(departureDate.getTime()) || departureDate.getTime() <= Date.now()) { setWriteError("Selecciona una salida futura en horario de Lima."); return; }
      if (!/^\d+(?:\.\d{1,2})?$/.test(price) || Number(price) <= 0 || !Number.isFinite(Number(price))) { setWriteError("Ingresa un precio positivo con hasta dos decimales."); return; }
      if (!recursos.vehiculos.some(v => v.vehiculoId === get("vehiculoId")) || !recursos.conductores.some(c => c.conductorId === get("conductorId"))) { setWriteError("Selecciona una camioneta y un conductor válidos."); return; }
      payload = { rutaId: selectedRoute.rutaId, oficinaOrigenId: originId, fechaSalida: departureDate.toISOString(), precioPasaje: Number(price), vehiculoId: get("vehiculoId"), conductorId: get("conductorId") };
    } else {
      const latest = rows?.find(v => v.viajeId === activeModal.viaje.viajeId);
      if (!latest || (!manager && latest.oficinaOrigenId !== office) || !SIGUIENTES[latest.estado].includes(activeModal.estado)) { setWriteError("El viaje cambió o no pertenece a tu oficina. Actualiza la lista."); return; }
      payload = {estado: activeModal.estado};
    }
    lock.current = true; setSaving(true); const controller = new AbortController(); mutation.current = controller;
    try {
      const config = {signal: controller.signal, headers: headers(), timeout: 15000};
      if (activeModal.kind === "create") await axiosClient.post(endpoint, payload, config);
      else await axiosClient.patch(`${endpoint}/${encodeURIComponent(activeModal.viaje.viajeId)}/estado`, payload, config);
      if (alive.current && currentScope.current === requestedScope) { setToast(activeModal.kind === "create" ? "Salida programada correctamente." : "Estado del viaje actualizado."); setModal(null); reload(); }
    } catch (e: unknown) {
      if (alive.current && currentScope.current === requestedScope && !controller.signal.aborted) {
        const unknownResult = isAxiosError(e) && (!e.response || e.response.status >= 500); setUncertain(unknownResult);
        setWriteError(unknownResult ? "No se pudo confirmar el resultado. Cierra y verifica la lista antes de repetir la operación." : message(e));
      }
    } finally { lock.current = false; if (alive.current) setSaving(false); }
  }
  const today = limaDate(now); const todayRows = rows?.filter(v => limaDate(instant(v.fechaHoraSalida)) === today);
  const kpis = [
    {label:"Salidas de hoy", value:todayRows?.length, icon:CalendarDays, detail:"Todas las salidas del día"},
    {label:"Vehículos en ruta", value:rows ? new Set(rows.filter(v => v.estado === "En Ruta").map(v => v.vehiculoId)).size : undefined, icon:CarFront, detail:"Camionetas únicas en curso"},
    {label:"Asientos libres hoy", value:todayRows?.filter(v => v.estado === "Programado").reduce((sum,v) => sum+v.asientosDisponibles,0), icon:Users, detail:"Salidas aún programadas"},
  ];
  const filtered = rows?.filter(v => (!date || limaDate(instant(v.fechaHoraSalida)) === date) && (!status || v.estado === status) && normalize(`${v.rutaNombre} ${v.placa} ${v.conductorNombre}`).includes(normalize(query))).sort((a,b) => instant(a.fechaHoraSalida).getTime()-instant(b.fechaHoraSalida).getTime());
  const missingOffice = !manager && recursos && !recursos.oficinas.some(o => o.oficinaId === office);
  const noResources = !recursos || !recursos.rutas.length || !recursos.vehiculos.length || !recursos.conductores.length || !recursos.oficinas.length || missingOffice;
  return <div className="jjr-viajes mx-auto max-w-[1600px] space-y-6 p-4 font-sans text-[#062443] sm:p-6 xl:p-8"><style>{CSS}</style>
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 flex items-center gap-1 text-xs text-slate-500">Operativa <ChevronRight size={13} aria-hidden="true" />Viajes y salidas</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Salidas Programadas</h1><p className="mt-2 text-sm text-slate-500">Cuatro asientos. Un destino. Todo listo para salir.</p></div><button type="button" onClick={openCreate} disabled={!allowed || saving} className={primary}><Plus size={18} aria-hidden="true" />Programar Salida</button></header>
    {!allowed ? <Alert>No se puede cargar la programación: necesitas un perfil Administrador/Gerente o Recepcionista con una oficina asignada.</Alert> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#062443] px-5 py-4 text-white"><p className="flex items-center gap-2 text-sm"><ShieldCheck size={18} className="text-[#F5B000]" aria-hidden="true" />{profile?.rol} · {manager ? "Gestión de oficinas" : recursos?.oficinas.find(o => o.oficinaId === office)?.nombre ?? `Oficina ${office}`}</p><span className="text-xs text-blue-100">Hora de Lima · 1 copiloto + 3 asientos atrás</span></div>
      <section aria-label="Indicadores operativos" className="grid gap-4 lg:grid-cols-3">{kpis.map(({label,value,icon:Icon,detail},i) => <motion.article key={label} initial={reduced ? false : {opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.35,delay:reduced ? 0 : i*.07}} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"><div className="flex items-center justify-between"><h2 className="text-sm text-slate-500">{label}</h2><span className="rounded-xl bg-blue-50 p-3 text-[#075BC6]"><Icon size={20} aria-hidden="true" /></span></div><p className="mt-2 text-3xl font-bold">{value ?? "—"}</p><p className="mt-2 text-xs text-slate-500">{detail} · {manager && !officeFilter ? "Todas las oficinas" : "Oficina seleccionada"}</p></motion.article>)}</section>
      {error && <Alert>{error}{rows && <p>Se conserva la última información recibida.</p>}<button type="button" onClick={reload} className={`mt-2 rounded underline ${focus}`}>Reintentar</button></Alert>}
      {resourceError && <Alert>{resourceError}<p>No se pudieron actualizar los recursos para programar o mostrar recorridos.</p><button type="button" onClick={reload} className={`mt-2 rounded underline ${focus}`}>Reintentar recursos</button></Alert>}
      <section aria-label="Filtros de salidas" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="min-w-0 flex-1 basis-60"><span className="mb-2 block text-sm font-medium">Buscar salida</span><span className="relative block"><Search size={17} aria-hidden="true" className="absolute top-3.5 left-3 text-slate-400" /><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ruta, placa o conductor…" className={`${input} pl-10`} /></span></label>
        {manager ? <Field label="Oficina de origen"><select value={officeFilter} onChange={e=>setOfficeFilter(e.target.value)} className={input}><option value="">Todas las oficinas</option>{recursos?.oficinas.map(o=><option key={o.oficinaId} value={o.oficinaId}>{o.nombre}</option>)}{officeFilter && !recursos?.oficinas.some(o=>o.oficinaId===Number(officeFilter)) && <option value={officeFilter}>Oficina {officeFilter}</option>}</select></Field> : <Field label="Oficina asignada"><input readOnly value={recursos?.oficinas.find(o=>o.oficinaId===office)?.nombre ?? `Oficina ${office}`} className={input} /></Field>}
        <Field label="Fecha de salida"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className={input} /></Field><Field label="Estado"><select value={status} onChange={e=>setStatus(e.target.value)} className={input}><option value="">Todos</option>{ESTADOS.map(s=><option key={s}>{s}</option>)}</select></Field><button type="button" onClick={()=>{setDate("");setStatus("");setQuery("");}} className={secondary}>Todas las fechas</button><button type="button" onClick={reload} disabled={loading} className={secondary}><RefreshCw size={17} aria-hidden="true" className={loading ? "animate-spin" : ""} />Actualizar</button>
      </section>
      <p role="status" className="text-xs text-slate-500">{loading ? "Actualizando salidas…" : `${filtered?.length ?? 0} salidas encontradas`} · Indicadores del {today} · Actualización cada 60 s</p>
      {loading && !rows ? <div role="status" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"><span className="sr-only">Cargando salidas</span>{[0,1,2].map(i=><div key={i} aria-hidden="true" className="h-80 animate-pulse rounded-3xl bg-slate-100" />)}</div> : !filtered?.length ? <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center"><CarFront size={34} aria-hidden="true" className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">{rows ? "No hay salidas para estos filtros" : "Programación no disponible"}</p></div> : <section aria-label="Tarjetas de salidas" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((v,i)=>{
        const itinerary = recursos?.rutas.find(r=>r.rutaId===v.rutaId);
        return <motion.article key={v.viajeId} initial={reduced ? false : {opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.3,delay:reduced ? 0 : Math.min(i,8)*.04}} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${COLOR[v.estado]}`}>{v.estado}</span><span className="text-xs font-semibold text-slate-500">{new Intl.NumberFormat("es-PE",{style:"currency",currency:"PEN"}).format(v.precioPasaje)}</span></div><h2 className="text-lg font-bold leading-7">{v.rutaNombre}</h2><p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Building2 size={14} aria-hidden="true" />{v.oficinaOrigenNombre}</p><div className="my-4 flex items-center gap-2 border-y border-slate-100 py-3 text-sm"><CalendarDays size={16} aria-hidden="true" className="text-[#075BC6]" />{dateLabel(v.fechaHoraSalida)}<span className="ml-auto font-bold">{timeLabel(v.fechaHoraSalida)}</span></div><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><span className="rounded-md border border-slate-200 border-l-4 border-l-[#075BC6] px-2.5 py-1.5 text-xs font-bold tracking-wider">{v.placa}</span><span className="text-xs text-slate-500">{v.conductorNombre}</span></div><Seats count={v.asientosOcupados} />
          <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" disabled={!itinerary} onClick={()=>{if(itinerary)setModal({scope,kind:"route",ruta:itinerary});}} className={`${secondary} text-xs`}><RouteIcon size={15} aria-hidden="true" />Ver recorrido</button>{SIGUIENTES[v.estado].map(next=><button type="button" key={next} disabled={saving} onClick={()=>openState(v,next)} aria-label={`${next} · ${v.placa} · ${v.rutaNombre}`} className={`min-h-10 rounded-xl px-3 text-xs font-semibold transition ${next==="Cancelado" ? "text-red-700 hover:bg-red-50" : "bg-blue-50 text-[#075BC6] hover:bg-blue-100"} ${focus}`}>{next==="En Ruta" ? "Iniciar" : next==="Cancelado" ? "Cancelar" : "Finalizar"}</button>)}</div>{v.manifiestoCerrado && <p className="mt-3 text-xs text-slate-500">Manifiesto cerrado</p>}
        </motion.article>;
      })}</section>}
    </>}
    <div role="status" aria-live="polite" aria-atomic="true" className="fixed right-4 bottom-4 z-50 max-w-[calc(100%_-_32px)]"><AnimatePresence>{toast && allowed && <motion.div key={toast} initial={reduced ? false : {opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-emerald-900 shadow-xl"><Check size={19} aria-hidden="true" />{toast}<button type="button" aria-label="Cerrar notificación" onClick={()=>setToast("")} className={`rounded p-1 ${focus}`}><X size={16}/></button></motion.div>}</AnimatePresence></div>
    {activeModal && <Modal key={activeModal.kind} title={activeModal.kind==="create" ? "Programar Salida" : activeModal.kind==="route" ? "Recorrido de la ruta" : "Confirmar cambio de estado"} busy={saving} onClose={close}>
      {activeModal.kind==="route" ? <>{recursos && <Itinerary key={activeModal.ruta.rutaId} ruta={activeModal.ruta} oficinas={recursos.oficinas}/>}<button type="button" onClick={close} className={`${secondary} mt-5`}>Cerrar recorrido</button></> : <form onSubmit={e=>void submit(e)} aria-busy={saving}>
        {writeError && <div className="mb-4"><Alert>{writeError}</Alert></div>}
        {activeModal.kind==="create" ? <>
          {resourceLoading && <p role="status" className="mb-4 flex items-center gap-2 text-sm"><LoaderCircle size={17} className="animate-spin" aria-hidden="true"/>Cargando recursos…</p>}
          {!resourceLoading && noResources && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{missingOffice ? "Tu oficina asignada no está activa o no está disponible." : "Faltan rutas, oficinas, camionetas operativas o conductores para programar."}<button type="button" onClick={reload} className={`ml-2 rounded underline ${focus}`}>Actualizar recursos</button></p>}
          <fieldset disabled={saving || uncertain || !recursos || Boolean(noResources)} className="space-y-4">
            <Field label="Oficina de origen *"><select autoFocus value={manager ? origin : String(office)} disabled={!manager} required onChange={e=>setOrigin(e.target.value)} className={input}><option value="" disabled>Selecciona el terminal</option>{recursos?.oficinas.map(o=><option key={o.oficinaId} value={o.oficinaId}>{o.nombre}</option>)}{!manager && !recursos?.oficinas.some(o=>o.oficinaId===office) && <option value={String(office)}>Oficina {office}</option>}</select></Field>
            {!manager && <p className="text-xs text-slate-500">La salida se registrará en tu oficina asignada.</p>}
            <Field label="Ruta *"><select required value={route} onChange={e=>{setRoute(e.target.value);const r=recursos?.rutas.find(r=>r.rutaId===Number(e.target.value));setPrice(r ? r.precioSugerido.toFixed(2) : "");}} className={input}><option value="" disabled>Selecciona una ruta</option>{recursos?.rutas.map(r=><option key={r.rutaId} value={r.rutaId}>{r.nombre}</option>)}</select></Field>
            <Field label="Fecha y hora · Lima *"><input type="datetime-local" name="fechaSalida" required step={60} min={limaInput(now)} className={input}/></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Camioneta *"><select name="vehiculoId" required defaultValue="" className={input}><option value="" disabled>Selecciona</option>{recursos?.vehiculos.map(v=><option key={v.vehiculoId} value={v.vehiculoId}>{v.placa} · {v.marca}</option>)}</select></Field><Field label="Conductor *"><select name="conductorId" required defaultValue="" className={input}><option value="" disabled>Selecciona</option>{recursos?.conductores.map(c=><option key={c.conductorId} value={c.conductorId}>{c.nombre}</option>)}</select></Field></div>
            <Field label="Precio del pasaje (S/) *"><input type="number" required min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} className={input}/></Field>
          </fieldset>
          <AnimatePresence mode="wait">{selectedRoute && recursos && <motion.div key={selectedRoute.rutaId} initial={reduced ? false : {opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.2}} className="mt-5"><Itinerary ruta={selectedRoute} oficinas={recursos.oficinas}/></motion.div>}</AnimatePresence>
        </> : <div className="rounded-2xl bg-slate-50 p-4"><p className="font-semibold">{activeModal.viaje.rutaNombre}</p><p className="mt-1 text-sm text-slate-500">{activeModal.viaje.placa} · {activeModal.viaje.oficinaOrigenNombre}</p><p className="mt-4 flex items-center gap-2 text-sm">{activeModal.viaje.estado}<ArrowRight size={16} aria-hidden="true"/><strong>{activeModal.estado}</strong></p>{activeModal.estado==="Cancelado" && <p className="mt-4 text-sm text-amber-900">La salida quedará cancelada. Revisa los pasajes y reservas para atender a los pasajeros.</p>}</div>}
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" disabled={saving} onClick={close} className={secondary}>{uncertain ? "Cerrar y verificar" : "Volver"}</button><button type="submit" disabled={saving || uncertain || (activeModal.kind==="create" && (Boolean(noResources) || !selectedRoute))} className={primary}>{saving ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true"/> : <Check size={17} aria-hidden="true"/>}{saving ? "Guardando…" : activeModal.kind==="create" ? "Programar salida" : "Confirmar cambio"}</button></div>
      </form>}
    </Modal>}
  </div>;
}
