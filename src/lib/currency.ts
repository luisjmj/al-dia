// Manejo de moneda(s) — SOLO front. No convierte ni toca los números guardados:
// cada deuda se "etiqueta" con una moneda en localStorage. Con una sola moneda
// es un cambio de formato global; con varias, un filtro por "perfil".
import { useEffect, useState } from "react";
import { setActiveCurrency } from "./format";

export interface CurrencyInfo {
  code: string;
  name: string;
}

// Monedas más usadas (código ISO 4217 + nombre en español).
export const CURRENCIES: CurrencyInfo[] = [
  { code: "COP", name: "Peso colombiano" },
  { code: "USD", name: "Dólar estadounidense" },
  { code: "EUR", name: "Euro" },
  { code: "MXN", name: "Peso mexicano" },
  { code: "GBP", name: "Libra esterlina" },
  { code: "BRL", name: "Real brasileño" },
  { code: "ARS", name: "Peso argentino" },
  { code: "CLP", name: "Peso chileno" },
  { code: "PEN", name: "Sol peruano" },
  { code: "UYU", name: "Peso uruguayo" },
  { code: "VES", name: "Bolívar venezolano" },
  { code: "CAD", name: "Dólar canadiense" },
  { code: "JPY", name: "Yen japonés" },
  { code: "CNY", name: "Yuan chino" },
  { code: "CHF", name: "Franco suizo" },
  { code: "AUD", name: "Dólar australiano" },
  { code: "INR", name: "Rupia india" },
  { code: "KRW", name: "Won surcoreano" },
];

export function currencyName(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.name ?? code;
}

const KEY = "aldia.currency";

interface CurrencyState {
  enabled: string[]; // monedas habilitadas (la 1ª es la base)
  active: string; // perfil/moneda actualmente seleccionada
  debtCurrency: Record<string, string>; // debtId -> moneda
}

const DEFAULT: CurrencyState = {
  enabled: ["COP"],
  active: "COP",
  debtCurrency: {},
};

function load(): CurrencyState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        enabled: Array.isArray(p.enabled) && p.enabled.length ? p.enabled : ["COP"],
        active: p.active || "COP",
        debtCurrency: p.debtCurrency || {},
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT;
}

export function useCurrency() {
  const [s, setS] = useState<CurrencyState>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(s));
  }, [s]);

  // Mantener el formateador global sincronizado con la moneda activa.
  setActiveCurrency(s.active);

  const base = s.enabled[0];

  return {
    currencies: s.enabled,
    activeCurrency: s.active,
    base,
    multi: s.enabled.length > 1,
    currencyOf: (debtId: string) => s.debtCurrency[debtId] ?? base,
    setActiveCurrencyProfile: (code: string) =>
      setS((x) => ({ ...x, active: code })),
    // modo una sola moneda: reemplaza todo
    setSingleCurrency: (code: string) =>
      setS((x) => ({ ...x, enabled: [code], active: code })),
    addCurrency: (code: string) =>
      setS((x) =>
        x.enabled.includes(code) ? x : { ...x, enabled: [...x.enabled, code] }
      ),
    removeCurrency: (code: string) =>
      setS((x) => {
        if (x.enabled.length <= 1) return x;
        const enabled = x.enabled.filter((c) => c !== code);
        return {
          ...x,
          enabled,
          active: x.active === code ? enabled[0] : x.active,
        };
      }),
    tagDebtCurrency: (debtId: string, code: string) =>
      setS((x) => ({
        ...x,
        debtCurrency: { ...x.debtCurrency, [debtId]: code },
      })),
  };
}

export type CurrencyApi = ReturnType<typeof useCurrency>;
