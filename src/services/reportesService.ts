import axiosClient from '../api/axiosClient';

export interface DesgloseCategoria {
  categoria: string;
  monto: number;
  porcentaje: number;
}

export interface ReporteFinancieroResponse {
  totalIngresos: number;
  totalEgresos: number;
  utilidadNeta: number;
  totalPasajesVendidos: number;
  totalEncomiendasProcesadas: number;
  ingresosPorCategoria: DesgloseCategoria[];
  egresosPorCategoria: DesgloseCategoria[];
}

export const reportesService = {
  getReporteFinanciero: async (fechaInicio?: string, fechaFin?: string): Promise<ReporteFinancieroResponse> => {
    const params = new URLSearchParams();
    if (fechaInicio) params.append('fechaInicio', fechaInicio);
    if (fechaFin) params.append('fechaFin', fechaFin);

    const response = await axiosClient.get<ReporteFinancieroResponse>(
      `/Reportes/financiero?${params.toString()}`
    );
    return response.data;
  }
};