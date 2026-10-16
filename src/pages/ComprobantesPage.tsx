import { useEffect, useState } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  FileCode,
  Eye,
} from 'lucide-react';
import {
  obtenerComprobantes,
  consultarEstadoSunat,
  anularComprobante,
  verPdfComprobante,
  descargarArchivoComprobante,
  type Comprobante,
  type EstadoSunat,
} from '../services/comprobantesService';

export function ComprobantesPage() {
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Filtros
  const [tipo, setTipo] = useState<string>('');
  const [busqueda, setBusqueda] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  // Modal de Anulación
  const [comprobanteAAnular, setComprobanteAAnular] = useState<Comprobante | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState<string>('');
  const [anulando, setAnulando] = useState<boolean>(false);

  // Cargar datos
  const cargarComprobantes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await obtenerComprobantes({
        tipo: tipo || undefined,
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
        busqueda: busqueda.trim() || undefined,
      });
      setComprobantes(data);
    } catch (err: any) {
      setError(err?.response?.data?.mensaje || 'Error al cargar el listado de comprobantes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarComprobantes();
  }, [tipo, fechaInicio, fechaFin]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    cargarComprobantes();
  };

  // Consultar estado SUNAT
  const handleConsultarSunat = async (id: number) => {
    try {
      const actualizado = await consultarEstadoSunat(id);
      setComprobantes((prev) =>
        prev.map((item) => (item.comprobanteId === id ? actualizado : item))
      );
    } catch (err: any) {
      alert(err?.response?.data?.mensaje || 'Error al consultar estado en SUNAT.');
    }
  };

  // Descargar Archivos (XML/CDR)
  const handleDescargar = async (id: number, formato: 'xml' | 'cdr', numero: string) => {
    try {
      const blob = await descargarArchivoComprobante(id, formato);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${numero}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert(`No se pudo descargar el archivo ${formato.toUpperCase()}.`);
    }
  };

  // Ejecutar Anulación
  const handleConfirmarAnulacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comprobanteAAnular || !motivoAnulacion.trim()) return;

    setAnulando(true);
    try {
      await anularComprobante(comprobanteAAnular.comprobanteId, motivoAnulacion.trim());
      setComprobanteAAnular(null);
      setMotivoAnulacion('');
      cargarComprobantes();
    } catch (err: any) {
      alert(err?.response?.data?.mensaje || 'No se pudo anular el comprobante.');
    } finally {
      setAnulando(false);
    }
  };

  // Badge Estado SUNAT
  const renderEstadoBadge = (estado: EstadoSunat) => {
    switch (estado) {
      case 'ACEPTADO':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={13} /> Aceptado
          </span>
        );
      case 'RECHAZADO':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            <XCircle size={13} /> Rechazado
          </span>
        );
      case 'ANULADO':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            <Ban size={13} /> Anulado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <Clock size={13} /> Pendiente
          </span>
        );
    }
  };

  // Métricas
  const totalMonto = comprobantes.reduce((acc, curr) => acc + (curr.estadoSunat !== 'ANULADO' ? curr.total : 0), 0);
  const aceptadosCount = comprobantes.filter((c) => c.estadoSunat === 'ACEPTADO').length;
  const pendientesCount = comprobantes.filter((c) => c.estadoSunat === 'PENDIENTE').length;

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#062443]">Comprobantes Electrónicos</h1>
          <p className="text-xs text-slate-500">Gestión y emisión de Boletas, Facturas y Notas de Venta</p>
        </div>
        <button
          type="button"
          onClick={cargarComprobantes}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar Listado
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Total Facturado (Aceptados/Pendientes)</p>
          <p className="mt-1 text-2xl font-bold text-[#062443]">S/ {totalMonto.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Aceptados SUNAT</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{aceptadosCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Pendientes de Envío</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{pendientesCount}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo Comprobante</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-[#062443] outline-none focus:border-[#075BC6]"
            >
              <option value="">Todos</option>
              <option value="BOLETA">Boletas</option>
              <option value="FACTURA">Facturas</option>
              <option value="NOTA_DE_VENTA">Notas de Venta</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Fecha Desde</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-[#062443] outline-none focus:border-[#075BC6]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Fecha Hasta</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-[#062443] outline-none focus:border-[#075BC6]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Búsqueda</label>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Serie, Número, DNI/RUC..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-9 text-xs font-medium text-[#062443] outline-none focus:border-[#075BC6]"
              />
              <button type="submit" className="absolute right-2 text-slate-400 hover:text-[#075BC6]">
                <Search size={15} />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Tabla de comprobantes */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-slate-50 font-semibold text-slate-500">
              <tr>
                <th className="p-3.5">Comprobante</th>
                <th className="p-3.5">Fecha</th>
                <th className="p-3.5">Cliente / Documento</th>
                <th className="p-3.5 text-right">Subtotal</th>
                <th className="p-3.5 text-right">IGV</th>
                <th className="p-3.5 text-right">Total</th>
                <th className="p-3.5 text-center">Estado SUNAT</th>
                <th className="p-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Cargando comprobantes...
                  </td>
                </tr>
              ) : comprobantes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No se encontraron comprobantes registrados.
                  </td>
                </tr>
              ) : (
                comprobantes.map((c) => (
                  <tr key={c.comprobanteId} className="hover:bg-slate-50/60">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-[#075BC6]" />
                        <div>
                          <p className="font-bold text-[#062443]">{c.numeroCompleto}</p>
                          <span className="text-[10px] uppercase text-slate-400">{c.tipoComprobante}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-medium text-slate-600">
                      {new Date(c.fechaEmision).toLocaleDateString('es-PE')}
                    </td>
                    <td className="p-3.5">
                      <p className="font-semibold text-slate-800">{c.clienteNombres}</p>
                      <p className="text-[10px] text-slate-400">{c.clienteDocumento}</p>
                    </td>
                    <td className="p-3.5 text-right font-medium text-slate-600">S/ {c.subtotal.toFixed(2)}</td>
                    <td className="p-3.5 text-right font-medium text-slate-600">S/ {c.igv.toFixed(2)}</td>
                    <td className="p-3.5 text-right font-bold text-[#062443]">S/ {c.total.toFixed(2)}</td>
                    <td className="p-3.5 text-center">{renderEstadoBadge(c.estadoSunat)}</td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => verPdfComprobante(c.comprobanteId)}
                          title="Ver PDF"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#075BC6]"
                        >
                          <Eye size={15} />
                        </button>

                        {c.tipoComprobante !== 'NOTA_DE_VENTA' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDescargar(c.comprobanteId, 'xml', c.numeroCompleto)}
                              title="Descargar XML"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#075BC6]"
                            >
                              <FileCode size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConsultarSunat(c.comprobanteId)}
                              title="Consultar/Enviar SUNAT"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600"
                            >
                              <RefreshCw size={15} />
                            </button>
                          </>
                        )}

                        {c.estadoSunat !== 'ANULADO' && (
                          <button
                            type="button"
                            onClick={() => setComprobanteAAnular(c)}
                            title="Anular Comprobante"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Ban size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Anulación */}
      {comprobanteAAnular && (
        <dialog open className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-2xl border-0 bg-white p-6 shadow-2xl">
          <h3 className="text-base font-bold text-[#062443]">Anular Comprobante</h3>
          <p className="mt-1 text-xs text-slate-500">
            ¿Estás seguro de anular el comprobante{' '}
            <strong className="text-slate-700">{comprobanteAAnular.numeroCompleto}</strong>?
          </p>

          <form onSubmit={handleConfirmarAnulacion} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Motivo de Anulación *</label>
              <textarea
                required
                rows={3}
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Ej. Error en los datos del cliente / Devolución de envío..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-[#062443] outline-none focus:border-[#075BC6]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setComprobanteAAnular(null);
                  setMotivoAnulacion('');
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={anulando}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {anulando ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}