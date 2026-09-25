import { Armchair, UserCheck } from "lucide-react";
import type { MapaCamioneta, NumeroAsiento } from "../../types/pasajes.types";
import { cents } from "../../utils/formatters";

const POSICIONES: Record<NumeroAsiento, string> = {
  1: "Copiloto",
  2: "Atrás izquierda",
  3: "Atrás centro",
  4: "Atrás derecha",
};

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00A3E0]";

interface CabinProps {
  map: MapaCamioneta;
  selected: NumeroAsiento | null;
  disabled: boolean;
  onSelect: (seat: NumeroAsiento) => void;
}

export function Cabin({ map, selected, disabled, onSelect }: CabinProps) {
  function renderSeat(n: NumeroAsiento) {
    const s = map.asientos.find((seat) => seat.numeroAsiento === n)!;
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
        className={`relative flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-3 shadow-[0_5px_0_rgba(0,0,0,.25)] transition duration-300 enabled:hover:-translate-y-1 disabled:cursor-wait ${
          s.ocupado
            ? debt
              ? "border-amber-400 bg-amber-500/20 text-amber-200"
              : "border-blue-400/60 bg-[#062443] text-blue-100"
            : active
              ? "jjr-seat-selected border-[#F5B000] bg-[#F5B000] text-[#062443]"
              : "jjr-seat-free border-emerald-400/70 bg-slate-800 text-emerald-300"
        } ${
          active && s.ocupado
            ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900"
            : ""
        } ${focus}`}
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
          {renderSeat(1)}
        </div>
        <div
          aria-hidden="true"
          className="mx-auto my-5 h-10 w-9 rounded-xl border border-slate-700 bg-slate-800"
        />
        <div className="grid grid-cols-3 gap-2">
          {renderSeat(2)}
          {renderSeat(3)}
          {renderSeat(4)}
        </div>
        <p className="mt-6 text-center text-[9px] tracking-[.25em] text-slate-500">
          TRANSPORTES JJR
        </p>
      </div>
    </div>
  );
}