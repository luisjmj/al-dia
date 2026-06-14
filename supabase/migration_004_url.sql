-- Migración: enlace para "ir a pagar" (web del banco/servicio) en cada deuda.
-- Pega esto en Supabase → SQL Editor → Run. Seguro de correr una sola vez.
alter table public.debts
  add column if not exists url text;
