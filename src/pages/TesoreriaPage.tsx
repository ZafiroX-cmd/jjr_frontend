import React, { useEffect, useState } from 'react';
import { 
  tesoreriaService, 
  type MovimientoCaja, 
  type RegistrarMovimientoPayload,
  type CuentaEmpresa
} from '../services/tesoreriaService';

export const TesoreriaPage: React.FC = () => {
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [cuentas, setCuentas] = useState<CuentaEmpresa[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);

  // Filtros
  const [tipoFiltro, setTipoFiltro] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  // Formulario de Registro
  const [nuevoMovimiento, setNuevoMovimiento] = useState<RegistrarMovimientoPayload>({
    cuentaEmpresaId: '',
    tipoMovimiento: 'INGRESO',
    concepto: '',
    monto: 0,
    medioPago: 'EFECTIVO',
    referencia: ''
  });

  const cargarMovimientos = async () => {
    setCargando(true);
    try {
      const data = await tesoreriaService.getMovimientos({
        tipoMovimiento: tipoFiltro || undefined,
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined
      });
      setMovimientos(data);
    } catch (error) {
      console.error('Error al cargar movimientos:', error);
    } finally {
      setCargando(false);
    }
  };

  const cargarCuentas = async () => {
    try {
      const data = await tesoreriaService.getCuentasEmpresa();
      setCuentas(data);
      if (data.length > 0) {
        setNuevoMovimiento(prev => ({ ...prev, cuentaEmpresaId: data[0].cuentaId }));
      }
    } catch (error) {
      console.error('Error al cargar cuentas de empresa:', error);
    }
  };

  useEffect(() => {
    cargarMovimientos();
  }, [tipoFiltro, fechaInicio, fechaFin]);

  useEffect(() => {
    cargarCuentas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nuevoMovimiento.cuentaEmpresaId) {
      alert('Debe seleccionar una cuenta o caja de la empresa.');
      return;
    }

    try {
      await tesoreriaService.registrarMovimiento(nuevoMovimiento);
      setModalAbierto(false);
      setNuevoMovimiento({
        cuentaEmpresaId: cuentas[0]?.cuentaId || '',
        tipoMovimiento: 'INGRESO',
        concepto: '',
        monto: 0,
        medioPago: 'EFECTIVO',
        referencia: ''
      });
      cargarMovimientos();
    } catch (error) {
      alert('Error al registrar el movimiento. Revisa los datos ingresados.');
    }
  };

  // Cálculos para KPIs
  const totalIngresos = movimientos
    .filter(m => m.tipoMovimiento === 'INGRESO')
    .reduce((acc, m) => acc + m.monto, 0);

  const totalEgresos = movimientos
    .filter(m => m.tipoMovimiento === 'EGRESO')
    .reduce((acc, m) => acc + m.monto, 0);

  const saldoNeto = totalIngresos - totalEgresos;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Módulo de Tesorería</h1>
          <p className="text-slate-500 text-sm">Control e historial de ingresos y egresos de caja institucional</p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition"
        >
          + Registrar Movimiento
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400">Total Ingresos</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">S/ {totalIngresos.toFixed(2)}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400">Total Egresos</span>
          <div className="text-2xl font-bold text-rose-600 mt-1">S/ {totalEgresos.toFixed(2)}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400">Saldo En Caja</span>
          <div className={`text-2xl font-bold mt-1 ${saldoNeto >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
            S/ {saldoNeto.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tipo Movimiento</label>
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Todos</option>
            <option value="INGRESO">Ingresos</option>
            <option value="EGRESO">Egresos</option>
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
          onClick={cargarMovimientos}
          className="mt-5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-300"
        >
          Limpiar/Actualizar
        </button>
      </div>

      {/* Tabla de Movimientos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Fecha/Hora</th>
              <th className="py-3 px-4">Tipo</th>
              <th className="py-3 px-4">Concepto / Descripción</th>
              <th className="py-3 px-4">Medio Pago</th>
              <th className="py-3 px-4">Usuario</th>
              <th className="py-3 px-4 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">Cargando movimientos...</td>
              </tr>
            ) : movimientos.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">No se encontraron movimientos.</td>
              </tr>
            ) : (
              movimientos.map((m) => (
                <tr key={m.movimientoId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">{new Date(m.fechaHora).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                      m.tipoMovimiento === 'INGRESO'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {m.tipoMovimiento}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">{m.concepto}</td>
                  <td className="py-3 px-4">{m.medioPago}</td>
                  <td className="py-3 px-4">{m.usuarioNombre}</td>
                  <td className={`py-3 px-4 text-right font-bold ${
                    m.tipoMovimiento === 'INGRESO' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {m.tipoMovimiento === 'INGRESO' ? '+' : '-'} S/ {m.monto.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Movimiento */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Registrar Nuevo Movimiento</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* 1. Selector de Caja/Cuenta */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cuenta / Caja de Destino</label>
                <select
                  required
                  value={nuevoMovimiento.cuentaEmpresaId}
                  onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, cuentaEmpresaId: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">-- Seleccione una cuenta o caja --</option>
                  {cuentas.map((c) => (
                    <option key={c.cuentaId} value={c.cuentaId}>
                      {c.nombreCuenta} ({c.tipoCuenta})
                    </option>
                  ))}
                  {/* Cajas por defecto si la lista viene vacía */}
                  {cuentas.length === 0 && (
                    <>
                      <option value="caja-chica-trujillo">Caja Chica - Agencia Trujillo</option>
                      <option value="caja-chica-chillia">Caja Chica - Agencia Chillia</option>
                      <option value="cuenta-bbva">Cuenta Corriente BBVA</option>
                    </>
                  )}
                </select>
              </div>

              {/* 2. Tipo de Movimiento */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Movimiento</label>
                <select
                  value={nuevoMovimiento.tipoMovimiento}
                  onChange={(e) => setNuevoMovimiento({
                    ...nuevoMovimiento, 
                    tipoMovimiento: e.target.value as 'INGRESO' | 'EGRESO'
                  })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="INGRESO">INGRESO</option>
                  <option value="EGRESO">EGRESO</option>
                </select>
              </div>

              {/* 3. Medio de Pago */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Medio de Pago</label>
                <select
                  value={nuevoMovimiento.medioPago}
                  onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, medioPago: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="EFECTIVO">EFECTIVO</option>
                  <option value="TRANSFERENCIA">TRANSFERENCIA BANCARIA</option>
                  <option value="YAPE">YAPE</option>
                  <option value="PLIN">PLIN</option>
                </select>
              </div>

              {/* 4. Concepto / Descripción */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Concepto / Descripción</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Fondeo de caja chica, Pago de alquiler, Planilla de personal..."
                  value={nuevoMovimiento.concepto}
                  onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, concepto: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* 5. Monto */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Monto (S/)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.1"
                  value={nuevoMovimiento.monto || ''}
                  onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, monto: parseFloat(e.target.value) || 0})}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* Botones de acción */}
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};