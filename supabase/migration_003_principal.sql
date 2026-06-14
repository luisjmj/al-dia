-- Migración: total financiado original de un crédito a cuotas.
-- Necesario para "reducir valor de cuota" (mantener saldo de origen aunque cambie la cuota).
-- Pega esto en Supabase → SQL Editor → Run. Seguro de correr una sola vez.
alter table public.debts
  add column if not exists principal numeric;
