import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Debt, Payment, User } from "./types";
import { SEED_USERS, SEED_DEBTS, buildSeedPayments } from "./lib/seed";
import { paidInPeriod, expectedAmount } from "./lib/finance";
import { addMonths } from "./lib/format";

const KEY = "aldia.v1";

interface Persisted {
  debts: Debt[];
  payments: Payment[];
  currentUserId: string;
  theme: "dark" | "light";
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {
    debts: SEED_DEBTS,
    payments: buildSeedPayments(),
    currentUserId: "u_me",
    theme: "dark",
  };
}

export interface Store {
  backend: "local" | "supabase";
  loading: boolean;
  users: User[];
  currentUser: User;
  currentUserId: string;
  debts: Debt[];
  payments: Payment[];
  theme: "dark" | "light";
  // acciones
  setCurrentUser: (id: string) => void;
  toggleTheme: () => void;
  // prepaidMonths: cuántos meses (desde el inicio) registrar ya como pagados
  addDebt: (d: Omit<Debt, "id">, prepaidMonths?: number) => void;
  updateDebt: (d: Debt) => void;
  archiveDebt: (id: string) => void;
  unarchiveDebt: (id: string) => void;
  deleteDebt: (id: string) => void;
  // marcar / desmarcar pago del mes (toggle) con monto opcional (pago parcial)
  togglePayment: (debt: Debt, period: string, amount?: number) => void;
  // abono extra a capital en una deuda a cuotas
  abonarCapital: (debt: Debt, amount: number) => void;
  resetData: () => void;
  // solo modo supabase (opcionales)
  household?: { id: string; name: string; inviteCode: string };
  signOut?: () => void;
  joinHousehold?: (code: string) => Promise<void>;
}

export const Ctx = createContext<Store | null>(null);

// El tema es preferencia del dispositivo: se guarda local en ambos modos.
const THEME_KEY = "aldia.theme";
export function loadTheme(): "dark" | "light" {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}
export function saveTheme(t: "dark" | "light") {
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.theme === "dark");
  }, [state.theme]);

  const users = SEED_USERS;
  const currentUser =
    users.find((u) => u.id === state.currentUserId) ?? users[0];

  const api = useMemo<Store>(() => {
    return {
      backend: "local",
      loading: false,
      users,
      currentUser,
      currentUserId: state.currentUserId,
      debts: state.debts,
      payments: state.payments,
      theme: state.theme,
      setCurrentUser: (id) =>
        setState((s) => ({ ...s, currentUserId: id })),
      toggleTheme: () =>
        setState((s) => ({
          ...s,
          theme: s.theme === "dark" ? "light" : "dark",
        })),
      addDebt: (d, prepaidMonths) =>
        setState((s) => {
          const id = `d_${crypto.randomUUID()}`;
          const extra: Payment[] = [];
          if (prepaidMonths && prepaidMonths > 0) {
            const startPeriod = d.startDate.slice(0, 7);
            for (let i = 0; i < prepaidMonths; i++) {
              extra.push({
                id: `p_${crypto.randomUUID()}`,
                debtId: id,
                period: addMonths(startPeriod, i),
                amount: d.amount,
                paidById: state.currentUserId,
                paidAt: new Date().toISOString(),
                type: "cuota",
              });
            }
          }
          return {
            ...s,
            debts: [...s.debts, { ...d, id }],
            payments: [...s.payments, ...extra],
          };
        }),
      updateDebt: (d) =>
        setState((s) => ({
          ...s,
          debts: s.debts.map((x) => (x.id === d.id ? d : x)),
        })),
      archiveDebt: (id) =>
        setState((s) => ({
          ...s,
          debts: s.debts.map((x) =>
            x.id === id ? { ...x, archived: true } : x
          ),
        })),
      unarchiveDebt: (id) =>
        setState((s) => ({
          ...s,
          debts: s.debts.map((x) =>
            x.id === id ? { ...x, archived: false } : x
          ),
        })),
      deleteDebt: (id) =>
        setState((s) => ({
          ...s,
          debts: s.debts.filter((x) => x.id !== id),
          payments: s.payments.filter((p) => p.debtId !== id),
        })),
      togglePayment: (debt, period, amount) =>
        setState((s) => {
          const already = paidInPeriod(debt.id, period, s.payments);
          if (already > 0) {
            // desmarcar: quitar pagos de ese periodo/deuda
            return {
              ...s,
              payments: s.payments.filter(
                (p) => !(p.debtId === debt.id && p.period === period)
              ),
            };
          }
          const pay: Payment = {
            id: `p_${crypto.randomUUID()}`,
            debtId: debt.id,
            period,
            amount: amount ?? expectedAmount(debt, period),
            paidById: state.currentUserId,
            paidAt: new Date().toISOString(),
            type: "cuota",
          };
          return { ...s, payments: [...s.payments, pay] };
        }),
      abonarCapital: (debt, amount) =>
        setState((s) => {
          const now = new Date();
          const period = `${now.getFullYear()}-${String(
            now.getMonth() + 1
          ).padStart(2, "0")}`;
          const pay: Payment = {
            id: `p_${crypto.randomUUID()}`,
            debtId: debt.id,
            period,
            amount,
            paidById: state.currentUserId,
            paidAt: now.toISOString(),
            type: "abono",
          };
          return { ...s, payments: [...s.payments, pay] };
        }),
      resetData: () =>
        setState({
          debts: SEED_DEBTS,
          payments: buildSeedPayments(),
          currentUserId: "u_me",
          theme: state.theme,
        }),
    };
  }, [state, currentUser, users]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore debe usarse dentro de StoreProvider");
  return ctx;
}

export const userById = (users: User[], id: string) =>
  users.find((u) => u.id === id);
