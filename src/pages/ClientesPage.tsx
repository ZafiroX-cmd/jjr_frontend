import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { isAxiosError } from "axios";
import { ArrowRight, Building2, CheckCircle2, ChevronRight, LoaderCircle, Mail, MapPin, Pencil, Phone, Plus, RefreshCw, Search, ShieldCheck, Sparkles, UserRound, Users, X } from "lucide-react";
import axiosClient from "../api/axiosClient";

export interface Cliente {
  clienteId: string;
  numeroDocumento: string;
  nombreCliente: string | null;
  direccionFiscal: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
}
export interface RespuestaConsulta {
  fuente: "RENIEC" | "SUNAT" | "LOCAL";
  numeroDocumento: string;
  nombres?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  razonSocial?: string | null;
  nombreComercial?: string | null;
  direccionFiscal?: string | null;
  ubigeo?: string | null;
  telefono?: string | null;
  email?: string | null;
  estado?: string | null;
  condicion?: string | null;
}
export interface ClienteDto {
  numeroDocumento: string;
  nombres: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  razonSocial: string | null;
  nombreComercial: string | null;
  direccionFiscal: string | null;
  ubigeo: string | null;
  telefono: string | null;
  email: string | null;
}
export interface ClientesPageProps {
  /** Detecta si axiosClient.baseURL ya incluye /api. */
  apiRoot?: string;
  /** Alternativa para cargar un DTO completo antes de editar. */
  onLoadDetalle?: (cliente: Cliente, signal: AbortSignal) => Promise<ClienteDto>;
}
type Fields = { [K in keyof ClienteDto]: string };
type EditableField = Exclude<keyof Fields, "numeroDocumento">;
const FIELD_KEYS: EditableField[] = ["nombres", "apellidoPaterno", "apellidoMaterno", "razonSocial", "nombreComercial", "direccionFiscal", "ubigeo", "telefono", "email"];
const blank = (numeroDocumento = ""): Fields => ({ numeroDocumento, nombres: "", apellidoPaterno: "", apellidoMaterno: "", razonSocial: "", nombreComercial: "", direccionFiscal: "", ubigeo: "", telefono: "", email: "" });
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A3E0]";
const input = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-[#102D50] outline-none transition duration-300 placeholder:text-slate-400 focus:border-[#00A3E0] focus:bg-white focus:ring-4 focus:ring-[#00A3E0]/10 disabled:opacity-60";
const primary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#075BC6] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-[#062443] hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;
const secondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold transition duration-300 hover:bg-blue-50 disabled:opacity-60 ${focus}`;
const css = `
  @keyframes jjr-client-enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes jjr-client-modal { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes jjr-client-scan {
    0%, 100% { border-color: #00A3E0; box-shadow: 0 0 0 2px rgba(0,163,224,.08); }
    50% { border-color: #075BC6; box-shadow: 0 0 0 5px rgba(0,163,224,.16), 0 0 20px rgba(0,163,224,.12); }
  }
  @keyframes jjr-client-highlight { 0%,25% { background-color: #DCFCE7; border-color: #86EFAC; } 100% { background-color: #FFFFFF; border-color: #E2E8F0; } }
  @keyframes jjr-client-pop { 0% { opacity: 0; transform: scale(.8); } 65% { opacity: 1; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
  .jjr-clientes .jjr-stagger { animation: jjr-client-enter .5s cubic-bezier(.16,1,.3,1) both; }
  .jjr-clientes .jjr-scan { animation: jjr-client-scan 1.25s ease-in-out infinite; }
  .jjr-clientes .jjr-highlight { animation: jjr-client-highlight 1s ease-out both; }
  .jjr-clientes .jjr-source { animation: jjr-client-pop .4s cubic-bezier(.2,.8,.2,1) both; transform-origin: left center; }
  .jjr-clientes dialog[open] { animation: jjr-client-modal .25s cubic-bezier(.16,1,.3,1) both; }
  .jjr-clientes dialog::backdrop { background: rgb(15 23 42 / .45); backdrop-filter: blur(4px); }
  @media (prefers-reduced-motion: reduce) { .jjr-clientes *, .jjr-clientes *::before, .jjr-clientes *::after { animation: none !important; transition: none !important; } .jjr-clientes .jjr-highlight { background-color: #F0FDF4; } }
`;
const fmt = (value: number) => new Intl.NumberFormat("es-PE").format(value);
const matchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("La API devolvió un registro inválido.");
  // Admite también PascalCase si se desactivó la política camelCase del servidor.
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.charAt(0).toLowerCase() + key.slice(1), item]));
}
function str(r: Record<string, unknown>, key: string): string {
  const value = r[key]; if (typeof value !== "string") throw new Error(`La respuesta no contiene ${key} válido.`); return value;
}
function nullableStr(r: Record<string, unknown>, key: string): string | null { return r[key] === null ? null : str(r, key); }
function bool(r: Record<string, unknown>, key: string): boolean {
  const value = r[key]; if (typeof value !== "boolean") throw new Error(`La respuesta no contiene ${key} válido.`); return value;
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
        if (!Array.isArray(data)) throw new Error("Se esperaba una lista JSON de clientes.");
        const parsed = data.map(decode);
        if (!controller.signal.aborted) setItems(parsed);
      }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url, decode, revision]);
  return { items, loading, error, reload };
}


function decodeCliente(value: unknown): Cliente {
  const r = record(value);
  return { clienteId: str(r, "clienteId"), numeroDocumento: str(r, "numeroDocumento"), nombreCliente: nullableStr(r, "nombreCliente"), direccionFiscal: nullableStr(r, "direccionFiscal"), telefono: nullableStr(r, "telefono"), email: nullableStr(r, "email"), activo: bool(r, "activo") };
}
function decodeConsulta(value: unknown, expected: string): RespuestaConsulta {
  const r = record(value);
  const fuente = str(r, "fuente");
  if (fuente !== "RENIEC" && fuente !== "SUNAT" && fuente !== "LOCAL") throw new Error("La consulta devolvió una fuente desconocida.");
  if (str(r, "numeroDocumento") !== expected) throw new Error("La respuesta no corresponde al documento consultado. Inténtalo nuevamente.");
  if ((fuente === "RENIEC" && expected.length !== 8) || (fuente === "SUNAT" && expected.length !== 11)) throw new Error("La fuente no corresponde al tipo de documento.");
  const result: RespuestaConsulta = { fuente, numeroDocumento: expected };
  for (const key of [...FIELD_KEYS, "estado", "condicion"] as const) {
    if (Object.prototype.hasOwnProperty.call(r, key)) {
      const field = r[key]; if (typeof field !== "string" && field !== null) throw new Error(`Campo ${key} inválido en la consulta.`);
      result[key] = field;
    }
  }
  return result;
}
function toFields(data: Partial<ClienteDto> & { numeroDocumento: string }): Fields {
  const result = blank(data.numeroDocumento);
  for (const key of FIELD_KEYS) result[key] = data[key] ?? "";
  return result;
}
function labelName(cliente: Cliente) { return cliente.nombreCliente?.trim() || "Sin nombre registrado"; }

function ClientModal({ endpoint, editing, onClose, onSaved, onShowLocal, onLoadDetalle }: {
  endpoint: string; editing: Cliente | null; onClose: () => void; onSaved: (message: string) => void;
  onShowLocal: (document: string) => void; onLoadDetalle?: ClientesPageProps["onLoadDetalle"];
}) {
  const id = useId(); const dialogRef = useRef<HTMLDialogElement>(null);
  const [fields, setFields] = useState<Fields>(() => blank(editing?.numeroDocumento));
  const [lookup, setLookup] = useState<RespuestaConsulta | null>(null);
  const [lookupLoading, setLookupLoading] = useState(Boolean(editing));
  const [lookupError, setLookupError] = useState("");
  const [detailReady, setDetailReady] = useState(!editing);
  const [detailRevision, setDetailRevision] = useState(0);
  const [existing, setExisting] = useState(false);
  const [identityDirty, setIdentityDirty] = useState(false);
  const [highlighted, setHighlighted] = useState<EditableField[]>([]);
  const [flashVersion, setFlashVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const queryRef = useRef<AbortController | null>(null);
  const writeRef = useRef<AbortController | null>(null);
  const generation = useRef(0); const saveLock = useRef(false); const live = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const person = fields.numeroDocumento.length === 8;
  const company = fields.numeroDocumento.length === 11;

  useEffect(() => {
    live.current = true;
    const oldFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialogRef.current?.showModal(); document.body.style.overflow = "hidden";
    return () => {
      live.current = false; generation.current += 1;
      queryRef.current?.abort(); writeRef.current?.abort();
      if (flashTimer.current) clearTimeout(flashTimer.current);
      dialogRef.current?.close(); document.body.style.overflow = previousOverflow; oldFocus?.focus();
    };
  }, []);
  function flash(keys: EditableField[]) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setHighlighted(keys); setFlashVersion(value => value + 1);
    flashTimer.current = setTimeout(() => { if (live.current) setHighlighted([]); }, 1050);
  }
  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController(); queryRef.current?.abort(); queryRef.current = controller;
    const ticket = ++generation.current;
    setLookupLoading(true); setLookupError(""); setDetailReady(false);
    void (async () => {
      try {
        if (onLoadDetalle) {
          const detail = await onLoadDetalle(editing, controller.signal);
          const r = record(detail);
          if (str(r, "numeroDocumento") !== editing.numeroDocumento || !FIELD_KEYS.every(key => Object.prototype.hasOwnProperty.call(r, key) && (r[key] === null || typeof r[key] === "string"))) throw new Error("Se necesita una ficha completa del cliente para editarlo.");
          if (controller.signal.aborted || ticket !== generation.current) return;
          setFields(toFields(detail)); setDetailReady(true);
        } else {
          const { data } = await axiosClient.get<unknown>(`${endpoint}/consulta/${encodeURIComponent(editing.numeroDocumento)}`, { headers: authHeaders(), signal: controller.signal, timeout: 15000 });
          const detail = decodeConsulta(data, editing.numeroDocumento);
          if (detail.fuente !== "LOCAL") throw new Error("El cliente ya no está disponible en el registro local. Actualiza el directorio.");
          if (controller.signal.aborted || ticket !== generation.current) return;
          setFields(toFields(detail)); setLookup(detail);
          // El PUT reemplaza NombreComercial. Nunca convertir una propiedad omitida en null.
          // Añadir al return LOCAL del backend: nombreComercial = clienteLocal.NombreComercial,
          if (!Object.prototype.hasOwnProperty.call(detail, "nombreComercial")) throw new Error("La ficha recibida está incompleta. No se puede guardar sin recuperar todos los datos del cliente.");
          setDetailReady(true);
        }
      } catch (cause: unknown) { if (!controller.signal.aborted && ticket === generation.current) setLookupError(errorMessage(cause)); }
      finally { if (!controller.signal.aborted && ticket === generation.current) setLookupLoading(false); }
    })();
    return () => controller.abort();
  }, [editing, endpoint, onLoadDetalle, detailRevision]);

  function changeDocument(value: string) {
    const number = value.replace(/\D/g, "").slice(0, 11);
    if (number === fields.numeroDocumento) return;
    queryRef.current?.abort(); generation.current += 1;
    setFields(blank(number)); setLookup(null); setExisting(false); setLookupLoading(false);
    setLookupError(""); setSaveError(""); setHighlighted([]); setIdentityDirty(false);
  }
  async function consult() {
    if (lookupLoading || saving || editing) return;
    const document = fields.numeroDocumento;
    if (!/^(?:\d{8}|\d{11})$/.test(document)) { setLookupError("Ingresa un DNI de 8 dígitos o un RUC de 11 dígitos."); return; }
    queryRef.current?.abort(); const controller = new AbortController(); queryRef.current = controller;
    const ticket = ++generation.current;
    setLookupLoading(true); setLookupError(""); setLookup(null); setHighlighted([]); setIdentityDirty(false);
    try {
      const { data } = await axiosClient.get<unknown>(`${endpoint}/consulta/${encodeURIComponent(document)}`, { headers: authHeaders(), signal: controller.signal, timeout: 15000 });
      const result = decodeConsulta(data, document);
      if (controller.signal.aborted || ticket !== generation.current || !live.current) return;
      const keys: EditableField[] = document.length === 8 ? ["nombres", "apellidoPaterno", "apellidoMaterno"] : ["razonSocial", "direccionFiscal", "ubigeo"];
      if (result.fuente === "LOCAL") keys.push("telefono", "email", "direccionFiscal", "ubigeo", "nombreComercial");
      const updated = [...new Set(keys)].filter(key => Object.prototype.hasOwnProperty.call(result, key));
      setFields(previous => { const next = { ...previous }; for (const key of updated) next[key] = result[key] ?? ""; return next; });
      setLookup(result); setExisting(result.fuente === "LOCAL");
      flash(updated.filter(key => Boolean(result[key]?.trim())));
    } catch (cause: unknown) {
      if (!controller.signal.aborted && ticket === generation.current) setLookupError(`${errorMessage(cause)} Puedes completar los datos manualmente.`);
    } finally { if (!controller.signal.aborted && ticket === generation.current && live.current) setLookupLoading(false); }
  }
  function editField(key: EditableField, value: string) {
    setFields(previous => ({ ...previous, [key]: value })); setSaveError("");
    if (lookup && Object.prototype.hasOwnProperty.call(lookup, key) && !["telefono", "email"].includes(key)) setIdentityDirty(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveLock.current || lookupLoading || uncertain || !detailReady || (!editing && existing)) return;
    setSaveError("");
    if (!person && !company) { setSaveError("El documento debe tener 8 u 11 dígitos."); return; }
    if (person && (!fields.nombres.trim() || !fields.apellidoPaterno.trim())) { setSaveError("Ingresa los nombres y el apellido paterno."); return; }
    if (company && !fields.razonSocial.trim()) { setSaveError("Ingresa la razón social de la empresa."); return; }
    if (fields.ubigeo && !/^\d{6}$/.test(fields.ubigeo)) { setSaveError("El ubigeo debe contener 6 dígitos o quedar vacío."); return; }
    const payload: ClienteDto = { numeroDocumento: fields.numeroDocumento, nombres: null, apellidoPaterno: null, apellidoMaterno: null, razonSocial: null, nombreComercial: null, direccionFiscal: null, ubigeo: null, telefono: null, email: null };
    for (const key of FIELD_KEYS) payload[key] = fields[key].trim() || null;
    // En alta solo se envían campos de identidad del tipo correspondiente.
    // En edición se preservan todos los campos recuperados, incluidos los no visibles.
    if (!editing) {
      if (person) { payload.razonSocial = null; payload.nombreComercial = null; }
      else { payload.nombres = null; payload.apellidoPaterno = null; payload.apellidoMaterno = null; }
    }
    if (payload.email) payload.email = payload.email.toLowerCase();
    saveLock.current = true; setSaving(true);
    const controller = new AbortController(); writeRef.current = controller;
    try {
      const config = { headers: authHeaders(), signal: controller.signal, timeout: 15000 };
      if (editing) await axiosClient.put(`${endpoint}/${encodeURIComponent(editing.clienteId)}`, payload, config);
      else await axiosClient.post(endpoint, payload, config);
      if (live.current) onSaved(editing ? "Cliente actualizado correctamente." : "Cliente registrado correctamente.");
    } catch (cause: unknown) {
      if (!live.current || controller.signal.aborted) return;
      setSaveError(errorMessage(cause, true));
      if (isAxiosError(cause) && (!cause.response || cause.response.status >= 500)) setUncertain(true);
    } finally { saveLock.current = false; if (live.current) setSaving(false); }
  }
  function close() { if (!saveLock.current) onClose(); }
  function field(key: EditableField, label: string, required = false, type = "text") {
    return <label className="block min-w-0"><span className="mb-2 block text-xs font-semibold">{label}{required ? " *" : ""}</span><input key={`${key}-${flashVersion}`} type={type} name={key} required={required} value={fields[key]} onChange={event => editField(key, event.target.value)} maxLength={key === "ubigeo" ? 6 : key === "telefono" ? 25 : 250} inputMode={key === "ubigeo" ? "numeric" : undefined} className={`${input} ${highlighted.includes(key) ? "jjr-highlight" : ""}`} /></label>;
  }
  const completeIdentity = lookup && (person ? Boolean(lookup.nombres?.trim() && lookup.apellidoPaterno?.trim()) : Boolean(lookup.razonSocial?.trim()));
  const sourceLabel = !lookup ? "" : lookup.fuente === "LOCAL" ? "Encontrado en registro local" : identityDirty ? `Datos modificados · consulta ${lookup.fuente}` : completeIdentity ? `Validado por ${lookup.fuente}` : `Consulta ${lookup.fuente} · datos incompletos`;

  return <dialog ref={dialogRef} aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-2xl overflow-y-auto rounded-3xl border-0 bg-white p-0 text-[#102D50] shadow-2xl">
    <div className="p-6 sm:p-8"><div className="mb-6 flex items-start justify-between gap-3"><div><h2 id={`${id}-title`} className="text-xl font-bold tracking-tight">{editing ? "Editar Cliente" : "Registrar Cliente"}</h2><p id={`${id}-desc`} className="mt-2 text-xs leading-5 text-slate-500">{editing ? "Actualiza la ficha del cliente. El documento no se modifica." : "Busca el DNI o RUC y completa su ficha en segundos."}</p></div><button type="button" disabled={saving} aria-label="Cerrar modal" onClick={close} className={`rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 ${focus}`}><X size={20} /></button></div>
      <form onSubmit={event => void save(event)} aria-busy={saving}>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><label htmlFor={`${id}-document`} className="mb-2 block text-xs font-semibold">DNI / RUC *</label><div className="flex flex-wrap gap-2"><input id={`${id}-document`} name="numeroDocumento" autoFocus type="text" inputMode="numeric" pattern="[0-9]{8}|[0-9]{11}" maxLength={11} required readOnly={Boolean(editing)} disabled={saving || uncertain} value={fields.numeroDocumento} onChange={event => changeDocument(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (!editing) void consult(); } }} placeholder="8 dígitos (DNI) u 11 dígitos (RUC)" className={`${input} min-w-[160px] flex-1 bg-white font-medium tracking-wide ${lookupLoading ? "jjr-scan" : ""}`} /><button type="button" onClick={() => editing ? setDetailRevision(value => value + 1) : void consult()} disabled={lookupLoading || saving || uncertain} className={primary}>{lookupLoading ? <LoaderCircle size={17} aria-hidden="true" className="animate-spin" /> : <Search size={17} aria-hidden="true" />}{lookupLoading ? "Consultando…" : editing ? "Recargar ficha" : "Buscar"}</button></div><p className="mt-2 text-[10px] leading-5 text-slate-500">{person ? "Persona natural · DNI" : company ? "Empresa · RUC" : "Ingresa el documento para mostrar los campos correspondientes."}</p></div>
        <div role="status" aria-live="polite" aria-atomic="true" className="mt-3">{lookupLoading ? <p className="text-xs text-[#075BC6]">{editing ? "Recuperando datos completos…" : "Consultando el documento…"}</p> : lookup && <span key={flashVersion} className={`jjr-source inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium ${lookup.fuente !== "LOCAL" && !identityDirty && completeIdentity ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-[#075BC6]"}`}><ShieldCheck size={14} aria-hidden="true" />{sourceLabel}</span>}</div>
        {lookupError && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{lookupError}</p>}
        {!editing && existing && <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5"><p>Este documento ya está registrado. Abre su ficha desde el directorio para editarlo.</p><button type="button" onClick={() => onShowLocal(fields.numeroDocumento)} className={`mt-2 inline-flex items-center gap-1 rounded px-1 py-2 font-semibold text-[#075BC6] ${focus}`}>Ver en el directorio <ArrowRight size={14} aria-hidden="true" /></button></div>}
        {lookup?.fuente === "SUNAT" && (lookup.estado || lookup.condicion) && <p className="mt-3 text-[10px] text-slate-500">Estado SUNAT: {lookup.estado || "No informado"} · Condición: {lookup.condicion || "No informada"}</p>}
        {saveError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">{saveError}</p>}
        {(person || company) && <fieldset disabled={lookupLoading || saving || uncertain || (Boolean(editing) && !detailReady) || (!editing && existing)} className="mt-6 grid gap-4 sm:grid-cols-2">
          {person ? <>{field("nombres", "Nombres", true)}{field("apellidoPaterno", "Apellido paterno", true)}{field("apellidoMaterno", "Apellido materno")}</> : <><div className="sm:col-span-2">{field("razonSocial", "Razón social", true)}</div>{field("nombreComercial", "Nombre comercial")}</>}
          <div className="sm:col-span-2">{field("direccionFiscal", "Dirección fiscal")}</div>{field("ubigeo", "Ubigeo")}{field("telefono", "Teléfono", false, "tel")}{field("email", "Correo electrónico", false, "email")}
        </fieldset>}
        <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" disabled={saving} onClick={close} className={secondary}>{uncertain ? "Cerrar y verificar directorio" : "Cancelar"}</button><button type="submit" disabled={saving || lookupLoading || uncertain || !detailReady || (!person && !company) || (!editing && existing)} className={primary}>{saving ? <LoaderCircle size={17} aria-hidden="true" className="animate-spin" /> : <CheckCircle2 size={17} aria-hidden="true" />}{saving ? "Guardando…" : editing ? "Guardar cambios" : "Guardar cliente"}</button></div>
      </form>
    </div>
  </dialog>;
}

export default function ClientesPage({ apiRoot, onLoadDetalle }: ClientesPageProps) {
  const endpoint = (apiRoot ?? (/\/api\/?$/i.test(axiosClient.defaults.baseURL ?? "") ? "/Clientes" : "/api/Clientes")).replace(/\/$/, "");
  const { items, loading, error, reload } = useList(endpoint, decodeCliente);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [modal, setModal] = useState<{ editing: Cliente | null } | null>(null);
  const [success, setSuccess] = useState("");
  const id = useId();
  const businesses = items?.filter(item => /^\d{11}$/.test(item.numeroDocumento)).length ?? 0;
  const people = items?.filter(item => /^\d{8}$/.test(item.numeroDocumento)).length ?? 0;
  const filtered = items?.filter(item => matchText(`${item.numeroDocumento} ${item.nombreCliente ?? ""} ${item.email ?? ""}`).includes(matchText(query.trim())) && (type === "all" || item.numeroDocumento.length === (type === "ruc" ? 11 : 8)));
  const kpis = [{ title: "Total clientes", count: items?.length, detail: "Directorio completo de clientes", icon: Users, color: "bg-blue-50 text-[#075BC6]" }, { title: "Empresas (RUC)", count: items ? businesses : undefined, detail: "Clientes con RUC de 11 dígitos", icon: Building2, color: "bg-[#F5B000]/15 text-amber-700" }, { title: "Personas naturales (DNI)", count: items ? people : undefined, detail: "Clientes con DNI de 8 dígitos", icon: UserRound, color: "bg-cyan-50 text-[#007DAA]" }];
  return <div className="jjr-clientes mx-auto max-w-[1600px] space-y-6 p-4 font-sans text-[#102D50] sm:p-6 xl:p-8">
    <style>{css}</style>
    <header className="jjr-stagger flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 flex items-center gap-1 text-[10px] font-medium text-slate-500">Comercial & SUNAT <ChevronRight size={12} aria-hidden="true" />Clientes</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Directorio de Clientes</h1><p className="mt-2 text-xs leading-6 text-slate-500">Personas y empresas, conectadas con cada destino.</p></div><button type="button" onClick={() => setModal({ editing: null })} className={primary}><Plus size={17} aria-hidden="true" />Registrar Cliente</button></header>
    <section aria-label="Indicadores de clientes" className="grid gap-4 lg:grid-cols-3">{kpis.map(({ title, count, detail, icon: Icon, color }, index) => <article key={title} className="jjr-stagger rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ animationDelay: `${index * 80}ms` }}><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500">{title}</p><span className={`flex size-10 items-center justify-center rounded-xl ${color}`}><Icon size={20} aria-hidden="true" /></span></div><p className="mt-2 text-3xl font-bold tabular-nums">{count === undefined ? "—" : fmt(count)}</p><p className="mt-3 text-[10px] text-slate-500">{detail}</p></article>)}</section>
    <div aria-live="polite" aria-atomic="true">{success && <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 size={17} aria-hidden="true" />{success}<button aria-label="Cerrar confirmación" onClick={() => setSuccess("")} className={`ml-auto rounded p-1 ${focus}`}><X size={16} /></button></p>}</div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-6 text-red-800"><p className="font-semibold">No se pudo actualizar el directorio</p><p>{error}</p>{items && <p>Se conserva la última información cargada.</p>}<button type="button" onClick={reload} disabled={loading} className={`mt-2 rounded px-1 py-2 font-semibold underline ${focus}`}>Reintentar carga</button></div>}
    <section aria-labelledby={`${id}-table-title`} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 id={`${id}-table-title`} className="text-sm font-bold">Clientes registrados</h2><p className="mt-1 text-[10px] text-slate-500">Identificación, contacto y datos de facturación.</p></div><button type="button" disabled={loading} onClick={reload} className={secondary}><RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden="true" />{loading ? "Actualizando…" : "Actualizar"}</button></div>
      <div className="flex flex-wrap items-center gap-3 p-5"><label className="relative min-w-[220px] flex-1 sm:max-w-sm"><span className="sr-only">Buscar documento, nombre o correo</span><Search size={17} aria-hidden="true" className="absolute top-3.5 left-3 text-slate-400" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar documento, nombre o correo…" className={`${input} pl-10`} /></label><label className="w-full sm:w-auto"><span className="sr-only">Tipo de cliente</span><select value={type} onChange={event => setType(event.target.value)} className={input}><option value="all">Todos los clientes</option><option value="dni">Personas · DNI</option><option value="ruc">Empresas · RUC</option></select></label></div>
      {loading && !items ? <div role="status" aria-label="Cargando clientes" className="space-y-4 p-6">{[0, 1, 2, 3].map(index => <div key={index} aria-hidden="true" className="h-14 animate-pulse rounded-xl bg-slate-100" />)}<span className="sr-only">Cargando clientes…</span></div> : !filtered?.length ? <div className="py-14 text-center"><Users size={30} aria-hidden="true" className="mx-auto mb-3 text-slate-300" /><h3 className="text-sm font-semibold">{!items ? "Directorio no disponible" : items.length ? "Sin coincidencias" : "Aún no hay clientes registrados"}</h3><p className="mt-2 text-xs text-slate-500">{!items ? "Reintenta la carga." : "Registra un cliente o ajusta la búsqueda."}</p></div> : <div role="region" aria-label="Tabla de clientes, desplazable horizontalmente" tabIndex={0} className={`overflow-x-auto ${focus}`}><table className="w-full min-w-[940px] text-left text-xs"><caption className="sr-only">Directorio de clientes</caption><thead className="border-y border-slate-100 bg-slate-50 text-[10px] tracking-wide text-slate-500 uppercase"><tr>{["Documento", "Cliente", "Contacto", "Dirección fiscal", "Acciones"].map(label => <th key={label} scope="col" className="px-5 py-3.5 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((cliente, index) => <tr key={cliente.clienteId} className="jjr-stagger transition-colors duration-300 hover:bg-blue-50/50" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}><th scope="row" className="px-5 py-5"><span className="inline-flex flex-col gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5"><span className="text-[9px] tracking-wider text-[#075BC6]">{cliente.numeroDocumento.length === 8 ? "DNI" : cliente.numeroDocumento.length === 11 ? "RUC" : "DOCUMENTO"}</span><span className="text-[11px] tracking-wide">{cliente.numeroDocumento}</span></span></th><td className="max-w-72 px-5 py-5"><div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-[#075BC6]">{cliente.numeroDocumento.length === 11 ? <Building2 size={18} aria-hidden="true" /> : <UserRound size={18} aria-hidden="true" />}</span><div><p className="font-semibold leading-5">{labelName(cliente)}</p>{!cliente.activo && <p className="mt-1 text-[10px] text-slate-500">Inactivo</p>}</div></div></td><td className="max-w-60 px-5 py-5"><p className="flex items-center gap-1.5 text-[11px] text-slate-600"><Phone size={12} aria-hidden="true" />{cliente.telefono || "Sin teléfono"}</p><p className="mt-2 flex items-start gap-1.5 break-all text-[10px] text-slate-500"><Mail size={12} aria-hidden="true" className="mt-0.5 shrink-0" />{cliente.email || "Sin correo"}</p></td><td className="max-w-64 px-5 py-5"><p className="flex items-start gap-1.5 text-[11px] leading-5 text-slate-500"><MapPin size={13} aria-hidden="true" className="mt-1 shrink-0" />{cliente.direccionFiscal || "No registrada"}</p></td><td className="px-5 py-5"><button type="button" title="Editar cliente" aria-label={`Editar ${labelName(cliente)}`} onClick={() => setModal({ editing: cliente })} className={`rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-blue-100 hover:text-[#075BC6] ${focus}`}><Pencil size={17} /></button></td></tr>)}</tbody></table></div>}
      <p role="status" className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500">{items ? `Mostrando ${filtered?.length ?? 0} de ${items.length} clientes` : "Esperando datos del servidor"}</p>
    </section>
    <p className="flex items-center gap-2 text-[10px] leading-5 text-slate-500"><Sparkles size={14} aria-hidden="true" className="text-[#00A3E0]" />Consulta por documento y revisa los datos antes de guardar.</p>
    {modal && <ClientModal key={modal.editing?.clienteId ?? "new"} endpoint={endpoint} editing={modal.editing} onLoadDetalle={onLoadDetalle} onClose={() => { setModal(null); reload(); }} onSaved={message => { setSuccess(message); setModal(null); reload(); }} onShowLocal={number => { setModal(null); setQuery(number); setType("all"); reload(); }} />}
  </div>;
}
