import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { isAxiosError } from "axios";
import {
  AlertTriangle,
  ArrowRight,
  Bus,
  CheckCircle2,
  ChevronRight,
  Eye,
  Handshake,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ToggleLeft,
  Users,
  X,
} from "lucide-react";
import axiosClient from "../api/axiosClient";

export type EstadoSocio = "Activo" | "Inactivo";

export interface Socio {
  socioId: string;
  rucDni: string;
  razonSocialNombre: string;
  porcentajeGanancia: number | null;
  activo: boolean;
  cantidadVehiculos: number;
  placasVehiculos?: string[];
}

export interface SocioDto {
  rucDni: string;
  razonSocialNombre: string;
  porcentajeGanancia: number;
}

export interface SociosPageProps {
  apiRoot?: string;
  onUpdate?: (id: string, payload: SocioDto, signal: AbortSignal) => Promise<void>;
  onChangeEstado?: (socio: Socio, estado: EstadoSocio, signal: AbortSignal) => Promise<void>;
}

type ModalState =
  | { kind: "create" }
  | { kind: "edit" | "view" | "state"; socio: Socio }
  | null;

const css = `
  @keyframes jjr-socios-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes jjr-socios-modal { from { opacity: 0; transform: translateY(10px) scale(.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .jjr-socios .jjr-enter { animation: jjr-socios-enter .4s cubic-bezier(.16,1,.3,1) both; }
  .jjr-socios dialog[open] { animation: jjr-socios-modal .2s cubic-bezier(.16,1,.3,1) both; }
  .jjr-socios dialog::backdrop { background: rgb(15 23 42 / .4); backdrop-filter: blur(4px); }
  @media (prefers-reduced-motion: reduce) { .jjr-socios *, .jjr-socios *::before, .jjr-socios *::after { animation: none !important; transition: none !important; } }
`;

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A3E0]";
const input =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-[#102D50] outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-[#00A3E0] focus:bg-white focus:ring-4 focus:ring-[#00A3E0]/10 disabled:opacity-60";
const primary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#075BC6] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#062443] hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;
const secondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#102D50] transition-all duration-300 hover:bg-blue-50 disabled:opacity-60 ${focus}`;

const fmt = (value: number) =>
  new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(value);
const textMatch = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("La API devolvió un registro inválido.");
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.charAt(0).toLowerCase() + key.slice(1),
      item,
    ])
  );
}

function str(r: Record<string, unknown>, key: string): string {
  const value = r[key];
  if (typeof value !== "string")
    throw new Error(`La respuesta no contiene ${key} válido.`);
  return value;
}

function num(r: Record<string, unknown>, key: string): number {
  const value = r[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error(`La respuesta no contiene ${key} válido.`);
  return value;
}

function bool(r: Record<string, unknown>, key: string): boolean {
  const value = r[key];
  if (typeof value !== "boolean")
    throw new Error(`La respuesta no contiene ${key} válido.`);
  return value;
}

function decodeSocio(value: unknown): Socio {
  const r = record(value);
  const percentage =
    r.porcentajeGanancia === null ? null : num(r, "porcentajeGanancia");
  const placas = Array.isArray(r.placasVehiculos)
    ? r.placasVehiculos.filter((item): item is string => typeof item === "string")
    : undefined;

  return {
    socioId: str(r, "socioId"),
    rucDni: str(r, "rucDni"),
    razonSocialNombre: str(r, "razonSocialNombre"),
    porcentajeGanancia: percentage,
    activo: bool(r, "activo"),
    cantidadVehiculos: num(r, "cantidadVehiculos"),
    placasVehiculos: placas,
  };
}

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function errorMessage(cause: unknown, writing = false): string {
  if (isAxiosError(cause)) {
    const status = cause.response?.status;
    if (status === 401)
      return "Tu sesión venció o no es válida. Inicia sesión nuevamente.";
    if (status === 403) return "No tienes permisos para realizar esta operación.";
    if (status === 429)
      return "Hay demasiadas solicitudes. Espera un momento e inténtalo otra vez.";
    if (status === 400 || status === 404 || status === 409 || status === 422) {
      const data: unknown = cause.response?.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const r = record(data);
        if (typeof r.mensaje === "string") return r.mensaje;
      }
      return "Revisa los campos del formulario y vuelve a intentarlo.";
    }
    if (writing && (!cause.response || (status ?? 0) >= 500))
      return "No se pudo confirmar la operación. Cierra el formulario y actualiza la lista.";
    return "No se pudo conectar con el servidor. Comprueba tu conexión.";
  }
  return cause instanceof Error ? cause.message : "Ocurrió un error inesperado.";
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-semibold text-[#102D50]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-[10px] leading-4 text-slate-500">
          {hint}
        </span>
      )}
    </label>
  );
}

function Avatar({ name }: { name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("") || "JJ";
  return (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-100 text-xs font-bold text-violet-800"
    >
      {initials.toUpperCase()}
    </span>
  );
}

function Modal({
  title,
  description,
  busy,
  onClose,
  children,
}: {
  title: string;
  description: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

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
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-2xl overflow-y-auto rounded-3xl border-0 bg-white p-0 text-[#102D50] shadow-2xl"
    >
      <div className="p-6 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id={`${id}-title`} className="text-xl font-bold tracking-tight">
              {title}
            </h2>
            <p id={`${id}-description`} className="mt-2 text-xs leading-5 text-slate-500">
              {description}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            disabled={busy}
            onClick={onClose}
            className={`shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 ${focus}`}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export default function SociosPage({
  apiRoot,
  onUpdate,
  onChangeEstado,
}: SociosPageProps) {
  const root = (
    apiRoot ??
    (/\/api\/?$/i.test(axiosClient.defaults.baseURL ?? "")
      ? "/Flota"
      : "/api/Flota")
  ).replace(/\/$/, "");

  const [items, setItems] = useState<Socio[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [modal, setModal] = useState<ModalState>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [success, setSuccess] = useState("");
  const [nextState, setNextState] = useState<EstadoSocio | "">("");

  const writeLock = useRef(false);
  const writeRef = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const id = useId();

  const reload = useCallback(() => setRevision((v) => v + 1), []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      writeRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    void axiosClient
      .get<unknown>(`${root}/socios`, {
        signal: controller.signal,
        timeout: 15000,
        headers: authHeaders(),
      })
      .then(({ data }) => {
        if (!Array.isArray(data))
          throw new Error("Se esperaba una lista JSON de socios.");
        const parsed = data.map(decodeSocio);
        if (!controller.signal.aborted) setItems(parsed);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [root, revision]);

  function open(value: ModalState) {
    setSaveError("");
    setUncertain(false);
    setNextState("");
    setModal(value);
  }

  function close() {
    if (writeLock.current) return;
    setModal(null);
    if (uncertain) reload();
  }

  const edited = modal?.kind === "edit" ? modal.socio : undefined;

  const totalVehicles =
    items?.reduce((acc, curr) => acc + curr.cantidadVehiculos, 0) ?? 0;
  const activeSocios = items?.filter((s) => s.activo).length ?? 0;
  const avgProfit =
    items && items.length > 0
      ? items.reduce((acc, curr) => acc + (curr.porcentajeGanancia ?? 70), 0) /
        items.length
      : 70;

  const filtered = items?.filter((socio) => {
    const matches = textMatch(
      `${socio.rucDni} ${socio.razonSocialNombre}`
    ).includes(textMatch(query.trim()));
    const socioState = socio.activo ? "Activo" : "Inactivo";
    return matches && (stateFilter === "all" || socioState === stateFilter);
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (writeLock.current || uncertain || !modal || modal.kind === "view") return;
    const action = modal;
    setSaveError("");

    let payload: SocioDto | undefined;

    if (action.kind === "state") {
      if (!nextState) {
        setSaveError("Selecciona el nuevo estado.");
        return;
      }
      const currentState = action.socio.activo ? "Activo" : "Inactivo";
      if (nextState === currentState) {
        setSaveError("Selecciona un estado distinto al actual.");
        return;
      }
    } else {
      const form = new FormData(event.currentTarget);
      const field = (key: string) => String(form.get(key) ?? "").trim();

      const rucDni = field("rucDni");
      const razonSocial = field("razonSocialNombre");
      const profit = Number(field("porcentajeGanancia"));

      if (!rucDni || !/^\d{8,11}$/.test(rucDni)) {
        setSaveError("Ingresa un RUC (11 dígitos) o DNI (8 dígitos) válido.");
        return;
      }
      if (!razonSocial) {
        setSaveError("Ingresa la Razón Social o Nombre Completo.");
        return;
      }
      if (!Number.isFinite(profit) || profit <= 0 || profit > 100) {
        setSaveError("El porcentaje de ganancia debe estar entre 1% y 100%.");
        return;
      }

      payload = {
        rucDni,
        razonSocialNombre: razonSocial,
        porcentajeGanancia: profit,
      };
    }

    writeLock.current = true;
    setSaving(true);
    const controller = new AbortController();
    writeRef.current = controller;
    const config = {
      timeout: 15000,
      signal: controller.signal,
      headers: authHeaders(),
    };

    try {
      if (action.kind === "create" && payload) {
        await axiosClient.post<unknown>(`${root}/socios`, payload, config);
      } else if (action.kind === "edit" && payload) {
        if (onUpdate)
          await onUpdate(action.socio.socioId, payload, controller.signal);
        else
          await axiosClient.put<unknown>(
            `${root}/socios/${encodeURIComponent(action.socio.socioId)}`,
            payload,
            config
          );
      } else if (action.kind === "state" && nextState) {
        if (onChangeEstado)
          await onChangeEstado(action.socio, nextState, controller.signal);
        else
          await axiosClient.patch<unknown>(
            `${root}/socios/${encodeURIComponent(action.socio.socioId)}/estado`,
            { estado: nextState },
            config
          );
      }

      if (!mounted.current) return;
      setModal(null);
      setSuccess(
        action.kind === "create"
          ? "Socio registrado correctamente."
          : action.kind === "edit"
          ? "Socio actualizado correctamente."
          : "Estado del socio actualizado correctamente."
      );
      reload();
    } catch (cause) {
      if (!mounted.current || controller.signal.aborted) return;
      setSaveError(errorMessage(cause, true));
      if (isAxiosError(cause) && (!cause.response || cause.response.status >= 500))
        setUncertain(true);
    } finally {
      writeLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <div className="jjr-socios mx-auto max-w-[1600px] space-y-6 p-4 font-sans text-[#102D50] sm:p-6 xl:p-8">
      <style>{css}</style>

      <header className="jjr-enter flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-1 text-[10px] font-medium text-slate-500">
            Flota & personal <ChevronRight size={12} aria-hidden="true" /> Socios
            inversionistas
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Socios Inversionistas
          </h1>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500">
            Gestión de propietarios de unidades, distribución de ingresos (70/30 por
            defecto) y resumen de flota asociada.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className={secondary}
        >
          <RefreshCw
            size={16}
            aria-hidden="true"
            className={loading ? "animate-spin" : ""}
          />
          {loading ? "Actualizando…" : "Actualizar datos"}
        </button>
      </header>

      {/* Tarjetas KPI */}
      <section
        aria-label="Indicadores de socios"
        className="grid gap-4 lg:grid-cols-3"
      >
        <article className="jjr-enter rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">
              Total socios registrados
            </p>
            <span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <Handshake size={20} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {items ? fmt(items.length) : "—"}
          </p>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            {items
              ? `${activeSocios} activos · ${items.length - activeSocios} inactivos`
              : "Esperando datos del servidor"}
          </p>
        </article>

        <article className="jjr-enter rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">
              Vehículos de socios
            </p>
            <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#075BC6]">
              <Bus size={20} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {items ? fmt(totalVehicles) : "—"}
          </p>
          <p className="mt-3 text-[11px] text-slate-500">
            Unidades activas asociadas a socios inversionistas.
          </p>
        </article>

        <article className="jjr-enter rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">
              Reparto de ganancia promedio
            </p>
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {items ? `${fmt(avgProfit)}%` : "—"}
          </p>

          <p className="mt-3 text-[11px] text-slate-500">
            Porcentaje promedio asignado al socio por viaje.
          </p>
        </article>
      </section>

      {/* Confirmación / Errores */}
      <div aria-live="polite" aria-atomic="true">
        {success && (
          <div className="jjr-enter flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            <CheckCircle2 size={17} aria-hidden="true" />
            <span className="flex-1">{success}</span>
            <button
              type="button"
              aria-label="Cerrar confirmación"
              onClick={() => setSuccess("")}
              className={`rounded p-1 ${focus}`}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs leading-6 text-red-800"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} aria-hidden="true" />
            No se pudo actualizar la lista de socios
          </p>
          <p>{error}</p>
          {items && <p>Se conserva la última información cargada.</p>}
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className={`mt-2 rounded px-1 py-2 font-semibold underline ${focus}`}
          >
            Reintentar carga
          </button>
        </div>
      )}

      {/* Tabla Principal */}
      <section
        aria-labelledby={`${id}-table-title`}
        className="jjr-enter overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id={`${id}-table-title`}
              className="flex items-center gap-2 text-sm font-bold"
            >
              <Users size={18} aria-hidden="true" className="text-[#075BC6]" />
              Directorio de socios inversionistas
            </h2>
            <p className="mt-1 text-[10px] text-slate-500">
              Socios registrados, RUC/DNI, comisiones y unidades asociadas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => open({ kind: "create" })}
            className={primary}
          >
            <Plus size={17} aria-hidden="true" />
            Registrar Socio
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-5">
          <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <span className="sr-only">Buscar por RUC/DNI o Razón Social</span>
            <Search
              size={17}
              aria-hidden="true"
              className="absolute top-3.5 left-3 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar RUC, DNI o Nombre…"
              className={`${input} pl-10`}
            />
          </label>
          <label className="w-full sm:w-auto">
            <span className="sr-only">Filtrar estado del socio</span>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className={input}
            >
              <option value="all">Todos los estados</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </label>
          {(query || stateFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStateFilter("all");
              }}
              className={`rounded-lg px-2 py-3 text-xs font-medium text-[#075BC6] hover:bg-blue-50 ${focus}`}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {loading && !items ? (
          <div className="space-y-4 p-6">
            {[0, 1, 2].map((k) => (
              <div
                key={k}
                className="flex animate-pulse items-center gap-4"
              >
                <span className="size-10 rounded-full bg-slate-100" />
                <span className="h-10 flex-1 rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : !filtered || !filtered.length ? (
          <div className="py-14 text-center">
            <Handshake
              size={32}
              aria-hidden="true"
              className="mx-auto mb-3 text-slate-300"
            />
            <p className="text-sm font-semibold">
              {!items
                ? "Datos no disponibles"
                : items.length
                ? "No se encontraron coincidencias"
                : "Aún no hay socios registrados"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {!items
                ? "Reintenta la carga para consultar la lista."
                : items.length
                ? "Prueba otra búsqueda o cambia el filtro de estado."
                : "Registra el primer socio inversionista para comenzar."}
            </p>
          </div>
        ) : (
          <div
            role="region"
            aria-label="Tabla de socios"
            tabIndex={0}
            className={`overflow-x-auto ${focus}`}
          >
            <table className="w-full min-w-[1000px] text-left text-xs">
              <thead className="border-y border-slate-100 bg-slate-50 text-[10px] tracking-wide text-slate-500 uppercase">
                <tr>
                  {[
                    "Socio / Razón Social",
                    "RUC / DNI",
                    "Reparto de Ganancia",
                    "Vehículos en Flota",
                    "Estado",
                    "Acciones",
                  ].map((label) => (
                    <th key={label} scope="col" className="px-5 py-3.5 font-semibold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((socio) => (
                  <tr
                    key={socio.socioId}
                    className="transition-colors duration-300 hover:bg-blue-50/50"
                  >
                    <th scope="row" className="px-5 py-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={socio.razonSocialNombre} />
                        <div>
                          <p className="max-w-60 text-xs font-semibold leading-5">
                            {socio.razonSocialNombre}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Socio Inversionista
                          </p>
                        </div>
                      </div>
                    </th>
                    <td className="px-5 py-5">
                      <span className="inline-block rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {socio.rucDni}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
                        {fmt(socio.porcentajeGanancia ?? 70)}% Socio /{" "}
                        {fmt(100 - (socio.porcentajeGanancia ?? 70))}% JJR
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <p className="font-semibold text-[#102D50]">
                        {fmt(socio.cantidadVehiculos)}{" "}
                        {socio.cantidadVehiculos === 1 ? "vehículo" : "vehículos"}
                      </p>
                      {socio.placasVehiculos && socio.placasVehiculos.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {socio.placasVehiculos.map((placa) => (
                            <span
                              key={placa}
                              className="rounded border border-blue-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#062443]"
                            >
                              {placa}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          socio.activo
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <span className="size-1.5 rounded-full bg-current" />
                        {socio.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Editar socio"
                          aria-label={`Editar socio ${socio.razonSocialNombre}`}
                          onClick={() => open({ kind: "edit", socio })}
                          className={`rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-blue-100 hover:text-[#075BC6] ${focus}`}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          title="Ver detalle"
                          aria-label={`Ver detalle de ${socio.razonSocialNombre}`}
                          onClick={() => open({ kind: "view", socio })}
                          className={`rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-blue-100 hover:text-[#075BC6] ${focus}`}
                        >
                          <Eye size={17} />
                        </button>
                        <button
                          type="button"
                          title="Cambiar estado"
                          aria-label={`Cambiar estado de ${socio.razonSocialNombre}`}
                          onClick={() => open({ kind: "state", socio })}
                          className={`rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-700 ${focus}`}
                        >
                          <ToggleLeft size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p
          role="status"
          className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500"
        >
          {items
            ? `Mostrando ${filtered?.length ?? 0} de ${items.length} socios`
            : "Esperando datos del servidor"}
          {loading && items ? " · Actualizando…" : ""}
        </p>
      </section>

      {/* Modales */}
      {modal && (
        <Modal
          key={modal.kind}
          title={
            modal.kind === "create"
              ? "Registrar Socio Inversionista"
              : modal.kind === "edit"
              ? "Editar Socio Inversionista"
              : modal.kind === "state"
              ? "Cambiar estado del socio"
              : "Ficha del Socio Inversionista"
          }
          description={
            modal.kind === "view"
              ? "Información corporativa y flota asociada registrada en Transportes JJR S.A.C."
              : "Completa los datos de identificación y porcentaje asignado. Los campos con * son obligatorios."
          }
          busy={saving}
          onClose={close}
        >
          {saveError && (
            <p
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"
            >
              <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              {saveError}
            </p>
          )}

          {modal.kind === "view" ? (
            <>
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
                <Avatar name={modal.socio.razonSocialNombre} />
                <div>
                  <p className="text-sm font-bold">{modal.socio.razonSocialNombre}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    RUC / DNI: {modal.socio.rucDni}
                  </p>
                </div>
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  [
                    "Reparto de ganancia",
                    `${fmt(modal.socio.porcentajeGanancia ?? 70)}% Socio / ${fmt(
                      100 - (modal.socio.porcentajeGanancia ?? 70)
                    )}% Empresa`,
                  ],
                  [
                    "Vehículos activos",
                    `${fmt(modal.socio.cantidadVehiculos)} unidades`,
                  ],
                  ["Estado", modal.socio.activo ? "Activo" : "Inactivo"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-[10px] text-slate-500">{label}</dt>
                    <dd className="mt-1 break-words text-xs font-semibold">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {modal.socio.placasVehiculos &&
                modal.socio.placasVehiculos.length > 0 && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] text-slate-500">
                      Placas asociadas a este socio:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {modal.socio.placasVehiculos.map((placa) => (
                        <span
                          key={placa}
                          className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-[#062443]"
                        >
                          {placa}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={close} className={secondary}>
                  Cerrar ficha <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={(e) => void submit(e)} aria-busy={saving}>
              {modal.kind === "state" ? (
                <fieldset disabled={saving || uncertain} className="space-y-5">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold">
                      {modal.socio.razonSocialNombre}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Estado actual: {modal.socio.activo ? "Activo" : "Inactivo"}
                    </p>
                  </div>
                  <Field label="Nuevo estado *">
                    <select
                      autoFocus
                      required
                      value={nextState}
                      onChange={(e) =>
                        setNextState(e.target.value as EstadoSocio | "")
                      }
                      className={input}
                    >
                      <option value="">Selecciona un estado</option>
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </Field>
                </fieldset>
              ) : (
                <fieldset disabled={saving || uncertain} className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="RUC / DNI *"
                    hint="8 dígitos para DNI o 11 dígitos para RUC."
                  >
                    <input
                      autoFocus
                      name="rucDni"
                      required
                      inputMode="numeric"
                      minLength={8}
                      maxLength={11}
                      defaultValue={edited?.rucDni ?? ""}
                      placeholder="Ej. 20601234567"
                      className={input}
                    />
                  </Field>
                  <Field label="Razón Social / Nombre Completo *">
                    <input
                      name="razonSocialNombre"
                      required
                      maxLength={150}
                      defaultValue={edited?.razonSocialNombre ?? ""}
                      placeholder="Ej. Inversiones San Martín S.A.C."
                      className={input}
                    />
                  </Field>
                  <Field
                    label="Porcentaje de Ganancia (%) *"
                    hint="Porcentaje asignado al socio por viaje (por defecto 70%)."
                  >
                    <input
                      name="porcentajeGanancia"
                      type="number"
                      required
                      min={1}
                      max={100}
                      step="0.01"
                      defaultValue={edited?.porcentajeGanancia ?? 70}
                      className={input}
                    />
                  </Field>
                </fieldset>
              )}

              <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={close}
                  className={secondary}
                >
                  {uncertain ? "Cerrar y verificar lista" : "Cancelar"}
                </button>
                <button
                  type="submit"
                  disabled={saving || uncertain}
                  className={primary}
                >
                  {saving ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  )}
                  {saving
                    ? "Guardando…"
                    : modal.kind === "create"
                    ? "Guardar socio"
                    : "Guardar cambios"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}