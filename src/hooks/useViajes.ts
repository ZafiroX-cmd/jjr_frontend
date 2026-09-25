import { useCallback, useEffect, useState } from "react";
import { viajesApi } from "../api/viajesApi";
import type { ProgramarViajeDto, RecursosViaje, Viaje } from "../types/viaje";

export function useViajes(oficinaId?: number | null) {
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [recursos, setRecursos] = useState<RecursosViaje | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => setRevision((v) => v + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    const targetOffice = oficinaId ?? undefined;

    Promise.all([
      viajesApi.getViajes(targetOffice, controller.signal),
      viajesApi.getRecursos(targetOffice, controller.signal),
    ])
      .then(([viajesData, recursosData]) => {
        setViajes(viajesData);
        setRecursos(recursosData);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err?.response?.data?.mensaje || "Error al cargar datos de viajes.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [oficinaId, revision]);

  const cargarRecursosPorOrigen = async (oficinaOrigenId: number) => {
    try {
      const data = await viajesApi.getRecursos(oficinaOrigenId);
      setRecursos(data);
    } catch {
      // Manejar error silenciosamente o notificar
    }
  };

  const programarSalida = async (dto: ProgramarViajeDto) => {
    await viajesApi.programarSalida(dto);
    reload();
  };

  const cambiarEstado = async (viajeId: string, estado: string) => {
    await viajesApi.cambiarEstado(viajeId, estado);
    reload();
  };

  return {
    viajes,
    recursos,
    loading,
    error,
    reload,
    cargarRecursosPorOrigen,
    programarSalida,
    cambiarEstado,
  };
}