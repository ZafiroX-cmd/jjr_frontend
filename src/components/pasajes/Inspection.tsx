import { FileText, Printer, Trash2, Wallet } from "lucide-react";
import type { Asiento } from "../../types/pasajes.types";
import { cents, currency } from "../../utils/formatters";
import { RemoteVoucher } from "./RemoteVoucher";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00A3E0]";
const primary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#075BC6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-[#062443] hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const secondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold transition duration-300 hover:bg-blue-50 disabled:opacity-50 ${focus}`;

interface InspectionProps {
  seat: Asiento;
  voucherBaseUrl?: string;
  disabled: boolean;
  canEmit: boolean;
  onAction: (kind: "pay" | "cancel" | "receipt") => void;
  onPrintTicket?: () => void;
}

export function Inspection({
  seat,
  voucherBaseUrl,
  disabled,
  canEmit,
  onAction,
  onPrintTicket,
}: InspectionProps) {
  const paid = cents(seat.saldoPendiente) === 0;

  const handlePrint = () => {
    if (onPrintTicket) {
      onPrintTicket();
    } else {
      window.print();
    }
  };

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
          className={`rounded-full px-2 py-1 text-xs font-bold ${
            paid ? "bg-[#062443] text-white" : "bg-amber-100 text-amber-900"
          }`}
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
        {/* El ticket de 80mm SOLO se puede imprimir si la deuda está en 0 */}
        {paid && (
          <button
            type="button"
            disabled={disabled}
            onClick={handlePrint}
            className={`${secondary} text-slate-800 hover:bg-slate-100`}
          >
            <Printer size={15} aria-hidden="true" />
            Imprimir Ticket (80mm)
          </button>
        )}

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