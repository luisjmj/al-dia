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
  addDebt: (d: Omit<Debt, "id">) => void;
  updateDebt: (d: Debt) => void;
  archiveDebt: (id: string) => void;
  // marcar / desmarcar pago del mes (toggle) con monto opcional (pago parcial)
  togglePayment: (debt: Debt, period: string, amount?: number) => void;
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
      addDebt: (d) =>
        setState((s) => ({
          ...s,
          debts: [...s.debts, { ...d, id: `d_${crypto.randomUUID()}` }],
        })),
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
