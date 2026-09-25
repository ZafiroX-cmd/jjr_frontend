import axiosClient from "./axiosClient";
import type { ProgramarViajeDto, RecursosViaje, Viaje } from "../types/viaje";

export const viajesApi = {
  getViajes: async (oficinaId?: number, signal?: AbortSignal) => {
    const response = await axiosClient.get<Viaje[]>("/Viajes", {
      params: { oficinaId },
      signal,
    });
    return response.data;
  },

  getRecursos: async (oficinaOrigenId?: number, signal?: AbortSignal) => {
    const response = await axiosClient.get<RecursosViaje>("/Viajes/recursos", {
      params: { oficinaOrigenId },
      signal,
    });
    return response.data;
  },

  programarSalida: async (dto: ProgramarViajeDto) => {
    const response = await axiosClient.post("/Viajes", dto);
    return response.data;
  },

  cambiarEstado: async (viajeId: string, estado: string) => {
    const response = await axiosClient.patch(`/Viajes/${viajeId}/estado`, { estado });
    return response.data;
  },
};