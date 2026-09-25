import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Check, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import axiosClient from "../../api/axiosClient";
import type { ClienteSeleccionado } from "../../types/pasajes.types";
import { errorMessage, headers, list, nullable, record, str } from "../../utils/api.utils";
import { Alert } from "../ui/Alert";
import { Field } from "../ui/Field";

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

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00A3E0]";
const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-[#062443] outline-none transition duration-300 focus:border-[#075BC6] focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";
const secondaryClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold transition duration-300 hover:bg-blue-50 disabled:opacity-50 ${focus}`;

function decodeCliente(raw: unknown): ClienteSeleccionado {
  const r = record(raw);
  return {
    clienteId: str(r.clienteId),
    numeroDocumento: str(r.numeroDocumento),
    nombreCliente: nullable(r.nombreCliente)?.trim() || "Cliente sin nombre",
    activo: Boolean(r.activo),
  };
}

export function PassengerPicker({
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
        if (
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
          className={inputClass}
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
              className={inputClass}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() => void search()}
          disabled={disabled || loading || registering}
          className={secondaryClass}
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
            className={secondaryClass}
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