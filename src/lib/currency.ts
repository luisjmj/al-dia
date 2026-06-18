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

// La moneda ACTIVA (qué perfil estás viendo) es por dispositivo: localStorage.
// Las monedas habilitadas y la moneda de cada deuda se guardan en la BD (hogar)
// en modo nube, o en el estado local en modo local — eso lo manejan los stores.
const ACTIVE_KEY = "aldia.activeCurrency";

export function useActiveCurrency(
  enabled: string[]
): [string, (code: string) => void] {
  const [stored, setStored] = useState<string>(
    () => localStorage.getItem(ACTIVE_KEY) || enabled[0] || "COP"
  );
  // si la moneda guardada ya no está habilitada, cae a la base
  const active = enabled.includes(stored) ? stored : enabled[0] || "COP";

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, active);
  }, [active]);

  // mantener el formateador global sincronizado
  setActiveCurrency(active);

  return [active, setStored];
}
