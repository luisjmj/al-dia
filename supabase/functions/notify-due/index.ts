// Edge Function · notify-due
// Corre 1 vez al día (cron). Busca deudas que vencen en 7 días o en 24h,
// excluye las ya pagadas o marcadas "no se paga", y envía un Web Push
// resumido a cada usuario. Registra lo enviado para no repetir.
//
// Secrets requeridos (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:tu@correo)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const COL_OFFSET_MS = 5 * 60 * 60 * 1000; // Colombia = UTC-5 (sin horario de verano)
const DAY_MS = 24 * 60 * 60 * 1000;

type Debt = {
  id: string;
  household_id: string;
  owner_id: string;
  name: string;
  kind: string;
  start_date: string;
  installments_total: number | null;
  due_day: number;
  shared: boolean;
  no_start_date: boolean;
  archived: boolean;
};
type Payment = { debt_id: string; period: string; type: string };
type Sub = {
  endpoint: string;
  user_id: string;
  household_id: string;
  p256dh: string;
  auth: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function periodOf(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
function daysInMonth(year: number, month0: number) {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}
function monthsBetween(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

// ¿La deuda genera cobro en ese periodo? (réplica de lib/finance.isDebtActiveIn)
function isActiveIn(debt: Debt, period: string, curPeriod: string): boolean {
  if (debt.archived) return false;
  if (debt.no_start_date && debt.kind === "recurring") return period >= curPeriod;
  const startPeriod = debt.start_date.slice(0, 7);
  const elapsed = monthsBetween(startPeriod, period);
  if (elapsed < 0) return false;
  if (debt.kind === "recurring") return true;
  if (debt.kind === "one_time") return elapsed === 0;
  return elapsed < (debt.installments_total ?? 0);
}

Deno.serve(async (req) => {
  // Permite invocación manual para probar; el cron también hace POST.
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:al-dia@example.com";
  const pub = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const priv = Deno.env.get("VAPID_PRIVATE_KEY")!;
  webpush.setVapidDetails(subject, pub, priv);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fecha "hoy" en hora Colombia, normalizada a medianoche.
  const colNow = new Date(Date.now() - COL_OFFSET_MS);
  const today = new Date(
    Date.UTC(colNow.getUTCFullYear(), colNow.getUTCMonth(), colNow.getUTCDate())
  );
  const curPeriod = periodOf(today);

  // Carga de datos (service role: omite RLS).
  const [{ data: debts }, { data: payments }, { data: subs }, { data: members }] =
    await Promise.all([
      sb.from("debts").select("*").eq("archived", false),
      sb.from("payments").select("debt_id, period, type"),
      sb.from("push_subscriptions").select("*"),
      sb.from("household_members").select("household_id, user_id"),
    ]);

  const allDebts = (debts ?? []) as Debt[];
  const allPays = (payments ?? []) as Payment[];
  const allSubs = (subs ?? []) as Sub[];
  const allMembers = (members ?? []) as { household_id: string; user_id: string }[];

  // Suscripciones agrupadas por usuario.
  const subsByUser = new Map<string, Sub[]>();
  for (const s of allSubs) {
    const arr = subsByUser.get(s.user_id) ?? [];
    arr.push(s);
    subsByUser.set(s.user_id, arr);
  }
  // Miembros por hogar.
  const membersByHh = new Map<string, string[]>();
  for (const m of allMembers) {
    const arr = membersByHh.get(m.household_id) ?? [];
    arr.push(m.user_id);
    membersByHh.set(m.household_id, arr);
  }

  // Silencia si ya hay pago real de la cuota o está marcada "no se paga".
  // Un abono a capital (type 'abono') NO cuenta como pagar la cuota del mes.
  const isPaidOrSkipped = (debtId: string, period: string) =>
    allPays.some(
      (p) =>
        p.debt_id === debtId &&
        p.period === period &&
        (p.type === "cuota" || p.type === "skipped")
    );

  // Por cada deuda, calcular la próxima ocurrencia del día de pago desde hoy.
  // Acumula avisos pendientes por (usuario, umbral).
  type Pending = { name: string };
  const buckets = new Map<string, Pending[]>(); // key: userId|threshold
  const logRows: { debt_id: string; period: string; threshold: string }[] = [];
  const seenLog = new Set<string>(); // evita duplicar log dentro del run

  // Log ya existente para los periodos en juego (este mes y el próximo).
  const nextPeriod = periodOf(new Date(today.getTime() + 31 * DAY_MS));
  const { data: existingLog } = await sb
    .from("notification_log")
    .select("debt_id, period, threshold")
    .in("period", [curPeriod, nextPeriod]);
  const logged = new Set(
    (existingLog ?? []).map(
      (l: any) => `${l.debt_id}|${l.period}|${l.threshold}`
    )
  );

  for (const debt of allDebts) {
    // próxima fecha de vencimiento (este mes si aún no pasa, si no el siguiente)
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth();
    let dueDate = new Date(
      Date.UTC(y, m, Math.min(debt.due_day, daysInMonth(y, m)))
    );
    if (dueDate < today) {
      const nm = m + 1;
      dueDate = new Date(
        Date.UTC(y, nm, Math.min(debt.due_day, daysInMonth(y, nm)))
      );
    }
    const period = periodOf(dueDate);
    const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / DAY_MS);
    const threshold = daysUntil === 7 ? "7d" : daysUntil === 1 ? "24h" : null;
    if (!threshold) continue;

    if (!isActiveIn(debt, period, curPeriod)) continue;
    if (isPaidOrSkipped(debt.id, period)) continue;

    const logKey = `${debt.id}|${period}|${threshold}`;
    if (logged.has(logKey) || seenLog.has(logKey)) continue;

    // destinatarios: compartida → todo el hogar; personal → solo el dueño
    const recipients = debt.shared
      ? membersByHh.get(debt.household_id) ?? [debt.owner_id]
      : [debt.owner_id];

    let queued = false;
    for (const uid of recipients) {
      if (!subsByUser.has(uid)) continue;
      const key = `${uid}|${threshold}`;
      const arr = buckets.get(key) ?? [];
      arr.push({ name: debt.name });
      buckets.set(key, arr);
      queued = true;
    }
    if (queued) {
      seenLog.add(logKey);
      logRows.push({ debt_id: debt.id, period, threshold });
    }
  }

  // Enviar un push resumen por (usuario, umbral).
  const deadEndpoints: string[] = [];
  let sent = 0;
  for (const [key, items] of buckets) {
    const [uid, threshold] = key.split("|");
    const when = threshold === "7d" ? "en 7 días" : "mañana";
    const names = items.map((i) => i.name);
    const title =
      items.length === 1
        ? `${names[0]} vence ${when}`
        : `${items.length} pagos vencen ${when}`;
    const body =
      items.length === 1
        ? `Recuerda pagar ${names[0]}.`
        : names.join(", ");
    const payload = JSON.stringify({ title, body, url: "/pagos", tag: `due-${threshold}` });

    for (const s of subsByUser.get(uid) ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        // 404/410 = suscripción muerta → borrar
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          deadEndpoints.push(s.endpoint);
        } else {
          console.error("push error", err?.statusCode, err?.body ?? err);
        }
      }
    }
  }

  // Persistir log y limpiar suscripciones muertas.
  if (logRows.length) await sb.from("notification_log").upsert(logRows);
  if (deadEndpoints.length)
    await sb.from("push_subscriptions").delete().in("endpoint", deadEndpoints);

  const summary = {
    date: periodOf(today),
    pushesSent: sent,
    debtsNotified: logRows.length,
    deadRemoved: deadEndpoints.length,
  };
  console.log("notify-due", summary);
  return new Response(JSON.stringify(summary), {
    headers: { "content-type": "application/json" },
  });
});
