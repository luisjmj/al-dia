import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Category, Debt, Payment, User } from "./types";
import { Ctx, type Store, loadTheme, saveTheme } from "./store";
import { CATEGORIES } from "./lib/seed";
import { useAuth } from "./auth";
import * as repo from "./lib/repo";
import { paidInPeriod, expectedAmount } from "./lib/finance";
import { currentPeriod, addMonths } from "./lib/format";
import { useActiveCurrency } from "./lib/currency";

export function SupabaseStoreProvider({ children }: { children: ReactNode }) {
  const { userId, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<repo.Household | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [currencies, setCurrencies] = useState<string[]>(["COP"]);
  const [theme, setTheme] = useState<"dark" | "light">(loadTheme);
  const [activeCurrency, setActiveCurrencyProfile] = useActiveCurrency(currencies);
  const base = currencies[0];
  const multi = currencies.length > 1;

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
      // monedas habilitadas del hogar (compartidas); cae a ["COP"] sin migración 009
      setCurrencies(await repo.getHouseholdCurrencies(h.id));
      // categorías: si la tabla aún no existe (migración pendiente), usamos las predeterminadas
      try {
        const cats = await repo.getCategories(h.id);
        if (cats.length) setCategories(cats);
      } catch {
        setCategories(CATEGORIES);
      }
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
    // En multi-moneda cada perfil ve solo sus deudas/pagos (nada se unifica).
    const currencyOf = (d: Debt) => d.currency ?? base;
    const debtCur = new Map(debts.map((d) => [d.id, currencyOf(d)]));
    const scopedDebts = multi
      ? debts.filter((d) => currencyOf(d) === activeCurrency)
      : debts;
    const scopedPayments = multi
      ? payments.filter(
          (p) => (debtCur.get(p.debtId) ?? base) === activeCurrency
        )
      : payments;
    // Persiste la lista de monedas en el hogar (sincroniza con la pareja).
    const saveCurrencies = (list: string[]) => {
      setCurrencies(list);
      if (household) repo.updateHouseholdCurrencies(household.id, list).catch(
        (e) => console.error("No se pudo guardar monedas:", e)
      );
    };
    return {
      backend: "supabase",
      loading,
      users,
      currentUser,
      currentUserId: userId ?? "",
      debts: scopedDebts,
      payments: scopedPayments,
      categories,
      theme,
      currencies,
      activeCurrency,
      setActiveCurrencyProfile,
      setSingleCurrency: (code) => saveCurrencies([code]),
      addCurrency: (code) =>
        saveCurrencies(
          currencies.includes(code) ? currencies : [...currencies, code]
        ),
      removeCurrency: (code) =>
        currencies.length <= 1
          ? undefined
          : saveCurrencies(currencies.filter((c) => c !== code)),
      household: household
        ? { id: household.id, name: household.name, inviteCode: household.inviteCode }
        : undefined,
      setCurrentUser: () => {}, // en modo nube eres tú; no aplica
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      addCategory: async (cat) => {
        if (!household) return;
        await repo.insertCategory(household.id, cat, categories.length);
        setCategories((cs) => [...cs, cat]);
      },
      updateCategory: async (cat) => {
        if (!household) return;
        await repo.updateCategory(household.id, cat);
        setCategories((cs) => cs.map((c) => (c.id === cat.id ? cat : c)));
      },
      deleteCategory: async (slug) => {
        if (!household) return;
        await repo.deleteCategory(household.id, slug);
        setCategories((cs) => cs.filter((c) => c.id !== slug));
      },
      addDebt: async (d, prepaidMonths) => {
        if (!household) return;
        const created = await repo.insertDebt(
          { ...d, currency: activeCurrency !== base ? activeCurrency : undefined },
          household.id
        );
        setDebts((xs) => [...xs, created]);
        // registrar meses pasados ya pagados
        if (prepaidMonths && prepaidMonths > 0 && userId) {
          const startPeriod = d.startDate.slice(0, 7);
          const nuevos = await Promise.all(
            Array.from({ length: prepaidMonths }, (_, i) =>
              repo.insertPayment(
                created.id,
                household.id,
                addMonths(startPeriod, i),
                created.amount,
                userId,
                "cuota"
              )
            )
          );
          setPayments((ps) => [...ps, ...nuevos]);
        }
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
      unarchiveDebt: async (id) => {
        await repo.unarchiveDebt(id);
        setDebts((xs) => xs.map((x) => (x.id === id ? { ...x, archived: false } : x)));
      },
      deleteDebt: async (id) => {
        await repo.deleteDebt(id);
        setDebts((xs) => xs.filter((x) => x.id !== id));
        setPayments((ps) => ps.filter((p) => p.debtId !== id));
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
          // limpiar skip si existía
          const hasSkip = payments.some(
            (p) => p.debtId === debt.id && p.period === period && p.type === "skipped"
          );
          if (hasSkip) {
            await repo.deletePayment(debt.id, period);
            setPayments((xs) =>
              xs.filter((p) => !(p.debtId === debt.id && p.period === period))
            );
          }
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
      skipPayment: async (debt, period) => {
        if (!household || !userId) return;
        const alreadySkipped = payments.some(
          (p) => p.debtId === debt.id && p.period === period && p.type === "skipped"
        );
        if (alreadySkipped) {
          await repo.deletePayment(debt.id, period);
          setPayments((xs) =>
            xs.filter((p) => !(p.debtId === debt.id && p.period === period && p.type === "skipped"))
          );
        } else {
          const created = await repo.insertPayment(
            debt.id,
            household.id,
            period,
            0,
            userId,
            "skipped"
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
  }, [loading, users, currentUser, userId, debts, payments, categories, theme, household, refresh, signOut, currencies, activeCurrency, base, multi, setActiveCurrencyProfile]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
