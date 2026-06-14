// Formato de moneda colombiana y fechas

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCOP(value: number): string {
  return cop.format(Math.round(value));
}

// Versión compacta para gráficas: $1,2M / $850k
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
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
