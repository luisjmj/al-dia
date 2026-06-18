-- =====================================================================
--  Migración 009 · Multi-moneda sincronizado
--  - debts.currency: moneda de cada deuda (null = moneda base del hogar)
--  - households.currencies: lista de monedas habilitadas (compartida)
--  Idempotente. No convierte ni mueve ningún valor numérico.
-- =====================================================================

alter table public.debts
  add column if not exists currency text;

alter table public.households
  add column if not exists currencies text[] not null default '{COP}';
