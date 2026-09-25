import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  CarFront,
  Check,
  ChevronRight,
  Clock3,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Ticket,
  UserCheck,
  X,
} from "lucide-react";
import axiosClient from "../api/axiosClient";
import { isAxiosError } from "axios";

// Importaciones Modulares
import type {
  Asiento,
  ClienteSeleccionado,
  MapaCamioneta,
  NumeroAsiento,
  PasajesPageProps,
  PaymentValue,
  TipoComprobante,
  TipoOperacion,
  VentaPasajeDto,
  ViajeVenta,
} from "../types/pasajes.types";

import {
  bool,
  errorMessage,
  headers,
  id,
  list,
  multipartHeaders,
  nullable,
  num,
  record,
  str,
} from "../utils/api.utils";

import {
  cents,
  currency,
  instant,
  normalize,
  parseMoney,
  timeLima,
  todayLima,
} from "../utils/formatters";

import { useProfile } from "../hooks/usePasajes";
import { Alert } from "../components/ui/Alert";
import { Field } from "../components/ui/Field";
import { ActionModal } from "../components/ui/ActionModal";
import { Cabin } from "../components/pasajes/Cabin";
import { PassengerPicker } from "../components/pasajes/PassengerPicker";
import {
  PaymentFields,
  validatePayment,
} from "../components/pasajes/PaymentFields";
import { Inspection } from "../components/pasajes/Inspection";
import { Ticket80mm } from "../components/pasajes/Ticket80mm";

const POSICIONES: Record<NumeroAsiento, string> = {
  1: "Copiloto",
  2: "Atrás izquierda",
  3: "Atrás centro",
  4: "Atrás derecha",
};

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00A3E0]";
const inputClass =
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

/* IMPRESIÓN 80MM (1 SOLA HOJA) */
@media screen {
  .jjr-ticket-print-area {
    display: none !important;
  }
}

@media print {
  html, body {
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  /* Quita del layout TODO lo que no sea el ticket (incluye #root) */
  body > *:not(.jjr-ticket-print-area) {
    display: none !important;
  }

  .jjr-ticket-print-area {
    display: block !important;
    position: static !important;   /* NO fixed: se repetiría en cada hoja */
    width: 80mm !important;
    max-width: 80mm !important;
    margin: 0 !important;
    padding: 2mm !important;
    box-sizing: border-box !important;
    background: #fff !important;
    color: #000 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  @page {
    size: 80mm auto;
    margin: 0;
  }
}

@media(prefers-reduced-motion:reduce){.jjr-pasajes *,.jjr-pasajes *::before,.jjr-pasajes *::after{animation:none!important;transition:none!important}}
`;

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
      numeroOperacion: nullable(s.numeroOperacion),
      numeroComprobante: nullable(s.numeroComprobante),
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
  if (dto.tipoComprobante)
    form.append("TipoComprobante", dto.tipoComprobante);
  if (dto.medioPago !== "EFECTIVO" && file)
    form.append("VoucherFile", file, file.name);
  return form;
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
      tipoComprobante: operation === "VENTA_DIRECTA" ? receiptType : undefined,
    };
    saleLock.current = true;
    setSaving(true);
    const key = mapKey;
    const c = new AbortController();
    mutation.current = c;

    try {
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

      let reference = "";
      try {
        reference = str(record(data).pasajeId);
      } catch {
        /* No repetir una venta confirmada por HTTP */
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
        const unknown =
          isAxiosError(e) &&
          e.config?.method?.toLowerCase() === "post" &&
          (!e.response || e.response.status >= 500);
        setUncertain(Boolean(unknown));
        setSaleError(
          unknown
            ? "No se pudo confirmar la venta. Verifica el asiento antes de iniciar otra operación."
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
        body.append("TipoComprobante", receiptType);

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

        if (receiptType !== "NOTA_VENTA" && onEmitirComprobante) {
          await onEmitirComprobante({
            pasajeId: actual.pasajeId,
            viajeId: tripId,
            tipo: receiptType,
            asiento: {
              ...actual,
              montoAdelanto: actual.precioTotal,
              saldoPendiente: 0,
            },
          });
        }

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
          setSuccess("Saldo liquidado y comprobante generado con éxito.");
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
            ? "No se pudo confirmar el resultado. Cierra y verifica el registro."
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
                    className={inputClass}
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

                    {operation === "VENTA_DIRECTA" && (
                      <Field label="Tipo de Comprobante *">
                        <select
                          value={receiptType}
                          onChange={(e) =>
                            setReceiptType(e.target.value as TipoComprobante)
                          }
                          className={inputClass}
                        >
                          <option value="NOTA_VENTA">
                            Nota de Venta (Interno)
                          </option>
                          <option value="BOLETA">
                            Boleta Electrónica (SUNAT)
                          </option>
                          <option value="FACTURA">
                            Factura Electrónica (SUNAT)
                          </option>
                        </select>
                      </Field>
                    )}

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
                          className={inputClass}
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
                          className={inputClass}
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

                    <Field label="Precio del pasaje (S/) *">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className={inputClass}
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
                        value={
                          operation === "VENTA_DIRECTA" ? price : advance
                        }
                        onChange={(e) => setAdvance(e.target.value)}
                        className={inputClass}
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
                      className={`${inputClass} font-bold`}
                    />
                  </Field>

                  <Field label="Tipo de comprobante a emitir *">
                    <select
                      value={receiptType}
                      onChange={(e) =>
                        setReceiptType(e.target.value as TipoComprobante)
                      }
                      className={inputClass}
                    >
                      <option value="NOTA_VENTA">
                        Nota de Venta (Interno)
                      </option>
                      <option value="BOLETA">
                        Boleta Electrónica (SUNAT)
                      </option>
                      <option value="FACTURA">
                        Factura Electrónica (SUNAT)
                      </option>
                    </select>
                  </Field>

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
                </div>
              ) : (
                <Field label="Tipo de comprobante">
                  <select
                    value={receiptType}
                    onChange={(e) =>
                      setReceiptType(e.target.value as TipoComprobante)
                    }
                    className={inputClass}
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

      {/* Solo monta el Ticket80mm cuando la deuda está liquidada al 100% */}
      {inspectedSeat && inspectedSeat.saldoPendiente === 0 && (
        <Ticket80mm seat={inspectedSeat} trip={selectedTrip} />
      )}
    </div>
  );
}