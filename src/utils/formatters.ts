export const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export function instant(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
    throw new Error("Fecha inválida en la API.");
  const d = new Date(
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`,
  );
  if (!Number.isFinite(d.getTime()))
    throw new Error("Fecha inválida en la API.");
  return d;
}

// Instancias reutilizables de Intl para mayor rendimiento
const limaDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const limaTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const penCurrencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

export function todayLima(date = new Date()): string {
  const parts = limaDateFormatter.formatToParts(date);
  const get = (key: string) => parts.find((v) => v.type === key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const timeLima = (value: string): string =>
  limaTimeFormatter.format(instant(value));

export const currency = (value: number): string =>
  penCurrencyFormatter.format(value);

export const cents = (amount: number): number =>
  Math.round((amount + Number.EPSILON) * 100);

export function parseMoney(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}