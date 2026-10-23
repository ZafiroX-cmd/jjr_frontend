import api from '../api/axiosClient';

export interface EgresoOperativo {
  egresoId: string;
  categoria: string;
  monto: number;
  descripcion?: string;
  comprobanteUrl?: string;
  validadoPorAdmin: boolean;
  placaVehiculo?: string;
  usuarioNombre: string;
  fechaEgreso: string;
}

export interface RegistrarEgresoPayload {
  cuentaId: string;
  vehiculoId?: string;
  viajeId?: string;
  categoria: string;
  monto: number;
  descripcion?: string;
  comprobanteFile?: File | null;
}

export const egresosService = {
  getEgresos: async (filtro?: { categoria?: string; fechaInicio?: string; fechaFin?: string }): Promise<EgresoOperativo[]> => {
    const response = await api.get<EgresoOperativo[]>('/EgresosOperativos', { params: filtro });
    return response.data;
  },

  registrarEgreso: async (payload: RegistrarEgresoPayload): Promise<void> => {
    const formData = new FormData();
    formData.append('cuentaId', payload.cuentaId);
    if (payload.vehiculoId) formData.append('vehiculoId', payload.vehiculoId);
    if (payload.viajeId) formData.append('viajeId', payload.viajeId);
    formData.append('categoria', payload.categoria);
    formData.append('monto', payload.monto.toString());
    if (payload.descripcion) formData.append('descripcion', payload.descripcion);
    if (payload.comprobanteFile) formData.append('comprobanteFile', payload.comprobanteFile);

    await api.post('/EgresosOperativos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};