import { useMemo, useState } from "react";
import type { Debt } from "../types";
import { useStore } from "../store";
import {
  buildAmortization,
  previewAbono,
  previewReducirCuota,
} from "../lib/amortization";
import { formatCOP, periodLabel } from "../lib/format";
import { Modal, ProgressBar } from "./ui";
import { TrendingDown, Check, Coins, Wallet } from "lucide-react";

type Modalidad = "cuotas" | "cuota";

export default function InstallmentDetail({
  debt,
  onClose,
}: {
  debt: Debt;
  onClose: () => void;
}) {
  const { payments, abonarCapital, updateDebt } = useStore();
  const amort = useMemo(
    () => buildAmortization(debt, payments),
    [debt, payments]
  );

  const [abono, setAbono] = useState("");
  const [modalidad, setModalidad] = useState<Modalidad | null>(null);
  const abonoNum = Number(abono) || 0;
  const valido = abonoNum > 0 && abonoNum <= amort.balance;

  // Preview según la modalidad elegida
  const previewCuotas = useMemo(
    () =>
      valido
        ? previewAbono(amort.balance, amort.rate, amort.cuota, abonoNum)
        : null,
    [valido, abonoNum, amort.balance, amort.rate, amort.cuota]
  );
  const previewCuota = useMemo(
    () =>
      valido
        ? previewReducirCuota(
            amort.balance,
            amort.rate,
            amort.remaining,
            amort.cuota,
            abonoNum
          )
        : null,
    [valido, abonoNum, amort.balance, amort.rate, amort.remaining, amort.cuota]
  );

  const progress = amort.totalCuotas
    ? amort.paidCount / amort.totalCuotas
    : 0;

  function aceptar() {
    if (!valido || !modalidad) return;
    // 1) registrar el abono a capital
    abonarCapital(debt, abonoNum);
    // 2) ajustar la deuda según la modalidad
    if (modalidad === "cuota" && previewCuota) {
      // mantener nº de cuotas, bajar el valor de la cuota
      updateDebt({ ...debt, amount: Math.round(previewCuota.cuotaDespues) });
    } else if (modalidad === "cuotas" && previewCuotas) {
      // mantener la cuota, bajar el nº de cuotas (ajustamos el total)
      updateDebt({
        ...debt,
        installmentsTotal: amort.paidCount + previewCuotas.cuotasDespues,
      });
    }
    setAbono("");
    setModalidad(null);
  }

  function cancelar() {
    setModalidad(null);
  }

  return (
    <Modal open onClose={onClose} title={debt.name}>
      <div className="flex flex-col gap-5">
        {/* Resumen */}
        <div className="grid grid-cols-2 gap-2.5">
          <Summary
            label="Saldo pendiente"
            value={formatCOP(amort.balance)}
            icon={<Wallet className="w-4 h-4" />}
            accent="#fb923c"
          />
          <Summary
            label="Cuotas"
            value={`${amort.paidCount} / ${amort.totalCuotas}`}
            icon={<Check className="w-4 h-4" />}
            accent="#34d399"
          />
          <Summary
            label="Capital original"
            value={formatCOP(amort.principal)}
            icon={<Coins className="w-4 h-4" />}
            accent="#8184f8"
          />
          <Summary
            label="Interés total"
            value={formatCOP(amort.totalInterest)}
            sub={
              debt.interestRate && debt.interestRate > 0
                ? `${debt.interestRate}% E.A. (${(amort.rate * 100).toFixed(2)}% mes)`
                : "sin interés"
            }
            icon={<TrendingDown className="w-4 h-4" />}
            accent="#f472b6"
          />
        </div>

        <div>
          <div className="flex justify-between text-sm text-muted mb-1.5">
            <span>Progreso del crédito</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <ProgressBar value={progress} color={debt.color} />
        </div>

        {/* Abono a capital */}
        {amort.balance > 0 && (
          <div className="card p-4 bg-surface-2/50">
            <div className="font-semibold mb-1 flex items-center gap-2">
              <TrendingDown className="w-4.5 h-4.5 text-emerald-400" />
              Abono a capital
            </div>
            <p className="text-xs text-muted mb-3">
              Paga capital extra y elige cómo aplicarlo. Te mostramos el cálculo
              antes de confirmar.
            </p>

            {/* Monto */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                $
              </span>
              <input
                className="input !pl-6"
                inputMode="numeric"
                placeholder="Monto del abono"
                value={abono}
                onChange={(e) => {
                  setAbono(e.target.value.replace(/\D/g, ""));
                  setModalidad(null);
                }}
              />
            </div>

            {abonoNum > amort.balance && (
              <div className="text-xs text-amber-400 mt-2">
                El abono no puede superar el saldo ({formatCOP(amort.balance)}).
              </div>
            )}

            {/* Modalidades */}
            {valido && (
              <>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <ModBtn
                    active={modalidad === "cuotas"}
                    title="Reducir cuotas"
                    desc="Misma cuota, terminas antes"
                    onClick={() => setModalidad("cuotas")}
                  />
                  <ModBtn
                    active={modalidad === "cuota"}
                    title="Reducir valor cuota"
                    desc="Mismo plazo, pagas menos al mes"
                    onClick={() => setModalidad("cuota")}
                  />
                </div>

                {/* Preview de la modalidad elegida */}
                {modalidad === "cuotas" && previewCuotas && (
                  <PreviewBox
                    a={{
                      label: "Reduces",
                      value: `${previewCuotas.cuotasReducidas} ${
                        previewCuotas.cuotasReducidas === 1 ? "cuota" : "cuotas"
                      }`,
                      sub: `${previewCuotas.cuotasAntes} → ${previewCuotas.cuotasDespues} cuotas`,
                    }}
                    b={{
                      label: "Ahorras en interés",
                      value: formatCOP(previewCuotas.ahorroInteres),
                      sub: `nuevo saldo ${formatCOP(previewCuotas.nuevoSaldo)}`,
                    }}
                  />
                )}
                {modalidad === "cuota" && previewCuota && (
                  <PreviewBox
                    a={{
                      label: "Nueva cuota",
                      value: formatCOP(previewCuota.cuotaDespues),
                      sub: `antes ${formatCOP(previewCuota.cuotaAntes)} · −${formatCOP(
                        previewCuota.reduccionCuota
                      )}`,
                    }}
                    b={{
                      label: "Ahorras en interés",
                      value: formatCOP(previewCuota.ahorroInteres),
                      sub: `nuevo saldo ${formatCOP(previewCuota.nuevoSaldo)}`,
                    }}
                  />
                )}

                {/* Aceptar / Cancelar */}
                {modalidad && (
                  <div className="flex gap-2 mt-3">
                    <button className="btn-ghost flex-1" onClick={cancelar}>
                      Cancelar
                    </button>
                    <button className="btn-primary flex-1" onClick={aceptar}>
                      Aceptar abono
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tabla de amortización */}
        <div>
          <div className="font-semibold mb-2">Plan de pagos</div>
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 text-muted text-xs">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">#</th>
                    <th className="text-left font-medium px-2 py-2">Mes</th>
                    <th className="text-right font-medium px-2 py-2">Cuota</th>
                    <th className="text-right font-medium px-2 py-2">Interés</th>
                    <th className="text-right font-medium px-2 py-2">Capital</th>
                    <th className="text-right font-medium px-3 py-2">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {amort.rows.map((r, idx) => (
                    <tr
                      key={idx}
                      className={`border-t border-border ${
                        r.type === "abono"
                          ? "bg-emerald-500/10"
                          : r.paid
                          ? "bg-surface-2/40"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        {r.type === "abono" ? (
                          <span className="text-emerald-400 text-xs font-semibold">
                            abono
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            {r.paid && (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            {r.n}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-muted">
                        {periodLabel(r.period)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {formatCOP(r.payment)}
                      </td>
                      <td className="px-2 py-2 text-right text-muted">
                        {r.interest > 0 ? formatCOP(r.interest) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {formatCOP(r.principal)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCOP(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-muted mt-2">
            Las filas con ✓ ya están pagadas. Las demás son la proyección con la
            cuota actual.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function Summary({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div className="font-bold mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function ModBtn({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-3 py-2.5 rounded-xl border transition ${
        active
          ? "border-brand bg-brand-soft text-brand"
          : "border-border bg-surface-2 text-muted hover:text-text"
      }`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-[11px] leading-tight opacity-90">{desc}</div>
    </button>
  );
}

function PreviewBox({
  a,
  b,
}: {
  a: { label: string; value: string; sub: string };
  b: { label: string; value: string; sub: string };
}) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      {[a, b].map((c, idx) => (
        <div key={idx} className="bg-emerald-500/10 rounded-xl p-3">
          <div className="text-xs text-muted">{c.label}</div>
          <div className="font-bold text-emerald-400">{c.value}</div>
          <div className="text-[11px] text-muted">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
