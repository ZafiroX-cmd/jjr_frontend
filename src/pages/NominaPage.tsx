import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import axiosClient from "../api/axiosClient";

export interface Contrato {
  contratoId: string;
  tipoTrabajador: string;
  trabajadorNombre: string;
  documento: string;
  cargo: string;
  sueldoBase: number;
  pagoPorViaje: number | null;
  tipoPago: string;
  fechaInicio: string;
  activo: boolean;
  conductorId: string | null;
  usuarioId: string | null;
  socioId: string | null;
}

export interface ContratoDto {
  conductorId: string | null;
  usuarioId: string | null;
  socioId: string | null;
  sueldoBase: number;
  pagoPorViaje: number | null;
  fechaInicio: string;
}

export interface PagoNomina {
  pagoId: string;
  contratoId: string;
  trabajadorNombre: string;
  periodo: string;
  periodoMes: number;
  periodoAnio: number;
  sueldoGanado: number;
  totalDescuentos: number;
  totalAdelantos: number;
  montoNetoPagar: number;
  fechaPago: string | null;
  estadoPago: "Pendiente" | "Pagado";
  observaciones: string | null;
}

export interface PagoNominaDto {
  contratoId: string;
  periodoMes: number;
  periodoAnio: number;
  sueldoGanado: number;
  totalDescuentos: number;
  totalAdelantos: number;
  marcarComoPagado: boolean;
  observaciones: string | null;
}

interface OptionPersona {
  id: string;
  nombre: string;
  tipo: "conductor" | "usuario" | "socio";
}

export interface NominaPageProps {
  apiRoot?: string;
}

type ModalState =
  | { kind: "create_contract" }
  | { kind: "edit_contract"; contrato: Contrato }
  | { kind: "create_pago" }
  | null;

const css = `
  @keyframes jjr-nomina-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes jjr-nomina-modal { from { opacity: 0; transform: translateY(10px) scale(.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .jjr-nomina .jjr-enter { animation: jjr-nomina-enter .4s cubic-bezier(.16,1,.3,1) both; }
  .jjr-nomina dialog[open] { animation: jjr-nomina-modal .2s cubic-bezier(.16,1,.3,1) both; }
  .jjr-nomina dialog::backdrop { background: rgb(15 23 42 / .4); backdrop-filter: blur(4px); }
  @media (prefers-reduced-motion: reduce) { .jjr-nomina *, .jjr-nomina *::before, .jjr-nomina *::after { animation: none !important; transition: none !important; } }
`;

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A3E0]";
const input =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-[#102D50] outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-[#00A3E0] focus:bg-white focus:ring-4 focus:ring-[#00A3E0]/10 disabled:opacity-60";
const primary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#075BC6] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#062443] hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;
const secondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#102D50] transition-all duration-300 hover:bg-blue-50 disabled:opacity-60 ${focus}`;

const fmt = (value: number) =>
  new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-semibold text-[#102D50]">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[10px] leading-4 text-slate-500">{hint}</span>}
    </label>
  );
}

function Modal({ title, description, busy, onClose, children }: { title: string; description: string; busy: boolean; onClose: () => void; children: ReactNode }) {
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
            <h2 id={`${id}-title`} className="text-xl font-bold tracking-tight">{title}</h2>
            <p id={`${id}-description`} className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
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

export default function NominaPage({ apiRoot }: NominaPageProps) {
  const root = (
    apiRoot ??
    (/\/api\/?$/i.test(axiosClient.defaults.baseURL ?? "")
      ? "/Nomina"
      : "/api/Nomina")
  ).replace(/\/$/, "");

  const [activeTab, setActiveTab] = useState<"contratos" | "pagos">("contratos");
  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [pagos, setPagos] = useState<PagoNomina[] | null>(null);
  const [personasOptions, setPersonasOptions] = useState<OptionPersona[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");

  const writeLock = useRef(false);
  const id = useId();

  const reload = useCallback(() => setRevision((v) => v + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    const fetchContratos = axiosClient.get<unknown>(`${root}/contratos`, { signal: controller.signal, headers: authHeaders() });
    const fetchPagos = axiosClient.get<unknown>(`${root}/pagos`, { signal: controller.signal, headers: authHeaders() });
    const fetchConductores = axiosClient.get<unknown>(`/Flota/conductores`, { signal: controller.signal, headers: authHeaders() });

    Promise.all([fetchContratos, fetchPagos, fetchConductores])
      .then(([resContratos, resPagos, resConductores]) => {
        if (Array.isArray(resContratos.data)) setContratos(resContratos.data as Contrato[]);
        if (Array.isArray(resPagos.data)) setPagos(resPagos.data as PagoNomina[]);

        if (Array.isArray(resConductores.data)) {
          const list: OptionPersona[] = resConductores.data.map((c: any) => ({
            id: String(c.conductorId),
            nombre: `${c.nombreCompleto || c.nombres} (Conductor)`,
            tipo: "conductor",
          }));
          setPersonasOptions(list);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("No se pudieron cargar los datos de nómina.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [root, revision]);

  const activeContracts = contratos?.filter((c) => c.activo).length ?? 0;
  const totalPayrollMonth = pagos?.filter((p) => p.estadoPago === "Pagado").reduce((acc, curr) => acc + curr.montoNetoPagar, 0) ?? 0;

  async function submitContract(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (writeLock.current || !modal) return;
    setSaveError("");

    const form = new FormData(e.currentTarget);
    const personaSel = String(form.get("personaSel") ?? "");
    const sueldoBase = Number(form.get("sueldoBase"));
    const pagoPorViaje = form.get("pagoPorViaje") ? Number(form.get("pagoPorViaje")) : null;
    const fechaInicio = String(form.get("fechaInicio"));

    if (modal.kind === "create_contract" && !personaSel) {
      setSaveError("Selecciona la persona a la que pertenece el contrato.");
      return;
    }

    if (sueldoBase <= 0 || !fechaInicio) {
      setSaveError("Ingresa un sueldo base válido y la fecha de inicio.");
      return;
    }

    let conductorId: string | null = null;
    let usuarioId: string | null = null;
    let socioId: string | null = null;

    if (modal.kind === "create_contract") {
      const [tipo, idPersona] = personaSel.split(":");
      if (tipo === "conductor") conductorId = idPersona;
      else if (tipo === "usuario") usuarioId = idPersona;
      else if (tipo === "socio") socioId = idPersona;
    } else if (modal.kind === "edit_contract") {
      conductorId = modal.contrato.conductorId;
      usuarioId = modal.contrato.usuarioId;
      socioId = modal.contrato.socioId;
    } else {
      return;
    }

    const payload: ContratoDto = {
      conductorId,
      usuarioId,
      socioId,
      sueldoBase,
      pagoPorViaje,
      fechaInicio,
    };

    writeLock.current = true;
    setSaving(true);

    try {
      if (modal.kind === "create_contract") {
        await axiosClient.post(`${root}/contratos`, payload, { headers: authHeaders() });
        setSuccess("Contrato laboral registrado correctamente.");
      } else if (modal.kind === "edit_contract") {
        await axiosClient.put(`${root}/contratos/${modal.contrato.contratoId}`, payload, { headers: authHeaders() });
        setSuccess("Contrato actualizado correctamente.");
      }
      setModal(null);
      reload();
    } catch (cause: any) {
      const msg = cause?.response?.data?.mensaje || "Ocurrió un error al procesar el contrato.";
      setSaveError(msg);
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  }

  async function submitPago(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (writeLock.current || !modal) return;
    setSaveError("");

    const form = new FormData(e.currentTarget);
    const contratoId = String(form.get("contratoId"));
    const periodoMes = Number(form.get("periodoMes"));
    const periodoAnio = Number(form.get("periodoAnio"));
    const sueldoGanado = Number(form.get("sueldoGanado"));
    const totalDescuentos = Number(form.get("totalDescuentos") ?? 0);
    const totalAdelantos = Number(form.get("totalAdelantos") ?? 0);
    const marcarComoPagado = form.get("marcarComoPagado") === "on";
    const observaciones = String(form.get("observaciones") ?? "").trim() || null;

    if (!contratoId || !periodoMes || !periodoAnio) {
      setSaveError("Completa todos los campos obligatorios del pago.");
      return;
    }

    const payload: PagoNominaDto = {
      contratoId,
      periodoMes,
      periodoAnio,
      sueldoGanado,
      totalDescuentos,
      totalAdelantos,
      marcarComoPagado,
      observaciones,
    };

    writeLock.current = true;
    setSaving(true);

    try {
      await axiosClient.post(`${root}/pagos`, payload, { headers: authHeaders() });
      setSuccess("Boleta de pago de nómina registrada correctamente.");
      setModal(null);
      reload();
    } catch (cause: any) {
      const msg = cause?.response?.data?.mensaje || "Error al generar el pago de nómina.";
      setSaveError(msg);
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  }

  async function updateEstadoPago(pagoId: string, estado: "Pagado" | "Pendiente") {
    try {
      await axiosClient.patch(`${root}/pagos/${pagoId}/estado`, { estado }, { headers: authHeaders() });
      setSuccess(`Estado del pago actualizado a ${estado}.`);
      reload();
    } catch {
      setError("No se pudo actualizar el estado del pago.");
    }
  }

  return (
    <div className="jjr-nomina mx-auto max-w-[1600px] space-y-6 p-4 font-sans text-[#102D50] sm:p-6 xl:p-8">
      <style>{css}</style>

      {/* Header */}
      <header className="jjr-enter flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-1 text-[10px] font-medium text-slate-500">
            Gestión humana <ChevronRight size={12} aria-hidden="true" /> Contratos & nómina
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Contratos & Nómina</h1>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500">
            Control de contratos laborales, sueldos base, pagos por viaje, adelantos y planillas de nómina.
          </p>
        </div>
        <button type="button" onClick={reload} disabled={loading} className={secondary}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {loading ? "Actualizando…" : "Actualizar datos"}
        </button>
      </header>

      {/* KPIs */}
      <section aria-label="KPIs de nómina" className="grid gap-4 lg:grid-cols-3">
        <article className="jjr-enter rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Contratos vigentes</p>
            <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#075BC6]">
              <ClipboardList size={20} />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums">{contratos ? activeContracts : "—"}</p>
          <p className="mt-3 text-[11px] text-slate-500">Contratos laborales activos en el sistema.</p>
        </article>

        <article className="jjr-enter rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Planilla total procesada</p>
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <DollarSign size={20} />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-700">{pagos ? `S/ ${fmt(totalPayrollMonth)}` : "—"}</p>
          <p className="mt-3 text-[11px] text-slate-500">Monto neto total pagado en planillas.</p>
        </article>

        <article className="jjr-enter rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Boletas pendientes</p>
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <CreditCard size={20} />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-amber-700">
            {pagos ? pagos.filter((p) => p.estadoPago === "Pendiente").length : "—"}
          </p>
          <p className="mt-3 text-[11px] text-slate-500">Planillas generadas pendientes de abono.</p>
        </article>
      </section>

      {/* Confirmación y errores */}
      {success && (
        <div className="jjr-enter flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <CheckCircle2 size={17} />
          <span className="flex-1">{success}</span>
          <button type="button" onClick={() => setSuccess("")} className={`rounded p-1 ${focus}`}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {/* Navegación por pestañas */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("contratos")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all ${
            activeTab === "contratos"
              ? "border-[#075BC6] text-[#075BC6]"
              : "border-transparent text-slate-500 hover:text-[#102D50]"
          }`}
        >
          <FileText size={16} />
          Contratos Laborales
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pagos")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all ${
            activeTab === "pagos"
              ? "border-[#075BC6] text-[#075BC6]"
              : "border-transparent text-slate-500 hover:text-[#102D50]"
          }`}
        >
          <CreditCard size={16} />
          Planilla & Pagos de Nómina
        </button>
      </div>

      {/* TAB 1: CONTRATOS */}
      {activeTab === "contratos" && (
        <section aria-labelledby={`${id}-contracts-title`} className="jjr-enter overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id={`${id}-contracts-title`} className="text-sm font-bold">Contratos Registrados</h2>
              <p className="mt-1 text-[10px] text-slate-500">Sueldos base, modalidad de pago y estado de vigencia.</p>
            </div>
            <button
              type="button"
              onClick={() => setModal({ kind: "create_contract" })}
              className={primary}
            >
              <Plus size={17} />
              Nuevo Contrato
            </button>
          </div>

          <div className="p-5">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por colaborador o cargo…"
              className={input}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-y border-slate-100 bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Colaborador</th>
                  <th className="px-5 py-3.5">Cargo / Tipo</th>
                  <th className="px-5 py-3.5">Sueldo Base</th>
                  <th className="px-5 py-3.5">Fecha Inicio</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contratos
                  ?.filter((c) => c.trabajadorNombre.toLowerCase().includes(query.toLowerCase()))
                  .map((contrato) => (
                    <tr key={contrato.contratoId} className="hover:bg-blue-50/50">
                      <td className="px-5 py-4 font-semibold">
                        {contrato.trabajadorNombre}
                        <span className="block text-[10px] font-normal text-slate-400">{contrato.documento}</span>
                      </td>
                      <td className="px-5 py-4">
                        {contrato.cargo}
                        <span className="block text-[10px] text-slate-500">{contrato.tipoTrabajador}</span>
                      </td>
                      <td className="px-5 py-4 font-bold text-[#075BC6]">
                        S/ {fmt(contrato.sueldoBase)}
                        <span className="block text-[10px] font-normal text-slate-500">{contrato.tipoPago}</span>
                      </td>
                      <td className="px-5 py-4 text-[11px]">{contrato.fechaInicio}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            contrato.activo ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {contrato.activo ? "Vigente" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setModal({ kind: "edit_contract", contrato })}
                          className="rounded-lg p-2 text-slate-500 hover:bg-blue-100 hover:text-[#075BC6]"
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: PAGOS DE NÓMINA */}
      {activeTab === "pagos" && (
        <section aria-labelledby={`${id}-pagos-title`} className="jjr-enter overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id={`${id}-pagos-title`} className="text-sm font-bold">Historial de Planillas & Pagos</h2>
              <p className="mt-1 text-[10px] text-slate-500">Sueldo ganado, adelantos, descuentos y neto a pagar.</p>
            </div>
            <button type="button" onClick={() => setModal({ kind: "create_pago" })} className={primary}>
              <Plus size={17} />
              Generar Pago de Nómina
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-y border-slate-100 bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Trabajador</th>
                  <th className="px-5 py-3.5">Periodo</th>
                  <th className="px-5 py-3.5">Ganado / Descuentos / Adelantos</th>
                  <th className="px-5 py-3.5">Monto Neto</th>
                  <th className="px-5 py-3.5">Fecha Pago</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagos?.map((pago) => (
                  <tr key={pago.pagoId} className="hover:bg-blue-50/50">
                    <td className="px-5 py-4 font-semibold">{pago.trabajadorNombre}</td>
                    <td className="px-5 py-4 font-bold text-slate-600">{pago.periodo}</td>
                    <td className="px-5 py-4 text-[11px]">
                      S/ {fmt(pago.sueldoGanado)}{" "}
                      <span className="text-red-700">-S/ {fmt(pago.totalDescuentos)} (Desc)</span>{" "}
                      <span className="text-amber-700">-S/ {fmt(pago.totalAdelantos)} (Adel)</span>
                    </td>
                    <td className="px-5 py-4 font-bold text-[#075BC6]">S/ {fmt(pago.montoNetoPagar)}</td>
                    <td className="px-5 py-4">{pago.fechaPago ? new Date(pago.fechaPago).toLocaleDateString("es-PE") : "—"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          pago.estadoPago === "Pagado" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {pago.estadoPago}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {pago.estadoPago === "Pendiente" && (
                        <button
                          type="button"
                          onClick={() => updateEstadoPago(pago.pagoId, "Pagado")}
                          className="rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700"
                        >
                          Marcar Pagado
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL CONTRATO */}
      {modal && (modal.kind === "create_contract" || modal.kind === "edit_contract") && (
        <Modal
          title={modal.kind === "create_contract" ? "Nuevo Contrato Laboral" : "Editar Contrato"}
          description="Selecciona a la persona asignada y ajusta su sueldo base y/o pago por viaje."
          busy={saving}
          onClose={() => setModal(null)}
        >
          {saveError && <p className="mb-4 text-xs font-semibold text-red-700">{saveError}</p>}
          <form onSubmit={(e) => void submitContract(e)} className="space-y-4">
            {modal.kind === "create_contract" ? (
              <Field label="Seleccionar Colaborador / Persona *">
                <select name="personaSel" required className={input}>
                  <option value="">Selecciona un chofer o personal</option>
                  {personasOptions.map((p) => (
                    <option key={`${p.tipo}:${p.id}`} value={`${p.tipo}:${p.id}`}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-[#102D50]">
                Colaborador: {modal.contrato.trabajadorNombre} ({modal.contrato.documento})
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sueldo Base (S/) *">
                <input
                  name="sueldoBase"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={modal.kind === "edit_contract" ? modal.contrato.sueldoBase : 1500}
                  className={input}
                />
              </Field>

              <Field label="Pago por Viaje (S/) (Opcional)">
                <input
                  name="pagoPorViaje"
                  type="number"
                  step="0.01"
                  defaultValue={modal.kind === "edit_contract" ? modal.contrato.pagoPorViaje ?? "" : ""}
                  placeholder="Ej. 50.00"
                  className={input}
                />
              </Field>
            </div>

            <Field label="Fecha Inicio *">
              <input
                name="fechaInicio"
                type="date"
                required
                defaultValue={modal.kind === "edit_contract" ? modal.contrato.fechaInicio : new Date().toISOString().split("T")[0]}
                className={input}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setModal(null)} className={secondary}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} className={primary}>
                {saving ? "Guardando…" : "Guardar Contrato"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL PAGO DE NÓMINA */}
      {modal && modal.kind === "create_pago" && (
        <Modal
          title="Generar Pago de Nómina"
          description="Selecciona el contrato y calcula el neto a pagar para la planilla."
          busy={saving}
          onClose={() => setModal(null)}
        >
          {saveError && <p className="mb-4 text-xs font-semibold text-red-700">{saveError}</p>}
          <form onSubmit={(e) => void submitPago(e)} className="space-y-4">
            <Field label="Seleccionar Trabajador / Contrato *">
              <select name="contratoId" required className={input}>
                <option value="">Selecciona un colaborador</option>
                {contratos
                  ?.filter((c) => c.activo)
                  .map((c) => (
                    <option key={c.contratoId} value={c.contratoId}>
                      {c.trabajadorNombre} ({c.cargo}) - Base S/ {fmt(c.sueldoBase)}
                    </option>
                  ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mes (1 - 12) *">
                <input name="periodoMes" type="number" min={1} max={12} required defaultValue={new Date().getMonth() + 1} className={input} />
              </Field>

              <Field label="Año *">
                <input name="periodoAnio" type="number" required defaultValue={new Date().getFullYear()} className={input} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Sueldo Ganado (S/) *">
                <input name="sueldoGanado" type="number" step="0.01" required defaultValue={1500} className={input} />
              </Field>

              <Field label="Descuentos (S/)">
                <input name="totalDescuentos" type="number" step="0.01" defaultValue={0} className={input} />
              </Field>

              <Field label="Adelantos (S/)">
                <input name="totalAdelantos" type="number" step="0.01" defaultValue={0} className={input} />
              </Field>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="marcarComoPagado" name="marcarComoPagado" className="size-4 rounded border-slate-300 text-[#075BC6]" />
              <label htmlFor="marcarComoPagado" className="text-xs text-[#102D50]">
                Marcar como desembolsado / pagado inmediatamente
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setModal(null)} className={secondary}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} className={primary}>
                {saving ? "Procesando…" : "Generar Boleta"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}