import axiosClient from './axiosClient';
import type { Encomienda, CrearEncomiendaDto, CambiarEstadoEncomiendaDto } from '../types/encomienda';

export const encomiendasApi = {
  getEncomiendas: async (params?: {
    oficinaOrigenId?: number | null;
    oficinaDestinoId?: number | null;
    estado?: string;
  }): Promise<Encomienda[]> => {
    const res = await axiosClient.get<Encomienda[]>('/encomiendas', { params });
    return res.data;
  },

  registrar: async (dto: CrearEncomiendaDto): Promise<{ mensaje: string; codigoGuia: string; encomiendaId: string }> => {
    const res = await axiosClient.post('/encomiendas', dto);
    return res.data;
  },

  cambiarEstado: async (id: string, dto: CambiarEstadoEncomiendaDto): Promise<void> => {
    await axiosClient.put(`/encomiendas/${id}/estado`, dto);
  },
};