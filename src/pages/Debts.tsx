import { useState } from "react";
import { useStore } from "../store";
import type { Debt } from "../types";
import {
  expectedAmount,
  installmentsPaid,
  isDebtActiveIn,
} from "../lib/finance";
import { currentPeriod, formatCOP } from "../lib/format";
import { CategoryBadge, ProgressBar, EmptyState } from "../components/ui";
import DebtForm from "../components/DebtForm";
import { Plus, Pencil, Archive, Users, Repeat, Coins } from "lucide-react";

export default function Debts() {
  const { debts, payments, archiveDebt, users } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const period = currentPeriod();

  const visible = debts.filter((d) => !d.archived);

  function edit(d: Debt) {
    setEditing(d);
    setOpen(true);
  }
  function create() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Mis deudas</h1>
        <button className="btn-primary" onClick={create}>
          <Plus className="w-4.5 h-4.5" /> Nueva
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Aún no tienes deudas"
          hint="Crea la primera con el botón “Nueva”."
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {visible.map((d) => {
            const owner = users.find((u) => u.id === d.ownerId);
            const active = isDebtActiveIn(d, period);
            const paidCount = installmentsPaid(d, payments);
            const total = d.installmentsTotal ?? 0;
            return (
              <div key={d.id} className="card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-2.5 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <div className="min-w-0">
                      <div className="font-bold truncate">{d.name}</div>
                      <div className="text-sm text-muted">
                        {formatCOP(expectedAmount(d, period) || d.amount)}
                        {d.kind === "recurring" && " / mes"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => edit(d)}
                      className="p-2 rounded-lg text-muted hover:bg-surface-2 hover:text-text"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => archiveDebt(d.id)}
                      className="p-2 rounded-lg text-muted hover:bg-surface-2 hover:text-text"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge id={d.category} />
                  {d.kind === "recurring" && (
                    <span className="chip bg-surface-2 text-muted">
                      <Repeat className="w-3.5 h-3.5" /> Recurrente
                    </span>
                  )}
                  {d.kind === "one_time" && (
                    <span className="chip bg-surface-2 text-muted">
                      <Coins className="w-3.5 h-3.5" /> Único
                    </span>
                  )}
                  {d.shared && (
                    <span className="chip bg-surface-2 text-muted">
                      <Users className="w-3.5 h-3.5" /> Compartida
                    </span>
                  )}
                  {!active && (
                    <span className="chip bg-surface-2 text-muted">
                      Finalizada
                    </span>
                  )}
                </div>

                {d.kind === "installments" && total > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>
                        Cuota {Math.min(paidCount + (active ? 1 : 0), total)}/
                        {total}
                      </span>
                      <span>{Math.round((paidCount / total) * 100)}%</span>
                    </div>
                    <ProgressBar value={paidCount / total} color={d.color} />
                  </div>
                )}

                <div className="text-xs text-muted">
                  Titular: {owner?.name ?? "—"} · vence día {d.dueDay}
                  {d.interestRate ? ` · ${d.interestRate}% mensual` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <DebtForm open onClose={() => setOpen(false)} editing={editing} />
      )}
    </div>
  );
}
