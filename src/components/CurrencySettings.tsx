import { useStore } from "../store";
import { CURRENCIES, currencyName } from "../lib/currency";
import { Coins, X, Plus } from "lucide-react";

// Ajustes de moneda(s) en el panel de admin.
export default function CurrencySettings() {
  const {
    currencies,
    activeCurrency,
    setSingleCurrency,
    addCurrency,
    removeCurrency,
  } = useStore();

  const single = currencies.length === 1;
  const available = CURRENCIES.filter((c) => !currencies.includes(c.code));

  return (
    <div>
      <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
        <Coins className="w-5 h-5 text-brand" /> Monedas
      </h2>
      <div className="card p-4 flex flex-col gap-3">
        {single ? (
          <div>
            <label className="label">Moneda de tus deudas</label>
            <select
              className="input"
              value={currencies[0]}
              onChange={(e) => setSingleCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted mt-1">
              Solo cambia cómo se muestran los montos; no convierte ni altera los
              valores.
            </p>
          </div>
        ) : (
          <div>
            <label className="label">Monedas activas</label>
            <div className="flex flex-wrap gap-2">
              {currencies.map((code) => (
                <span
                  key={code}
                  className={`chip border ${
                    code === activeCurrency
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border bg-surface-2 text-muted"
                  }`}
                >
                  {code}
                  <button
                    onClick={() => removeCurrency(code)}
                    className="ml-0.5 hover:text-red-400"
                    title={`Quitar ${code}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted mt-2">
              En el encabezado aparece un selector para alternar entre monedas.
              Las deudas de cada una se mantienen separadas.
            </p>
          </div>
        )}

        {/* Agregar moneda */}
        {available.length > 0 && (
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-muted shrink-0" />
            <select
              className="input !py-2"
              value=""
              onChange={(e) => e.target.value && addCurrency(e.target.value)}
            >
              <option value="">Agregar otra moneda…</option>
              {available.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// helper reexport por si se necesita el nombre en otros lados
export { currencyName };
