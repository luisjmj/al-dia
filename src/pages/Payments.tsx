import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import {
  isDebtActiveIn,
  isSkippedInPeriod,
  paidInPeriod,
  totalPaid,
  expectedAmount,
  isSubMonthly,
  occurrencesInMonth,
  slotsForDebtInMonth,
  slotDateOf,
  weeklySlotVisible,
  isCompleted,
} from "../lib/finance";
import {
  addMonths,
  currentPeriod,
  formatCOP,
  monthOf,
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
  // las semanas futuras se ocultan por defecto (botón "Mostrar deudas semanales")
  const [showWeekly, setShowWeekly] = useState(false);

  // al cambiar de mes, se vuelve a ocultar lo generado y las semanas futuras
  useEffect(() => {
    setGenerated(false);
    setShowWeekly(false);
  }, [period]);

  const todayISO = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  const isPast = period < currentPeriod();
  const isFuture = period > currentPeriod();

  // ¿la deuda tiene algún pago/skip registrado en este mes?
  const hasActivity = (id: string) =>
    payments.some((p) => p.debtId === id && monthOf(p.period) === period);

  // Slots (filas) normales: deudas activas ese mes o con pago ese mes,
  // expandiendo las sub-mensuales en una fila por semana.
  const base = useMemo(
    () =>
      debts
        .filter(
          (d) =>
            !d.archived &&
            ((isDebtActiveIn(d, period) && !isCompleted(d, payments)) ||
              hasActivity(d.id))
        )
        .flatMap((d) =>
          slotsForDebtInMonth(d, period, payments).map((sp) => ({
            debt: d,
            period: sp,
          }))
        ),
    [debts, period, payments]
  );

  // Deudas que no aplican ese mes y sin pago: aparecen solo con "Generar pagos".
  const extraVisible = useMemo(
    () =>
      debts
        .filter(
          (d) =>
            !d.archived &&
            !isDebtActiveIn(d, period) &&
            !hasActivity(d.id) &&
            (d.noStartDate || d.startDate.slice(0, 7) <= currentPeriod())
        )
        .flatMap((d) => {
          // sub-mensual: una fila por semana del mes; mensual: el mes completo
          const slots = isSubMonthly(d)
            ? occurrencesInMonth(d, period)
            : [period];
          return slots.map((sp) => ({ debt: d, period: sp }));
        }),
    [debts, period]
  );

  const shown = useMemo(
    () =>
      [...(generated ? [...base, ...extraVisible] : base)].sort((a, b) =>
        slotDateOf(a.debt, a.period).localeCompare(slotDateOf(b.debt, b.period))
      ),
    [base, extraVisible, generated]
  );

  const expected = shown.reduce(
    (s, r) =>
      isSkippedInPeriod(r.debt.id, r.period, payments)
        ? s
        : s + (expectedAmount(r.debt, r.period, payments) || r.debt.amount),
    0
  );
  const paid = totalPaid(period, payments);
  const canGenerate = isPast && !generated && extraVisible.length > 0;

  // Semanas lejanas sin pagar: ocultas por defecto (la próxima ya se muestra
  // sola si faltan ≤7 días o la anterior está pagada).
  const isFutureWeekly = (r: { debt: (typeof debts)[number]; period: string }) =>
    isSubMonthly(r.debt) &&
    slotDateOf(r.debt, r.period) > todayISO &&
    !weeklySlotVisible(r.debt, r.period, payments) &&
    paidInPeriod(r.debt.id, r.period, payments) === 0 &&
    !isSkippedInPeriod(r.debt.id, r.period, payments);

  const hiddenWeekly = shown.filter(isFutureWeekly);
  const visible = showWeekly ? shown : shown.filter((r) => !isFutureWeekly(r));

  const hint = isPast
    ? 'Marca las deudas que pagaste este mes. Usa “Generar pagos” para incluir las demás.'
    : isFuture
      ? 'Puedes adelantar pagos para este mes antes de que llegue.'
      : 'Toca una deuda para marcarla como pagada. En los gastos variables, escribe cuánto costó este mes.';

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
          disabled={period >= addMonths(currentPeriod(), 3)}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <ProgressBar value={expected ? paid / expected : 0} color="#34d399" />

      {visible.length === 0 && hiddenWeekly.length === 0 && !canGenerate ? (
        <EmptyState title="No hay deudas para este mes" />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((r) => (
            <PaymentRow
              key={`${r.debt.id}:${r.period}`}
              debt={r.debt}
              period={r.period}
            />
          ))}
        </div>
      )}

      {/* Mostrar / ocultar semanas futuras */}
      {hiddenWeekly.length > 0 && (
        <button
          onClick={() => setShowWeekly((v) => !v)}
          className="btn-ghost w-full !py-3"
        >
          <CalendarPlus className="w-4.5 h-4.5" />
          {showWeekly ? "Ocultar semanas próximas" : "Mostrar deudas semanales"}
          {!showWeekly && (
            <span className="text-muted font-normal">({hiddenWeekly.length})</span>
          )}
        </button>
      )}

      {/* Generar pagos de un mes pasado */}
      {canGenerate && (
        <button
          onClick={() => setGenerated(true)}
          className="btn-ghost w-full !py-3"
        >
          <CalendarPlus className="w-4.5 h-4.5" />
          Generar pagos para este mes
          <span className="text-muted font-normal">({extraVisible.length})</span>
        </button>
      )}

      <p className="text-xs text-muted text-center">{hint}</p>
    </div>
  );
}
