export type EstadoEncomienda = 'REGISTRADO' | 'EN RUTA' | 'POR ENTREGAR' | 'ENTREGADO' | 'CANCELADO';

export interface Encomienda {
  encomiendaId: string;
  codigoGuia: string;
  oficinaOrigenId: number;
  oficinaOrigenNombre: string;
  oficinaDestinoId: number;
  oficinaDestinoNombre: string;
  viajeId?: string | null;
  viajeRuta?: string | null;
  placaVehiculo?: string | null;

  remitenteDocumento: string;
  remitenteNombres: string;
  remitenteTelefono: string;

  destinatarioDocumento: string;
  destinatarioNombres: string;
  destinatarioTelefono: string;

  descripcion: string;
  cantidadPaquetes: number;
  pesoKg: number;
  precioEnvio: number;
  porPagar: boolean;
  estado: EstadoEncomienda;
  fechaRegistro: string;
  fechaEntrega?: string | null;
}

export interface CrearEncomiendaDto {
  oficinaOrigenId: number;
  oficinaDestinoId: number;
  viajeId?: string | null;

  remitenteDocumento: string;
  remitenteNombres: string;
  remitenteTelefono: string;

  destinatarioDocumento: string;
  destinatarioNombres: string;
  destinatarioTelefono: string;

  descripcion: string;
  cantidadPaquetes: number;
  pesoKg: number;
  precioEnvio: number;
  porPagar: boolean;
  observaciones?: string;
}

export interface CambiarEstadoEncomiendaDto {
  nuevoEstado: EstadoEncomienda;
  viajeId?: string | null;
  observacion?: string;
}