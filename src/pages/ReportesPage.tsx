import React, { useEffect, useState } from 'react';
import { reportesService, type ReporteFinancieroResponse } from '../services/reportesService';

export const ReportesPage: React.FC = () => {
  const [reporte, setReporte] = useState<ReporteFinancieroResponse | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

  // Rango de fechas por defecto (mes actual)
  const today = new Date().toISOString().split('T')[0];
  const firstDayMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [fechaInicio, setFechaInicio] = useState<string>(firstDayMonth);
  const [fechaFin, setFechaFin] = useState<string>(today);

  const cargarReporte = async () => {
    setCargando(true);
    try {
      const data = await reportesService.getReporteFinanciero(fechaInicio, fechaFin);
      setReporte(data);
    } catch (error) {
      console.error('Error al cargar reporte financiero:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarReporte();
  }, []);

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Encabezado y Filtros por Rango */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">📊 Reportes Financieros</h1>
          <p className="text-slate-500 text-sm">Estado de resultados, desglose por categoría y volumen operativo</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">Desde:</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">Hasta:</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={cargarReporte}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded-lg text-xs transition shadow-sm"
          >
            Filtrar
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="size-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-4" />
          <p className="text-slate-600 font-medium text-sm">Consolidando métricas financieras...</p>
        </div>
      ) : !reporte ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
          No se pudieron obtener los reportes financieros.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tarjetas KPI */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
              <span className="text-xs font-semibold uppercase text-slate-400">Total Ingresos</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">S/ {reporte.totalIngresos.toFixed(2)}</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-rose-500">
              <span className="text-xs font-semibold uppercase text-slate-400">Total Egresos</span>
              <div className="text-2xl font-bold text-rose-600 mt-1">S/ {reporte.totalEgresos.toFixed(2)}</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500">
              <span className="text-xs font-semibold uppercase text-slate-400">Utilidad Neta</span>
              <div className={`text-2xl font-bold mt-1 ${reporte.utilidadNeta >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                S/ {reporte.utilidadNeta.toFixed(2)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
              <span className="text-xs font-semibold uppercase text-slate-400">Volumen Operativo</span>
              <div className="text-xs text-slate-600 mt-2 space-y-1">
                <p>🎫 Pasajes: <strong>{reporte.totalPasajesVendidos}</strong></p>
                <p>📦 Encomiendas: <strong>{reporte.totalEncomiendasProcesadas}</strong></p>
              </div>
            </div>
          </div>

          {/* Tablas de Desglose */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Desglose Ingresos */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                🟢 Ingresos por Categoría
              </h2>
              {reporte.ingresosPorCategoria.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Sin ingresos en este rango</p>
              ) : (
                <div className="space-y-3">
                  {reporte.ingresosPorCategoria.map((cat, idx) => (
                    <div key={idx} className="border-b border-slate-100 pb-2">
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>{cat.categoria}</span>
                        <span className="text-emerald-700">S/ {cat.monto.toFixed(2)} ({cat.porcentaje}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${cat.porcentaje}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desglose Egresos */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                🔴 Egresos por Categoría
              </h2>
              {reporte.egresosPorCategoria.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Sin egresos en este rango</p>
              ) : (
                <div className="space-y-3">
                  {reporte.egresosPorCategoria.map((cat, idx) => (
                    <div key={idx} className="border-b border-slate-100 pb-2">
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>{cat.categoria}</span>
                        <span className="text-rose-600">S/ {cat.monto.toFixed(2)} ({cat.porcentaje}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full" style={{ width: `${cat.porcentaje}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};