import { useState } from 'react';
import {
  Package,
  PackageCheck,
  Truck,
  Search,
  RefreshCw,
  Plus,
  Building2,
  ChevronRight,
  Phone,
} from 'lucide-react';
import { useEncomiendas } from '../hooks/useEncomiendas';
import { NuevaEncomiendaModal } from '../components/encomiendas/NuevaEncomiendaModal';
import { buscarClientePorDocumento } from '../services/clientesService';
import type { EstadoEncomienda } from '../types/encomienda';

const ESTADO_COLOR: Record<EstadoEncomienda, string> = {
  REGISTRADO: 'bg-amber-50 text-amber-800 border-amber-200',
  'EN RUTA': 'bg-blue-50 text-[#075BC6] border-blue-200',
  'POR ENTREGAR': 'bg-purple-50 text-purple-800 border-purple-200',
  ENTREGADO: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CANCELADO: 'bg-red-50 text-red-800 border-red-200',
};

const inputStyle =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-[#062443] outline-none transition duration-300 focus:border-[#075BC6] focus:bg-white focus:ring-4 focus:ring-blue-100';

// Función para obtener la información del usuario autenticado guardada en localStorage
function getUsuarioSesion() {
  try {
    const userJson = localStorage.getItem('usuario') || localStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
  } catch {
    return null;
  }
}

export default function EncomiendasPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Lectura del usuario actual
  const user = getUsuarioSesion();
  const rolUpper = String(user?.rol || user?.role || '').toUpperCase();
  const esAdmin = rolUpper.includes('ADMIN');
  const oficinaUsuarioNombre = user?.oficinaNombre || user?.sede || 'TRUJILLO';

  const { encomiendas, recursos, loading, error, reload, registrarEncomienda, cambiarEstado } =
    useEncomiendas();

  const filtered = encomiendas.filter((e) => {
    const matchesStatus = !statusFilter || e.estado === statusFilter;
    const matchesQuery =
      !query ||
      `${e.codigoGuia} ${e.remitenteNombres} ${e.destinatarioNombres} ${e.descripcion}`
        .toLowerCase()
        .includes(query.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const registradas = encomiendas.filter((e) => e.estado === 'REGISTRADO').length;
  const enRuta = encomiendas.filter((e) => e.estado === 'EN RUTA').length;
  const entregadas = encomiendas.filter((e) => e.estado === 'ENTREGADO').length;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 font-sans text-[#062443] sm:p-6 xl:p-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs text-slate-500">
            Operativa <ChevronRight size={13} /> Encomiendas y envíos
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Guías y Seguimiento</h1>
          <p className="mt-1 text-sm text-slate-500">
            Control de paquetes, envíos contra entrega y trazabilidad en agencia.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#075BC6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#062443]"
        >
          <Plus size={18} /> Nueva Encomienda
        </button>
      </header>

      {/* KPI Cards */}
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-slate-500">En Almacén Origen</h2>
            <span className="rounded-xl bg-amber-50 p-3 text-amber-700">
              <Package size={20} />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold">{registradas}</p>
          <p className="mt-2 text-xs text-slate-500">Paquetes recibidos pendientes de despacho</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-slate-500">En Tránsito / Ruta</h2>
            <span className="rounded-xl bg-blue-50 p-3 text-[#075BC6]">
              <Truck size={20} />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold">{enRuta}</p>
          <p className="mt-2 text-xs text-slate-500">Encomiendas embarcadas en camioneta</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-slate-500">Entregados hoy</h2>
            <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
              <PackageCheck size={20} />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold">{entregadas}</p>
          <p className="mt-2 text-xs text-slate-500">Envíos recepcionados con éxito</p>
        </article>
      </section>

      {/* Filtros */}
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="min-w-0 flex-1 basis-60">
          <span className="mb-2 block text-xs font-semibold">Buscar guía o cliente</span>
          <div className="relative">
            <Search size={17} className="absolute top-3.5 left-3 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="N° Guía, remitente, destinatario..."
              className={`${inputStyle} pl-10`}
            />
          </div>
        </div>

        <div>
          <span className="mb-2 block text-xs font-semibold">Estado</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputStyle}
          >
            <option value="">Todos los estados</option>
            <option value="REGISTRADO">En Almacén Origen</option>
            <option value="EN RUTA">En Ruta</option>
            <option value="POR ENTREGAR">Por Entregar Destino</option>
            <option value="ENTREGADO">Entregado</option>
          </select>
        </div>

        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-blue-50"
        >
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Grid de Encomiendas */}
      {loading ? (
        <div className="py-12 text-center text-slate-500">Cargando encomiendas…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
          No hay encomiendas registradas.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <article
              key={e.encomiendaId}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-mono text-xs font-bold text-[#075BC6]">
                  {e.codigoGuia}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                    ESTADO_COLOR[e.estado]
                  }`}
                >
                  {e.estado}
                </span>
              </div>

              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1">
                  <Building2 size={13} /> {e.oficinaOrigenNombre}
                </span>
                <ChevronRight size={13} />
                <span className="flex items-center gap-1">
                  <Building2 size={13} /> {e.oficinaDestinoNombre}
                </span>
              </div>

              <div className="mb-4 space-y-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Remitente</p>
                  <p className="font-semibold text-[#062443]">
                    {e.remitenteNombres} · {e.remitenteDocumento}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-slate-500">
                    <Phone size={11} /> {e.remitenteTelefono}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Destinatario</p>
                  <p className="font-semibold text-[#062443]">
                    {e.destinatarioNombres} · {e.destinatarioDocumento}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-slate-500">
                    <Phone size={11} /> {e.destinatarioTelefono}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <div>
                  <p className="font-semibold">{e.descripcion}</p>
                  <p className="mt-0.5 font-bold text-[#075BC6]">
                    {e.cantidadPaquetes} bulto(s) · {e.pesoKg} Kg
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-700">
                    S/ {e.precioEnvio.toFixed(2)}
                  </span>
                  {e.porPagar && (
                    <p className="mt-0.5 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                      POR PAGAR
                    </p>
                  )}
                </div>
              </div>

              {/* Flujo de Cambios de Estado */}
              {e.estado === 'REGISTRADO' && (
                <button
                  type="button"
                  onClick={() => cambiarEstado(e.encomiendaId, 'EN RUTA')}
                  className="mt-4 w-full rounded-xl bg-blue-50 py-2 text-xs font-bold text-[#075BC6] hover:bg-blue-100"
                >
                  Embarcar en Salida
                </button>
              )}

              {e.estado === 'EN RUTA' && (
                <button
                  type="button"
                  onClick={() => cambiarEstado(e.encomiendaId, 'POR ENTREGAR')}
                  className="mt-4 w-full rounded-xl bg-purple-50 py-2 text-xs font-bold text-purple-800 hover:bg-purple-100"
                >
                  Recepcionar en Destino
                </button>
              )}

              {e.estado === 'POR ENTREGAR' && (
                <button
                  type="button"
                  onClick={() => cambiarEstado(e.encomiendaId, 'ENTREGADO')}
                  className="mt-4 w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Entregar a Cliente
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Modal con soporte de rol Administrador / Recepcionista y Búsqueda Inteligente de Clientes */}
      {recursos && (
        <NuevaEncomiendaModal
          open={modalOpen}
          recursos={recursos}
          esAdmin={esAdmin}
          oficinaUsuarioNombre={oficinaUsuarioNombre}
          onClose={() => setModalOpen(false)}
          onSubmit={registrarEncomienda}
          onBuscarCliente={buscarClientePorDocumento}
        />
      )}
    </div>
  );
}