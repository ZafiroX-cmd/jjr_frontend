import { isAxiosError, AxiosHeaders } from "axios";

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("La API devolvió un registro inválido.");
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k.charAt(0).toLowerCase() + k.slice(1),
      v,
    ]),
  );
}

export function str(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Falta un campo de texto requerido en la API.");
  return value;
}

export function nullable(value: unknown): string | null {
  return value == null ? null : typeof value === "string" ? value : str(value);
}

export function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("La API debe devolver una lista.");
  return value;
}

export function num(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("La API devolvió un número inválido.");
  return value;
}

export function id(value: unknown): number {
  const n = num(value);
  if (!Number.isInteger(n) || n <= 0)
    throw new Error("Identificador numérico inválido.");
  return n;
}

export function bool(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new Error("La API devolvió un indicador inválido.");
  return value;
}

export function headers(): Record<string, string> {
  try {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export function multipartHeaders(): AxiosHeaders {
  const result = new AxiosHeaders(headers());
  result.set("Content-Type", false);
  return result;
}

export function errorMessage(e: unknown): string {
  if (isAxiosError(e)) {
    if (e.response?.status === 401)
      return "Tu sesión venció. Inicia sesión nuevamente.";
    if (e.response?.status === 403)
      return "No tienes permiso para esta operación.";
    if (e.response?.data && typeof e.response.data === "object") {
      const r = record(e.response.data);
      if (typeof r.mensaje === "string") return r.mensaje;
    }
    return "No se pudo completar la solicitud. Revisa tu conexión e inténtalo nuevamente.";
  }
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}