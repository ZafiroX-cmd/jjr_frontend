import React, { useEffect, useState } from 'react';
import { egresosService, type EgresoOperativo } from '../services/egresosService';
import { tesoreriaService, type CuentaEmpresa } from '../services/tesoreriaService';

export const EgresosOperativosPage: React.FC = () => {
  const [egresos, setEgresos] = useState<EgresoOperativo[]>([]);
  const [cuentas, setCuentas] = useState<CuentaEmpresa[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);

  // Filtros
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  // Formulario Modal
  const [cuentaId, setCuentaId] = useState<string>('');
  const [categoria, setCategoria] = useState<string>('COMBUSTIBLE');
  const [monto, setMonto] = useState<number>(0);
  const [descripcion, setDescripcion] = useState<string>('');
  const [archivo, setArchivo] = useState<File | null>(null);

  const cargarEgresos = async () => {
    setCargando(true);
    try {
      const data = await egresosService.getEgresos({
        categoria: categoriaFiltro || undefined,
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined
      });
      setEgresos(data);
    } catch (error) {
      console.error('Error al cargar egresos:', error);
    } finally {
      setCargando(false);
    }
  };

  const cargarCuentas = async () => {
    try {
      const data = await tesoreriaService.getCuentasEmpresa();
      setCuentas(data);
      if (data.length > 0) setCuentaId(data[0].cuentaId);
    } catch (error) {
      console.error('Error al cargar cuentas:', error);
    }
  };

  useEffect(() => {
    cargarEgresos();
  }, [categoriaFiltro, fechaInicio, fechaFin]);

  useEffect(() => {
    cargarCuentas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuentaId) {
      alert('Seleccione una caja o cuenta de origen.');
      return;
    }

    try {
      await egresosService.registrarEgreso({
        cuentaId,
        categoria,
        monto,
        descripcion,
        comprobanteFile: archivo
      });

      alert('Egreso operativo registrado exitosamente.');
      setModalAbierto(false);
      setMonto(0);
      setDescripcion('');
      setArchivo(null);
      cargarEgresos();
    } catch (error) {
      alert('Error al registrar el egreso.');
    }
  };

  const totalMontoEgresos = egresos.reduce((acc, e) => acc + e.monto, 0);

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Egresos Operativos</h1>
          <p className="text-slate-500 text-sm">Registro de gastos en ruta, combustible, peajes y mantenimiento</p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition"
        >
          + Registrar Egreso
        </button>
      </div>

      {/* KPI Total */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm max-w-xs mb-6">
        <span className="text-xs font-semibold uppercase text-slate-400">Total Gastos Registrados</span>
        <div className="text-2xl font-bold text-rose-600 mt-1">S/ {totalMontoEgresos.toFixed(2)}</div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Todas</option>
            <option value="COMBUSTIBLE">Combustible</option>
            <option value="PEAJE">Peaje</option>
            <option value="VIATICOS">Viáticos</option>
            <option value="MANTENIMIENTO">Mantenimiento</option>
            <option value="OTROS">Otros Gastos</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={cargarEgresos}
          className="mt-5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-300"
        >
          Limpiar/Actualizar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Fecha/Hora</th>
              <th className="py-3 px-4">Categoría</th>
              <th className="py-3 px-4">Descripción</th>
              <th className="py-3 px-4">Vehículo</th>
              <th className="py-3 px-4">Usuario</th>
              <th className="py-3 px-4">Comprobante</th>
              <th className="py-3 px-4 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">Cargando egresos...</td>
              </tr>
            ) : egresos.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">No se encontraron egresos.</td>
              </tr>
            ) : (
              egresos.map((e) => (
                <tr key={e.egresoId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">{new Date(e.fechaEgreso).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded text-xs font-semibold">
                      {e.categoria}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">{e.descripcion || 'Sin descripción'}</td>
                  <td className="py-3 px-4">{e.placaVehiculo || 'N/A'}</td>
                  <td className="py-3 px-4">{e.usuarioNombre}</td>
                  <td className="py-3 px-4">
                    {e.comprobanteUrl ? (
                      <a href={e.comprobanteUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        Ver Foto
                      </a>
                    ) : (
                      <span className="text-slate-400">Sin foto</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-rose-600">
                    - S/ {e.monto.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Registrar Egreso Operativo</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Caja / Cuenta de Origen</label>
                <select
                  required
                  value={cuentaId}
                  onChange={(e) => setCuentaId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">-- Seleccione caja --</option>
                  {cuentas.map((c) => (
                    <option key={c.cuentaId} value={c.cuentaId}>
                      {c.nombreCuenta} ({c.tipoCuenta})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría del Gasto</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="COMBUSTIBLE">Combustible</option>
                  <option value="PEAJE">Peaje</option>
                  <option value="VIATICOS">Viáticos conductor</option>
                  <option value="MANTENIMIENTO">Mantenimiento / Repuestos</option>
                  <option value="OTROS">Otros Gastos Operativos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción / Detalle</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Recarga de Petróleo Primax"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Monto (S/)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.1"
                  value={monto || ''}
                  onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Foto Comprobante/Voucher (Opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium shadow-sm"
                >
                  Guardar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};