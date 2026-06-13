-- Migración: gastos de monto variable (ej. servicios)
-- Pega esto en Supabase → SQL Editor → Run. Es seguro correrlo una sola vez.
alter table public.debts
  add column if not exists variable boolean not null default false;
