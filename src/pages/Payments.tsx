import { useMemo, useState } from "react";
import { useStore } from "../store";
import { isDebtActiveIn, totalExpected, totalPaid } from "../lib/finance";
import {
  addMonths,
  currentPeriod,
  formatCOP,
  periodLabel,
} from "../lib/format";
import { ProgressBar, EmptyState } from "../components/ui";
import PaymentRow from "../components/PaymentRow";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Payments() {
  const { debts, payments } = useStore();
  const [period, setPeriod] = useState(currentPeriod());

  const active = useMemo(
    () =>
      debts
        .filter((d) => isDebtActiveIn(d, period))
        .sort((a, b) => a.dueDay - b.dueDay),
    [debts, period]
  );

  const expected = totalExpected(active, period, payments);
  const paid = totalPaid(period, payments);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Pagos del mes</h1>

      {/* Selector de mes */}
      <div className="flex items-center justify-between card p-2.5">
        <button
          className="p-2 rounded-lg hover:bg-surface-2 text-muted"
          onClick={() => setPeriod((p) => addMonths(p, -1))}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="font-bold">{periodLabel(period)}</div>
          <div className="text-xs text-muted">
            {formatCOP(paid)} de {formatCOP(expected)}
          </div>
        </div>
        <button
          className="p-2 rounded-lg hover:bg-surface-2 text-muted disabled:opacity-30"
          onClick={() => setPeriod((p) => addMonths(p, 1))}
          disabled={period >= currentPeriod()}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <ProgressBar value={expected ? paid / expected : 0} color="#34d399" />

      {active.length === 0 ? (
        <EmptyState title="No hay deudas activas este mes" />
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((d) => (
            <PaymentRow key={d.id} debt={d} period={period} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted text-center">
        Toca una deuda para marcarla como pagada. En los gastos variables,
        escribe cuánto costó este mes.
      </p>
    </div>
  );
}
