import { useState } from "react";
import { useStore } from "../store";
import { formatCOP } from "../lib/format";
import { Modal, CategoryBadge, EmptyState } from "./ui";
import { RotateCcw, Trash2 } from "lucide-react";

export default function ArchivedDebts({ onClose }: { onClose: () => void }) {
  const { debts, unarchiveDebt, deleteDebt } = useStore();
  const archived = debts.filter((d) => d.archived);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <Modal open onClose={onClose} title="Deudas archivadas">
      {archived.length === 0 ? (
        <EmptyState
          title="No tienes deudas archivadas"
          hint="Cuando archives una deuda desde la lista, aparecerá aquí."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {archived.map((d) => (
            <div key={d.id} className="card p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-2 h-9 rounded-full shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{d.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <CategoryBadge id={d.category} />
                      <span className="text-xs text-muted">
                        {formatCOP(d.amount)}
                      </span>
                    </div>
                  </div>
                </div>
                {confirmId !== d.id && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => unarchiveDebt(d.id)}
                      title="Restaurar"
                      className="p-2 rounded-lg text-muted hover:bg-surface-2 hover:text-text"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmId(d.id)}
                      title="Eliminar"
                      className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {confirmId === d.id && (
                <div className="mt-3 rounded-xl bg-red-500/10 p-3">
                  <p className="text-sm text-red-300 mb-2">
                    ¿Eliminar <b>{d.name}</b> definitivamente? Se borran también
                    sus pagos. No se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost flex-1 !py-2 text-sm"
                      onClick={() => setConfirmId(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="btn flex-1 !py-2 text-sm bg-red-500 text-white hover:opacity-90"
                      onClick={() => {
                        deleteDebt(d.id);
                        setConfirmId(null);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
