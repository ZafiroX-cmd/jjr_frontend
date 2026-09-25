import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type {
  Asiento,
  TipoComprobante,
  ViajeVenta,
} from "../../types/pasajes.types";
import { currency, timeLima } from "../../utils/formatters";

// Declaración directa para evitar error cuando falten los tipos de JsBarcode
declare global {
  interface Window {
    JsBarcode?: any;
  }
}
import JsBarcode from "jsbarcode";

interface Ticket80mmProps {
  seat: Asiento;
  trip: ViajeVenta | null;
  nombreCajero?: string;
  wifiClave?: string;
}

const EMPRESA = {
  nombre: "JJR TRANSPORTES S.A.C.",
  ruc: "20600000001",
  direccion: "Av. Prolongación César Vallejo N° 1364 - Trujillo",
  telefono: "966753653",
  logo: "/images/Logo%20(1).png",
};

const TITULOS: Record<TipoComprobante, string> = {
  NOTA_VENTA: "NOTA DE VENTA ELECTRÓNICA",
  BOLETA: "BOLETA DE VENTA ELECTRÓNICA",
  FACTURA: "FACTURA ELECTRÓNICA",
};

const CONDICIONES = [
  "Al recibir el presente documento acepta todos los términos y condiciones del contrato detallado en el letrero y/o banner del área de pasajes.",
  "1. El boleto de viaje es personal pudiéndose transferir con un plazo de 24 horas antes del viaje o postergarlo 6 horas antes del viaje, presentando su comprobante.",
  "2. El pasajero perderá su derecho al viaje y el valor del pasaje cuando se encuentre bajo influencia de alcohol o drogas.",
  "3. La empresa no se responsabiliza por bienes u objetos perdidos en el salón de pasajeros ni por artículos no declarados en el embarque.",
  "4. Los menores de edad deben viajar con sus padres o con permiso notarial. Niños mayores a 5 años pagan su pasaje.",
  "5. Está prohibido el transporte de armas de fuego, objetos punzocortantes, herramientas o inflamables.",
  "6. No se aceptan devoluciones.",
];

function numeroALetras(monto: number): string {
  const entero = Math.floor(monto);
  const decimales = Math.round((monto - entero) * 100);
  const padDecimales = String(decimales).padStart(2, "0");

  const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const especiales = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];

  let textoEntero = "";
  if (entero === 100) textoEntero = "CIENTO";
  else if (entero > 100 && entero < 200) textoEntero = "CIENTO " + numeroALetras(entero - 100).split(" CON")[0];
  else if (entero >= 200) textoEntero = `${entero}`;
  else if (entero >= 10 && entero <= 19) textoEntero = especiales[entero - 10];
  else if (entero >= 20 && entero < 100) {
    const d = Math.floor(entero / 10);
    const u = entero % 10;
    textoEntero = u === 0 ? decenas[d] : `${decenas[d]} Y ${unidades[u]}`;
  } else if (entero < 10) {
    textoEntero = unidades[entero] || "CERO";
  }

  return `SON: ${textoEntero} CON ${padDecimales}/100 SOLES`;
}

const limaDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-2">
      <h3 className="border-b border-black bg-slate-100 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide">
        {title}
      </h3>
      <dl className="space-y-0.5 pt-1 text-[10px]">{children}</dl>
    </section>
  );
}

function Row({
  label,
  children,
  strong = false,
  indent = false,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[30mm_1fr] gap-x-1 ${strong ? "font-bold" : ""} ${
        indent ? "pl-2 text-[9px] text-slate-700" : ""
      }`}
    >
      <dt className="uppercase">{label}:</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: 1.8,
        height: 42,
        margin: 0,
        fontSize: 12,
        displayValue: true,
        background: "transparent",
      });
    } catch {
      /* Omitir si el formato no es válido */
    }
  }, [value]);

  return <svg ref={ref} className="my-2 mx-auto max-w-full" />;
}

export function Ticket80mm({ seat, trip, nombreCajero, wifiClave }: Ticket80mmProps) {
  if (!seat) return null;

  // Detección del tipo de comprobante (Opción 1: por propiedad o por la inicial de la Serie)
  const obtenerTipoComprobante = (): TipoComprobante => {
    if (seat.tipoComprobante) return seat.tipoComprobante;

    const comp = seat.numeroComprobante?.trim().toUpperCase() ?? "";
    if (comp.startsWith("F")) return "FACTURA";
    if (comp.startsWith("B")) return "BOLETA";
    return "NOTA_VENTA";
  };

  const tipo: TipoComprobante = obtenerTipoComprobante();

  const serieCorrelativo =
    seat.numeroComprobante ||
    (seat.pasajeId ? `NV01 - ${seat.pasajeId.slice(0, 6).toUpperCase()}` : "NV01 - 0001");

  const horaSalida = trip?.fechaHoraSalida ? timeLima(trip.fechaHoraSalida) : "—";
  const fechaSalida = trip?.fechaHoraSalida ? limaDate(trip.fechaHoraSalida) : "—";

  return createPortal(
    <div className="jjr-ticket-print-area w-[80mm] max-w-[80mm] bg-white p-2 font-mono text-[10px] leading-tight text-black">
      {/* Cabecera */}
      <header className="space-y-0.5 text-center">
        <img
          src={EMPRESA.logo}
          alt={EMPRESA.nombre}
          className="mx-auto mb-1 max-h-[22mm] w-auto object-contain"
          style={{ filter: "grayscale(1) contrast(1.5)" }}
        />
        <p className="text-[11px] font-bold tracking-tight">{EMPRESA.nombre}</p>
        <p className="text-[10px]">RUC: {EMPRESA.ruc}</p>
        <p className="text-[9px] leading-tight">{EMPRESA.direccion}</p>
        <p className="text-[9px]">Telf. {EMPRESA.telefono}</p>
        
        <p className="pt-1 text-[9px]">
          Fecha: {limaDate(new Date())} &nbsp; Hora: {timeLima(new Date().toISOString())}
        </p>
        
        <div className="pt-1">
          <h2 className="text-[12px] font-extrabold uppercase tracking-wide">
            {TITULOS[tipo]}
          </h2>
          <p className="text-[13px] font-extrabold">{serieCorrelativo}</p>
        </div>
      </header>

      <div className="my-1.5 border-b border-dashed border-black" />

      {/* Datos del viaje */}
      <Section title="Datos del viaje">
        <Row label="ORIGEN">{trip?.oficinaOrigenNombre || "TRUJILLO"}</Row>
        <p className="pl-2 text-[8.5px] leading-tight text-slate-600">
          {EMPRESA.direccion}
        </p>
        
        <Row label="DESTINO">{seat.destinoNombre || "CHILLIA"}</Row>
        <p className="pl-2 text-[8.5px] leading-tight text-slate-600">
          Jr. Chimbote 111
        </p>

        <Row label="ASIENTO" strong>
          {String(seat.numeroAsiento).padStart(2, "0")}
        </Row>
        <Row label="PLACA / UNIDAD">{trip?.placa || "—"}</Row>
        <Row label="FECHA VIAJE">{fechaSalida}</Row>
        <Row label="HORA VIAJE">{horaSalida}</Row>
        <Row label="OBSERVACIÓN">PRESENTARSE 30 MINUTOS ANTES</Row>
      </Section>

      <div className="my-1 border-b border-dashed border-black" />

      {/* Datos del pasajero */}
      <Section title="Datos del pasajero">
        <Row label="NOMBRE">{seat.pasajeroNombre || "PUBLICO GENERAL"}</Row>
        <Row label="N° DOCUMENTO">{seat.pasajeroDocumento || "—"}</Row>
      </Section>

      <div className="my-1 border-b border-dashed border-black" />

      {/* Detalle de pago */}
      <Section title="Datos de pago">
        <Row label="Op. Gratuita">0.00</Row>
        <Row label="Op. Exonerado">{currency(seat.precioTotal)}</Row>
        <Row label="Op. Inafecta">0.00</Row>
        <Row label="TOTAL A PAGAR" strong>
          {currency(seat.precioTotal)}
        </Row>
        
        <p className="mt-1 text-[9px] font-bold uppercase">
          {numeroALetras(seat.precioTotal)}
        </p>

        <Row label="Medio de pago">{seat.medioPago || "Efectivo"}</Row>
        {seat.numeroOperacion && (
          <Row label="N° de operación">{seat.numeroOperacion}</Row>
        )}
        {nombreCajero && <Row label="CAJERO">{nombreCajero}</Row>}
      </Section>

      <div className="my-1.5 border-b border-dashed border-black" />

      {/* Condiciones de viaje */}
      <section className="space-y-1 text-[8px] leading-tight">
        <h4 className="text-[8.5px] font-bold uppercase">Condiciones de viaje</h4>
        {CONDICIONES.map((condicion, i) => (
          <p key={i} className="text-justify">{condicion}</p>
        ))}
      </section>

      {/* Código de barras */}
      {serieCorrelativo && (
        <div className="pt-2 text-center">
          <Barcode value={serieCorrelativo.replace(/\s+/g, "")} />
        </div>
      )}

      {/* Pie del ticket */}
      <footer className="mt-2 space-y-0.5 text-center text-[9px]">
        <p className="font-bold">GRACIAS POR SU PREFERENCIA</p>
        {wifiClave && <p className="text-[8px]">CLAVE DE WIFI: {wifiClave}</p>}
        <p className="text-[8px] text-slate-500">{EMPRESA.nombre}</p>
      </footer>
    </div>,
    document.body,
  );
}