import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Debt, Payment, User } from "./types";
import { Ctx, type Store, loadTheme, saveTheme } from "./store";
import { useAuth } from "./auth";
import * as repo from "./lib/repo";
import { paidInPeriod, expectedAmount } from "./lib/finance";
import { currentPeriod } from "./lib/format";

export function SupabaseStoreProvider({ children }: { children: ReactNode }) {
  const { userId, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<repo.Household | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">(loadTheme);

  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const h = await repo.getActiveHousehold(userId);
      setHousehold(h);
      const [m, d, p] = await Promise.all([
        repo.getMembers(h.id),
        repo.getDebts(),
        repo.getPayments(),
      ]);
      setUsers(m);
      setDebts(d);
      setPayments(p);
    } catch (e) {
      console.error("Error cargando datos:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentUser: User =
    users.find((u) => u.id === userId) ??
    ({ id: userId ?? "", name: "Yo", email: "", color: "#8184f8" } as User);

  const api = useMemo<Store>(() => {
    return {
      backend: "supabase",
      loading,
      users,
      currentUser,
      currentUserId: userId ?? "",
      debts,
      payments,
      theme,
      household: household
        ? { id: household.id, name: household.name, inviteCode: household.inviteCode }
        : undefined,
      setCurrentUser: () => {}, // en modo nube eres tú; no aplica
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      addDebt: async (d) => {
        if (!household) return;
        const created = await repo.insertDebt(d, household.id);
        setDebts((xs) => [...xs, created]);
      },
      updateDebt: async (d) => {
        if (!household) return;
        const updated = await repo.updateDebt(d, household.id);
        setDebts((xs) => xs.map((x) => (x.id === d.id ? updated : x)));
      },
      archiveDebt: async (id) => {
        await repo.archiveDebt(id);
        setDebts((xs) => xs.map((x) => (x.id === id ? { ...x, archived: true } : x)));
      },
      togglePayment: async (debt, period, amount) => {
        if (!household || !userId) return;
        const already = paidInPeriod(debt.id, period, payments);
        if (already > 0) {
          await repo.deletePayment(debt.id, period);
          setPayments((xs) =>
            xs.filter((p) => !(p.debtId === debt.id && p.period === period))
          );
        } else {
          const amt = amount ?? expectedAmount(debt, period);
          const created = await repo.insertPayment(
            debt.id,
            household.id,
            period,
            amt,
            userId
          );
          setPayments((xs) => [...xs, created]);
        }
      },
      abonarCapital: async (debt, amount) => {
        if (!household || !userId) return;
        const period = currentPeriod();
        const created = await repo.insertPayment(
          debt.id,
          household.id,
          period,
          amount,
          userId,
          "abono"
        );
        setPayments((xs) => [...xs, created]);
      },
      resetData: () => refresh(),
      signOut,
      joinHousehold: async (code: string) => {
        await repo.joinHousehold(code);
        await refresh();
      },
    };
  }, [loading, users, currentUser, userId, debts, payments, theme, household, refresh, signOut]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
