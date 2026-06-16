-- =====================================================================
--  Migración 007 · Web Push (suscripciones + registro anti-duplicados)
--  Idempotente. Pega en Supabase → SQL Editor → Run.
-- =====================================================================

-- Suscripciones push por dispositivo. Un usuario puede tener varias (PC + cel).
create table if not exists public.push_subscriptions (
  endpoint     text primary key,                 -- identifica el dispositivo
  user_id      uuid not null references auth.users on delete cascade,
  household_id uuid not null references public.households on delete cascade,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz default now()
);

create index if not exists idx_push_subs_household on public.push_subscriptions(household_id);

-- Registro de avisos ya enviados: evita repetir el mismo umbral por deuda/mes.
create table if not exists public.notification_log (
  debt_id    uuid not null references public.debts on delete cascade,
  period     text not null,                       -- 'yyyy-mm'
  threshold  text not null,                       -- '7d' | '24h'
  sent_at    timestamptz default now(),
  primary key (debt_id, period, threshold)
);

-- ---------- RLS ----------
alter table public.push_subscriptions enable row level security;
alter table public.notification_log   enable row level security;

-- Cada quien administra solo sus propias suscripciones.
drop policy if exists push_subs_select on public.push_subscriptions;
create policy push_subs_select on public.push_subscriptions for select
  using (user_id = auth.uid());
drop policy if exists push_subs_insert on public.push_subscriptions;
create policy push_subs_insert on public.push_subscriptions for insert
  with check (user_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists push_subs_update on public.push_subscriptions;
create policy push_subs_update on public.push_subscriptions for update
  using (user_id = auth.uid());
drop policy if exists push_subs_delete on public.push_subscriptions;
create policy push_subs_delete on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- notification_log: solo lo escribe la Edge Function (service role, omite RLS).
-- Sin policies => los clientes no pueden leer ni escribir.
