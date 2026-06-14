import { useState } from "react";
import { useStore } from "../store";
import type { Debt } from "../types";
import {
  expectedAmount,
  installmentsPaid,
  isDebtActiveIn,
} from "../lib/finance";
import { currentPeriod, formatCOP, externalUrl } from "../lib/format";
import { CategoryBadge, ProgressBar, EmptyState } from "../components/ui";
import DebtForm from "../components/DebtForm";
import InstallmentDetail from "../components/InstallmentDetail";
import ArchivedDebts from "../components/ArchivedDebts";
import {
  Plus,
  Pencil,
  Archive,
  Users,
  Repeat,
  Coins,
  ListTree,
  ExternalLink,
} from "lucide-react";

export default function Debts() {
  const { debts, payments, archiveDebt, users } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [detail, setDetail] = useState<Debt | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const period = currentPeriod();

  const visible = debts.filter((d) => !d.archived);
  const archivedCount = debts.filter((d) => d.archived).length;

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
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost !px-3"
            onClick={() => setShowArchived(true)}
            title="Deudas archivadas"
          >
            <Archive className="w-4.5 h-4.5" />
            {archivedCount > 0 && (
              <span className="text-xs font-bold">{archivedCount}</span>
            )}
          </button>
          <button className="btn-primary" onClick={create}>
            <Plus className="w-4.5 h-4.5" /> Nueva
          </button>
        </div>
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
            const notStarted = d.startDate.slice(0, 7) > period; // empieza en el futuro
            const finished = !active && !notStarted; // ya terminó (no es que no empezó)
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
                    {d.url && (
                      <a
                        href={externalUrl(d.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ir a pagar"
                        className="p-2 rounded-lg text-brand hover:bg-brand-soft"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
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
                  {notStarted && (
                    <span className="chip bg-surface-2 text-muted">
                      Programada
                    </span>
                  )}
                  {finished && (
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
                    <button
                      onClick={() => setDetail(d)}
                      className="mt-2.5 w-full btn-ghost !py-2 text-sm"
                    >
                      <ListTree className="w-4 h-4" /> Ver detalle y abonos
                    </button>
                  </div>
                )}

                <div className="text-xs text-muted">
                  Titular: {owner?.name ?? "—"} · vence día {d.dueDay}
                  {d.interestRate ? ` · ${d.interestRate}% E.A.` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <DebtForm open onClose={() => setOpen(false)} editing={editing} />
      )}
      {detail && (
        <InstallmentDetail debt={detail} onClose={() => setDetail(null)} />
      )}
      {showArchived && <ArchivedDebts onClose={() => setShowArchived(false)} />}
    </div>
  );
}
