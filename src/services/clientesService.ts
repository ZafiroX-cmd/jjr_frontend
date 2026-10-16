import axiosClient from '../api/axiosClient';

export interface ClienteConsultaResponse {
  nombres: string;
  telefono?: string;
}

export const buscarClientePorDocumento = async (
  documento: string
): Promise<ClienteConsultaResponse | null> => {
  try {
    const { data } = await axiosClient.get(`/Clientes/consulta/${documento}`);

    let nombreCompleto = '';

    if (data.fuente === 'LOCAL') {
      nombreCompleto = data.razonSocial
        ? data.razonSocial
        : `${data.nombres || ''} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
    } else if (data.fuente === 'RENIEC') {
      nombreCompleto = `${data.nombres || ''} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
    } else if (data.fuente === 'SUNAT') {
      nombreCompleto = data.razonSocial || '';
    }

    return {
      nombres: nombreCompleto,
      telefono: data.telefono || '',
    };
  } catch (error) {
    console.warn('Error o documento no encontrado en la consulta:', error);
    return null;
  }
};