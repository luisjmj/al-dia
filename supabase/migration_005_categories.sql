-- Migración: categorías configurables por hogar (sección admin).
-- Pega esto en Supabase → SQL Editor → Run. Seguro de correr una sola vez.

create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  slug         text not null,                 -- id estable usado por debts.category
  label        text not null,
  color        text not null default '#94a3b8',
  icon         text not null default 'Tag',
  sort         int  not null default 0,
  created_at   timestamptz default now(),
  unique (household_id, slug)
);

create index if not exists idx_categories_household on public.categories(household_id);

alter table public.categories enable row level security;

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select
  using (public.is_household_member(household_id));
drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories for insert
  with check (public.is_household_member(household_id));
drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories for update
  using (public.is_household_member(household_id));
drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories for delete
  using (public.is_household_member(household_id));
