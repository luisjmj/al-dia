-- =====================================================================
--  Al Día · Esquema de base de datos (Supabase / Postgres)
--  Pega TODO esto en Supabase → SQL Editor → New query → Run.
--  Es idempotente: puedes correrlo varias veces sin romper nada.
-- =====================================================================

-- ---------- Tablas ----------

create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null,
  email      text,
  color      text default '#8184f8',
  created_at timestamptz default now()
);

create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Mi hogar',
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_by  uuid references auth.users,
  created_at  timestamptz default now()
);

create table if not exists public.household_members (
  household_id uuid references public.households on delete cascade,
  user_id      uuid references auth.users on delete cascade,
  role         text default 'member',
  joined_at    timestamptz default now(),
  primary key (household_id, user_id)
);

create table if not exists public.debts (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households on delete cascade,
  owner_id           uuid not null references auth.users,
  name               text not null,
  amount             numeric not null,
  kind               text not null default 'recurring',   -- recurring | installments | one_time
  frequency          text not null default 'monthly',     -- monthly | biweekly | weekly
  category           text not null default 'otro',
  due_day            int  not null default 1,
  start_date         date not null default current_date,
  installments_total int,
  principal          numeric,                          -- total financiado original (créditos)
  interest_rate      numeric,
  variable           boolean not null default false,  -- monto cambia cada mes (servicios)
  shared             boolean not null default false,
  color              text,
  note               text,
  url                text,                             -- enlace para "ir a pagar"
  archived           boolean not null default false,
  created_at         timestamptz default now()
);

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  debt_id      uuid not null references public.debts on delete cascade,
  household_id uuid not null references public.households on delete cascade,
  period       text not null,          -- 'yyyy-mm'
  amount       numeric not null,
  type         text not null default 'cuota',  -- 'cuota' | 'abono' (abono a capital)
  paid_by      uuid not null references auth.users,
  paid_at      timestamptz default now()
);

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

create index if not exists idx_debts_household on public.debts(household_id);
create index if not exists idx_payments_household on public.payments(household_id);
create index if not exists idx_payments_debt on public.payments(debt_id);
create index if not exists idx_categories_household on public.categories(household_id);

-- ---------- Funciones auxiliares (SECURITY DEFINER evita recursión de RLS) ----------

create or replace function public.is_household_member(hid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create or replace function public.shares_household(other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from household_members a
    join household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Unirse a un hogar con su código de invitación (devuelve el id del hogar).
create or replace function public.join_household(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select id into hid from households where invite_code = code;
  if hid is null then raise exception 'Código de invitación inválido'; end if;
  insert into household_members(household_id, user_id) values (hid, auth.uid())
    on conflict do nothing;
  return hid;
end; $$;

-- Al registrarse: crea perfil + hogar personal + membresía.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  insert into public.profiles(id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  insert into public.households(name, created_by) values ('Mi hogar', new.id)
    returning id into hid;
  insert into public.household_members(household_id, user_id, role)
    values (hid, new.id, 'owner');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------

alter table public.profiles          enable row level security;
alter table public.households         enable row level security;
alter table public.household_members  enable row level security;
alter table public.debts              enable row level security;
alter table public.payments           enable row level security;
alter table public.categories         enable row level security;

-- categories: CRUD para miembros del hogar
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

-- profiles: me veo a mí y a quienes comparten hogar conmigo
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_household(id));
drop policy if exists profiles_upsert on public.profiles;
create policy profiles_upsert on public.profiles for insert
  with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid());

-- households: las que son mías
drop policy if exists households_select on public.households;
create policy households_select on public.households for select
  using (public.is_household_member(id) or created_by = auth.uid());
drop policy if exists households_insert on public.households;
create policy households_insert on public.households for insert
  with check (created_by = auth.uid());
drop policy if exists households_update on public.households;
create policy households_update on public.households for update
  using (public.is_household_member(id));

-- household_members: veo a mis co-miembros; me puedo agregar/sacar
drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members for select
  using (public.is_household_member(household_id));
drop policy if exists members_insert on public.household_members;
create policy members_insert on public.household_members for insert
  with check (user_id = auth.uid());
drop policy if exists members_delete on public.household_members;
create policy members_delete on public.household_members for delete
  using (user_id = auth.uid());

-- debts: mías, o compartidas dentro de mi hogar
drop policy if exists debts_select on public.debts;
create policy debts_select on public.debts for select
  using (owner_id = auth.uid() or (shared and public.is_household_member(household_id)));
drop policy if exists debts_insert on public.debts;
create policy debts_insert on public.debts for insert
  with check (owner_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists debts_update on public.debts;
create policy debts_update on public.debts for update
  using (owner_id = auth.uid() or (shared and public.is_household_member(household_id)));
drop policy if exists debts_delete on public.debts;
create policy debts_delete on public.debts for delete
  using (owner_id = auth.uid());

-- payments: visibles si puedo ver la deuda; cualquiera del hogar puede pagar una compartida
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select
  using (exists (
    select 1 from public.debts d
    where d.id = debt_id
      and (d.owner_id = auth.uid() or (d.shared and public.is_household_member(d.household_id)))
  ));
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert
  with check (paid_by = auth.uid() and public.is_household_member(household_id));
drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments for delete
  using (public.is_household_member(household_id));
