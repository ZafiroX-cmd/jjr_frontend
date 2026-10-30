import React, { useEffect, useState } from 'react';
import { prediccionesService, type DashboardIAResponse } from '../services/prediccionesService';

export const PrediccionesPage: React.FC = () => {
  const [data, setData] = useState<DashboardIAResponse | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

  const cargarPredicciones = async () => {
    setCargando(true);
    try {
      const res = await prediccionesService.getDashboardIA();
      setData(res);
    } catch (e) {
      console.error('Error al consultar Groq Cloud IA:', e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPredicciones();
  }, []);

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            ⚡ Predicciones con IA (Groq Cloud Llama 3.1)
          </h1>
          <p className="text-slate-500 text-sm">
            Análisis en tiempo real de demanda por rutas y proyección financiera de tesorería
          </p>
        </div>
        <button
          onClick={cargarPredicciones}
          disabled={cargando}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition shadow-sm"
        >
          {cargando ? 'Analizando...' : 'Re-analizar con IA'}
        </button>
      </div>

      {cargando ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="size-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-4" />
          <p className="text-slate-700 font-semibold text-sm">Groq LPU procesando datos contables y de rutas...</p>
          <span className="text-slate-400 text-xs mt-1">Generando inferencia con Llama 3.1</span>
        </div>
      ) : !data ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
          No se pudieron obtener las predicciones. Verifica la clave de API de Groq en el backend.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Métricas Generales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-400">Viajes Analizados</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{data.totalViajesAnalizados} salidas</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-400">Precision Estimada del Modelo</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{data.precisionModelo}%</div>
            </div>
          </div>

          {/* Demanda por Rutas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-800 mb-4">Proyección de Ocupación por Ruta</h2>
            <div className="grid grid-cols-1 gap-4">
              {data.demandaRutas.map((r, i) => (
                <div key={i} className="border border-slate-200 p-4 rounded-xl bg-slate-50/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-slate-800 text-sm">{r.ruta}</span>
                    <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                      Demanda Estimada: {r.nivelDemandaPorcentaje}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full ${r.nivelDemandaPorcentaje >= 75 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${r.nivelDemandaPorcentaje}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600">
                    💡 <strong className="text-slate-700">Recomendación IA:</strong> {r.recomendacion}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Flujo de Caja Proyectado */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-800 mb-4">Proyección Financiera Proyectada por IA</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.proyeccionFinanciera.map((pf, i) => (
                <div key={i} className="border border-emerald-200 bg-emerald-50/40 p-4 rounded-xl">
                  <h3 className="font-bold text-emerald-900 text-sm mb-3">{pf.mes}</h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Ingresos Estimados:</span>
                      <span className="font-semibold text-emerald-700">S/ {pf.ingresosProyectados.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Egresos Estimados:</span>
                      <span className="font-semibold text-rose-600">- S/ {pf.egresosProyectados.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-800 font-bold border-t border-emerald-200 pt-2 mt-2 text-sm">
                      <span>Utilidad Estimada:</span>
                      <span className="text-emerald-800">S/ {pf.utilidadEstimada.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};