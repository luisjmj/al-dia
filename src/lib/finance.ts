import type { Debt, Payment } from "../types";
import { addMonths, currentPeriod, monthsBetween } from "./format";

// ¿La deuda está vigente (genera cobro) en este periodo?
export function isDebtActiveIn(debt: Debt, period: string): boolean {
  if (debt.archived) return false;
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

  // Cuotas: la cuota es fija (el interés va dentro de ella, ver lib/amortization).
  let base = debt.amount;
  if (debt.frequency === "biweekly") base = debt.amount * 2;
  if (debt.frequency === "weekly") base = debt.amount * 4;
  return base;
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

// Total esperado del mes (suma de todas las deudas activas).
export function totalExpected(
  debts: Debt[],
  period: string,
  payments?: Payment[]
): number {
  return debts.reduce((s, d) => s + expectedAmount(d, period, payments), 0);
}

// Total pagado en el mes.
export function totalPaid(period: string, payments: Payment[]): number {
  return payments
    .filter((p) => p.period === period)
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
    .reduce((s, d) => s + expectedAmount(d, cur), 0);
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
