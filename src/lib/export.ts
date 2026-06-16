import * as XLSX from "xlsx";
import type { Debt, Payment, User } from "../types";

const TIPO_LABEL: Record<string, string> = {
  cuota: "Cuota",
  abono: "Abono a capital",
  skipped: "No se pago",
};

function buildRows(
  payments: Payment[],
  debts: Debt[],
  users: User[]
) {
  const debtMap = Object.fromEntries(debts.map((d) => [d.id, d]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return payments
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((p) => {
      const debt = debtMap[p.debtId];
      const user = userMap[p.paidById];
      return {
        Mes: p.period,
        Deuda: debt?.name ?? p.debtId,
        Categoria: debt?.category ?? "",
        Tipo: TIPO_LABEL[p.type ?? "cuota"] ?? p.type,
        "Monto (COP)": p.amount,
        "Pagado por": user?.name ?? p.paidById,
        "Fecha de pago": p.paidAt ? p.paidAt.slice(0, 10) : "",
        Nota: debt?.note ?? "",
      };
    });
}

export function exportToExcel(
  payments: Payment[],
  debts: Debt[],
  users: User[]
) {
  const currentYear = new Date().getFullYear().toString();

  const thisYear = payments.filter((p) => p.period.startsWith(currentYear));
  const rest = payments.filter((p) => !p.period.startsWith(currentYear));

  const rowsThisYear = buildRows(thisYear, debts, users);
  const rowsRest = buildRows(rest, debts, users);

  const wb = XLSX.utils.book_new();

  const wsThis = XLSX.utils.json_to_sheet(
    rowsThisYear.length ? rowsThisYear : [{}]
  );
  XLSX.utils.book_append_sheet(wb, wsThis, currentYear);

  const wsRest = XLSX.utils.json_to_sheet(
    rowsRest.length ? rowsRest : [{}]
  );
  XLSX.utils.book_append_sheet(wb, wsRest, "Historico");

  XLSX.writeFile(wb, `al-dia-${currentYear}.xlsx`);
}
