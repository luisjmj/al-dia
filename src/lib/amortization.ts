// Motor de amortización para deudas a cuotas (sistema francés: cuota fija).
// `debt.amount` = valor de la cuota; `debt.interestRate` = % efectivo anual (E.A.).
// Calcula capital original, desglose interés/capital por cuota, saldo y
// el efecto de abonos a capital (reducción de número de cuotas).
import type { Debt, Payment } from "../types";
import { addMonths } from "./format";

export interface ScheduleRow {
  n: number | null; // número de cuota (null para abonos extra)
  period: string; // yyyy-mm
  type: "cuota" | "abono";
  payment: number; // monto del pago
  interest: number; // parte de interés
  principal: number; // parte de capital (abono a capital)
  balance: number; // saldo después del pago
  paid: boolean; // pagado real (true) o proyectado (false)
}

export interface Amortization {
  principal: number; // capital original del préstamo
  cuota: number; // valor de la cuota
  rate: number; // tasa mensual (decimal)
  rows: ScheduleRow[];
  paidCount: number; // cuotas pagadas
  totalCuotas: number; // total de cuotas efectivas (puede bajar con abonos)
  balance: number; // saldo pendiente actual
  remaining: number; // cuotas que faltan
  totalInterest: number; // interés total del crédito (real + proyectado)
  interestPaid: number; // interés ya pagado
  totalToPay: number; // suma de todos los pagos (capital + interés)
}

// Capital original a partir de la cuota fija (anualidad).
export function principalFromCuota(
  cuota: number,
  i: number,
  n: number
): number {
  if (n <= 0) return 0;
  if (i <= 0) return cuota * n;
  return (cuota * (1 - Math.pow(1 + i, -n))) / i;
}

// Simula el pago de un saldo a cuota fija: cuántas cuotas faltan y cuánto interés.
export function payoff(
  balance: number,
  i: number,
  cuota: number
): { count: number; totalInterest: number; totalPaid: number } {
  if (balance <= 0) return { count: 0, totalInterest: 0, totalPaid: 0 };
  if (i <= 0) {
    const count = Math.ceil(balance / cuota);
    return { count, totalInterest: 0, totalPaid: balance };
  }
  // si la cuota no cubre el primer interés, nunca se paga
  if (cuota <= balance * i) {
    return { count: Infinity, totalInterest: Infinity, totalPaid: Infinity };
  }
  let bal = balance;
  let count = 0;
  let interest = 0;
  let paid = 0;
  while (bal > 0.01 && count < 1000) {
    const int = bal * i;
    let principal = cuota - int;
    if (principal > bal) principal = bal;
    interest += int;
    paid += principal + int;
    bal -= principal;
    count++;
  }
  return { count, totalInterest: interest, totalPaid: paid };
}

// Convierte una tasa efectiva anual (E.A., en %) a tasa mensual (decimal).
export function eaToMonthly(eaPercent: number): number {
  if (!eaPercent || eaPercent <= 0) return 0;
  return Math.pow(1 + eaPercent / 100, 1 / 12) - 1;
}

// Plan de pagos de un crédito SEMANAL/QUINCENAL: cuota fija por semana, sin
// interés (el monto es directo). Una fila por cuota, con la fecha de esa semana.
function buildWeeklySchedule(debt: Debt, payments: Payment[]): Amortization {
  const cuota = debt.amount;
  const n = debt.installmentsTotal ?? 0;
  const step = debt.frequency === "weekly" ? 7 : 14;

  const pad = (x: number) => String(x).padStart(2, "0");
  const isoD = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const [Y, M, D] = debt.startDate.split("-").map(Number);
  const anchor = new Date(Y, M - 1, D);
  anchor.setDate(anchor.getDate() + ((debt.dueDay - anchor.getDay() + 7) % 7));

  const paidPeriods = new Set(
    payments
      .filter((p) => p.debtId === debt.id && (p.type ?? "cuota") === "cuota")
      .map((p) => p.period)
  );
  const abonos = payments.filter(
    (p) => p.debtId === debt.id && p.type === "abono"
  );
  const abonoTotal = abonos.reduce((s, p) => s + p.amount, 0);

  const principal = cuota * n; // total a pagar (sin interés)
  let balance = principal;
  const rows: ScheduleRow[] = [];
  let paidCount = 0;

  for (let k = 0; k < n; k++) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + k * step);
    const period = isoD(d);
    const paid = paidPeriods.has(period);
    const cap = Math.min(cuota, balance);
    balance = Math.max(0, balance - cap);
    if (paid) paidCount++;
    rows.push({
      n: k + 1,
      period,
      type: "cuota",
      payment: cuota,
      interest: 0,
      principal: cap,
      balance,
      paid,
    });
  }
  for (const ab of abonos) {
    const cap = Math.min(ab.amount, balance);
    balance = Math.max(0, balance - cap);
    rows.push({
      n: null,
      period: ab.period,
      type: "abono",
      payment: ab.amount,
      interest: 0,
      principal: cap,
      balance,
      paid: true,
    });
  }

  const currentBalance = Math.max(0, principal - paidCount * cuota - abonoTotal);
  const remaining = rows.filter((r) => !r.paid && r.type === "cuota").length;
  return {
    principal,
    cuota,
    rate: 0,
    rows,
    paidCount,
    totalCuotas: n,
    balance: currentBalance,
    remaining,
    totalInterest: 0,
    interestPaid: 0,
    totalToPay: principal,
  };
}

export function buildAmortization(debt: Debt, payments: Payment[]): Amortization {
  // Semanal / quincenal: plan por semanas, sin interés.
  if (
    (debt.frequency === "weekly" || debt.frequency === "biweekly") &&
    debt.kind !== "one_time"
  ) {
    return buildWeeklySchedule(debt, payments);
  }

  const i = eaToMonthly(debt.interestRate ?? 0);
  const cuota = debt.amount;
  const n = debt.installmentsTotal ?? 0;
  // El total original es la fuente de verdad. Para deudas viejas sin `principal`,
  // se reconstruye desde la cuota.
  const principal = debt.principal ?? principalFromCuota(cuota, i, n);

  // eventos pagados reales, ordenados por periodo (cuota antes que abono en el mismo mes)
  const events = payments
    .filter((p) => p.debtId === debt.id)
    .slice()
    .sort((a, b) => {
      if (a.period !== b.period) return a.period < b.period ? -1 : 1;
      const ta = a.type === "abono" ? 1 : 0;
      const tb = b.type === "abono" ? 1 : 0;
      return ta - tb;
    });

  const rows: ScheduleRow[] = [];
  let balance = principal;
  let cuotaNum = 0;
  let interestPaid = 0;
  let lastCuotaPeriod: string | null = null;

  for (const p of events) {
    if (balance <= 0.01) break;
    if (p.type === "abono") {
      const cap = Math.min(p.amount, balance);
      balance -= cap;
      rows.push({
        n: null,
        period: p.period,
        type: "abono",
        payment: p.amount,
        interest: 0,
        principal: cap,
        balance: Math.max(0, balance),
        paid: true,
      });
    } else {
      cuotaNum++;
      const interest = balance * i;
      let cap = p.amount - interest;
      if (cap > balance) cap = balance;
      if (cap < 0) cap = 0;
      balance -= cap;
      interestPaid += interest;
      lastCuotaPeriod = p.period;
      rows.push({
        n: cuotaNum,
        period: p.period,
        type: "cuota",
        payment: p.amount,
        interest,
        principal: cap,
        balance: Math.max(0, balance),
        paid: true,
      });
    }
  }

  const paidCount = cuotaNum;
  const currentBalance = Math.max(0, balance);

  // proyección de las cuotas restantes
  let projPeriod = lastCuotaPeriod
    ? addMonths(lastCuotaPeriod, 1)
    : debt.startDate.slice(0, 7);
  let guard = 0;
  while (balance > 0.01 && guard < 1000) {
    const interest = balance * i;
    let cap = cuota - interest;
    if (cap <= 0) break; // cuota no cubre interés
    if (cap > balance) cap = balance;
    const pay = cap + interest;
    balance -= cap;
    cuotaNum++;
    rows.push({
      n: cuotaNum,
      period: projPeriod,
      type: "cuota",
      payment: pay,
      interest,
      principal: cap,
      balance: Math.max(0, balance),
      paid: false,
    });
    projPeriod = addMonths(projPeriod, 1);
    guard++;
  }

  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const totalToPay = rows.reduce((s, r) => s + r.payment, 0);
  const remaining = rows.filter((r) => !r.paid && r.type === "cuota").length;

  return {
    principal,
    cuota,
    rate: i,
    rows,
    paidCount,
    totalCuotas: paidCount + remaining,
    balance: currentBalance,
    remaining,
    totalInterest,
    interestPaid,
    totalToPay,
  };
}

// Modalidad 1: abono a capital MANTENIENDO la cuota → se reduce el nº de cuotas.
export function previewAbono(
  balance: number,
  i: number,
  cuota: number,
  abono: number
): {
  cuotasAntes: number;
  cuotasDespues: number;
  cuotasReducidas: number;
  ahorroInteres: number;
  nuevoSaldo: number;
} {
  const antes = payoff(balance, i, cuota);
  const nuevoSaldo = Math.max(0, balance - abono);
  const despues = payoff(nuevoSaldo, i, cuota);
  return {
    cuotasAntes: antes.count,
    cuotasDespues: despues.count,
    cuotasReducidas: antes.count - despues.count,
    ahorroInteres: antes.totalInterest - despues.totalInterest,
    nuevoSaldo,
  };
}

// Modalidad 2: abono a capital MANTENIENDO el nº de cuotas → se reduce la cuota.
export function previewReducirCuota(
  balance: number,
  i: number,
  remaining: number,
  cuotaActual: number,
  abono: number
): {
  cuotaAntes: number;
  cuotaDespues: number;
  reduccionCuota: number;
  ahorroInteres: number;
  nuevoSaldo: number;
} {
  const nuevoSaldo = Math.max(0, balance - abono);
  const nuevaCuota =
    remaining > 0
      ? i > 0
        ? (nuevoSaldo * i) / (1 - Math.pow(1 + i, -remaining))
        : nuevoSaldo / remaining
      : 0;
  const interesAntes = payoff(balance, i, cuotaActual).totalInterest;
  const interesDespues = payoff(nuevoSaldo, i, nuevaCuota).totalInterest;
  return {
    cuotaAntes: cuotaActual,
    cuotaDespues: nuevaCuota,
    reduccionCuota: cuotaActual - nuevaCuota,
    ahorroInteres: interesAntes - interesDespues,
    nuevoSaldo,
  };
}
