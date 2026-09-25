export type NumeroAsiento = 1 | 2 | 3 | 4;
export type TipoOperacion = "VENTA_DIRECTA" | "RESERVA";
export type MedioPago = "EFECTIVO" | "YAPE" | "PLIN" | "TRANSFERENCIA";
export type TipoComprobante = "NOTA_VENTA" | "BOLETA" | "FACTURA";

export interface ViajeVenta {
  viajeId: string;
  rutaNombre: string;
  fechaHoraSalida: string;
  placa: string;
  conductorNombre: string;
  estado: string;
  manifiestoCerrado: boolean;
  oficinaOrigenId: number | null;
  oficinaOrigenNombre: string;
}

export interface Asiento {
  numeroAsiento: NumeroAsiento;
  ubicacion: string;
  ocupado: boolean;
  estado: string;
  pasajeroNombre: string | null;
  pasajeroDocumento: string | null;
  destinoNombre: string | null;
  pasajeId: string | null;
  tipoOperacion: string | null;
  precioTotal: number;
  montoAdelanto: number;
  saldoPendiente: number;
  medioPago: string | null;
  comprobantePagoUrl: string | null;
  comprobanteEmitido: boolean;
  tipoComprobante?: TipoComprobante | null;
  numeroComprobante?: string | null;
  numeroOperacion?: string | null;
}

export interface Parada {
  paradaId: number;
  nombreParada: string;
  orden: number;
  esOficina: boolean;
}

export interface MapaCamioneta {
  viajeId: string;
  rutaNombre: string;
  placa: string;
  precioBase: number;
  fechaSalida: string;
  paradas: Parada[];
  asientos: Asiento[];
}

export interface ClienteSeleccionado {
  clienteId: string;
  numeroDocumento: string;
  nombreCliente: string;
  activo: boolean;
}

export interface VentaPasajeDto {
  viajeId: string;
  numeroAsiento: NumeroAsiento;
  clientePasajeroId: string;
  clienteFacturacionId: string | null;
  origenParadaId: number;
  destinoParadaId: number;
  precio: number;
  tipoOperacion: TipoOperacion;
  montoAdelanto: number;
  medioPago: MedioPago;
  numeroOperacion: string;
  tipoComprobante?: TipoComprobante;
}

export interface EmisionComprobante {
  pasajeId: string;
  viajeId: string;
  tipo: TipoComprobante;
  asiento: Asiento;
}

export interface PaymentValue {
  medio: MedioPago;
  numero: string;
  file: File | null;
}

export interface PerfilPasajes {
  rol: string;
  oficinaId: number | null;
}

export interface PasajesPageProps {
  usuario?: PerfilPasajes;
  apiPrefix?: string;
  onEmitirComprobante?: (solicitud: EmisionComprobante) => void | Promise<void>;
  voucherBaseUrl?: string;
  maxVoucherBytes?: number;
}