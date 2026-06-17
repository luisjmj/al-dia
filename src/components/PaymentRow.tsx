import { useState } from "react";
import { useStore } from "../store";
import type { Debt } from "../types";
import { expectedAmount, isSkippedInPeriod, paidInPeriod } from "../lib/finance";
import { formatCOP, slotLabel } from "../lib/format";
import { CategoryBadge } from "./ui";
import { Check, MinusCircle } from "lucide-react";

export default function PaymentRow({
  debt,
  period,
}: {
  debt: Debt;
  period: string;
}) {
  const { payments, togglePayment, skipPayment, users } = useStore();
  const isPaid = paidInPeriod(debt.id, period, payments) > 0;
  const isSkipped = !isPaid && isSkippedInPeriod(debt.id, period, payments);
  const payRecord = payments.find(
    (p) => p.debtId === debt.id && p.period === period && p.type !== "skipped"
  );
  const payer = users.find((u) => u.id === payRecord?.paidById);
  const suggested = expectedAmount(debt, period, payments) || debt.amount;
  // Etiqueta de vencimiento: fecha de la semana (semanal) o "día N" (mensual).
  const whenLabel = slotLabel(period) ?? `día ${debt.dueDay}`;

  const [draft, setDraft] = useState<string>(String(Math.round(suggested)));

  function toggle(amount?: number) {
    togglePayment(debt, period, amount);
  }

  function skip() {
    skipPayment(debt, period);
  }

  // --- Skipped ---
  if (isSkipped) {
    return (
      <div className="card p-3.5 flex items-center gap-3 opacity-60">
        <MinusCircle className="w-5 h-5 text-muted shrink-0" />
        <span
          className="w-1.5 h-9 rounded-full shrink-0"
          style={{ backgroundColor: debt.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate line-through text-muted">
            {debt.name}
          </div>
          <div className="text-xs text-muted">no se paga este mes</div>
        </div>
        <button
          onClick={skip}
          className="text-xs text-muted hover:text-text underline shrink-0"
        >
          deshacer
        </button>
      </div>
    );
  }

  // --- Gasto variable, aún sin pagar ---
  if (debt.variable && !isPaid) {
    return (
      <div className="card p-3.5 flex items-center gap-3 flex-wrap">
        <span
          className="w-1.5 h-9 rounded-full shrink-0"
          style={{ backgroundColor: debt.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{debt.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <CategoryBadge id={debt.category} />
            <span className="text-xs text-muted">variable · {whenLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
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
          <button
            onClick={skip}
            className="p-2 text-muted hover:text-amber-400 transition"
            title="No se paga este mes"
          >
            <MinusCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // --- Fijo o ya pagado ---
  return (
    <div
      className={`card p-3.5 flex items-center gap-3 ${isPaid ? "opacity-70" : ""}`}
    >
      <button
        onClick={() => toggle(debt.variable ? (payRecord?.amount ?? suggested) : suggested)}
        className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 border-2 transition ${
          isPaid ? "bg-emerald-500 border-emerald-500" : "border-border"
        }`}
      >
        {isPaid && <Check className="w-4 h-4 text-white" />}
      </button>

      <span
        className="w-1.5 h-9 rounded-full shrink-0"
        style={{ backgroundColor: debt.color }}
      />

      <div
        className="min-w-0 flex-1 cursor-pointer"
        onClick={() => toggle(debt.variable ? (payRecord?.amount ?? suggested) : suggested)}
      >
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
            <span className="text-xs text-muted">{whenLabel}</span>
          )}
        </div>
      </div>

      <div
        className="font-bold whitespace-nowrap cursor-pointer"
        onClick={() => toggle(debt.variable ? (payRecord?.amount ?? suggested) : suggested)}
      >
        {formatCOP(isPaid ? (payRecord?.amount ?? suggested) : suggested)}
      </div>

      {!isPaid && (
        <button
          onClick={skip}
          className="p-1.5 text-muted hover:text-amber-400 transition shrink-0"
          title="No se paga este mes"
        >
          <MinusCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
