export type EstadoViaje = "Programado" | "En Ruta" | "Finalizado" | "Cancelado";

export interface Viaje {
  viajeId: string;
  rutaNombre: string;
  rutaId: number;
  oficinaOrigenId: number | null;
  oficinaOrigenNombre: string;
  vehiculoId: string;
  placa: string;
  conductorId: string;
  conductorNombre: string;
  fechaHoraSalida: string;
  precioPasaje: number;
  manifiestoCerrado: boolean;
  asientosOcupados: number;
  asientosDisponibles: number;
  estado: EstadoViaje;
}

export interface Parada {
  paradaId: number;
  nombreParada: string;
  orden: number;
  esOficina: boolean;
}

export interface Ruta {
  rutaId: number;
  origen: string;
  destino: string;
  nombre: string;
  precioSugerido: number;
  paradas: Parada[];
}

export interface RecursosViaje {
  rutas: Ruta[];
  vehiculos: { vehiculoId: string; placa: string; marca: string }[];
  conductores: { conductorId: string; nombre: string }[];
  oficinas: { oficinaId: number; nombre: string; direccion: string | null }[];
}

export interface ProgramarViajeDto {
  rutaId: number;
  oficinaOrigenId: number;
  vehiculoId: string;
  conductorId: string;
  fechaSalida: string;
  precioPasaje: number;
}

export interface PerfilViajes {
  rol: string;
  oficinaId: number | null;
  nombreCompleto?: string;
}