import type { Category, Debt, Payment, User } from "../types";
import { addMonths, currentPeriod } from "./format";

// Paleta con tonos bien separados entre sí (turquesa, verde, ámbar, naranja,
// rosa, púrpura, azul, gris). Todos claros para que el texto oscuro contraste.
export const CATEGORIES: Category[] = [
  { id: "servicios", label: "Servicios", color: "#22d3ee", icon: "Zap" },
  { id: "tarjeta", label: "Tarjeta", color: "#f472b6", icon: "CreditCard" },
  { id: "prestamo", label: "Préstamo", color: "#fb923c", icon: "Landmark" },
  { id: "suscripcion", label: "Suscripción", color: "#c084fc", icon: "Repeat" },
  { id: "hogar", label: "Hogar", color: "#4ade80", icon: "Home" },
  { id: "carro", label: "Carro", color: "#60a5fa", icon: "Car" },
  { id: "personal", label: "Personal", color: "#fde047", icon: "User" },
  { id: "otro", label: "Otro", color: "#cbd5e1", icon: "Tag" },
];

export const categoryById = (id: string) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

// Usuarios de ejemplo (en Supabase vendrán de Auth).
export const SEED_USERS: User[] = [
  { id: "u_me", name: "Yo", email: "yo@aldia.app", color: "#8184f8" },
  { id: "u_pareja", name: "Pareja", email: "pareja@aldia.app", color: "#f472b6" },
];

const cur = currentPeriod();

export const SEED_DEBTS: Debt[] = [
  {
    id: "d_arriendo",
    name: "Arriendo",
    amount: 1_500_000,
    kind: "recurring",
    frequency: "monthly",
    category: "hogar",
    dueDay: 5,
    startDate: addMonths(cur, -8) + "-05",
    shared: true,
    ownerId: "u_me",
    color: "#34d399",
    note: "Apartamento",
  },
  {
    id: "d_luz",
    name: "Energía",
    amount: 180_000,
    kind: "recurring",
    frequency: "monthly",
    category: "servicios",
    dueDay: 15,
    startDate: addMonths(cur, -8) + "-15",
    variable: true,
    shared: true,
    ownerId: "u_me",
    color: "#38bdf8",
  },
  {
    id: "d_internet",
    name: "Internet + TV",
    amount: 120_000,
    kind: "recurring",
    frequency: "monthly",
    category: "servicios",
    dueDay: 20,
    startDate: addMonths(cur, -8) + "-20",
    shared: true,
    ownerId: "u_pareja",
    color: "#38bdf8",
  },
  {
    id: "d_netflix",
    name: "Netflix",
    amount: 44_900,
    kind: "recurring",
    frequency: "monthly",
    category: "suscripcion",
    dueDay: 12,
    startDate: addMonths(cur, -6) + "-12",
    shared: false,
    ownerId: "u_me",
    color: "#a78bfa",
  },
  {
    id: "d_carro",
    name: "Crédito carro",
    amount: 850_000,
    kind: "installments",
    frequency: "monthly",
    category: "prestamo",
    dueDay: 10,
    startDate: addMonths(cur, -5) + "-10",
    installmentsTotal: 24,
    interestRate: 1.2,
    shared: true,
    ownerId: "u_me",
    color: "#fb923c",
    note: "24 cuotas",
  },
  {
    id: "d_tarjeta",
    name: "Tarjeta Visa",
    amount: 320_000,
    kind: "installments",
    frequency: "monthly",
    category: "tarjeta",
    dueDay: 25,
    startDate: addMonths(cur, -3) + "-25",
    installmentsTotal: 6,
    shared: false,
    ownerId: "u_pareja",
    color: "#f472b6",
    note: "Compra electrodomésticos",
  },
  {
    id: "d_gym",
    name: "Gimnasio",
    amount: 95_000,
    kind: "recurring",
    frequency: "monthly",
    category: "personal",
    dueDay: 1,
    startDate: addMonths(cur, -4) + "-01",
    shared: false,
    ownerId: "u_me",
    color: "#facc15",
  },
];

// Genera pagos históricos realistas para los meses pasados (no el actual).
export function buildSeedPayments(): Payment[] {
  const payments: Payment[] = [];
  let n = 0;
  for (let i = 6; i >= 1; i--) {
    const period = addMonths(cur, -i);
    for (const d of SEED_DEBTS) {
      const startPeriod = d.startDate.slice(0, 7);
      if (period < startPeriod) continue;
      if (d.kind === "one_time" && period !== startPeriod) continue;
      // pequeña variación para que el histórico no sea plano
      const jitter = d.category === "servicios" ? 0.9 + Math.random() * 0.25 : 1;
      payments.push({
        id: `p_${n++}`,
        debtId: d.id,
        period,
        amount: Math.round(d.amount * jitter),
        paidById: d.ownerId,
        paidAt: `${period}-${String(d.dueDay).padStart(2, "0")}T10:00:00`,
      });
    }
  }
  return payments;
}
