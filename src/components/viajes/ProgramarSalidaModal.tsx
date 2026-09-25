import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LoaderCircle, Check, Route as RouteIcon, Building2, MapPin } from "lucide-react";
import type { ProgramarViajeDto, RecursosViaje, Ruta } from "../../types/viaje";

interface Props {
  open: boolean;
  recursos: RecursosViaje;
  oficinaDefaultId?: number;
  esGerente: boolean;
  onClose: () => void;
  onSubmit: (dto: ProgramarViajeDto) => Promise<void>;
  onCambiarOrigen?: (oficinaId: number) => void;
}

interface ItineraryNode {
  key: string;
  name: string;
  office: boolean;
  order: number | null;
}

const inputStyle =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-[#062443] outline-none transition duration-300 focus:border-[#075BC6] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60";

const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/* Subcomponente para renderizar la lista completa de paradas ordenadas */
function Itinerary({ ruta, oficinas }: { ruta: Ruta; oficinas: RecursosViaje["oficinas"] }) {
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);

  const nodes: ItineraryNode[] = (ruta.paradas || []).map((p) => ({
    key: `p-${p.paradaId}`,
    name: p.nombreParada,
    office: p.esOficina,
    order: p.orden,
  }));

  const endpoint = (name: string, key: string): ItineraryNode => ({
    key,
    name,
    office: oficinas.some((o) => normalize(o.nombre) === normalize(name)),
    order: null,
  });

  const ordered: ItineraryNode[] = [...nodes];
  if (!nodes.length || normalize(nodes[0].name) !== normalize(ruta.origen)) {
    ordered.unshift(endpoint(ruta.origen, "origin"));
  }
  if (!nodes.length || normalize(nodes[nodes.length - 1].name) !== normalize(ruta.destino)) {
    ordered.push(endpoint(ruta.destino, "destination"));
  }

  const active = ordered.find((node) => node.key === selected);

  return (
    <section aria-label={`Recorrido ${ruta.nombre}`} className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white p-4 text-[#062443]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-bold text-[#075BC6]">
          <RouteIcon size={16} aria-hidden="true" />
          Recorrido de la ruta
        </h3>
        <span className="text-xs text-slate-500">{ordered.length} puntos</span>
      </div>

      <ol className="max-h-56 overflow-y-auto pr-2 space-y-1">
        {ordered.map((node, index) => {
          const edge = index === 0 || index === ordered.length - 1;
          return (
            <motion.li
              key={node.key}
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduced ? 0 : Math.min(index, 18) * 0.025, duration: 0.2 }}
              className="relative pb-3 pl-9 last:pb-0"
            >
              {index < ordered.length - 1 && (
                <span aria-hidden="true" className="absolute top-6 bottom-0 left-3 border-l-2 border-dashed border-blue-200" />
              )}
              <button
                type="button"
                aria-pressed={selected === node.key}
                onClick={() => setSelected(selected === node.key ? null : node.key)}
                className={`w-full rounded-xl px-2 py-1.5 text-left transition hover:bg-white ${
                  selected === node.key ? "bg-white ring-1 ring-blue-200" : ""
                }`}
              >
                <span
                  className={`absolute top-1.5 left-0 flex size-6 items-center justify-center rounded-full ${
                    edge
                      ? "bg-[#075BC6] text-white"
                      : node.office
                      ? "bg-[#F5B000]/20 text-amber-800"
                      : "bg-white text-slate-500 ring-1 ring-blue-100"
                  }`}
                >
                  {node.office ? <Building2 size={13} /> : <MapPin size={12} />}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold">
                    {index + 1}. {node.name}
                  </span>
                  {node.office && (
                    <span className="rounded-full bg-[#F5B000]/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-900">
                      Oficina
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {index === 0 ? "Origen de la ruta" : index === ordered.length - 1 ? "Destino de la ruta" : "Parada intermedia"}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>

      <p role="status" className="mt-3 border-t border-blue-100 pt-2 text-[11px] text-slate-500">
        {active
          ? `${active.name} · ${active.office ? "Oficina de atención" : "Punto del recorrido"}`
          : "Selecciona un punto para consultar su detalle."}
      </p>
    </section>
  );
}

export function ProgramarSalidaModal({
  open,
  recursos,
  oficinaDefaultId,
  esGerente,
  onClose,
  onSubmit,
  onCambiarOrigen,
}: Props) {
  const [origenId, setOrigenId] = useState<string>(
    String(oficinaDefaultId || recursos.oficinas[0]?.oficinaId || "1")
  );
  const [routeId, setRouteId] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!open) return null;

  const oficinaOrigenNombre =
    recursos.oficinas.find((o) => o.oficinaId === Number(origenId))?.nombre ?? "";

  const rutasDisponibles = recursos.rutas.filter((r) => {
    if (!oficinaOrigenNombre) return true;
    return normalize(r.origen) === normalize(oficinaOrigenNombre);
  });

  const selectedRoute = recursos.rutas.find((r) => r.rutaId === Number(routeId));

  const handleOrigenChange = (idStr: string) => {
    setOrigenId(idStr);
    setRouteId("");
    setPrice("");
    if (onCambiarOrigen) onCambiarOrigen(Number(idStr));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    const form = new FormData(e.currentTarget);
    const fecha = String(form.get("fechaSalida") ?? "");
    const vehiculoId = String(form.get("vehiculoId") ?? "");
    const conductorId = String(form.get("conductorId") ?? "");

    if (!routeId || !origenId || !vehiculoId || !conductorId || !price) {
      setErrorMsg("Completa todos los campos obligatorios.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        rutaId: Number(routeId),
        oficinaOrigenId: Number(origenId),
        fechaSalida: new Date(`${fecha}:00-05:00`).toISOString(),
        vehiculoId,
        conductorId,
        precioPasaje: Number(price),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.mensaje || "Error al programar la salida.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog open className="fixed inset-0 z-50 m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-xl overflow-y-auto rounded-3xl border-0 bg-white p-6 text-[#062443] shadow-2xl sm:p-8">
      <div className="mb-6 flex items-start justify-between">
        <h2 className="text-xl font-bold">Programar Salida</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">✕</button>
      </div>

      {errorMsg && <p className="mb-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{errorMsg}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold">Oficina de origen *</label>
          <select
            value={origenId}
            disabled={!esGerente}
            onChange={(e) => handleOrigenChange(e.target.value)}
            className={inputStyle}
          >
            {recursos.oficinas.map((o) => (
              <option key={o.oficinaId} value={o.oficinaId}>{o.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold">Ruta *</label>
          <select
            required
            value={routeId}
            onChange={(e) => {
              const idStr = e.target.value;
              setRouteId(idStr);
              const r = rutasDisponibles.find((item) => item.rutaId === Number(idStr));
              if (r) setPrice(r.precioSugerido.toFixed(2));
            }}
            className={inputStyle}
          >
            <option value="" disabled>Selecciona una ruta</option>
            {rutasDisponibles.map((r) => (
              <option key={r.rutaId} value={r.rutaId}>{r.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold">Fecha y hora · Lima *</label>
          <input type="datetime-local" name="fechaSalida" required className={inputStyle} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold">Camioneta *</label>
            <select name="vehiculoId" required defaultValue="" className={inputStyle}>
              <option value="" disabled>Selecciona camioneta</option>
              {recursos.vehiculos.map((v) => (
                <option key={v.vehiculoId} value={v.vehiculoId}>{v.placa} · {v.marca}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold">Conductor *</label>
            <select name="conductorId" required defaultValue="" className={inputStyle}>
              <option value="" disabled>Selecciona conductor</option>
              {recursos.conductores.map((c) => (
                <option key={c.conductorId} value={c.conductorId}>{c.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold">Precio del pasaje (S/) *</label>
          <input type="number" step="0.01" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required className={inputStyle} />
        </div>

        <AnimatePresence mode="wait">
          {selectedRoute && (
            <motion.div
              key={selectedRoute.rutaId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-5"
            >
              <Itinerary ruta={selectedRoute} oficinas={recursos.oficinas} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#062443]">Volver</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#075BC6] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#062443]">
            {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
            {saving ? "Guardando…" : "Programar salida"}
          </button>
        </div>
      </form>
    </dialog>
  );
}