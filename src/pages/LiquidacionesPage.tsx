import React, { useEffect, useState } from 'react';
import { liquidacionesService, type PreviaLiquidacionViaje, type LiquidacionSocioResponse } from '../services/liquidacionesService';
import { tesoreriaService, type CuentaEmpresa } from '../services/tesoreriaService';

export const LiquidacionesPage: React.FC = () => {
  const [pendientes, setPendientes] = useState<PreviaLiquidacionViaje[]>([]);
  const [historial, setHistorial] = useState<LiquidacionSocioResponse[]>([]);
  const [cuentas, setCuentas] = useState<CuentaEmpresa[]>([]);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>('');
  const [cargando, setCargando] = useState<boolean>(false);
  const [pestana, setPestana] = useState<'pendientes' | 'historial'>('pendientes');

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resPendientes, resHistorial, resCuentas] = await Promise.all([
        liquidacionesService.getViajesPendientes(),
        liquidacionesService.getHistorial(),
        tesoreriaService.getCuentasEmpresa()
      ]);

      setPendientes(resPendientes);
      setHistorial(resHistorial);
      setCuentas(resCuentas);

      if (resCuentas.length > 0) {
        setCuentaSeleccionada(resCuentas[0].cuentaId);
      }
    } catch (e) {
      console.error('Error al cargar liquidaciones:', e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleProcesar = async (viaje: PreviaLiquidacionViaje) => {
    if (!cuentaSeleccionada) {
      alert('Seleccione la caja o cuenta de origen para realizar el pago.');
      return;
    }

    if (!confirm(`¿Confirmar liquidación para el viaje ${viaje.rutaOrigenDestino} (${viaje.placaVehiculo}) por el monto de S/ ${viaje.montoGananciaSocio.toFixed(2)} al socio ${viaje.nombreSocio}?`)) {
      return;
    }

    try {
      await liquidacionesService.procesarLiquidacion(viaje.viajeId, cuentaSeleccionada);
      alert('Liquidación abonada y procesada correctamente.');
      cargarDatos();
    } catch (error) {
      alert('Error al procesar la liquidación.');
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Liquidación de Socios Inversionistas</h1>
          <p className="text-slate-500 text-sm">Cálculo por viaje consolidando Pasajes, Encomiendas y Egresos Operativos</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setPestana('pendientes')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              pestana === 'pendientes' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setPestana('historial')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              pestana === 'historial' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Historial Pagados
          </button>
        </div>
      </div>

      {pestana === 'pendientes' && (
        <>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600">Caja / Cuenta de Pago:</label>
              <select
                value={cuentaSeleccionada}
                onChange={(e) => setCuentaSeleccionada(e.target.value)}
                className="border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500 bg-white"
              >
                {cuentas.map((c) => (
                  <option key={c.cuentaId} value={c.cuentaId}>
                    {c.nombreCuenta} ({c.tipoCuenta})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={cargarDatos}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg border border-slate-300 font-medium"
            >
              Actualizar Lista
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Fecha Salida</th>
                  <th className="py-3 px-4">Socio Propietario</th>
                  <th className="py-3 px-4">Placa / Ruta</th>
                  <th className="py-3 px-4 text-right">Pasajes</th>
                  <th className="py-3 px-4 text-right">Encomiendas</th>
                  <th className="py-3 px-4 text-right">Egresos</th>
                  <th className="py-3 px-4 text-right">Ganancia Socio ({'%'})</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">Cargando previa...</td>
                  </tr>
                ) : pendientes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">No hay viajes pendientes de liquidación.</td>
                  </tr>
                ) : (
                  pendientes.map((v) => (
                    <tr key={v.viajeId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">{new Date(v.fechaSalida).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{v.nombreSocio}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-800">{v.placaVehiculo}</span>
                        <div className="text-xs text-slate-400 mt-0.5">{v.rutaOrigenDestino}</div>
                      </td>
                      <td className="py-3 px-4 text-right">S/ {v.montoIngresoPasajes.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">S/ {v.montoIngresoEncomiendas.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-rose-600">- S/ {v.montoEgresosDeducibles.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        S/ {v.montoGananciaSocio.toFixed(2)}
                        <div className="text-xs font-normal text-slate-400">({v.porcentajeSocio}%)</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {v.yaLiquidado ? (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-semibold">Liquidado</span>
                        ) : (
                          <button
                            onClick={() => handleProcesar(v)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm"
                          >
                            Liquidar y Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pestana === 'historial' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Fecha Pago</th>
                <th className="py-3 px-4">Socio</th>
                <th className="py-3 px-4">Vehículo / Ruta</th>
                <th className="py-3 px-4 text-right">Total Bruto</th>
                <th className="py-3 px-4 text-right">Ganancia Empresa</th>
                <th className="py-3 px-4 text-right">Ganancia Socio</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">Sin historial de liquidaciones.</td>
                </tr>
              ) : (
                historial.map((h) => (
                  <tr key={h.liquidacionId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">{new Date(h.procesadoEn).toLocaleString()}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{h.nombreSocio}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-800">{h.placaVehiculo}</span>
                      <div className="text-xs text-slate-400 mt-0.5">{h.rutaOrigenDestino}</div>
                    </td>
                    <td className="py-3 px-4 text-right">S/ {h.montoBrutoTotal.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-amber-600 font-medium">S/ {h.montoGananciaEmpresa.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">S/ {h.montoGananciaSocio.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-semibold">
                        {h.estadoPago}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};