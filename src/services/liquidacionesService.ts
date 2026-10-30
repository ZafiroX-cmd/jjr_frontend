import api from '../api/axiosClient';

export interface PreviaLiquidacionViaje {
  viajeId: string;
  socioId: string;
  nombreSocio: string;
  placaVehiculo: string;
  rutaOrigenDestino: string;
  fechaSalida: string;
  montoIngresoPasajes: number;
  montoIngresoEncomiendas: number;
  montoEgresosDeducibles: number;
  montoBrutoTotal: number;
  porcentajeSocio: number;
  montoGananciaSocio: number;
  montoGananciaEmpresa: number;
  yaLiquidado: boolean;
}

export interface LiquidacionSocioResponse {
  liquidacionId: string;
  viajeId: string;
  nombreSocio: string;
  placaVehiculo: string;
  rutaOrigenDestino: string;
  montoBrutoTotal: number;
  porcentajeSocio: number;
  montoGananciaSocio: number;
  montoGananciaEmpresa: number;
  estadoPago: string;
  fechaPago?: string;
  procesadoEn: string;
}

export const liquidacionesService = {
  getViajesPendientes: async (): Promise<PreviaLiquidacionViaje[]> => {
    const response = await api.get<PreviaLiquidacionViaje[]>('/Liquidaciones/viajes-pendientes');
    return response.data;
  },

  procesarLiquidacion: async (viajeId: string, cuentaId: string): Promise<void> => {
    await api.post('/Liquidaciones/procesar', { viajeId, cuentaId });
  },

  getHistorial: async (): Promise<LiquidacionSocioResponse[]> => {
    const response = await api.get<LiquidacionSocioResponse[]>('/Liquidaciones/historial');
    return response.data;
  }
};