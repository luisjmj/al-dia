import type { Debt, Payment } from "../types";
import { addMonths, currentPeriod, monthsBetween, monthOf } from "./format";

// --- Frecuencias sub-mensuales (semanal / quincenal) ---
// Estas deudas generan un pago por OCURRENCIA; el `period` de cada pago es la
// fecha "yyyy-mm-dd" de esa semana. `dueDay` guarda el día de la semana (0=Dom..6=Sáb).
export function isSubMonthly(debt: Debt): boolean {
  return (
    (debt.frequency === "weekly" || debt.frequency === "biweekly") &&
    debt.kind !== "one_time"
  );
}

function intervalDays(debt: Debt): number {
  return debt.frequency === "weekly" ? 7 : 14;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Primera ocurrencia: la fecha >= startDate cuyo día de semana == dueDay.
function firstOccurrence(debt: Debt): Date {
  const [Y, M, D] = debt.startDate.split("-").map(Number);
  const d = new Date(Y, M - 1, D);
  const diff = (debt.dueDay - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// Fechas "yyyy-mm-dd" de una deuda sub-mensual dentro del mes "yyyy-mm".
// Respeta inicio, cadencia (7/14 días) y, en créditos, el nº de cuotas.
export function occurrencesInMonth(debt: Debt, month: string): string[] {
  if (debt.archived || !isSubMonthly(debt)) return [];
  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0); // último día del mes (00:00)
  const anchor = firstOccurrence(debt);
  const step = intervalDays(debt);
  const cap =
    debt.kind === "installments" ? debt.installmentsTotal ?? 0 : Infinity;

  let idx = 0;
  if (anchor < monthStart) {
    const days = Math.round(
      (monthStart.getTime() - anchor.getTime()) / 86400000
    );
    idx = Math.ceil(days / step);
  }
  const out: string[] = [];
  while (idx < cap) {
    const occ = new Date(anchor);
    occ.setDate(anchor.getDate() + idx * step);
    if (occ > monthEnd) break;
    if (occ >= monthStart) out.push(isoOf(occ));
    idx++;
  }
  return out;
}

// Fecha ISO comparable de un "slot" (para ordenar filas dentro de un mes).
export function slotDateOf(debt: Debt, period: string): string {
  if (period.length > 7) return period; // ya es una fecha (semanal)
  const [y, m] = period.split("-").map(Number);
  const dim = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(1, debt.dueDay), dim);
  return `${period}-${pad2(day)}`;
}

// Slots (periodos) de una deuda en un mes: para mensuales es [mes] si está
// activa; para sub-mensuales, una entrada por semana. Incluye periodos con pago.
export function slotsForDebtInMonth(
  debt: Debt,
  month: string,
  payments: Payment[]
): string[] {
  const set = new Set<string>(
    isSubMonthly(debt)
      ? occurrencesInMonth(debt, month)
      : isDebtActiveIn(debt, month)
      ? [month]
      : []
  );
  for (const p of payments) {
    if (p.debtId === debt.id && monthOf(p.period) === month) set.add(p.period);
  }
  return [...set].sort((a, b) =>
    slotDateOf(debt, a).localeCompare(slotDateOf(debt, b))
  );
}

// ¿La deuda está vigente (genera cobro) en este periodo?
// `period` puede ser un mes ("yyyy-mm") o un slot semanal ("yyyy-mm-dd").
export function isDebtActiveIn(debt: Debt, period: string): boolean {
  if (debt.archived) return false;

  if (isSubMonthly(debt)) {
    const occ = occurrencesInMonth(debt, monthOf(period));
    return period.length > 7 ? occ.includes(period) : occ.length > 0;
  }

  // Sin fecha de inicio: activa en mes actual y futuros; en pasados aparece solo via "Generar pagos"
  if (debt.noStartDate && debt.kind === "recurring") {
    return period >= currentPeriod();
  }
  const startPeriod = debt.startDate.slice(0, 7);
  const elapsed = monthsBetween(startPeriod, period);
  if (elapsed < 0) return false; // aún no empieza

  switch (debt.kind) {
    case "recurring":
      return true; // sin fin
    case "one_time":
      return elapsed === 0; // solo el mes de inicio
    case "installments":
      return elapsed < (debt.installmentsTotal ?? 0); // mientras queden cuotas
  }
}

// Monto esperado de una deuda en un periodo (aplica interés mensual si existe).
// Para frecuencias no mensuales, normalizamos a impacto mensual.
// Para gastos variables, si hay un pago real en ese periodo se usa ese valor;
// si no, se estima con el promedio histórico real (y `amount` como respaldo).
export function expectedAmount(
  debt: Debt,
  period: string,
  payments?: Payment[]
): number {
  if (!isDebtActiveIn(debt, period)) return 0;

  if (debt.variable) {
    if (payments) {
      const real = paidInPeriod(debt.id, period, payments);
      if (real > 0) return real;
      const avg = avgActualForDebt(debt.id, payments);
      if (avg > 0) return avg;
    }
    return debt.amount; // estimado del usuario
  }

  // `amount` es el monto por ocurrencia: por mes (mensual) o por semana
  // (semanal/quincenal, donde cada semana es un pago aparte).
  return debt.amount;
}

// Total esperado de UNA deuda en un mes. Para sub-mensuales suma sus semanas.
export function expectedForMonth(
  debt: Debt,
  month: string,
  payments?: Payment[]
): number {
  if (isSubMonthly(debt)) {
    return occurrencesInMonth(debt, month).reduce((s, occ) => {
      if (payments && isSkippedInPeriod(debt.id, occ, payments)) return s;
      return s + expectedAmount(debt, occ, payments);
    }, 0);
  }
  if (payments && isSkippedInPeriod(debt.id, month, payments)) return 0;
  return expectedAmount(debt, month, payments);
}

// Promedio de lo realmente pagado en una deuda (para estimar gastos variables).
export function avgActualForDebt(debtId: string, payments: Payment[]): number {
  const ps = payments.filter(
    (p) => p.debtId === debtId && p.type !== "skipped" && p.type !== "abono"
  );
  if (ps.length === 0) return 0;
  return ps.reduce((s, p) => s + p.amount, 0) / ps.length;
}

// Cuotas pagadas de una deuda a cuotas (los abonos y skips no cuentan).
export function installmentsPaid(debt: Debt, payments: Payment[]): number {
  return payments.filter(
    (p) => p.debtId === debt.id && p.type !== "abono" && p.type !== "skipped"
  ).length;
}

// ¿Cuánto se ha pagado de una deuda en un periodo?
export function paidInPeriod(
  debtId: string,
  period: string,
  payments: Payment[]
): number {
  return payments
    .filter((p) => p.debtId === debtId && p.period === period)
    .reduce((s, p) => s + p.amount, 0);
}

// ¿La deuda está marcada como "no se paga este mes" en ese periodo?
export function isSkippedInPeriod(
  debtId: string,
  period: string,
  payments: Payment[]
): boolean {
  return payments.some(
    (p) => p.debtId === debtId && p.period === period && p.type === "skipped"
  );
}

// Total esperado del mes (suma de todas las deudas activas, excluye skipped).
export function totalExpected(
  debts: Debt[],
  period: string,
  payments?: Payment[]
): number {
  return debts.reduce((s, d) => s + expectedForMonth(d, period, payments), 0);
}

// Total pagado en el mes (agrupa por mes; los pagos semanales tienen fecha).
export function totalPaid(period: string, payments: Payment[]): number {
  return payments
    .filter((p) => monthOf(p.period) === period)
    .reduce((s, p) => s + p.amount, 0);
}

// --- Estadísticas históricas ---

// Gasto pagado por periodo en los últimos `n` meses (incluye el actual).
export function spendingByMonth(
  payments: Payment[],
  n = 6
): { period: string; total: number }[] {
  const cur = currentPeriod();
  const out: { period: string; total: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const period = addMonths(cur, -i);
    out.push({ period, total: totalPaid(period, payments) });
  }
  return out;
}

// Promedio mensual real de los meses pasados (sin contar el actual incompleto).
export function avgMonthlySpend(payments: Payment[], lookback = 6): number {
  const cur = currentPeriod();
  let sum = 0;
  let count = 0;
  for (let i = 1; i <= lookback; i++) {
    const period = addMonths(cur, -i);
    const t = totalPaid(period, payments);
    if (t > 0) {
      sum += t;
      count++;
    }
  }
  return count ? sum / count : 0;
}

// --- Proyección a futuro ---
// Combina: (1) cuotas comprometidas de deudas vigentes,
//          (2) colchón de gastos recurrentes variables vía promedio histórico.
export interface Projection {
  period: string;
  committed: number; // deudas conocidas (cuotas/recurrentes fijas)
  variable: number; // ajuste por histórico variable
  total: number;
}

export function projectNextMonths(
  debts: Debt[],
  payments: Payment[],
  months = 3
): Projection[] {
  const cur = currentPeriod();
  const out: Projection[] = [];

  // "Colchón" variable: cuánto del gasto histórico NO está explicado por deudas
  // recurrentes fijas. Si el histórico es mayor que lo comprometido, sumamos la diferencia.
  const histAvg = avgMonthlySpend(payments);
  const recurringFixed = debts
    .filter((d) => d.kind === "recurring")
    .reduce((s, d) => s + expectedForMonth(d, cur), 0);
  const variableCushion = Math.max(0, histAvg - recurringFixed);

  for (let i = 1; i <= months; i++) {
    const period = addMonths(cur, i);
    const committed = totalExpected(debts, period, payments);
    out.push({
      period,
      committed,
      variable: variableCushion,
      total: committed + variableCushion,
    });
  }
  return out;
}

// Gasto por categoría en un periodo (esperado).
export function byCategory(
  debts: Debt[],
  period: string,
  payments?: Payment[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of debts) {
    const amt = expectedAmount(d, period, payments);
    if (amt > 0) out[d.category] = (out[d.category] ?? 0) + amt;
  }
  return out;
}

// Aporte por persona (cuánto pagó cada usuario) en un rango.
export function contributionByUser(
  payments: Payment[],
  lookback = 6
): Record<string, number> {
  const cur = currentPeriod();
  const out: Record<string, number> = {};
  for (const p of payments) {
    if (monthsBetween(p.period, cur) <= lookback) {
      out[p.paidById] = (out[p.paidById] ?? 0) + p.amount;
    }
  }
  return out;
}
