-- Migración 006: columna no_start_date en debts
-- Recurrentes "eternas" que no tienen fecha de inicio definida.
-- Aparecen en el mes actual automáticamente y en "Generar pagos" en meses pasados.

alter table public.debts
  add column if not exists no_start_date boolean not null default false;
