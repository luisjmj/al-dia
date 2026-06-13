import { useState } from "react";
import { useStore } from "../store";
import type { Debt } from "../types";
import { expectedAmount, paidInPeriod } from "../lib/finance";
import { formatCOP } from "../lib/format";
import { CategoryBadge } from "./ui";
import { Check } from "lucide-react";

// Fila de pago reutilizable (Pagos y Dashboard).
// Gastos fijos: toggle de un toque. Gastos variables sin pagar: campo de monto + ✓.
export default function PaymentRow({
  debt,
  period,
}: {
  debt: Debt;
  period: string;
}) {
  const { payments, togglePayment, users } = useStore();
  const isPaid = paidInPeriod(debt.id, period, payments) > 0;
  const payRecord = payments.find(
    (p) => p.debtId === debt.id && p.period === period
  );
  const payer = users.find((u) => u.id === payRecord?.paidById);
  const suggested = expectedAmount(debt, period, payments);

  const [draft, setDraft] = useState<string>(String(Math.round(suggested)));
  const paidAmount = payRecord?.amount ?? suggested;

  function toggle(amount?: number) {
    togglePayment(debt, period, amount);
  }

  // --- Gasto variable, aún sin pagar: pedir el monto real ---
  if (debt.variable && !isPaid) {
    return (
      <div className="card p-3.5 flex items-center gap-3">
        <span
          className="w-1.5 h-9 rounded-full shrink-0"
          style={{ backgroundColor: debt.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{debt.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <CategoryBadge id={debt.category} />
            <span className="text-xs text-muted">
              variable · día {debt.dueDay}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm">
              $
            </span>
            <input
              className="input !py-2 !pl-5 !pr-2 w-28 text-right font-semibold"
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <button
            className="btn-primary !px-3 !py-2"
            onClick={() => toggle(Number(draft) || 0)}
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // --- Fijo o ya pagado: toggle de una sola pulsación ---
  return (
    <button
      onClick={() => toggle(debt.variable ? paidAmount : suggested)}
      className={`card p-3.5 flex items-center gap-3 text-left transition w-full ${
        isPaid ? "opacity-70" : ""
      }`}
    >
      <span
        className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 border-2 transition ${
          isPaid ? "bg-emerald-500 border-emerald-500" : "border-border"
        }`}
      >
        {isPaid && <Check className="w-4 h-4 text-white" />}
      </span>

      <span
        className="w-1.5 h-9 rounded-full shrink-0"
        style={{ backgroundColor: debt.color }}
      />

      <div className="min-w-0 flex-1">
        <div
          className={`font-semibold truncate ${
            isPaid ? "line-through text-muted" : ""
          }`}
        >
          {debt.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <CategoryBadge id={debt.category} />
          {isPaid && payer && (
            <span
              className="text-xs font-medium"
              style={{ color: payer.color }}
            >
              pagó {payer.name}
            </span>
          )}
          {!isPaid && (
            <span className="text-xs text-muted">día {debt.dueDay}</span>
          )}
        </div>
      </div>

      <div className="font-bold whitespace-nowrap">
        {formatCOP(isPaid ? paidAmount : suggested)}
      </div>
    </button>
  );
}
