import api from '../api/axiosClient';

export interface CuentaEmpresa {
  cuentaId: string;
  nombreCuenta: string;
  tipoCuenta: string;
}

export interface RegistrarMovimientoPayload {
  cuentaEmpresaId: string;
  tipoMovimiento: 'INGRESO' | 'EGRESO';
  concepto: string;
  monto: number;
  medioPago: string;
  referencia?: string;
}

export interface MovimientoCaja {
  movimientoId: string;
  fechaHora: string;
  tipoMovimiento: string;
  concepto: string;
  monto: number;
  medioPago: string;
  referencia?: string;
  usuarioNombre: string;
}

export interface MovimientoFiltro {
  tipoMovimiento?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

export const tesoreriaService = {
  getMovimientos: async (filtro?: MovimientoFiltro): Promise<MovimientoCaja[]> => {
    const response = await api.get<MovimientoCaja[]>('/tesoreria/movimientos', { params: filtro });
    return response.data;
  },

  getCuentasEmpresa: async (): Promise<CuentaEmpresa[]> => {
    const response = await api.get<CuentaEmpresa[]>('/tesoreria/cuentas');
    return response.data;
  },

  registrarMovimiento: async (payload: RegistrarMovimientoPayload): Promise<MovimientoCaja> => {
    const response = await api.post<MovimientoCaja>('/tesoreria/movimientos', payload);
    return response.data;
  }
};