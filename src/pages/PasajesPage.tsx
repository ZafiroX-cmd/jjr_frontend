import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AxiosHeaders, isAxiosError } from "axios";
import {
  AlertCircle,
  Armchair,
  Building2,
  CarFront,
  Check,
  ChevronRight,
  Clock3,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  UserCheck,
  X,
} from "lucide-react";
import { FileText, Wallet, Trash2, ExternalLink } from "lucide-react";
import axiosClient from "../api/axiosClient";


export type NumeroAsiento = 1 | 2 | 3 | 4;
export interface ViajeVenta {
  viajeId: string;
  rutaNombre: string;
  fechaHoraSalida: string;
  placa: string;
  conductorNombre: string;
  estado: string;
  manifiestoCerrado: boolean;
  oficinaOrigenId: number | null;
  oficinaOrigenNombre: string;
}
export interface Asiento {
  numeroAsiento: NumeroAsiento;
  ubicacion: string;
  ocupado: boolean;
  estado: string;
  pasajeroNombre: string | null;
  pasajeroDocumento: string | null;
  destinoNombre: string | null;
  pasajeId: string | null;
  tipoOperacion: string | null;
  precioTotal: number;
  montoAdelanto: number;
  saldoPendiente: number;
  medioPago: string | null;
  comprobantePagoUrl: string | null;
  comprobanteEmitido: boolean;
}
export interface Parada {
  paradaId: number;
  nombreParada: string;
  orden: number;
  esOficina: boolean;
}
export interface MapaCamioneta {
  viajeId: string;
  rutaNombre: string;
  placa: string;
  precioBase: number;
  fechaSalida: string;
  paradas: Parada[];
  asientos: Asiento[];
}
export interface ClienteSeleccionado {
  clienteId: string;
  numeroDocumento: string;
  nombreCliente: string;
  activo: boolean;
}
export interface VentaPasajeDto {
  viajeId: string;
  numeroAsiento: NumeroAsiento;
  clientePasajeroId: string;
  clienteFacturacionId: string | null;
  origenParadaId: number;
  destinoParadaId: number;
  precio: number;
  tipoOperacion: TipoOperacion;
  montoAdelanto: number;
  medioPago: MedioPago;
  numeroOperacion: string;
}
export type TipoOperacion = "VENTA_DIRECTA" | "RESERVA";
export type MedioPago = "EFECTIVO" | "YAPE" | "PLIN" | "TRANSFERENCIA";
export type TipoComprobante = "NOTA_VENTA" | "BOLETA" | "FACTURA";
export interface EmisionComprobante {
  pasajeId: string;
  viajeId: string;
  tipo: TipoComprobante;
  asiento: Asiento;
}
interface PaymentValue {
  medio: MedioPago;
  numero: string;
  file: File | null;
}
export interface PerfilPasajes {
  rol: string;
  oficinaId: number | null;
}
export interface PasajesPageProps {
  /** Recomendado: perfil del AuthContext. Alternativa: localStorage.user y token. */
  usuario?: PerfilPasajes;
  
  apiPrefix?: string;
  
  onEmitirComprobante?: (solicitud: EmisionComprobante) => void | Promise<void>;
  
  voucherBaseUrl?: string;
  
  maxVoucherBytes?: number;
}
interface DatosCliente {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  razonSocial: string;
  nombreComercial: string;
  direccionFiscal: string;
  ubigeo: string;
  telefono: string;
  email: string;
}
const EMPTY: DatosCliente = {
  nombres: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  razonSocial: "",
  nombreComercial: "",
  direccionFiscal: "",
  ubigeo: "",
  telefono: "",
  email: "",
};
const POSICIONES: Record<NumeroAsiento, string> = {
  1: "Copiloto",
  2: "Atrás izquierda",
  3: "Atrás centro",
  4: "Atrás derecha",
};
const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00A3E0]";
const input =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-[#062443] outline-none transition duration-300 focus:border-[#075BC6] focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";
const primary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#075BC6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-[#062443] hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const secondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold transition duration-300 hover:bg-blue-50 disabled:opacity-50 ${focus}`;
const CSS = `
@keyframes jjr-ticket-enter {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes jjr-seat-free {0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.1)}50%{box-shadow:0 0 0 4px rgba(52,211,153,.18)}}
@keyframes jjr-seat-selected {0%{transform:scale(.94)}65%{transform:scale(1.06)}100%{transform:scale(1)}}
.jjr-pasajes .jjr-enter{animation:jjr-ticket-enter .4s cubic-bezier(.16,1,.3,1) both}
.jjr-pasajes .jjr-seat-free{animation:jjr-seat-free 2.8s ease-in-out infinite}
.jjr-pasajes .jjr-seat-selected{animation:jjr-seat-selected .35s cubic-bezier(.16,1,.3,1) both;box-shadow:0 0 24px rgba(245,176,0,.28)}
.jjr-pasajes .jjr-seat-info:focus-within .jjr-tooltip,.jjr-pasajes .jjr-seat-info:hover .jjr-tooltip{opacity:1;visibility:visible}
@media(prefers-reduced-motion:reduce){.jjr-pasajes *,.jjr-pasajes *::before,.jjr-pasajes *::after{animation:none!important;transition:none!important}}
`;
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("La API devolvió un registro inválido.");
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k.charAt(0).toLowerCase() + k.slice(1),
      v,
    ]),
  );
}
function str(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Falta un campo de texto requerido en la API.");
  return value;
}
function nullable(value: unknown): string | null {
  return value == null ? null : typeof value === "string" ? value : str(value);
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("La API debe devolver una lista.");
  return value;
}
function num(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("La API devolvió un número inválido.");
  return value;
}
function id(value: unknown): number {
  const n = num(value);
  if (!Number.isInteger(n) || n <= 0)
    throw new Error("Identificador numérico inválido.");
  return n;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new Error("La API devolvió un indicador inválido.");
  return value;
}
function instant(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
    throw new Error("Fecha inválida en la API.");
  const d = new Date(
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`,
  );
  if (!Number.isFinite(d.getTime()))
    throw new Error("Fecha inválida en la API.");
  return d;
}
function todayLima(date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (key: string) => p.find((v) => v.type === key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
const timeLima = (value: string) =>
  new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant(value));
const currency = (value: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    value,
  );
function headers(): Record<string, string> {
  try {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
function errorMessage(e: unknown): string {
  if (isAxiosError(e)) {
    if (e.response?.status === 401)
      return "Tu sesión venció. Inicia sesión nuevamente.";
    if (e.response?.status === 403)
      return "No tienes permiso para esta operación.";
    if (e.response?.data && typeof e.response.data === "object") {
      const r = record(e.response.data);
      if (typeof r.mensaje === "string") return r.mensaje;
    }
    return "No se pudo completar la solicitud. Revisa tu conexión e inténtalo nuevamente.";
  }
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}
function decodeViaje(raw: unknown): ViajeVenta {
  const r = record(raw);
  const date = str(r.fechaHoraSalida);
  instant(date);
  return {
    viajeId: str(r.viajeId),
    rutaNombre: str(r.rutaNombre),
    fechaHoraSalida: date,
    placa: str(r.placa),
    conductorNombre: str(r.conductorNombre),
    estado: str(r.estado),
    manifiestoCerrado: bool(r.manifiestoCerrado),
    oficinaOrigenId: r.oficinaOrigenId == null ? null : id(r.oficinaOrigenId),
    oficinaOrigenNombre: str(r.oficinaOrigenNombre),
  };
}
function decodeMapa(raw: unknown, expected: string): MapaCamioneta {
  const r = record(raw);
  if (str(r.viajeId).toLowerCase() !== expected.toLowerCase())
    throw new Error("El mapa no corresponde al viaje seleccionado.");
  const seats = list(r.asientos).map((raw) => {
    const s = record(raw);
    const n = id(s.numeroAsiento);
    if (n > 4) throw new Error("Solo existen los asientos 1, 2, 3 y 4.");
    return {
      numeroAsiento: n as NumeroAsiento,
      ubicacion: str(s.ubicacion),
      ocupado: bool(s.ocupado),
      estado: str(s.estado),
      pasajeroNombre: nullable(s.pasajeroNombre),
      pasajeroDocumento: nullable(s.pasajeroDocumento),
      destinoNombre: nullable(s.destinoNombre),
      pasajeId: nullable(s.pasajeId),
      tipoOperacion: nullable(s.tipoOperacion),
      precioTotal: num(s.precioTotal),
      montoAdelanto: num(s.montoAdelanto),
      saldoPendiente: num(s.saldoPendiente),
      medioPago: nullable(s.medioPago),
      comprobantePagoUrl: nullable(s.comprobantePagoUrl),
      comprobanteEmitido: bool(s.comprobanteEmitido),
    };
  });
  for (const seat of seats) {
    if (seat.ocupado && !seat.pasajeId)
      throw new Error("El asiento ocupado no tiene PasajeId.");
    if (
      seat.ocupado &&
      cents(seat.precioTotal) !==
        cents(seat.montoAdelanto) + cents(seat.saldoPendiente)
    )
      throw new Error(
        "Los importes del asiento no coinciden. Actualiza o revisa el registro.",
      );
  }
  if (
    seats.length !== 4 ||
    new Set(seats.map((s) => s.numeroAsiento)).size !== 4
  )
    throw new Error("El mapa debe contener exactamente los cuatro asientos.");
  const stops = list(r.paradas)
    .map((raw) => {
      const p = record(raw);
      const order = num(p.orden);
      if (!Number.isInteger(order))
        throw new Error("Orden de parada inválido.");
      return {
        paradaId: id(p.paradaId),
        nombreParada: str(p.nombreParada),
        orden: order,
        esOficina: bool(p.esOficina),
      };
    })
    .sort((a, b) => a.orden - b.orden);
  if (new Set(stops.map((p) => p.paradaId)).size !== stops.length)
    throw new Error("La API devolvió paradas duplicadas.");
  const fechaSalida = str(r.fechaSalida);
  instant(fechaSalida);
  return {
    viajeId: str(r.viajeId),
    rutaNombre: str(r.rutaNombre),
    placa: str(r.placa),
    precioBase: num(r.precioBase),
    fechaSalida,
    paradas: stops,
    asientos: seats.sort((a, b) => a.numeroAsiento - b.numeroAsiento),
  };
}
function decodeCliente(raw: unknown): ClienteSeleccionado {
  const r = record(raw);
  return {
    clienteId: str(r.clienteId),
    numeroDocumento: str(r.numeroDocumento),
    nombreCliente: nullable(r.nombreCliente)?.trim() || "Cliente sin nombre",
    activo: bool(r.activo),
  };
}
function localProfile(): PerfilPasajes | null {
  try {
    const u = record(
      JSON.parse(localStorage.getItem("user") ?? "{}") as unknown,
    );
    let jwt: Record<string, unknown> = {};
    const t = localStorage.getItem("token")?.split(".")[1];
    if (t) {
      const b = t.replace(/-/g, "+").replace(/_/g, "/");
      jwt = record(
        JSON.parse(
          new TextDecoder().decode(
            Uint8Array.from(
              atob(b.padEnd(Math.ceil(b.length / 4) * 4, "=")),
              (c) => c.charCodeAt(0),
            ),
          ),
        ) as unknown,
      );
    }
    const role =
      jwt.role ??
      jwt["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ??
      u.rol;
    const raw = jwt.oficinaId ?? u.oficinaId;
    const office = Number(raw);
    return typeof role === "string"
      ? {
          rol: role,
          oficinaId:
            raw != null && Number.isInteger(office) && office > 0
              ? office
              : null,
        }
      : null;
  } catch {
    return null;
  }
}
function useProfile(explicit?: PerfilPasajes) {
  const [profile, setProfile] = useState(localProfile);
  useEffect(() => {
    const update = () => setProfile(localProfile());
    window.addEventListener("storage", update);
    window.addEventListener("jjr:session-changed", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("jjr:session-changed", update);
    };
  }, []);
  return explicit ?? profile;
}
function Alert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800"
    >
      <AlertCircle size={18} aria-hidden="true" className="mt-1 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-semibold">{label}</span>
      {children}
    </label>
  );
}

function PassengerPicker({
  endpoint,
  disabled,
  onChange,
  onBusy,
}: {
  endpoint: string;
  disabled: boolean;
  onChange: (c: ClienteSeleccionado | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [document, setDocument] = useState("");
  const [found, setFound] = useState<ClienteSeleccionado | null>(null);
  const [draft, setDraft] = useState<DatosCliente | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const [unknownSave, setUnknownSave] = useState(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const live = useRef(true);
  const writeLock = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      request.current?.abort();
    };
  }, []);
  function change(value: string) {
    if (writeLock.current) return;
    request.current?.abort();
    generation.current++;
    setLoading(false);
    setDocument(value.replace(/\D/g, "").slice(0, 11));
    setFound(null);
    setDraft(null);
    setSource("");
    setError("");
    onChange(null);
  }
  async function search() {
    if (disabled || writeLock.current || loading) return;
    if (!/^(?:\d{8}|\d{11})$/.test(document)) {
      setError("Ingresa un DNI de 8 dígitos o un RUC de 11 dígitos.");
      return;
    }
    request.current?.abort();
    const c = new AbortController();
    request.current = c;
    const ticket = ++generation.current;
    setLoading(true);
    setError("");
    setFound(null);
    setDraft(null);
    onChange(null);
    try {
      const { data } = await axiosClient.get<unknown>(endpoint, {
        headers: headers(),
        signal: c.signal,
        timeout: 15000,
      });
      const clients = list(data).map(decodeCliente);
      const existing = clients.find((v) => v.numeroDocumento === document);
      if (c.signal.aborted || ticket !== generation.current) return;
      if (existing) {
        if (!existing.activo)
          throw new Error(
            "El cliente está inactivo. Revisa su ficha antes de vender.",
          );
        setFound(existing);
        setSource("Registro local");
        setUnknownSave(false);
        onChange(existing);
        return;
      }
      const { data: raw } = await axiosClient.get<unknown>(
        `${endpoint}/consulta/${document}`,
        { headers: headers(), signal: c.signal, timeout: 15000 },
      );
      if (c.signal.aborted || ticket !== generation.current) return;
      const r = record(raw);
      if (r.numeroDocumento !== document)
        throw new Error("La consulta devolvió un documento diferente.");
      if (r.fuente === "LOCAL")
        throw new Error(
          "El cliente ya existe, pero no se pudo recuperar su identificador. Vuelve a buscar.",
        );
      if (r.fuente !== (document.length === 8 ? "RENIEC" : "SUNAT"))
        throw new Error(
          "La fuente de la consulta no corresponde al documento.",
        );
      const fields = { ...EMPTY };
      for (const key of Object.keys(fields) as (keyof DatosCliente)[])
        fields[key] = nullable(r[key]) ?? "";
      setDraft(fields);
      setSource(`Datos consultados en ${String(r.fuente)}`);
    } catch (e: unknown) {
      if (!c.signal.aborted && ticket === generation.current) {
        setError(errorMessage(e));
        /* Solo un 404 de consulta permite alta manual, no una falla del directorio. */ if (
          isAxiosError(e) &&
          e.response?.status === 404 &&
          e.config?.url?.includes("/consulta/")
        ) {
          setDraft({ ...EMPTY });
          setSource("Ingreso manual");
        }
      }
    } finally {
      if (live.current && !c.signal.aborted && ticket === generation.current)
        setLoading(false);
    }
  }
  async function register() {
    if (disabled || writeLock.current || !draft || unknownSave) return;
    if (
      document.length === 8
        ? !draft.nombres.trim() || !draft.apellidoPaterno.trim()
        : !draft.razonSocial.trim()
    ) {
      setError("Completa los datos de identificación obligatorios.");
      return;
    }
    const dto = {
      numeroDocumento: document,
      ...Object.fromEntries(
        Object.entries(draft).map(([k, v]) => [k, v.trim() || null]),
      ),
    };
    writeLock.current = true;
    setRegistering(true);
    onBusy(true);
    setError("");
    const c = new AbortController();
    request.current = c;
    try {
      const { data } = await axiosClient.post<unknown>(endpoint, dto, {
        headers: headers(),
        signal: c.signal,
        timeout: 15000,
      });
      const clienteId = str(record(data).clienteId);
      const cliente = {
        clienteId,
        numeroDocumento: document,
        nombreCliente:
          document.length === 8
            ? `${draft.nombres} ${draft.apellidoPaterno} ${draft.apellidoMaterno}`.trim()
            : draft.razonSocial,
        activo: true,
      };
      if (live.current) {
        setFound(cliente);
        setDraft(null);
        setSource("Cliente registrado");
        onChange(cliente);
      }
    } catch (e: unknown) {
      if (live.current && !c.signal.aborted) {
        const unknown =
          !isAxiosError(e) || !e.response || e.response.status >= 500;
        setUnknownSave(unknown);
        setError(
          unknown
            ? "No se pudo confirmar el registro. Busca nuevamente el documento antes de intentar otra alta."
            : errorMessage(e),
        );
      }
    } finally {
      writeLock.current = false;
      if (live.current) setRegistering(false);
      onBusy(false);
    }
  }
  function detailField(key: keyof DatosCliente, label: string) {
    return (
      <Field label={label}>
        <input
          value={draft?.[key] ?? ""}
          maxLength={200}
          onChange={(e) =>
            setDraft((v) => (v ? { ...v, [key]: e.target.value } : v))
          }
          className={input}
        />
      </Field>
    );
  }
  return (
    <section aria-label="Identificación del pasajero" className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="DNI / RUC del pasajero">
            <input
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={document}
              disabled={disabled || registering || unknownSave}
              onChange={(e) => change(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
              placeholder="8 u 11 dígitos"
              className={input}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() => void search()}
          disabled={disabled || loading || registering}
          className={secondary}
        >
          {loading ? (
            <LoaderCircle
              size={17}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Search size={17} aria-hidden="true" />
          )}
          Buscar
        </button>
      </div>
      {loading && (
        <p role="status" className="text-xs text-slate-500">
          Buscando al cliente…
        </p>
      )}
      {error && <Alert>{error}</Alert>}
      {found && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <ShieldCheck size={16} aria-hidden="true" />
            {found.nombreCliente}
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            {found.numeroDocumento} · {source}
          </p>
        </div>
      )}
      {draft && (
        <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <p className="text-xs leading-5 text-slate-600">
            {source}. Revisa y registra al cliente para obtener su
            identificación interna.
          </p>
          <fieldset
            disabled={disabled || registering || unknownSave}
            className="space-y-3"
          >
            {document.length === 8 ? (
              <>
                {detailField("nombres", "Nombres *")}
                {detailField("apellidoPaterno", "Apellido paterno *")}
                {detailField("apellidoMaterno", "Apellido materno")}
              </>
            ) : (
              <>
                {detailField("razonSocial", "Razón social *")}
                {detailField("direccionFiscal", "Dirección fiscal")}
              </>
            )}
          </fieldset>
          <button
            type="button"
            onClick={() => void register()}
            disabled={disabled || registering || unknownSave}
            className={secondary}
          >
            {registering ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Check size={16} aria-hidden="true" />
            )}
            Registrar cliente y seleccionar
          </button>
        </div>
      )}
    </section>
  );
}

const METHODS: MedioPago[] = ["EFECTIVO", "YAPE", "PLIN", "TRANSFERENCIA"];
const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100);
function parseMoney(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}
function multipartHeaders(): AxiosHeaders {
  const result = new AxiosHeaders(headers());
  // Evita heredar application/json de axiosClient. El navegador añade el boundary.
  result.set("Content-Type", false);
  return result;
}
function saleForm(dto: VentaPasajeDto, file: File | null): FormData {
  const form = new FormData();
  form.append("ViajeId", dto.viajeId);
  form.append("NumeroAsiento", String(dto.numeroAsiento));
  form.append("ClientePasajeroId", dto.clientePasajeroId);
  if (dto.clienteFacturacionId)
    form.append("ClienteFacturacionId", dto.clienteFacturacionId);
  form.append("OrigenParadaId", String(dto.origenParadaId));
  form.append("DestinoParadaId", String(dto.destinoParadaId));
  form.append("Precio", dto.precio.toFixed(2));
  form.append("TipoOperacion", dto.tipoOperacion);
  form.append("MontoAdelanto", dto.montoAdelanto.toFixed(2));
  form.append("MedioPago", dto.medioPago);
  form.append("NumeroOperacion", dto.numeroOperacion);
  if (dto.medioPago !== "EFECTIVO" && file)
    form.append("VoucherFile", file, file.name);
  return form;
}
function validateFile(file: File, limit: number): string | null {
  if (!file.size) return "El voucher está vacío.";
  if (file.size > limit)
    return `El voucher no debe superar ${(limit / 1024 / 1024).toFixed(1)} MB.`;
  const image = /^image\/(jpeg|png|webp|gif|avif|bmp|heic|heif)$/i.test(
    file.type,
  );
  const pdf = file.type === "application/pdf";
  const extensionOnly =
    !file.type &&
    /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif|pdf)$/i.test(file.name);
  return image || pdf || extensionOnly
    ? null
    : "Adjunta una imagen (JPG, PNG, WebP, GIF, AVIF, BMP, HEIC) o un PDF.";
}
function validatePayment(value: PaymentValue, limit: number): string | null {
  if (!METHODS.includes(value.medio))
    return "Selecciona un medio de pago válido.";
  if (value.medio === "EFECTIVO") return null;
  if (!value.file)
    return "Adjunta un voucher para el pago digital, incluso si la reserva tiene adelanto cero.";
  return validateFile(value.file, limit);
}
function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {!pdf && url && (
        <img
          src={url}
          alt="Vista previa del voucher seleccionado"
          className="mb-3 max-h-40 w-full rounded-lg object-contain"
        />
      )}
      <p className="break-all text-xs text-slate-600">
        {file.name} · {(file.size / 1024).toFixed(0)} KB
      </p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-2 inline-flex items-center gap-1 rounded text-xs font-semibold text-[#075BC6] ${focus}`}
        >
          <FileText size={14} aria-hidden="true" />
          Abrir archivo
        </a>
      )}
    </div>
  );
}
function PaymentFields({
  value,
  onChange,
  maxBytes,
  withNumber = true,
}: {
  value: PaymentValue;
  onChange: (value: PaymentValue) => void;
  maxBytes: number;
  withNumber?: boolean;
}) {
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!value.file && inputRef.current) inputRef.current.value = "";
  }, [value.file]);
  return (
    <div className="space-y-3">
      <Field label="Medio de pago">
        <select
          value={value.medio}
          onChange={(e) => {
            const medio = e.target.value as MedioPago;
            setError("");
            onChange({
              ...value,
              medio,
              file: medio === "EFECTIVO" ? null : value.file,
            });
          }}
          className={input}
        >
          {METHODS.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </select>
      </Field>
      {withNumber && (
        <Field label="Número de operación (opcional)">
          <input
            value={value.numero}
            maxLength={100}
            onChange={(e) => onChange({ ...value, numero: e.target.value })}
            className={input}
          />
        </Field>
      )}
      {value.medio !== "EFECTIVO" && (
        <div className="space-y-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-4">
          <Field label="Voucher de pago *">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf"
              required
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                const issue = file ? validateFile(file, maxBytes) : null;
                setError(issue ?? "");
                onChange({ ...value, file: issue ? null : file });
                if (issue) e.target.value = "";
              }}
              className={`w-full min-w-0 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#075BC6] file:px-3 file:py-2 file:text-white ${focus}`}
            />
          </Field>
          <p className="text-[11px] text-slate-500">
            Imagen o PDF · Máximo {(maxBytes / 1024 / 1024).toFixed(1)} MB
          </p>
          {value.file && (
            <>
              <FilePreview file={value.file} />
              <button
                type="button"
                onClick={() => onChange({ ...value, file: null })}
                className={`rounded text-xs text-red-700 underline ${focus}`}
              >
                Quitar voucher
              </button>
            </>
          )}
        </div>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
function voucherURL(value: string, base?: string): string | null {
  try {
    const api = new URL(
      base ?? axiosClient.defaults.baseURL ?? "/",
      window.location.origin,
    );
    const url = new URL(value, api.origin);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function RemoteVoucher({ value, base }: { value: string; base?: string }) {
  const url = voucherURL(value, base);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url)
    return (
      <p className="text-xs text-slate-500">
        El enlace del voucher no es válido.
      </p>
    );
  const pdf = /\.pdf(?:[?#]|$)/i.test(url);
  return (
    <div className="space-y-2">
      {!pdf && !failed && (
        <img
          src={url}
          alt="Voucher registrado del pasaje"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="max-h-48 w-full rounded-xl border border-slate-200 bg-white object-contain"
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 rounded text-xs font-semibold text-[#075BC6] ${focus}`}
      >
        <ExternalLink size={14} aria-hidden="true" />
        {pdf ? "Abrir voucher PDF" : "Abrir voucher"}
      </a>
    </div>
  );
}
function Inspection({
  seat,
  voucherBaseUrl,
  disabled,
  canEmit,
  onAction,
}: {
  seat: Asiento;
  voucherBaseUrl?: string;
  disabled: boolean;
  canEmit: boolean;
  onAction: (kind: "pay" | "cancel" | "receipt") => void;
}) {
  const paid = cents(seat.saldoPendiente) === 0;
  return (
    <section
      aria-label="Detalle del pasaje"
      className="jjr-enter mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">
          Asiento #{seat.numeroAsiento} · {seat.ubicacion}
        </h3>
        <span
          className={`rounded-full px-2 py-1 text-xs font-bold ${paid ? "bg-[#062443] text-white" : "bg-amber-100 text-amber-900"}`}
        >
          {paid ? "Pagado" : "Reservado"}
        </span>
      </div>
      <div>
        <p className="font-semibold">
          {seat.pasajeroNombre || "Pasajero registrado"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {seat.pasajeroDocumento || "Sin documento"} · Baja en{" "}
          {seat.destinoNombre || "Destino no informado"}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-500">Total</dt>
          <dd className="mt-1 font-bold">{currency(seat.precioTotal)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Pagado</dt>
          <dd className="mt-1 font-bold text-emerald-700">
            {currency(seat.montoAdelanto)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Deuda</dt>
          <dd className="mt-1 font-bold text-amber-800">
            {currency(seat.saldoPendiente)}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-slate-500">
        Medio del registro original: {seat.medioPago || "No informado"}
      </p>
      {seat.comprobantePagoUrl && (
        <RemoteVoucher value={seat.comprobantePagoUrl} base={voucherBaseUrl} />
      )}
      <div className="flex flex-wrap gap-2">
        {!paid && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction("pay")}
            className={primary}
          >
            <Wallet size={16} aria-hidden="true" />
            Liquidar saldo
          </button>
        )}
        {paid && (
          <button
            type="button"
            disabled={disabled || !canEmit || seat.comprobanteEmitido}
            onClick={() => onAction("receipt")}
            className={primary}
          >
            <FileText size={16} aria-hidden="true" />
            {seat.comprobanteEmitido
              ? "Comprobante emitido"
              : "Emitir comprobante"}
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction("cancel")}
          className={`${secondary} text-red-700`}
        >
          <Trash2 size={15} aria-hidden="true" />
          Anular / Liberar asiento
        </button>
      </div>
      {paid && !canEmit && !seat.comprobanteEmitido && (
        <p className="text-xs text-slate-500">
          La emisión de comprobantes aún no está habilitada en esta pantalla.
        </p>
      )}
    </section>
  );
}
function ActionModal({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={heading}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (!busy && e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-lg overflow-y-auto rounded-3xl border-0 bg-white p-6 text-[#062443] shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm sm:p-8"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id={heading} className="text-xl font-bold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Cerrar diálogo"
          disabled={busy}
          onClick={onClose}
          className={`rounded-lg p-2 hover:bg-slate-100 ${focus}`}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Cabin({
  map,
  selected,
  disabled,
  onSelect,
}: {
  map: MapaCamioneta;
  selected: NumeroAsiento | null;
  disabled: boolean;
  onSelect: (seat: NumeroAsiento) => void;
}) {
  function seat(n: NumeroAsiento) {
    const s = map.asientos.find((s) => s.numeroAsiento === n)!;
    const active = selected === n;
    const debt = s.ocupado && cents(s.saldoPendiente) > 0;
    const label = s.ocupado
      ? debt
        ? "Reservado"
        : "Pagado"
      : active
        ? "Elegido"
        : "Libre";
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(n)}
        aria-label={`Asiento ${n}, ${POSICIONES[n]}, ${label}`}
        aria-pressed={active}
        className={`relative flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-3 shadow-[0_5px_0_rgba(0,0,0,.25)] transition duration-300 enabled:hover:-translate-y-1 disabled:cursor-wait ${s.ocupado ? (debt ? "border-amber-400 bg-amber-500/20 text-amber-200" : "border-blue-400/60 bg-[#062443] text-blue-100") : active ? "jjr-seat-selected border-[#F5B000] bg-[#F5B000] text-[#062443]" : "jjr-seat-free border-emerald-400/70 bg-slate-800 text-emerald-300"} ${active && s.ocupado ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : ""} ${focus}`}
      >
        <Armchair size={29} aria-hidden="true" />
        <span className="text-sm font-bold">{n}</span>
        <span className="text-[9px]">{label}</span>
      </button>
    );
  }
  return (
    <div className="mx-auto max-w-[350px] px-5 py-2">
      <div className="relative rounded-[55px_55px_42px_42px] border-4 border-slate-700 bg-gradient-to-b from-slate-800 to-slate-950 px-5 pt-5 pb-7 shadow-[inset_0_2px_3px_rgba(255,255,255,.16),0_18px_35px_rgba(6,36,67,.24)]">
        <div
          aria-hidden="true"
          className="mb-6 h-10 rounded-t-[35px] rounded-b-lg border border-cyan-900 bg-gradient-to-b from-cyan-900/40 to-slate-900"
        />
        <div
          aria-hidden="true"
          className="absolute top-24 -left-5 h-10 w-4 rounded-l-lg bg-slate-600"
        />
        <div
          aria-hidden="true"
          className="absolute top-24 -right-5 h-10 w-4 rounded-r-lg bg-slate-600"
        />
        <div className="grid grid-cols-2 gap-8">
          <button
            type="button"
            disabled
            aria-label="Conductor, no disponible para venta"
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-600 bg-slate-800/60 text-slate-500"
          >
            <UserCheck size={28} aria-hidden="true" />
            <span className="text-[10px]">Conductor</span>
          </button>
          {seat(1)}
        </div>
        <div
          aria-hidden="true"
          className="mx-auto my-5 h-10 w-9 rounded-xl border border-slate-700 bg-slate-800"
        />
        <div className="grid grid-cols-3 gap-2">
          {seat(2)}
          {seat(3)}
          {seat(4)}
        </div>
        <p className="mt-6 text-center text-[9px] tracking-[.25em] text-slate-500">
          TRANSPORTES JJR
        </p>
      </div>
    </div>
  );
}

export default function PasajesPage({
  usuario,
  apiPrefix,
  onEmitirComprobante,
  voucherBaseUrl,
  maxVoucherBytes = 10 * 1024 * 1024,
}: PasajesPageProps) {
  const profile = useProfile(usuario);
  const role = normalize(profile?.rol ?? "");
  const manager = role === "administrador" || role === "gerente";
  const office = profile?.oficinaId ?? null;
  const allowed =
    manager ||
    (role === "recepcionista" &&
      office !== null &&
      Number.isInteger(office) &&
      office > 0);
  const prefix = (
    apiPrefix ??
    (/\/api\/?$/i.test(axiosClient.defaults.baseURL ?? "") ? "" : "/api")
  ).replace(/\/$/, "");
  const scope = `${prefix}:${role}:${office ?? ""}`;
  const [clock, setClock] = useState(() => todayLima());
  const today = clock;
  const [tripsSnapshot, setTripsSnapshot] = useState<{
    key: string;
    rows: ViajeVenta[];
  } | null>(null);
  const [tripLoading, setTripLoading] = useState(true);
  const [tripError, setTripError] = useState("");
  const [chosen, setChosen] = useState<{ scope: string; id: string } | null>(
    null,
  );
  const [tripRevision, setTripRevision] = useState(0);
  const tripsKey = `${scope}:${today}`;
  const trips =
    allowed && tripsSnapshot?.key === tripsKey ? tripsSnapshot.rows : null;
  const tripId = chosen?.scope === tripsKey ? chosen.id : "";
  const selectedTrip = trips?.find((t) => t.viajeId === tripId) ?? null;
  const [mapSnapshot, setMapSnapshot] = useState<{
    key: string;
    data: MapaCamioneta;
  } | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState("");
  const [mapRevision, setMapRevision] = useState(0);
  const mapKey = `${tripsKey}:${tripId}`;
  const map =
    selectedTrip && mapSnapshot?.key === mapKey ? mapSnapshot.data : null;
  const [seat, setSeat] = useState<{
    key: string;
    number: NumeroAsiento;
  } | null>(null);
  const seatNumber = seat?.key === mapKey ? seat.number : null;
  const [inspected, setInspected] = useState<{
    key: string;
    number: NumeroAsiento;
  } | null>(null);
  const inspectedSeat =
    inspected?.key === mapKey
      ? (map?.asientos.find(
          (s) => s.numeroAsiento === inspected.number && s.ocupado,
        ) ?? null)
      : null;
  const [action, setAction] = useState<{
    key: string;
    kind: "pay" | "cancel" | "receipt";
    seat: Asiento;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const actionLock = useRef(false);
  const [actionUncertain, setActionUncertain] = useState(false);
  const [actionError, setActionError] = useState("");
  const [liquidation, setLiquidation] = useState<PaymentValue>({
    medio: "EFECTIVO",
    numero: "",
    file: null,
  });
  const [receiptType, setReceiptType] = useState<TipoComprobante>("NOTA_VENTA");
  const [operation, setOperation] = useState<TipoOperacion>("VENTA_DIRECTA");
  const [advance, setAdvance] = useState("0.00");
  const [payment, setPayment] = useState<PaymentValue>({
    medio: "EFECTIVO",
    numero: "",
    file: null,
  });
  const selectedSeat =
    map?.asientos.find((s) => s.numeroAsiento === seatNumber && !s.ocupado)
      ?.numeroAsiento ?? null;
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [price, setPrice] = useState("");
  const defaultsKey = useRef("");
  const [client, setClient] = useState<ClienteSeleccionado | null>(null);
  const [customerBusy, setCustomerBusy] = useState(false);
  const customerLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const saleLock = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [saleError, setSaleError] = useState("");
  const [success, setSuccess] = useState("");
  const [passengerRevision, setPassengerRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const live = useRef(true);
  const mutation = useRef<AbortController | null>(null);
  const currentKey = useRef(mapKey);
  currentKey.current = mapKey;
  const passengerChanged = useCallback(
    (value: ClienteSeleccionado | null) => setClient(value),
    [],
  );
  const passengerBusy = useCallback((value: boolean) => {
    customerLock.current = value;
    setCustomerBusy(value);
  }, []);
  const refreshTrips = useCallback(() => setTripRevision((v) => v + 1), []);
  const refreshMap = useCallback(() => setMapRevision((v) => v + 1), []);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      mutation.current?.abort();
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!saleLock.current && !customerLock.current && !actionLock.current) {
        setClock(todayLima());
        refreshTrips();
        refreshMap();
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refreshTrips, refreshMap]);
  useEffect(() => {
    if (!allowed) {
      setTripLoading(false);
      return;
    }
    const c = new AbortController();
    setTripLoading(true);
    setTripError("");
    void axiosClient
      .get<unknown>(`${prefix}/Viajes`, {
        params: {
          estado: "Programado",
          oficinaId: manager ? undefined : office,
        },
        signal: c.signal,
        headers: headers(),
        timeout: 15000,
      })
      .then(({ data }) => {
        const all = list(data).map(decodeViaje);
        const rows = all
          .filter(
            (t) =>
              t.estado === "Programado" &&
              !t.manifiestoCerrado &&
              todayLima(instant(t.fechaHoraSalida)) === today &&
              (manager || t.oficinaOrigenId === office),
          )
          .sort(
            (a, b) =>
              instant(a.fechaHoraSalida).getTime() -
              instant(b.fechaHoraSalida).getTime(),
          );
        if (!c.signal.aborted) setTripsSnapshot({ key: tripsKey, rows });
      })
      .catch((e: unknown) => {
        if (!c.signal.aborted) setTripError(errorMessage(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setTripLoading(false);
      });
    return () => c.abort();
  }, [allowed, prefix, manager, office, today, tripsKey, tripRevision]);
  useEffect(() => {
    if (!selectedTrip) {
      setMapLoading(false);
      return;
    }
    const c = new AbortController();
    setMapLoading(true);
    setMapError("");
    void axiosClient
      .get<unknown>(`${prefix}/Pasajes/viaje/${encodeURIComponent(tripId)}`, {
        signal: c.signal,
        headers: headers(),
        timeout: 15000,
      })
      .then(({ data }) => {
        const parsed = decodeMapa(data, tripId);
        if (!c.signal.aborted) setMapSnapshot({ key: mapKey, data: parsed });
      })
      .catch((e: unknown) => {
        if (!c.signal.aborted) setMapError(errorMessage(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setMapLoading(false);
      });
    return () => c.abort();
  }, [Boolean(selectedTrip), prefix, tripId, mapKey, mapRevision]);
  useEffect(() => {
    if (!map) return;
    if (defaultsKey.current !== mapKey) {
      defaultsKey.current = mapKey;
      setPrice(map.precioBase.toFixed(2));
      setDestination("");
      const starting = map.paradas.find(
        (p) =>
          normalize(p.nombreParada) ===
          normalize(selectedTrip?.oficinaOrigenNombre ?? ""),
      );
      setOrigin(starting ? String(starting.paradaId) : "");
    }
    if (
      seat?.key === mapKey &&
      map.asientos.some((s) => s.numeroAsiento === seat.number && s.ocupado)
    ) {
      setSeat(null);
      setNotice(
        "El asiento seleccionado ya está ocupado. Revisa el mapa y selecciona otro asiento libre.",
      );
    }
  }, [map, mapKey, seat, selectedTrip?.oficinaOrigenNombre]);
  function chooseTrip(value: string) {
    if (saleLock.current || customerLock.current || actionLock.current) return;
    setInspected(null);
    setAction(null);
    setOperation("VENTA_DIRECTA");
    setAdvance("0.00");
    setPayment({ medio: "EFECTIVO", numero: "", file: null });
    setChosen({ scope: tripsKey, id: value });
    setSeat(null);
    setClient(null);
    setOrigin("");
    setDestination("");
    setPrice("");
    setNotice("");
    setSaleError("");
    setUncertain(false);
    defaultsKey.current = "";
  }
  function chooseSeat(n: NumeroAsiento) {
    if (
      saleLock.current ||
      customerLock.current ||
      actionLock.current ||
      mapLoading ||
      tripLoading ||
      mapError ||
      tripError
    )
      return;
    const candidate = map?.asientos.find((s) => s.numeroAsiento === n);
    if (!candidate) return;
    if (candidate.ocupado) {
      setInspected({ key: mapKey, number: n });
      setSeat(null);
      return;
    }
    if (uncertain) return;
    setInspected(null);
    setSeat({ key: mapKey, number: n });
    setNotice("");
    setSaleError("");
  }
  const originStop = map?.paradas.find((p) => p.paradaId === Number(origin));
  const destinations =
    map?.paradas.filter((p) => originStop && p.orden > originStop.orden) ?? [];
  const operational =
    allowed &&
    selectedTrip !== null &&
    map !== null &&
    !mapLoading &&
    !tripLoading &&
    !mapError &&
    !tripError;
  async function sell() {
    if (
      saleLock.current ||
      customerLock.current ||
      actionLock.current ||
      uncertain ||
      !operational ||
      !map ||
      !selectedSeat ||
      !client
    )
      return;
    setSaleError("");
    const end = destinations.find((p) => p.paradaId === Number(destination));
    if (!originStop || !end) {
      setSaleError(
        "Selecciona una parada de subida y una bajada posterior en el recorrido.",
      );
      return;
    }
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(price) ||
      Number(price) <= 0 ||
      !Number.isFinite(Number(price))
    ) {
      setSaleError("Ingresa un precio positivo, con hasta dos decimales.");
      return;
    }
    const total = parseMoney(price);
    const deposit = operation === "VENTA_DIRECTA" ? total : parseMoney(advance);
    if (
      total === null ||
      total <= 0 ||
      deposit === null ||
      deposit < 0 ||
      deposit > total
    ) {
      setSaleError(
        "El adelanto debe estar entre cero y el precio total, con hasta dos decimales.",
      );
      return;
    }
    const fileIssue = validatePayment(payment, maxVoucherBytes);
    if (fileIssue) {
      setSaleError(fileIssue);
      return;
    }
    const payload: VentaPasajeDto = {
      viajeId: tripId,
      numeroAsiento: selectedSeat,
      clientePasajeroId: client.clienteId,
      clienteFacturacionId: null,
      origenParadaId: originStop.paradaId,
      destinoParadaId: end.paradaId,
      precio: total / 100,
      tipoOperacion: operation,
      montoAdelanto: deposit / 100,
      medioPago: payment.medio,
      numeroOperacion: payment.numero.trim(),
    };
    saleLock.current = true;
    setSaving(true);
    const key = mapKey;
    const c = new AbortController();
    mutation.current = c;
    try {
      // Revalida salida y asiento antes de enviar. No reemplaza la unicidad del servidor.
      const [{ data: tripData }, { data: mapData }] = await Promise.all([
        axiosClient.get<unknown>(`${prefix}/Viajes`, {
          params: {
            estado: "Programado",
            oficinaId: manager ? undefined : office,
          },
          signal: c.signal,
          headers: headers(),
          timeout: 15000,
        }),
        axiosClient.get<unknown>(
          `${prefix}/Pasajes/viaje/${encodeURIComponent(tripId)}`,
          { signal: c.signal, headers: headers(), timeout: 15000 },
        ),
      ]);
      if (!live.current || currentKey.current !== key) return;
      const currentTrip = list(tripData)
        .map(decodeViaje)
        .find(
          (t) =>
            t.viajeId === tripId &&
            t.estado === "Programado" &&
            !t.manifiestoCerrado &&
            todayLima(instant(t.fechaHoraSalida)) === todayLima() &&
            (manager || t.oficinaOrigenId === office),
        );
      if (!currentTrip)
        throw new Error(
          "La salida ya no está disponible para venta. Actualiza la lista.",
        );
      const fresh = decodeMapa(mapData, tripId);
      setMapSnapshot({ key, data: fresh });
      if (
        fresh.asientos.some(
          (s) => s.numeroAsiento === selectedSeat && s.ocupado,
        )
      )
        throw new Error(
          `El asiento #${selectedSeat} ya está ocupado. Elige otro asiento libre.`,
        );
      const startNow = fresh.paradas.find(
        (p) => p.paradaId === payload.origenParadaId,
      );
      const endNow = fresh.paradas.find(
        (p) => p.paradaId === payload.destinoParadaId,
      );
      if (!startNow || !endNow || endNow.orden <= startNow.orden)
        throw new Error(
          "El recorrido cambió. Selecciona nuevamente las paradas.",
        );
      const { data } = await axiosClient.post<unknown>(
        `${prefix}/Pasajes`,
        saleForm(payload, payment.file),
        { signal: c.signal, headers: multipartHeaders(), timeout: 30000 },
      );
      // Un 2xx confirma el registro aun si el cuerpo no incluye la referencia.
      let reference = "";
      try {
        reference = str(record(data).pasajeId);
      } catch {
        /* No repetir una venta confirmada por HTTP. */
      }
      if (live.current && currentKey.current === key) {
        setMapSnapshot({
          key,
          data: {
            ...fresh,
            asientos: fresh.asientos.map((s) =>
              s.numeroAsiento === selectedSeat
                ? {
                    ...s,
                    ocupado: true,
                    estado: deposit >= total ? "Emitido" : "Reservado",
                    tipoOperacion: operation,
                    precioTotal: total / 100,
                    montoAdelanto: deposit / 100,
                    saldoPendiente: (total - deposit) / 100,
                    medioPago: payment.medio,
                    comprobanteEmitido: false,
                    comprobantePagoUrl: null,
                    pasajeroNombre: client.nombreCliente,
                    pasajeroDocumento: client.numeroDocumento,
                    destinoNombre: endNow.nombreParada,
                    pasajeId: reference || null,
                  }
                : s,
            ),
          },
        });
        setSuccess(
          `${operation === "RESERVA" ? "Reserva registrada" : "Venta registrada"} · Asiento ${selectedSeat}${reference ? ` · Ref. ${reference}` : ""}`,
        );
        setSeat(null);
        setClient(null);
        setDestination("");
        setPassengerRevision((v) => v + 1);
        setPrice(fresh.precioBase.toFixed(2));
        setAdvance("0.00");
        setPayment({ medio: "EFECTIVO", numero: "", file: null });
        refreshMap();
        refreshTrips();
      }
    } catch (e: unknown) {
      if (live.current && currentKey.current === key && !c.signal.aborted) {
        // Solo un fallo de POST puede dejar una venta de resultado desconocido.
        const unknown =
          isAxiosError(e) &&
          e.config?.method?.toLowerCase() === "post" &&
          (!e.response || e.response.status >= 500);
        setUncertain(Boolean(unknown));
        setSaleError(
          unknown
            ? "No se pudo confirmar la venta. Verifica el asiento antes de iniciar otra operación; no vuelvas a emitir este boleto sin comprobarlo."
            : errorMessage(e),
        );
        refreshMap();
        refreshTrips();
      }
    } finally {
      saleLock.current = false;
      if (live.current) setSaving(false);
    }
  }
  function openAction(kind: "pay" | "cancel" | "receipt", target: Asiento) {
    if (
      saleLock.current ||
      customerLock.current ||
      actionLock.current ||
      !operational
    )
      return;
    if (uncertain) {
      setSaleError(
        "Verifica primero el resultado de la última venta antes de gestionar otro cobro.",
      );
      return;
    }
    setAction({ key: mapKey, kind, seat: target });
    setActionError("");
    setActionUncertain(false);
    setLiquidation({ medio: "EFECTIVO", numero: "", file: null });
    setReceiptType("NOTA_VENTA");
  }
  function closeAction() {
    if (!actionLock.current) {
      setAction(null);
      if (actionUncertain) {
        refreshMap();
        refreshTrips();
      }
    }
  }
  async function manage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      actionLock.current ||
      saleLock.current ||
      customerLock.current ||
      !action ||
      action.key !== mapKey ||
      actionUncertain ||
      !operational
    )
      return;
    setActionError("");
    if (action.kind === "pay") {
      const issue = validatePayment(liquidation, maxVoucherBytes);
      if (issue) {
        setActionError(issue);
        return;
      }
    }
    const target = action;
    const key = mapKey;
    actionLock.current = true;
    setActionBusy(true);
    const controller = new AbortController();
    mutation.current = controller;
    let sent = false;
    try {
      const config = {
        headers: headers(),
        signal: controller.signal,
        timeout: 15000,
      };
      const { data } = await axiosClient.get<unknown>(
        `${prefix}/Pasajes/viaje/${encodeURIComponent(tripId)}`,
        config,
      );
      if (!live.current || currentKey.current !== key) return;
      const fresh = decodeMapa(data, tripId);
      setMapSnapshot({ key, data: fresh });
      const actual = fresh.asientos.find(
        (s) =>
          s.numeroAsiento === target.seat.numeroAsiento &&
          s.ocupado &&
          s.pasajeId === target.seat.pasajeId,
      );
      if (!actual?.pasajeId)
        throw new Error(
          "Este pasaje ya no ocupa el asiento. Cierra el diálogo y revisa el mapa.",
        );
      if (target.kind === "pay") {
        const balance = cents(actual.saldoPendiente);
        if (balance <= 0)
          throw new Error(
            "El pasaje ya está pagado. No se registró un nuevo cobro.",
          );
        if (balance !== cents(target.seat.saldoPendiente)) {
          setAction({ ...target, seat: actual });
          throw new Error(
            "El saldo cambió. Revisa el nuevo importe y vuelve a confirmar.",
          );
        }
        const body = new FormData();
        body.append("MontoPago", (balance / 100).toFixed(2));
        body.append("MedioPago", liquidation.medio);
        if (liquidation.medio !== "EFECTIVO" && liquidation.file)
          body.append("VoucherFile", liquidation.file, liquidation.file.name);
        sent = true;
        await axiosClient.patch(
          `${prefix}/Pasajes/${encodeURIComponent(actual.pasajeId)}/completar-pago`,
          body,
          {
            headers: multipartHeaders(),
            signal: controller.signal,
            timeout: 30000,
          },
        );
        if (live.current && currentKey.current === key) {
          setMapSnapshot({
            key,
            data: {
              ...fresh,
              asientos: fresh.asientos.map((s) =>
                s.pasajeId === actual.pasajeId
                  ? {
                      ...s,
                      montoAdelanto: s.precioTotal,
                      saldoPendiente: 0,
                      estado: "Emitido",
                      comprobantePagoUrl: liquidation.file
                        ? null
                        : s.comprobantePagoUrl,
                    }
                  : s,
              ),
            },
          });
          setSuccess("Saldo liquidado. El pasaje está pagado al 100 %.");
        }
      } else if (target.kind === "cancel") {
        sent = true;
        await axiosClient.delete(
          `${prefix}/Pasajes/${encodeURIComponent(actual.pasajeId)}/cancelar`,
          config,
        );
        if (live.current && currentKey.current === key) {
          setMapSnapshot({
            key,
            data: {
              ...fresh,
              asientos: fresh.asientos.map((s) =>
                s.pasajeId === actual.pasajeId
                  ? {
                      ...s,
                      ocupado: false,
                      estado: "Disponible",
                      pasajeId: null,
                      pasajeroNombre: null,
                      pasajeroDocumento: null,
                      destinoNombre: null,
                      tipoOperacion: null,
                      precioTotal: 0,
                      montoAdelanto: 0,
                      saldoPendiente: 0,
                      medioPago: null,
                      comprobantePagoUrl: null,
                      comprobanteEmitido: false,
                    }
                  : s,
              ),
            },
          });
          setInspected(null);
          setSuccess(
            "Pasaje anulado. El asiento quedó libre; no se registró devolución.",
          );
        }
      } else {
        if (cents(actual.saldoPendiente) !== 0)
          throw new Error("Liquida el saldo antes de emitir un comprobante.");
        if (actual.comprobanteEmitido)
          throw new Error("Este pasaje ya tiene un comprobante emitido.");
        if (!onEmitirComprobante)
          throw new Error(
            "La integración de comprobantes no está configurada.",
          );
        sent = true;
        await onEmitirComprobante({
          pasajeId: actual.pasajeId,
          viajeId: tripId,
          tipo: receiptType,
          asiento: actual,
        });
        if (live.current && currentKey.current === key)
          setSuccess(
            "Solicitud enviada al módulo de comprobantes. Verifica allí el resultado.",
          );
      }
      if (live.current && currentKey.current === key) {
        setAction(null);
        refreshMap();
        refreshTrips();
      }
    } catch (e: unknown) {
      if (
        live.current &&
        currentKey.current === key &&
        !controller.signal.aborted
      ) {
        const unknown =
          sent && (!isAxiosError(e) || !e.response || e.response.status >= 500);
        setActionUncertain(unknown);
        setActionError(
          unknown
            ? "No se pudo confirmar el resultado. Cierra y verifica el registro antes de repetir esta operación."
            : errorMessage(e),
        );
        refreshMap();
      }
    } finally {
      actionLock.current = false;
      if (live.current) setActionBusy(false);
    }
  }

  const busy = saving || customerBusy || actionBusy;
  const seatBusy = busy || !operational || uncertain;
  const totalCents = parseMoney(price);
  const paidCents =
    operation === "VENTA_DIRECTA" ? totalCents : parseMoney(advance);
  const pendingCents =
    totalCents !== null && paidCents !== null ? totalCents - paidCents : null;
  const activeAction = allowed && action?.key === mapKey ? action : null;
  return (
    <div className="jjr-pasajes mx-auto max-w-[1500px] space-y-6 p-4 font-sans text-[#062443] sm:p-6 xl:p-8">
      <style>{CSS}</style>
      <header className="jjr-enter">
        <p className="mb-2 flex items-center gap-1 text-xs text-slate-500">
          Operativa
          <ChevronRight size={13} aria-hidden="true" />
          Venta y reserva de pasajes
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Venta y Reserva de Pasajes
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Selecciona la salida, el asiento y el destino de tu pasajero.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-[#075BC6]">
            Hoy · {today} · Lima
          </span>
        </div>
      </header>
      {!allowed ? (
        <Alert>
          Necesitas un perfil Administrador/Gerente o Recepcionista con oficina
          asignada para consultar las salidas.
        </Alert>
      ) : (
        <>
          <section
            aria-label="Selector de salida activa"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 basis-72">
                <Field label="Salida programada del día">
                  <select
                    value={selectedTrip ? tripId : ""}
                    disabled={busy || tripLoading}
                    onChange={(e) => chooseTrip(e.target.value)}
                    className={input}
                  >
                    <option value="">
                      {tripLoading
                        ? "Cargando salidas…"
                        : "Selecciona una salida"}
                    </option>
                    {trips?.map((t) => (
                      <option key={t.viajeId} value={t.viajeId}>
                        {timeLima(t.fechaHoraSalida)} · {t.rutaNombre} ·{" "}
                        {t.placa}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <button
                type="button"
                disabled={busy || tripLoading || mapLoading}
                onClick={() => {
                  refreshTrips();
                  refreshMap();
                }}
                className={secondary}
              >
                <RefreshCw
                  size={16}
                  aria-hidden="true"
                  className={tripLoading || mapLoading ? "animate-spin" : ""}
                />
                Actualizar
              </button>
            </div>
            {!tripLoading && trips?.length === 0 && (
              <p role="status" className="mt-3 text-sm text-slate-500">
                No hay salidas programadas con manifiesto abierto para hoy.
              </p>
            )}
            {selectedTrip && (
              <div className="mt-4 grid gap-3 rounded-xl bg-[#062443] p-4 text-white sm:grid-cols-2 xl:grid-cols-4">
                <p className="flex items-center gap-2 text-sm">
                  <MapPin
                    size={17}
                    aria-hidden="true"
                    className="shrink-0 text-[#F5B000]"
                  />
                  {selectedTrip.rutaNombre}
                </p>
                <p className="flex items-center gap-2 text-sm">
                  <Clock3
                    size={17}
                    aria-hidden="true"
                    className="text-blue-200"
                  />
                  {timeLima(selectedTrip.fechaHoraSalida)} · Lima
                </p>
                <p className="flex items-center gap-2 text-sm">
                  <CarFront
                    size={17}
                    aria-hidden="true"
                    className="text-blue-200"
                  />
                  {selectedTrip.placa}
                </p>
                <p className="flex items-center gap-2 text-sm">
                  <UserCheck
                    size={17}
                    aria-hidden="true"
                    className="shrink-0 text-blue-200"
                  />
                  {selectedTrip.conductorNombre}
                </p>
              </div>
            )}
          </section>
          {tripError && (
            <Alert>
              {tripError}
              <p>La venta queda bloqueada hasta actualizar las salidas.</p>
            </Alert>
          )}
          {mapError && (
            <Alert>
              {mapError}
              <button
                type="button"
                onClick={refreshMap}
                disabled={busy}
                className={`mt-2 rounded underline ${focus}`}
              >
                Reintentar mapa
              </button>
            </Alert>
          )}
          <div role="status" aria-live="polite" aria-atomic="true">
            {success && (
              <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <Check size={18} aria-hidden="true" className="shrink-0" />
                <span className="break-all">{success}</span>
                <button
                  type="button"
                  aria-label="Cerrar confirmación"
                  onClick={() => setSuccess("")}
                  className={`ml-auto rounded p-1 ${focus}`}
                >
                  <X size={16} />
                </button>
              </p>
            )}
          </div>
          {chosen?.scope === tripsKey &&
            tripId &&
            !selectedTrip &&
            !tripLoading && (
              <Alert>
                La salida seleccionada ya no está disponible. Selecciona otra
                salida programada.
              </Alert>
            )}
          {!selectedTrip ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <Ticket
                size={35}
                aria-hidden="true"
                className="mx-auto mb-4 text-slate-300"
              />
              <h2 className="font-semibold">Primero selecciona una salida</h2>
              <p className="mt-2 text-sm text-slate-500">
                Aquí aparecerán los cuatro asientos disponibles para venta.
              </p>
            </div>
          ) : mapLoading && !map ? (
            <div role="status" className="grid gap-6 lg:grid-cols-2">
              <span className="sr-only">Cargando camioneta</span>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className="h-[540px] animate-pulse rounded-3xl bg-slate-100"
                />
              ))}
            </div>
          ) : (
            map && (
              <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
                <section
                  aria-label="Mapa de la camioneta"
                  className="jjr-enter rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="font-bold">Elige tu asiento</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Camioneta de 4 pasajeros
                      </p>
                    </div>
                    <span className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-[#075BC6]">
                      {map.asientos.filter((s) => !s.ocupado).length}/4 libres
                    </span>
                  </div>
                  <Cabin
                    map={map}
                    selected={inspectedSeat?.numeroAsiento ?? selectedSeat}
                    disabled={busy || !operational}
                    onSelect={chooseSeat}
                  />
                  <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
                    {[
                      { name: "Libre", color: "bg-emerald-400" },
                      { name: "Pagado", color: "bg-[#062443]" },
                      { name: "Reservado", color: "bg-amber-400" },
                      { name: "Seleccionado", color: "bg-[#F5B000]" },
                    ].map((s) => (
                      <span
                        key={s.name}
                        className="inline-flex items-center gap-1.5"
                      >
                        <span
                          aria-hidden="true"
                          className={`size-2.5 rounded-full ${s.color}`}
                        />
                        {s.name}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                    Haz clic en un asiento pagado o reservado para consultar y
                    gestionar el pasaje.
                  </p>
                  {notice && (
                    <p
                      role="status"
                      className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
                    >
                      {notice}
                    </p>
                  )}
                  {inspectedSeat && (
                    <Inspection
                      seat={inspectedSeat}
                      voucherBaseUrl={voucherBaseUrl}
                      disabled={busy || !operational}
                      canEmit={Boolean(onEmitirComprobante)}
                      onAction={(kind) => openAction(kind, inspectedSeat)}
                    />
                  )}
                </section>
                <section
                  aria-label="Formulario de venta"
                  className="jjr-enter rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-bold">Datos del boleto</h2>
                    {selectedSeat ? (
                      <span className="rounded-full bg-[#F5B000]/20 px-3 py-2 text-xs font-bold text-amber-900">
                        Asiento #{selectedSeat} · {POSICIONES[selectedSeat]}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Selecciona un asiento libre
                      </span>
                    )}
                  </div>
                  {saleError && (
                    <div className="mb-4">
                      <Alert>{saleError}</Alert>
                    </div>
                  )}
                  {uncertain && (
                    <div className="mb-4 space-y-2">
                      <button
                        type="button"
                        disabled={busy || mapLoading}
                        onClick={refreshMap}
                        className={secondary}
                      >
                        Verificar estado del asiento
                      </button>
                      <p className="text-xs leading-5 text-slate-500">
                        Tras revisar el resultado, cambia de salida para
                        comenzar otra operación. El mapa no confirma por sí solo
                        quién realizó la venta.
                      </p>
                    </div>
                  )}
                  <fieldset
                    disabled={!selectedSeat || seatBusy}
                    className="space-y-5 disabled:opacity-65"
                  >
                    <div
                      role="group"
                      aria-label="Tipo de operación"
                      className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5"
                    >
                      {(["VENTA_DIRECTA", "RESERVA"] as const).map((kind) => (
                        <button
                          type="button"
                          key={kind}
                          aria-pressed={operation === kind}
                          onClick={() => setOperation(kind)}
                          className={`min-h-11 rounded-lg px-2 text-xs font-bold transition ${operation === kind ? "bg-[#075BC6] text-white shadow-sm" : "text-slate-600 hover:bg-white"} ${focus}`}
                        >
                          {kind === "VENTA_DIRECTA"
                            ? "VENTA DIRECTA"
                            : "RESERVA"}
                        </button>
                      ))}
                    </div>
                    <PassengerPicker
                      key={`${mapKey}:${passengerRevision}`}
                      endpoint={`${prefix}/Clientes`}
                      disabled={!selectedSeat || seatBusy}
                      onChange={passengerChanged}
                      onBusy={passengerBusy}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Parada de subida *">
                        <select
                          value={origin}
                          onChange={(e) => {
                            setOrigin(e.target.value);
                            setDestination("");
                          }}
                          className={input}
                        >
                          <option value="">Selecciona el origen</option>
                          {map.paradas
                            .filter((p) =>
                              map.paradas.some((next) => next.orden > p.orden),
                            )
                            .map((p) => (
                              <option key={p.paradaId} value={p.paradaId}>
                                {p.nombreParada}
                                {p.esOficina ? " · Oficina" : ""}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Parada de bajada *">
                        <select
                          value={destination}
                          disabled={!originStop}
                          onChange={(e) => setDestination(e.target.value)}
                          className={input}
                        >
                          <option value="">Selecciona el destino</option>
                          {destinations.map((p) => (
                            <option key={p.paradaId} value={p.paradaId}>
                              {p.nombreParada}
                              {p.esOficina ? " · Oficina" : ""}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    {map.paradas.length < 2 && (
                      <p role="alert" className="text-sm text-amber-900">
                        Esta ruta necesita al menos dos paradas para vender un
                        tramo.
                      </p>
                    )}
                    <Field label="Precio del pasaje (S/) *">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className={input}
                      />
                    </Field>
                    <Field
                      label={
                        operation === "VENTA_DIRECTA"
                          ? "Cobro total (S/)"
                          : "Monto de Adelanto (S/)"
                      }
                    >
                      <input
                        type="number"
                        min="0"
                        max={price || undefined}
                        step="0.01"
                        readOnly={operation === "VENTA_DIRECTA"}
                        value={operation === "VENTA_DIRECTA" ? price : advance}
                        onChange={(e) => setAdvance(e.target.value)}
                        className={input}
                      />
                    </Field>
                    <PaymentFields
                      value={payment}
                      onChange={setPayment}
                      maxBytes={maxVoucherBytes}
                    />
                  </fieldset>
                  <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-500">Total del boleto</span>
                      <strong className="text-xl">
                        {Number.isFinite(Number(price)) && Number(price) > 0
                          ? currency(Number(price))
                          : "—"}
                      </strong>
                    </p>
                    <p className="mt-2 flex justify-between text-sm">
                      <span>Cobro ahora</span>
                      <strong>
                        {paidCents !== null ? currency(paidCents / 100) : "—"}
                      </strong>
                    </p>
                    <p className="mt-2 flex justify-between text-sm">
                      <span>Saldo pendiente</span>
                      <strong className="text-amber-800">
                        {pendingCents !== null && pendingCents >= 0
                          ? currency(pendingCents / 100)
                          : "—"}
                      </strong>
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Building2 size={13} aria-hidden="true" />
                      Facturación al mismo cliente
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={
                      seatBusy ||
                      !selectedSeat ||
                      !client ||
                      !originStop ||
                      !destinations.some(
                        (p) => p.paradaId === Number(destination),
                      )
                    }
                    onClick={() => void sell()}
                    className={`${primary} mt-4 w-full`}
                  >
                    {saving ? (
                      <LoaderCircle
                        size={19}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Ticket size={19} aria-hidden="true" />
                    )}
                    {saving
                      ? "Registrando boleto…"
                      : operation === "RESERVA"
                        ? "Registrar Reserva"
                        : "Emitir y Cobrar Boleto"}
                  </button>
                  <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
                    Registra el cobro informado y su voucher. La emisión del
                    comprobante se gestiona desde el asiento pagado.
                  </p>
                </section>
              </div>
            )
          )}
        </>
      )}
      {activeAction && (
        <ActionModal
          title={
            activeAction.kind === "pay"
              ? "Liquidar saldo pendiente"
              : activeAction.kind === "cancel"
                ? "Anular y liberar asiento"
                : "Emitir comprobante"
          }
          busy={actionBusy}
          onClose={closeAction}
        >
          <form
            onSubmit={(e) => void manage(e)}
            aria-busy={actionBusy}
            className="space-y-5"
          >
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="font-semibold">
                Asiento #{activeAction.seat.numeroAsiento} ·{" "}
                {activeAction.seat.pasajeroNombre || "Pasajero registrado"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {activeAction.seat.pasajeroDocumento} ·{" "}
                {activeAction.seat.destinoNombre}
              </p>
            </div>
            {actionError && <Alert>{actionError}</Alert>}
            <fieldset
              disabled={actionBusy || actionUncertain}
              className="space-y-4"
            >
              {activeAction.kind === "pay" ? (
                <>
                  <Field label="Monto a liquidar (S/)">
                    <input
                      type="text"
                      readOnly
                      value={activeAction.seat.saldoPendiente.toFixed(2)}
                      className={`${input} font-bold`}
                    />
                  </Field>
                  <p className="text-xs text-slate-500">
                    Se cobra exactamente el saldo pendiente, sin pagos parciales
                    ni excedentes.
                  </p>
                  <PaymentFields
                    value={liquidation}
                    onChange={setLiquidation}
                    maxBytes={maxVoucherBytes}
                    withNumber={false}
                  />
                </>
              ) : activeAction.kind === "cancel" ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <p>Se anulará el pasaje y se liberará el asiento.</p>
                  <p className="mt-2 font-semibold">
                    Monto registrado como pagado:{" "}
                    {currency(activeAction.seat.montoAdelanto)}
                  </p>
                  <p className="mt-2">
                    Esta acción no registra devoluciones ni anula comprobantes
                    emitidos.
                  </p>
                </div>
              ) : (
                <Field label="Tipo de comprobante">
                  <select
                    value={receiptType}
                    onChange={(e) =>
                      setReceiptType(e.target.value as TipoComprobante)
                    }
                    className={input}
                  >
                    <option value="NOTA_VENTA">Nota de Venta</option>
                    <option value="BOLETA">Boleta</option>
                    <option value="FACTURA">Factura</option>
                  </select>
                </Field>
              )}
            </fieldset>
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                disabled={actionBusy}
                onClick={closeAction}
                className={secondary}
              >
                {actionUncertain ? "Cerrar y verificar" : "Volver"}
              </button>
              <button
                type="submit"
                disabled={actionBusy || actionUncertain || !operational}
                className={primary}
              >
                {actionBusy ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Check size={17} aria-hidden="true" />
                )}
                {actionBusy
                  ? "Procesando…"
                  : activeAction.kind === "pay"
                    ? "Confirmar pago total"
                    : activeAction.kind === "cancel"
                      ? "Confirmar anulación"
                      : "Continuar con emisión"}
              </button>
            </div>
          </form>
        </ActionModal>
      )}
    </div>
  );
}
