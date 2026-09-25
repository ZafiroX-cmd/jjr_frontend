export type RolUsuario = "Administrador" | "Gerente" | "Recepcionista";

export interface Usuario {
  usuarioId: string;
  username: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  dni?: string | null;
  email?: string | null;
  rol: RolUsuario;
  oficinaId: number | null;
  oficinaNombre?: string;
  activo: boolean;
}

export interface OficinaOption {
  oficinaId: number;
  nombre: string;
}

export interface CrearUsuarioDto {
  username: string;
  nombres: string;
  apellidos: string;
  dni?: string | null;
  email?: string | null;
  passwordHash: string;
  rol: string;
  oficinaId: number | null;
}