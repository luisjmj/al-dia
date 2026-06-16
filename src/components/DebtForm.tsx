import { useEffect, useState } from "react";
import type { Debt, DebtKind, Frequency, CategoryId } from "../types";
import { Modal } from "./ui";
import { useStore } from "../store";
import { eaToMonthly, principalFromCuota } from "../lib/amortization";
import { formatCOP, currentPeriod, monthsBetween, readableText } from "../lib/format";
import { Repeat, CalendarClock, Coins } from "lucide-react";

// Cuota mensual (sistema francés) a partir del total financiado.
function cuotaFromTotal(total: number, eaPercent: number, n: number): number {
  if (n <= 0) return 0;
  const i = eaToMonthly(eaPercent);
  if (i <= 0) return total / n;
  return (total * i) / (1 - Math.pow(1 + i, -n));
}

const KIND_OPTS: { id: DebtKind; label: string; desc: string; icon: any }[] = [
  { id: "recurring", label: "Recurrente", desc: "Sin fecha fin", icon: Repeat },
  { id: "installments", label: "A cuotas", desc: "Nº de cuotas", icon: CalendarClock },
  { id: "one_time", label: "Pago único", desc: "Una sola vez", icon: Coins },
];

const FREQ_OPTS: { id: Frequency; label: string }[] = [
  { id: "monthly", label: "Mensual" },
  { id: "biweekly", label: "Quincenal" },
  { id: "weekly", label: "Semanal" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DebtForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Debt | null;
}) {
  const { addDebt, updateDebt, currentUser, categories } = useStore();
  const e = editing;

  const [name, setName] = useState(e?.name ?? "");
  // Para créditos a cuotas el campo guarda el TOTAL; al editar lo reconstruimos
  // desde la cuota almacenada.
  const [amount, setAmount] = useState<string>(() => {
    if (!e) return "";
    if (e.kind === "installments") {
      // mostramos el total: el guardado (principal) o el reconstruido desde la cuota
      const total =
        e.principal ??
        principalFromCuota(
          e.amount,
          eaToMonthly(e.interestRate ?? 0),
          e.installmentsTotal ?? 0
        );
      return String(Math.round(total));
    }
    return String(e.amount);
  });
  const [kind, setKind] = useState<DebtKind>(e?.kind ?? "recurring");
  const [frequency, setFrequency] = useState<Frequency>(e?.frequency ?? "monthly");
  const [category, setCategory] = useState<CategoryId>(
    e?.category ?? categories[0]?.id ?? "otro"
  );
  const [dueDay, setDueDay] = useState<string>(e ? String(e.dueDay) : "5");
  const [startDate, setStartDate] = useState(e?.startDate ?? todayISO());
  const [installmentsTotal, setInstallmentsTotal] = useState<string>(
    e?.installmentsTotal ? String(e.installmentsTotal) : "12"
  );
  const [interestRate, setInterestRate] = useState<string>(
    e?.interestRate ? String(e.interestRate) : ""
  );
  const [noStartDate, setNoStartDate] = useState(e?.noStartDate ?? false);
  const [variable, setVariable] = useState(e?.variable ?? false);
  const [shared, setShared] = useState(e?.shared ?? false);
  const [note, setNote] = useState(e?.note ?? "");
  const [url, setUrl] = useState(e?.url ?? "");
  const [prepaid, setPrepaid] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cat = categories.find((c) => c.id === category) ?? categories[0];
  const valid = name.trim() && Number(amount) > 0;

  // Para créditos: el campo es el TOTAL; la cuota mensual se calcula.
  const isInstallments = kind === "installments";
  const cuotaMensual = isInstallments
    ? cuotaFromTotal(
        Number(amount) || 0,
        Number(interestRate) || 0,
        Number(installmentsTotal) || 0
      )
    : 0;

  // Meses transcurridos desde el inicio (para registrar deudas de meses pasados).
  const elapsed = Math.max(
    0,
    monthsBetween(startDate.slice(0, 7), currentPeriod())
  );
  const maxPrepaid =
    kind === "one_time"
      ? Math.min(elapsed, 1)
      : kind === "installments"
      ? Math.min(elapsed, Number(installmentsTotal) || elapsed)
      : elapsed;
  const showPrepaid = !e && maxPrepaid > 0;

  // al cambiar a un tipo distinto de recurring, desactivar noStartDate
  useEffect(() => {
    if (kind !== "recurring") setNoStartDate(false);
  }, [kind]);

  // al cambiar la fecha/tipo, sugerimos pagar todos los meses pasados
  useEffect(() => {
    setPrepaid(String(maxPrepaid));
  }, [maxPrepaid]);

  async function submit() {
    if (!valid || submitting) return;
    setError(null);
    setSubmitting(true);
    const base: Omit<Debt, "id"> = {
      name: name.trim(),
      // créditos guardan la cuota mensual calculada; el resto, el monto tal cual
      amount: isInstallments ? Math.round(cuotaMensual) : Number(amount),
      // total financiado original (solo créditos a cuotas)
      principal: isInstallments ? Number(amount) : undefined,
      kind,
      frequency,
      category,
      dueDay: Math.min(31, Math.max(1, Number(dueDay) || 1)),
      startDate,
      installmentsTotal:
        kind === "installments" ? Number(installmentsTotal) : undefined,
      interestRate: interestRate ? Number(interestRate) : undefined,
      variable,
      shared,
      ownerId: e?.ownerId ?? currentUser.id,
      color: cat?.color ?? "#94a3b8",
      noStartDate: kind === "recurring" ? noStartDate : undefined,
      note: note.trim() || undefined,
      url: url.trim() || undefined,
      archived: e?.archived,
    };
    try {
      if (e) {
        await updateDebt({ ...base, id: e.id });
      } else {
        const prepaidMonths = showPrepaid
          ? Math.min(maxPrepaid, Math.max(0, Number(prepaid) || 0))
          : 0;
        await addDebt(base, prepaidMonths);
      }
      onClose();
    } catch (err) {
      console.error("Error guardando deuda:", err);
      setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={e ? "Editar deuda" : "Nueva deuda"}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="label">Nombre</label>
          <input
            className="input"
            placeholder="Ej. Tarjeta Visa, Arriendo…"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="label">
              {isInstallments
                ? "Valor total (COP)"
                : variable
                ? "Monto estimado (COP)"
                : "Monto (COP)"}
            </label>
            <input
              className="input min-w-0"
              inputMode="numeric"
              placeholder={isInstallments ? "Total del crédito" : "150000"}
              value={amount}
              onChange={(ev) => setAmount(ev.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="min-w-0">
            <label className="label">Día de pago</label>
            <input
              className="input min-w-0"
              inputMode="numeric"
              value={dueDay}
              onChange={(ev) => setDueDay(ev.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>

        {/* Tipo de duración */}
        <div>
          <label className="label">Tipo</label>
          <div className="grid grid-cols-3 gap-2">
            {KIND_OPTS.map((o) => (
              <button
                key={o.id}
                onClick={() => setKind(o.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-center transition ${
                  kind === o.id
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-border bg-surface-2 text-muted hover:text-text"
                }`}
              >
                <o.icon className="w-5 h-5" />
                <span className="text-xs font-semibold">{o.label}</span>
                <span className="text-[10px] leading-tight opacity-80">
                  {o.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {kind === "installments" && (
          <div>
            <label className="label">Número de cuotas</label>
            <input
              className="input"
              inputMode="numeric"
              value={installmentsTotal}
              onChange={(ev) =>
                setInstallmentsTotal(ev.target.value.replace(/\D/g, ""))
              }
            />
            {cuotaMensual > 0 && (
              <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm flex items-center justify-between">
                <span className="text-muted">Cuota mensual</span>
                <span className="font-bold">{formatCOP(cuotaMensual)}</span>
              </div>
            )}
          </div>
        )}

        {/* Frecuencia */}
        <div>
          <label className="label">Frecuencia</label>
          <div className="grid grid-cols-3 gap-2">
            {FREQ_OPTS.map((o) => (
              <button
                key={o.id}
                onClick={() => setFrequency(o.id)}
                className={`px-2 py-2 rounded-xl border text-sm font-medium transition ${
                  frequency === o.id
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-border bg-surface-2 text-muted hover:text-text"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categoría */}
        <div>
          <label className="label">Categoría</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className="chip border font-semibold transition"
                style={
                  category === c.id
                    ? {
                        backgroundColor: c.color,
                        color: readableText(c.color),
                        borderColor: c.color,
                      }
                    : { borderColor: "rgb(var(--border))", color: "rgb(var(--muted))" }
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sin fecha de inicio (solo recurrentes) */}
        {kind === "recurring" && (
          <button
            onClick={() => setNoStartDate((s) => !s)}
            className="flex items-center justify-between card p-3.5"
          >
            <div className="text-left">
              <div className="font-semibold text-text">Sin fecha de inicio</div>
              <div className="text-xs text-muted">
                Siempre aparece en "Generar pagos" para meses pasados
              </div>
            </div>
            <span
              className={`w-11 h-6 rounded-full p-0.5 transition ${
                noStartDate ? "bg-brand" : "bg-surface-2 border border-border"
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition ${
                  noStartDate ? "translate-x-5" : ""
                }`}
              />
            </span>
          </button>
        )}

        <div
          className={`grid gap-3 ${
            noStartDate ? "grid-cols-1" : "grid-cols-1 min-[480px]:grid-cols-2"
          }`}
        >
          {!noStartDate && (
            <div className="min-w-0">
              <label className="label">Inicio</label>
              <input
                type="date"
                className="input min-w-0"
                value={startDate}
                onChange={(ev) => setStartDate(ev.target.value)}
              />
            </div>
          )}
          <div className="min-w-0">
            <label className="label">Interés % E.A.</label>
            <input
              className="input min-w-0"
              inputMode="decimal"
              placeholder="ej. 24 (anual)"
              value={interestRate}
              onChange={(ev) =>
                setInterestRate(ev.target.value.replace(/[^\d.]/g, ""))
              }
            />
          </div>
        </div>
        {interestRate && Number(interestRate) > 0 && (
          <div className="-mt-2 text-xs text-muted">
            {interestRate}% efectivo anual ≈{" "}
            <span className="text-text font-medium">
              {(
                (Math.pow(1 + Number(interestRate) / 100, 1 / 12) - 1) *
                100
              ).toFixed(2)}
              % mensual
            </span>
          </div>
        )}

        {/* Registrar meses pasados ya pagados */}
        {showPrepaid && (
          <div className="card p-3.5 bg-surface-2/50">
            <label className="label !mb-1">¿Cuántas cuotas ya pagaste?</label>
            <p className="text-xs text-muted mb-2.5">
              Empezó hace {elapsed} {elapsed === 1 ? "mes" : "meses"}. Las
              registramos como pagadas en sus meses para que el historial quede
              al día.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-ghost !px-3 !py-2"
                onClick={() =>
                  setPrepaid((p) => String(Math.max(0, (Number(p) || 0) - 1)))
                }
              >
                −
              </button>
              <input
                className="input text-center !w-16"
                inputMode="numeric"
                value={prepaid}
                onChange={(ev) =>
                  setPrepaid(ev.target.value.replace(/\D/g, ""))
                }
              />
              <button
                type="button"
                className="btn-ghost !px-3 !py-2"
                onClick={() =>
                  setPrepaid((p) =>
                    String(Math.min(maxPrepaid, (Number(p) || 0) + 1))
                  )
                }
              >
                +
              </button>
              <span className="text-sm text-muted ml-1">
                de {maxPrepaid} {maxPrepaid === 1 ? "mes" : "meses"}
              </span>
            </div>
          </div>
        )}

        <div>
          <label className="label">Nota</label>
          <input
            className="input"
            placeholder="opcional"
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
          />
        </div>

        <div>
          <label className="label">Enlace para pagar (URL)</label>
          <input
            className="input"
            inputMode="url"
            placeholder="ej. https://www.bancolombia.com"
            value={url}
            onChange={(ev) => setUrl(ev.target.value)}
          />
          <p className="text-[11px] text-muted mt-1">
            Opcional. Aparece un botón para ir directo al sitio de pago.
          </p>
        </div>

        {/* Monto variable */}
        <button
          onClick={() => setVariable((s) => !s)}
          className="flex items-center justify-between card p-3.5"
        >
          <div className="text-left">
            <div className="font-semibold text-text">Monto variable</div>
            <div className="text-xs text-muted">
              Cambia cada mes (ej. servicios); registras el real al pagar
            </div>
          </div>
          <span
            className={`w-11 h-6 rounded-full p-0.5 transition ${
              variable ? "bg-brand" : "bg-surface-2 border border-border"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition ${
                variable ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>

        {/* Compartida */}
        <button
          onClick={() => setShared((s) => !s)}
          className="flex items-center justify-between card p-3.5"
        >
          <div className="text-left">
            <div className="font-semibold text-text">Compartida con pareja</div>
            <div className="text-xs text-muted">
              Ambos la ven y pueden marcarla pagada
            </div>
          </div>
          <span
            className={`w-11 h-6 rounded-full p-0.5 transition ${
              shared ? "bg-brand" : "bg-surface-2 border border-border"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition ${
                shared ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>

        <div className="sticky bottom-0 -mx-5 -mb-5 mt-1 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-surface border-t border-border flex flex-col gap-2">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost flex-1"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={!valid || submitting}
              onClick={submit}
            >
              {submitting ? "Guardando…" : e ? "Guardar" : "Crear deuda"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
