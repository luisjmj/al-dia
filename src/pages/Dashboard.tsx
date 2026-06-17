import { useMemo, useState } from "react";
import { useStore } from "../store";
import {
  totalExpected,
  totalPaid,
  isDebtActiveIn,
  paidInPeriod,
  isSkippedInPeriod,
  projectNextMonths,
  slotsForDebtInMonth,
  slotDateOf,
} from "../lib/finance";
import { currentPeriod, formatCOP, periodLabel } from "../lib/format";
import { StatCard, ProgressBar } from "../components/ui";
import DebtForm from "../components/DebtForm";
import PaymentRow from "../components/PaymentRow";
import {
  Wallet,
  CheckCircle2,
  Clock,
  TrendingUp,
  Plus,
  CalendarClock,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { debts, payments } = useStore();
  const [open, setOpen] = useState(false);
  const period = currentPeriod();

  const active = useMemo(
    () => debts.filter((d) => isDebtActiveIn(d, period)),
    [debts, period]
  );
  const expected = totalExpected(active, period, payments);
  const paid = totalPaid(period, payments);
  const pending = Math.max(0, expected - paid);
  const ratio = expected ? paid / expected : 0;

  const nextMonth = useMemo(
    () => projectNextMonths(debts, payments, 1)[0],
    [debts, payments]
  );
  const projNext = nextMonth?.total ?? 0;

  // Próximas a vencer (no pagadas), ordenadas por fecha. Las deudas
  // semanales/quincenales se expanden en una fila por semana pendiente.
  const upcoming = useMemo(() => {
    const slots: { debt: (typeof active)[number]; period: string }[] = [];
    for (const d of active) {
      for (const sp of slotsForDebtInMonth(d, period, payments)) {
        if (
          paidInPeriod(d.id, sp, payments) === 0 &&
          !isSkippedInPeriod(d.id, sp, payments)
        ) {
          slots.push({ debt: d, period: sp });
        }
      }
    }
    return slots
      .sort((a, b) =>
        slotDateOf(a.debt, a.period).localeCompare(
          slotDateOf(b.debt, b.period)
        )
      )
      .slice(0, 5);
  }, [active, payments, period]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Hola 👋</h1>
          <p className="text-muted">{periodLabel(period)}</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="w-4.5 h-4.5" /> Nueva
        </button>
      </div>

      {/* Resumen del mes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="A pagar este mes"
          value={formatCOP(expected)}
          icon={<Wallet className="w-4.5 h-4.5" />}
          accent="#8184f8"
        />
        <StatCard
          label="Ya pagado"
          value={formatCOP(paid)}
          icon={<CheckCircle2 className="w-4.5 h-4.5" />}
          accent="#34d399"
        />
        <StatCard
          label="Pendiente"
          value={formatCOP(pending)}
          icon={<Clock className="w-4.5 h-4.5" />}
          accent="#fb923c"
        />
        <StatCard
          label="Proyección próx. mes"
          value={formatCOP(projNext)}
          icon={<TrendingUp className="w-4.5 h-4.5" />}
          accent="#38bdf8"
        />
      </div>

      {/* Progreso del mes */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold">Progreso del mes</span>
          <span className="text-sm text-muted">
            {Math.round(ratio * 100)}% pagado
          </span>
        </div>
        <ProgressBar value={ratio} color="#34d399" />
        <div className="flex justify-between mt-2 text-sm text-muted">
          <span>{formatCOP(paid)}</span>
          <span>{formatCOP(expected)}</span>
        </div>
      </div>

      {/* Próximas a vencer */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-muted" /> Por pagar
          </h2>
          <Link to="/pagos" className="text-sm text-brand font-medium">
            Ver todas
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="card p-6 text-center text-muted">
            ¡Todo pagado este mes! 🎉
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((r) => (
              <PaymentRow
                key={`${r.debt.id}:${r.period}`}
                debt={r.debt}
                period={r.period}
              />
            ))}
          </div>
        )}
      </div>

      {open && <DebtForm open onClose={() => setOpen(false)} />}
    </div>
  );
}
