import api from '../api/axiosClient';

export type TipoComprobante = 'BOLETA' | 'FACTURA' | 'NOTA_DE_VENTA';
export type EstadoSunat = 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'ANULADO';

export interface Comprobante {
  comprobanteId: number;
  tipoComprobante: TipoComprobante;
  serie: string;
  correlativo: string;
  numeroCompleto: string;
  fechaEmision: string;
  clienteDocumento: string;
  clienteNombres: string;
  subtotal: number;
  igv: number;
  total: number;
  estadoSunat: EstadoSunat;
  mensajeSunat?: string;
  encomiendaId?: number;
  oficinaNombre?: string;
}

export interface ComprobanteFiltros {
  tipo?: string;
  fechaInicio?: string;
  fechaFin?: string;
  busqueda?: string;
}

/**
 * Obtiene la lista de comprobantes aplicando filtros opcionales.
 */
export async function obtenerComprobantes(filtros?: ComprobanteFiltros): Promise<Comprobante[]> {
  const params = new URLSearchParams();

  if (filtros?.tipo) params.append('tipo', filtros.tipo);
  if (filtros?.fechaInicio) params.append('fechaInicio', filtros.fechaInicio);
  if (filtros?.fechaFin) params.append('fechaFin', filtros.fechaFin);
  if (filtros?.busqueda) params.append('busqueda', filtros.busqueda);

  const { data } = await api.get<Comprobante[]>(`/Comprobantes?${params.toString()}`);
  return data;
}

/**
 * Obtiene el detalle de un comprobante por ID.
 */
export async function obtenerComprobantePorId(id: number): Promise<Comprobante> {
  const { data } = await api.get<Comprobante>(`/Comprobantes/${id}`);
  return data;
}

/**
 * Consulta o reenvía el estado de un comprobante ante la SUNAT.
 */
export async function consultarEstadoSunat(id: number): Promise<Comprobante> {
  const { data } = await api.post<Comprobante>(`/Comprobantes/${id}/consultar-sunat`);
  return data;
}

/**
 * Solicita la anulación de un comprobante.
 */
export async function anularComprobante(id: number, motivo: string): Promise<void> {
  await api.post(`/Comprobantes/${id}/anular`, { motivo });
}

/**
 * Descarga o abre en nueva pestaña un archivo del comprobante (pdf, xml, cdr).
 */
export async function descargarArchivoComprobante(id: number, formato: 'pdf' | 'xml' | 'cdr'): Promise<Blob> {
  const { data } = await api.get(`/Comprobantes/${id}/descargar/${formato}`, {
    responseType: 'blob',
  });
  return data;
}

/**
 * Helper para abrir directamente el PDF del comprobante en una nueva pestaña.
 */
export async function verPdfComprobante(id: number): Promise<void> {
  const blob = await descargarArchivoComprobante(id, 'pdf');
  const fileURL = URL.createObjectURL(blob);
  window.open(fileURL, '_blank');
}