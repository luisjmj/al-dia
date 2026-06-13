-- Migración: distinguir cuotas regulares de abonos a capital.
-- Pega esto en Supabase → SQL Editor → Run. Seguro de correr una sola vez.
alter table public.payments
  add column if not exists type text not null default 'cuota';
