// Modelos de datos de "Al Día"
// Diseñados para mapear 1:1 con tablas de Supabase cuando conectemos el backend.

export type DebtKind = "recurring" | "installments" | "one_time";
export type Frequency = "monthly" | "biweekly" | "weekly";

export type CategoryId =
  | "servicios"
  | "tarjeta"
  | "prestamo"
  | "suscripcion"
  | "hogar"
  | "personal"
  | "otro";

export interface Category {
  id: CategoryId;
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
  interestRate?: number; // % mensual opcional
  variable?: boolean; // monto cambia cada mes (ej. servicios); `amount` es solo un estimado
  shared: boolean; // visible/pagable por la pareja
  ownerId: string;
  color: string;
  note?: string;
  archived?: boolean;
}

// Un pago marcado en un mes concreto.
export interface Payment {
  id: string;
  debtId: string;
  period: string; // "yyyy-mm"
  amount: number; // monto pagado (permite pago parcial)
  paidById: string;
  paidAt: string; // ISO datetime
  type?: "cuota" | "abono"; // 'cuota' = pago regular; 'abono' = abono extra a capital
}
