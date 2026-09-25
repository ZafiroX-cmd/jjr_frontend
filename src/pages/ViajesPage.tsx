import { useState } from "react";
import {
  CalendarDays,
  CarFront,
  Users,
  Search,
  RefreshCw,
  Plus,
  ShieldCheck,
  Building2,
  Armchair,
  Route as RouteIcon,
  ChevronRight,
} from "lucide-react";
import { useViajes } from "../hooks/useViajes";
import { ProgramarSalidaModal } from "../components/viajes/ProgramarSalidaModal";
import type { Viaje, EstadoViaje } from "../types/viaje";

function getStoredProfile() {
  try {
    const userJson = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    let jwtData: Record<string, any> = {};

    if (token) {
      const part = token.split(".")[1];
      if (part) {
        const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        jwtData = JSON.parse(jsonPayload);
      }
    }

    const userData = userJson ? JSON.parse(userJson) : {};

    const rawOffice =
      jwtData.OficinaId ??
      jwtData.oficinaId ??
      jwtData.oficina_id ??
      userData.oficinaId ??
      userData.oficina_id;

    const parsedOffice = Number(rawOffice);

    return {
      rol: String(
        jwtData.role ??
          jwtData["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ??
          userData.rol ??
          "Recepcionista"
      ),
      oficinaId: !isNaN(parsedOffice) && parsedOffice > 0 ? parsedOffice : null,
      oficinaNombre: jwtData.OficinaNombre ?? userData.oficinaNombre ?? null,
    };
  } catch {
    return { rol: "Recepcionista", oficinaId: null, oficinaNombre: null };
  }
}

// Utilidades de formato de fecha en horario de Lima
function getLimaTodayString(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function getLimaDateFromIso(iso: string): string {
  try {
    const date = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return "";
  }
}

function formatLimaTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function formatLimaDateLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

const COLOR: Record<string, string> = {
  Programado: "bg-blue-50 text-[#075BC6]",
  "En Ruta": "bg-emerald-50 text-emerald-800",
  Finalizado: "bg-[#F1F5F9] text-slate-600",
  Cancelado: "bg-red-50 text-red-800",
};

const SIGUIENTES: Record<EstadoViaje, EstadoViaje[]> = {
  Programado: ["En Ruta", "Cancelado"],
  "En Ruta": ["Finalizado", "Cancelado"],
  Finalizado: [],
  Cancelado: [],
};

const inputStyle =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-[#062443] outline-none transition duration-300 focus:border-[#075BC6] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60";

export default function ViajesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(() => getLimaTodayString());

  const profile = getStoredProfile();
  const userRole: string = profile.rol;
  const userOficinaId = profile.oficinaId;

  const esGerente = ["Administrador", "Gerente", "administrador", "gerente"].includes(userRole);

  // ID de la oficina activa para consultar
  const activeOfficeQuery = esGerente
    ? officeFilter
      ? Number(officeFilter)
      : null
    : userOficinaId;

  const {
    viajes,
    recursos,
    loading,
    error,
    reload,
    programarSalida,
    cambiarEstado,
    cargarRecursosPorOrigen,
  } = useViajes(activeOfficeQuery);

  const nombreOficinaActual =
    recursos?.oficinas.find((o) => Number(o.oficinaId) === Number(userOficinaId))?.nombre ||
    profile.oficinaNombre ||
    (userOficinaId ? `Oficina ${userOficinaId}` : "Sin Oficina Asignada");

  // Filtrado de viajes por fecha, estado y término de búsqueda
  const filteredViajes = viajes
    .filter((v) => {
      const fechaViaje = getLimaDateFromIso(v.fechaHoraSalida);
      const matchesDate = !dateFilter || fechaViaje === dateFilter;
      const matchesStatus = !statusFilter || v.estado === statusFilter;
      const matchesQuery =
        !query ||
        `${v.rutaNombre} ${v.placa} ${v.conductorNombre}`
          .toLowerCase()
          .includes(query.toLowerCase());

      return matchesDate && matchesStatus && matchesQuery;
    })
    .sort(
      (a, b) =>
        new Date(a.fechaHoraSalida).getTime() - new Date(b.fechaHoraSalida).getTime()
    );

  // KPIs
  const todayStr = getLimaTodayString();
  const todayRows = viajes.filter((v) => getLimaDateFromIso(v.fechaHoraSalida) === todayStr);
  const vehiculosEnRuta = new Set(
    viajes.filter((v) => v.estado === "En Ruta").map((v) => v.vehiculoId)
  ).size;
  const asientosLibresHoy = todayRows
    .filter((v) => v.estado === "Programado")
    .reduce((sum, v) => sum + v.asientosDisponibles, 0);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 font-sans text-[#062443] sm:p-6 xl:p-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs text-slate-500">
            Operativa <ChevronRight size={13} /> Viajes y salidas
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Salidas Programadas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cuatro asientos. Un destino. Todo listo para salir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#075BC6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#062443]"
        >
          <Plus size={18} /> Programar Salida
        </button>
      </header>

      {/* Banner de Oficina */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#062443] px-5 py-4 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={18} className="text-[#F5B000]" />
          {userRole} · {esGerente ? "Gestión de oficinas" : nombreOficinaActual}
        </p>
        <span className="text-xs text-blue-100">Hora de Lima · 1 copiloto + 3 asientos atrás</span>
      </div>

      {/* KPIs */}
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-slate-500">Salidas de hoy</h2>
            <span className="rounded-xl bg-blue-50 p-3 text-[#075BC6]">
              <CalendarDays size={20} />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold">{todayRows.length}</p>
          <p className="mt-2 text-xs text-slate-500">Todas las salidas del día · Oficina seleccionada</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-slate-500">Vehículos en ruta</h2>
            <span className="rounded-xl bg-blue-50 p-3 text-[#075BC6]">
              <CarFront size={20} />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold">{vehiculosEnRuta}</p>
          <p className="mt-2 text-xs text-slate-500">Camionetas únicas en curso · Oficina seleccionada</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-slate-500">Asientos libres hoy</h2>
            <span className="rounded-xl bg-blue-50 p-3 text-[#075BC6]">
              <Users size={20} />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold">{asientosLibresHoy}</p>
          <p className="mt-2 text-xs text-slate-500">Salidas aún programadas · Oficina seleccionada</p>
        </article>
      </section>

      {/* Barra de Filtros Completa */}
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Buscar salida */}
        <div className="min-w-0 flex-1 basis-60">
          <span className="mb-2 block text-xs font-semibold">Buscar salida</span>
          <div className="relative">
            <Search size={17} className="absolute top-3.5 left-3 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ruta, placa o conductor…"
              className={`${inputStyle} pl-10`}
            />
          </div>
        </div>

        {/* Filtro por Oficina (si es Administrador/Gerente) */}
        {esGerente ? (
          <div>
            <span className="mb-2 block text-xs font-semibold">Oficina de origen</span>
            <select
              value={officeFilter}
              onChange={(e) => setOfficeFilter(e.target.value)}
              className={inputStyle}
            >
              <option value="">Todas las oficinas</option>
              {recursos?.oficinas.map((o) => (
                <option key={o.oficinaId} value={o.oficinaId}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <span className="mb-2 block text-xs font-semibold">Oficina asignada</span>
            <input readOnly value={nombreOficinaActual} className={inputStyle} />
          </div>
        )}

        {/* Filtro por Fecha de salida */}
        <div>
          <span className="mb-2 block text-xs font-semibold">Fecha de salida</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={inputStyle}
          />
        </div>

        {/* Filtro por Estado */}
        <div>
          <span className="mb-2 block text-xs font-semibold">Estado</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputStyle}
          >
            <option value="">Todos</option>
            <option value="Programado">Programado</option>
            <option value="En Ruta">En Ruta</option>
            <option value="Finalizado">Finalizado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>

        {/* Botón reset fecha */}
        <button
          type="button"
          onClick={() => setDateFilter("")}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-blue-50"
        >
          Todas las fechas
        </button>

        {/* Botón Actualizar */}
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-blue-50"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </section>

      <p role="status" className="text-xs text-slate-500">
        {loading ? "Actualizando salidas…" : `${filteredViajes.length} salidas encontradas`} · Indicadores del {dateFilter || todayStr}
      </p>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Grid de Tarjetas de Viaje */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando salidas programadas...</div>
      ) : filteredViajes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
          No hay salidas programadas para los filtros aplicados.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredViajes.map((v) => {
            const siguientes = SIGUIENTES[v.estado] || [];

            return (
              <article
                key={v.viajeId}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-xl"
              >
                {/* Estado y Precio */}
                <div className="mb-3 flex items-center justify-between">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COLOR[v.estado]}`}>
                    {v.estado}
                  </span>
                  <span className="text-xs font-bold text-slate-600">S/ {v.precioPasaje.toFixed(2)}</span>
                </div>

                {/* Ruta y Terminal */}
                <h2 className="text-lg font-bold leading-tight">{v.rutaNombre}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <Building2 size={14} /> {v.oficinaOrigenNombre}
                </p>

                {/* Fecha y Hora */}
                <div className="my-3 flex items-center gap-2 border-y border-slate-100 py-2.5 text-xs">
                  <CalendarDays size={15} className="text-[#075BC6]" />
                  <span>{formatLimaDateLabel(v.fechaHoraSalida)}</span>
                  <span className="ml-auto font-bold text-[#062443]">
                    {formatLimaTime(v.fechaHoraSalida)}
                  </span>
                </div>

                {/* Placa y Conductor */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="rounded-md border border-slate-200 border-l-4 border-l-[#075BC6] px-2 py-1 font-bold">
                    {v.placa}
                  </span>
                  <span className="text-slate-500">{v.conductorNombre}</span>
                </div>

                {/* Aforo de Pasajeros */}
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="mb-2 flex justify-between text-xs font-semibold">
                    <span className="text-slate-500">Pasajeros</span>
                    <span className="text-[#062443]">{v.asientosOcupados}/4 ocupados</span>
                  </div>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`rounded-lg p-2 border transition ${
                          i < v.asientosOcupados
                            ? "bg-[#075BC6] text-white border-[#075BC6]"
                            : "bg-white text-slate-300 border-slate-200"
                        }`}
                      >
                        <Armchair size={17} />
                      </span>
                    ))}
                  </div>
                </div>

                {/* Acciones de cambio de estado */}
                {siguientes.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    {siguientes.map((next) => (
                      <button
                        key={next}
                        type="button"
                        onClick={() => cambiarEstado(v.viajeId, next)}
                        className={`min-h-9 rounded-xl px-3 text-xs font-semibold transition ${
                          next === "Cancelado"
                            ? "text-red-700 hover:bg-red-50"
                            : "bg-blue-50 text-[#075BC6] hover:bg-blue-100"
                        }`}
                      >
                        {next === "En Ruta" ? "Iniciar" : next === "Cancelado" ? "Cancelar" : "Finalizar"}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Reutilizable de Programación */}
      {recursos && (
        <ProgramarSalidaModal
          open={modalOpen}
          recursos={recursos}
          oficinaDefaultId={userOficinaId ?? undefined}
          esGerente={esGerente}
          onClose={() => setModalOpen(false)}
          onSubmit={programarSalida}
          onCambiarOrigen={cargarRecursosPorOrigen}
        />
      )}
    </div>
  );
}