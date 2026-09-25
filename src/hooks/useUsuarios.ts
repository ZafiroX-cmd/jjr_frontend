import { useCallback, useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import type { CrearUsuarioDto, OficinaOption, Usuario } from "../types/usuario";

function getAuthHeaders() {
  try {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [oficinas, setOficinas] = useState<OficinaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");

    const headers = getAuthHeaders();

    try {
      // 1. Obtener lista de usuarios
      const resUsers = await axiosClient.get<Usuario[]>("/Usuarios", {
        signal,
        headers,
      });
      setUsuarios(resUsers.data || []);
    } catch (e: any) {
      if (e?.name !== "CanceledError") {
        setError(
          e?.response?.data?.mensaje || "No se pudieron cargar los datos de usuarios."
        );
      }
    }

    try {
      // 2. Obtener lista de oficinas para los dropdowns
      const resOficinas = await axiosClient.get<OficinaOption[]>("/Flota/oficinas", {
        signal,
        headers,
      });
      setOficinas(resOficinas.data || []);
    } catch {
      // Si el endpoint de oficinas no está listo, se mantiene un arreglo vacío sin romper la vista
      setOficinas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const crearUsuario = async (dto: CrearUsuarioDto) => {
    await axiosClient.post("/Usuarios", dto, { headers: getAuthHeaders() });
    await fetchData();
  };

  const actualizarUsuario = async (id: string, dto: any) => {
    await axiosClient.put(`/Usuarios/${id}`, dto, { headers: getAuthHeaders() });
    await fetchData();
  };

  return {
    usuarios,
    oficinas,
    loading,
    error,
    reload: () => fetchData(),
    crearUsuario,
    actualizarUsuario,
  };
}