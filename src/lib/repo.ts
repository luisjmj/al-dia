// Capa de acceso a datos: traduce entre filas de Supabase (snake_case)
// y los tipos de la app (camelCase).
import { supabase } from "./supabase";
import type { Debt, Payment, User } from "../types";

function sb() {
  if (!supabase) throw new Error("Supabase no configurado");
  return supabase;
}

// ---------- Mappers ----------
function rowToDebt(r: any): Debt {
  return {
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    kind: r.kind,
    frequency: r.frequency,
    category: r.category,
    dueDay: r.due_day,
    startDate: r.start_date,
    installmentsTotal: r.installments_total ?? undefined,
    interestRate: r.interest_rate != null ? Number(r.interest_rate) : undefined,
    variable: r.variable ?? false,
    shared: r.shared,
    ownerId: r.owner_id,
    color: r.color,
    note: r.note ?? undefined,
    archived: r.archived,
  };
}

function debtToRow(d: Omit<Debt, "id">, householdId: string) {
  return {
    household_id: householdId,
    owner_id: d.ownerId,
    name: d.name,
    amount: d.amount,
    kind: d.kind,
    frequency: d.frequency,
    category: d.category,
    due_day: d.dueDay,
    start_date: d.startDate,
    installments_total: d.installmentsTotal ?? null,
    interest_rate: d.interestRate ?? null,
    variable: d.variable ?? false,
    shared: d.shared,
    color: d.color,
    note: d.note ?? null,
    archived: d.archived ?? false,
  };
}

function rowToPayment(r: any): Payment {
  return {
    id: r.id,
    debtId: r.debt_id,
    period: r.period,
    amount: Number(r.amount),
    paidById: r.paid_by,
    paidAt: r.paid_at,
    type: r.type ?? "cuota",
  };
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
}

// ---------- Hogar activo ----------
// Elige el hogar con más miembros (el compartido gana al personal).
export async function getActiveHousehold(userId: string): Promise<Household> {
  const { data: mine, error } = await sb()
    .from("household_members")
    .select("household_id, households(id, name, invite_code)")
    .eq("user_id", userId);
  if (error) throw error;
  if (!mine || mine.length === 0) throw new Error("Sin hogar");

  // contar miembros visibles por hogar
  const { data: allRows } = await sb()
    .from("household_members")
    .select("household_id");
  const counts: Record<string, number> = {};
  (allRows ?? []).forEach((r: any) => {
    counts[r.household_id] = (counts[r.household_id] ?? 0) + 1;
  });

  const best = [...mine].sort(
    (a: any, b: any) =>
      (counts[b.household_id] ?? 0) - (counts[a.household_id] ?? 0)
  )[0] as any;
  const h = best.households;
  return { id: h.id, name: h.name, inviteCode: h.invite_code };
}

export async function getMembers(householdId: string): Promise<User[]> {
  const { data: members, error } = await sb()
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId);
  if (error) throw error;
  const ids = (members ?? []).map((m: any) => m.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await sb()
    .from("profiles")
    .select("id, name, email, color")
    .in("id", ids);
  return (profiles ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    color: p.color ?? "#8184f8",
  }));
}

export async function getDebts(): Promise<Debt[]> {
  const { data, error } = await sb()
    .from("debts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToDebt);
}

export async function getPayments(): Promise<Payment[]> {
  const { data, error } = await sb().from("payments").select("*");
  if (error) throw error;
  return (data ?? []).map(rowToPayment);
}

export async function insertDebt(
  d: Omit<Debt, "id">,
  householdId: string
): Promise<Debt> {
  const { data, error } = await sb()
    .from("debts")
    .insert(debtToRow(d, householdId))
    .select()
    .single();
  if (error) throw error;
  return rowToDebt(data);
}

export async function updateDebt(d: Debt, householdId: string): Promise<Debt> {
  const { id, ...rest } = d;
  const { data, error } = await sb()
    .from("debts")
    .update(debtToRow(rest, householdId))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToDebt(data);
}

export async function archiveDebt(id: string): Promise<void> {
  const { error } = await sb()
    .from("debts")
    .update({ archived: true })
    .eq("id", id);
  if (error) throw error;
}

export async function insertPayment(
  debtId: string,
  householdId: string,
  period: string,
  amount: number,
  paidBy: string,
  type: "cuota" | "abono" = "cuota"
): Promise<Payment> {
  const row: Record<string, unknown> = {
    debt_id: debtId,
    household_id: householdId,
    period,
    amount,
    paid_by: paidBy,
  };
  // Solo enviamos `type` para abonos: así los pagos normales siguen
  // funcionando aunque la columna aún no exista (migración pendiente).
  if (type === "abono") row.type = "abono";
  const { data, error } = await sb()
    .from("payments")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return rowToPayment(data);
}

export async function deletePayment(
  debtId: string,
  period: string
): Promise<void> {
  const { error } = await sb()
    .from("payments")
    .delete()
    .eq("debt_id", debtId)
    .eq("period", period);
  if (error) throw error;
}

// Unirse a un hogar con código de invitación. Devuelve el id del hogar.
export async function joinHousehold(code: string): Promise<string> {
  const { data, error } = await sb().rpc("join_household", {
    code: code.trim(),
  });
  if (error) throw error;
  return data as string;
}
