import { useState, useEffect, useCallback } from 'react';
import { encomiendasApi } from '../api/encomiendasApi';
import { viajesApi } from '../api/viajesApi';
import type { Encomienda, CrearEncomiendaDto, EstadoEncomienda } from '../types/encomienda';
import type { RecursosViaje } from '../types/viaje';

export function useEncomiendas(oficinaFiltroId?: number | null) {
  const [encomiendas, setEncomiendas] = useState<Encomienda[]>([]);
  const [recursos, setRecursos] = useState<RecursosViaje | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lista, recs] = await Promise.all([
        encomiendasApi.getEncomiendas({ oficinaOrigenId: oficinaFiltroId }),
        viajesApi.getRecursos(),
      ]);
      setEncomiendas(lista);
      setRecursos(recs);
    } catch (err: any) {
      setError(err?.response?.data?.mensaje || 'Error al cargar encomiendas.');
    } finally {
      setLoading(false);
    }
  }, [oficinaFiltroId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const registrarEncomienda = async (dto: CrearEncomiendaDto) => {
    await encomiendasApi.registrar(dto);
    await reload();
  };

  const cambiarEstado = async (id: string, nuevoEstado: EstadoEncomienda, viajeId?: string | null) => {
    await encomiendasApi.cambiarEstado(id, { nuevoEstado, viajeId });
    await reload();
  };

  return {
    encomiendas,
    recursos,
    loading,
    error,
    reload,
    registrarEncomienda,
    cambiarEstado,
  };
}