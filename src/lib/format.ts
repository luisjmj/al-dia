// Formato de moneda colombiana y fechas

// Formateadores por moneda (cacheados). La moneda activa la fija el store vía
// setActiveCurrency; no se convierten valores, solo cambia el símbolo/formato.
let activeCode = "COP";
const fmtCache = new Map<string, Intl.NumberFormat>();

function fmtFor(code: string): Intl.NumberFormat {
  let f = fmtCache.get(code);
  if (!f) {
    f = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    fmtCache.set(code, f);
  }
  return f;
}

export function setActiveCurrency(code: string) {
  activeCode = code || "COP";
}

// Símbolo de la moneda activa (para gráficas/etiquetas).
export function activeSymbol(): string {
  const part = fmtFor(activeCode)
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part ? part.value : "$";
}

export function formatCOP(value: number): string {
  return fmtFor(activeCode).format(Math.round(value));
}

// Versión compacta para gráficas: $1,2M / $850k (con el símbolo de la moneda activa)
export function formatCompact(value: number): string {
  const s = activeSymbol();
  if (Math.abs(value) >= 1_000_000) return `${s}${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${s}${Math.round(value / 1_000)}k`;
  return `${s}${Math.round(value)}`;
}

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

// "yyyy-mm" -> "Jun 2026"
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

export function periodShort(period: string): string {
  const [, m] = period.split("-").map(Number);
  return MESES[m - 1];
}

// Periodo actual "yyyy-mm"
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Suma n meses a un periodo "yyyy-mm"
export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Devuelve un color de texto (oscuro o claro) legible sobre el fondo dado.
export function readableText(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#0b0f17";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.58 ? "#0b0f17" : "#ffffff";
}

// Asegura que la URL tenga protocolo para abrirla como enlace externo.
export function externalUrl(url: string): string {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

// Diferencia en meses entre dos periodos (b - a)
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

// Mes "yyyy-mm" de cualquier periodo (mensual "yyyy-mm" o semanal "yyyy-mm-dd").
export function monthOf(period: string): string {
  return period.slice(0, 7);
}

// Nombres cortos de día de la semana, indexados por Date.getDay() (0=Dom).
export const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Etiqueta de un periodo semanal ("yyyy-mm-dd") -> "Vie 6". Null si es mensual.
export function slotLabel(period: string): string | null {
  if (period.length <= 7) return null;
  const [y, m, d] = period.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${WEEKDAYS_SHORT[dow]} ${d}`;
}
