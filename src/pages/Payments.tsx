import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { isDebtActiveIn, paidInPeriod, isSkippedInPeriod, totalPaid, expectedAmount } from "../lib/finance";
import {
  addMonths,
  currentPeriod,
  formatCOP,
  periodLabel,
} from "../lib/format";
import { ProgressBar, EmptyState } from "../components/ui";
import PaymentRow from "../components/PaymentRow";
import { ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";

export default function Payments() {
  const { debts, payments } = useStore();
  const [period, setPeriod] = useState(currentPeriod());
  // en meses pasados se puede "generar" para incluir todas las deudas
  const [generated, setGenerated] = useState(false);

  // al cambiar de mes, se vuelve a ocultar lo generado
  useEffect(() => setGenerated(false), [period]);

  const isPast = period < currentPeriod();

  // deudas que se muestran normalmente: activas ese mes, o con pago ya hecho ese mes
  const base = useMemo(
    () =>
      debts.filter(
        (d) =>
          !d.archived &&
          (isDebtActiveIn(d, period) ||
            paidInPeriod(d.id, period, payments) > 0 ||
            isSkippedInPeriod(d.id, period, payments))
      ),
    [debts, period, payments]
  );

  // deudas que existen pero no aplican ese mes (ej. creadas después) y aún sin pago
  const extra = useMemo(
    () =>
      debts.filter(
        (d) =>
          !d.archived &&
          !isDebtActiveIn(d, period) &&
          paidInPeriod(d.id, period, payments) === 0
      ),
    [debts, period, payments]
  );

  const shown = useMemo(
    () =>
      [...(generated ? [...base, ...extra] : base)].sort(
        (a, b) => a.dueDay - b.dueDay
      ),
    [base, extra, generated]
  );

  const expected = shown.reduce(
    (s, d) =>
      isSkippedInPeriod(d.id, period, payments)
        ? s
        : s + (expectedAmount(d, period, payments) || d.amount),
    0
  );
  const paid = totalPaid(period, payments);
  const canGenerate = isPast && !generated && extra.length > 0;

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

      {shown.length === 0 && !canGenerate ? (
        <EmptyState title="No hay deudas para este mes" />
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((d) => (
            <PaymentRow key={d.id} debt={d} period={period} />
          ))}
        </div>
      )}

      {/* Generar pagos de un mes pasado */}
      {canGenerate && (
        <button
          onClick={() => setGenerated(true)}
          className="btn-ghost w-full !py-3"
        >
          <CalendarPlus className="w-4.5 h-4.5" />
          Generar pagos para este mes
          <span className="text-muted font-normal">({extra.length})</span>
        </button>
      )}

      <p className="text-xs text-muted text-center">
        {isPast
          ? "Marca las deudas que pagaste este mes. Usa “Generar pagos” para incluir las demás."
          : "Toca una deuda para marcarla como pagada. En los gastos variables, escribe cuánto costó este mes."}
      </p>
    </div>
  );
}
