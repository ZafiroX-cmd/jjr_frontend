import api from '../api/axiosClient';

export interface PrediccionDemandaRuta {
  ruta: string;
  diaSemana: string;
  asientosOcupadosPromedio: number;
  nivelDemandaPorcentaje: number;
  recomendacion: string;
}

export interface ProyeccionFlujoCaja {
  mes: string;
  ingresosProyectados: number;
  egresosProyectados: number;
  utilidadEstimada: number;
}

export interface DashboardIAResponse {
  demandaRutas: PrediccionDemandaRuta[];
  proyeccionFinanciera: ProyeccionFlujoCaja[];
  totalViajesAnalizados: number;
  precisionModelo: number;
}

export const prediccionesService = {
  getDashboardIA: async (): Promise<DashboardIAResponse> => {
    const response = await api.get<DashboardIAResponse>('/Predicciones/dashboard');
    return response.data;
  }
};