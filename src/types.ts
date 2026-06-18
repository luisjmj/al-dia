// Modelos de datos de "Al Día"
// Diseñados para mapear 1:1 con tablas de Supabase cuando conectemos el backend.

export type DebtKind = "recurring" | "installments" | "one_time";
export type Frequency = "monthly" | "biweekly" | "weekly";

// Las categorías ahora son configurables (admin), por eso el id es texto libre
// (slug). Las 8 predeterminadas conservan sus slugs históricos.
export type CategoryId = string;

export interface Category {
  id: CategoryId; // slug estable usado por debts.category
  label: string;
  color: string; // hex
  icon: string; // lucide icon name
}

export interface User {
  id: string;
  name: string;
  email: string;
  color: string;
}

export interface Debt {
  id: string;
  name: string;
  amount: number; // valor de cada cuota/pago en COP
  kind: DebtKind;
  frequency: Frequency;
  category: CategoryId;
  dueDay: number; // día del mes (1-31)
  startDate: string; // ISO yyyy-mm-dd
  installmentsTotal?: number; // solo para "installments"
  principal?: number; // total financiado original (créditos a cuotas); fuente de verdad para amortización
  interestRate?: number; // % efectivo anual (E.A.) opcional; se convierte a mensual en lib/amortization
  variable?: boolean; // monto cambia cada mes (ej. servicios); `amount` es solo un estimado
  shared: boolean; // visible/pagable por la pareja
  ownerId: string;
  color: string;
  note?: string;
  url?: string; // enlace para "ir a pagar" (web del banco/servicio)
  noStartDate?: boolean; // solo recurring: siempre aplica (sin fecha de inicio)
  archived?: boolean;
  currency?: string; // código ISO de la moneda (null/undefined = moneda base del hogar)
}

// Un pago marcado en un mes concreto.
export interface Payment {
  id: string;
  debtId: string;
  period: string; // "yyyy-mm"
  amount: number; // monto pagado (permite pago parcial)
  paidById: string;
  paidAt: string; // ISO datetime
  type?: "cuota" | "abono" | "skipped"; // 'cuota' = pago regular; 'abono' = abono extra a capital; 'skipped' = no se paga este mes
}
