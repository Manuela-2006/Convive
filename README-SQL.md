-- =========================================================
-- CONVIVE MVP - SUPABASE SQL
-- Tablas, triggers, funciones, RLS y policies
-- =========================================================


-- =========================================================
-- 1) TABLAS
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  join_code text not null unique,
  public_code text unique,
  max_members int not null check (max_members > 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.house_members (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (house_id, profile_id)
);

create table if not exists public.house_invites (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  code text not null unique,
  max_uses int,
  used_count int not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);


-- =========================================================
-- 2) UPDATED_AT
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_houses_updated_at on public.houses;
create trigger set_houses_updated_at
before update on public.houses
for each row execute function public.set_updated_at();

drop trigger if exists set_house_members_updated_at on public.house_members;
create trigger set_house_members_updated_at
before update on public.house_members
for each row execute function public.set_updated_at();


-- =========================================================
-- 3) CREAR PROFILE AUTOMÁTICAMENTE AL REGISTRARSE
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- =========================================================
-- 4) RELLENAR PROFILES YA EXISTENTES
-- =========================================================

insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
on conflict (id) do update
set email = excluded.email;


-- =========================================================
-- 5) GENERADOR DE CÓDIGO PÚBLICO
-- =========================================================

create or replace function public.generate_house_code(code_length int default 12)
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i int;
begin
  for i in 1..code_length loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;

  return result;
end;
$$;


-- =========================================================
-- 6) CREAR PISO
-- Devuelve public_code
-- =========================================================

drop function if exists public.create_house(text, integer);

create function public.create_house(
  p_name text,
  p_max_members int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_join_code text;
  v_public_code text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre del piso es obligatorio';
  end if;

  if p_max_members is null or p_max_members < 1 then
    raise exception 'El número de personas debe ser mayor que 0';
  end if;

  v_join_code := lpad(floor(random() * 1000000)::text, 6, '0');

  while exists (
    select 1 from public.houses where join_code = v_join_code
  ) loop
    v_join_code := lpad(floor(random() * 1000000)::text, 6, '0');
  end loop;

  v_public_code := public.generate_house_code(12);

  while exists (
    select 1 from public.houses where public_code = v_public_code
  ) loop
    v_public_code := public.generate_house_code(12);
  end loop;

  insert into public.houses (name, created_by, join_code, public_code, max_members)
  values (trim(p_name), auth.uid(), v_join_code, v_public_code, p_max_members)
  returning id into v_house_id;

  insert into public.house_members (house_id, profile_id, role)
  values (v_house_id, auth.uid(), 'admin');

  insert into public.house_invites (house_id, created_by, code, max_uses)
  values (v_house_id, auth.uid(), v_join_code, p_max_members - 1);

  return v_public_code;
end;
$$;


-- =========================================================
-- 7) UNIRSE A PISO
-- Usa public_code y devuelve public_code
-- =========================================================

drop function if exists public.join_house_by_code(text);

create function public.join_house_by_code(
  p_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses%rowtype;
  v_current_members int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select *
  into v_house
  from public.houses
  where public_code = trim(p_code)
    and status = 'active'
  limit 1;

  if v_house.id is null then
    raise exception 'Código no válido';
  end if;

  if exists (
    select 1
    from public.house_members
    where house_id = v_house.id
      and profile_id = auth.uid()
      and is_active = true
  ) then
    return v_house.public_code;
  end if;

  select count(*)
  into v_current_members
  from public.house_members
  where house_id = v_house.id
    and is_active = true;

  if v_current_members >= v_house.max_members then
    raise exception 'El piso ya está completo';
  end if;

  insert into public.house_members (house_id, profile_id, role)
  values (v_house.id, auth.uid(), 'member');

  return v_house.public_code;
end;
$$;


-- =========================================================
-- 8) OBTENER MI PISO ACTIVO
-- =========================================================

create or replace function public.get_my_active_house()
returns table (
  house_id uuid,
  house_name text,
  role text,
  join_code text,
  public_code text,
  max_members int
)
language sql
security definer
set search_path = public
as $$
  select
    h.id as house_id,
    h.name as house_name,
    hm.role,
    h.join_code,
    h.public_code,
    h.max_members
  from public.house_members hm
  join public.houses h on h.id = hm.house_id
  where hm.profile_id = auth.uid()
    and hm.is_active = true
    and h.status = 'active'
  order by hm.joined_at asc
  limit 1;
$$;


-- =========================================================
-- 9) FUNCIONES HELPER PARA RLS
-- =========================================================

create or replace function public.is_house_member(p_house_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.house_members hm
    where hm.house_id = p_house_id
      and hm.profile_id = auth.uid()
      and hm.is_active = true
  );
$$;

create or replace function public.is_house_creator(p_house_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.houses h
    where h.id = p_house_id
      and h.created_by = auth.uid()
  );
$$;


-- =========================================================
-- 10) PERMISOS PARA RPC / FUNCIONES
-- =========================================================

grant execute on function public.create_house(text, int) to authenticated;
grant execute on function public.join_house_by_code(text) to authenticated;
grant execute on function public.get_my_active_house() to authenticated;
grant execute on function public.is_house_member(uuid) to authenticated;
grant execute on function public.is_house_creator(uuid) to authenticated;


-- =========================================================
-- 11) ACTIVAR RLS
-- =========================================================

alter table public.profiles enable row level security;
alter table public.houses enable row level security;
alter table public.house_members enable row level security;
alter table public.house_invites enable row level security;


-- =========================================================
-- 12) POLICIES RLS
-- =========================================================

drop policy if exists "houses_select_if_member" on public.houses;
create policy "houses_select_if_member"
on public.houses
for select
to authenticated
using (
  created_by = auth.uid()
  or public.is_house_member(id)
);

drop policy if exists "house_members_select_if_member" on public.house_members;
create policy "house_members_select_if_member"
on public.house_members
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_house_member(house_id)
  or public.is_house_creator(house_id)
);

drop policy if exists "profiles_select_same_house" on public.profiles;
drop policy if exists "profile_select_own" on public.profiles;
create policy "profiles_select_same_house"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.house_members hm
    where hm.profile_id = profiles.id
      and hm.is_active = true
      and public.is_house_member(hm.house_id)
  )
);

drop policy if exists "invites_select_if_member" on public.house_invites;
create policy "invites_select_if_member"
on public.house_invites
for select
to authenticated
using (
  public.is_house_member(house_id)
  or public.is_house_creator(house_id)
);

-- =========================================================
-- CONVIVE - MÓDULO GASTOS
-- Incremental sobre tu esquema actual
-- =========================================================


-- =========================================================
-- 0) AJUSTES SOBRE TABLAS EXISTENTES
-- =========================================================

alter table public.houses
add column if not exists public_code text;

create unique index if not exists houses_public_code_uidx
on public.houses (public_code);

do $$
declare
  r record;
  v_code text;
begin
  for r in
    select id
    from public.houses
    where public_code is null
       or length(trim(public_code)) = 0
  loop
    v_code := public.generate_house_code(12);

    while exists (
      select 1
      from public.houses
      where public_code = v_code
    ) loop
      v_code := public.generate_house_code(12);
    end loop;

    update public.houses
    set public_code = v_code
    where id = r.id;
  end loop;
end $$;

update public.profiles
set full_name = case id
  when 'eb07d3f6-902f-4f4a-a842-8a9c7e28b947' then 'Adrián'
  when '48d7f9ee-08c9-42c2-aa8b-5b0cb935dc1c' then 'Manuela Ruiz'
  when '28b04090-7e3f-4a0f-a0a2-3425cafaf999' then 'Manuela Palma'
  else full_name
end
where id in (
  'eb07d3f6-902f-4f4a-a842-8a9c7e28b947',
  '48d7f9ee-08c9-42c2-aa8b-5b0cb935dc1c',
  '28b04090-7e3f-4a0f-a0a2-3425cafaf999'
);


-- =========================================================
-- 1) TABLAS NUEVAS
-- =========================================================

create table if not exists public.purchase_tickets (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  paid_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  merchant text not null,
  title text,
  purchase_date date not null default current_date,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  currency text not null default 'EUR',
  ticket_file_path text,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_ticket_items (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.purchase_tickets(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null default 0 check (unit_price >= 0),
  total_price numeric(10,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.shared_expenses (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  source_ticket_id uuid references public.purchase_tickets(id) on delete set null,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  paid_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  expense_type text not null default 'shared_purchase'
    check (expense_type in ('ticket', 'invoice', 'shared_purchase', 'other')),
  expense_date date not null default current_date,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  currency text not null default 'EUR',
  split_method text not null default 'equal'
    check (split_method in ('equal', 'manual', 'percentage')),
  status text not null default 'active'
    check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.shared_expenses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  share_amount numeric(10,2) not null check (share_amount >= 0),
  share_percentage numeric(5,2),
  is_waived boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'waived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expense_id, profile_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  from_profile_id uuid not null references public.profiles(id) on delete restrict,
  to_profile_id uuid not null references public.profiles(id) on delete restrict,
  related_expense_id uuid references public.shared_expenses(id) on delete set null,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  payment_date date not null default current_date,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_different_profiles_chk
    check (from_profile_id <> to_profile_id)
);


-- =========================================================
-- 2) ÍNDICES
-- =========================================================

create index if not exists purchase_tickets_house_date_idx
on public.purchase_tickets (house_id, purchase_date desc);

create index if not exists purchase_tickets_house_status_idx
on public.purchase_tickets (house_id, status);

create index if not exists purchase_ticket_items_ticket_idx
on public.purchase_ticket_items (ticket_id);

create index if not exists shared_expenses_house_date_idx
on public.shared_expenses (house_id, expense_date desc);

create index if not exists shared_expenses_house_status_idx
on public.shared_expenses (house_id, status);

create index if not exists expense_participants_expense_idx
on public.expense_participants (expense_id);

create index if not exists expense_participants_profile_idx
on public.expense_participants (profile_id);

create index if not exists payments_house_status_idx
on public.payments (house_id, status);

create index if not exists payments_from_profile_idx
on public.payments (from_profile_id);

create index if not exists payments_to_profile_idx
on public.payments (to_profile_id);


-- =========================================================
-- 3) UPDATED_AT PARA TABLAS NUEVAS
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_purchase_tickets_updated_at on public.purchase_tickets;
create trigger set_purchase_tickets_updated_at
before update on public.purchase_tickets
for each row execute function public.set_updated_at();

drop trigger if exists set_shared_expenses_updated_at on public.shared_expenses;
create trigger set_shared_expenses_updated_at
before update on public.shared_expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_expense_participants_updated_at on public.expense_participants;
create trigger set_expense_participants_updated_at
before update on public.expense_participants
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();


-- =========================================================
-- 4) HELPERS
-- =========================================================

create or replace function public.profile_display_name(p_profile_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1))
  from public.profiles p
  where p.id = p_profile_id
$$;

create or replace function public.get_accessible_house_id(p_house_public_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select h.id
  into v_house_id
  from public.houses h
  where h.public_code = trim(p_house_public_code)
    and h.status = 'active'
    and (
      h.created_by = auth.uid()
      or public.is_house_member(h.id)
      or public.is_house_creator(h.id)
    )
  limit 1;

  if v_house_id is null then
    raise exception 'Piso no encontrado o sin acceso';
  end if;

  return v_house_id;
end;
$$;


-- =========================================================
-- 5) RLS EN TABLAS NUEVAS
-- =========================================================

alter table public.purchase_tickets enable row level security;
alter table public.purchase_ticket_items enable row level security;
alter table public.shared_expenses enable row level security;
alter table public.expense_participants enable row level security;
alter table public.payments enable row level security;

drop policy if exists "purchase_tickets_select_if_member" on public.purchase_tickets;
create policy "purchase_tickets_select_if_member"
on public.purchase_tickets
for select
to authenticated
using (
  public.is_house_member(house_id)
  or public.is_house_creator(house_id)
);

drop policy if exists "purchase_ticket_items_select_if_member" on public.purchase_ticket_items;
create policy "purchase_ticket_items_select_if_member"
on public.purchase_ticket_items
for select
to authenticated
using (
  exists (
    select 1
    from public.purchase_tickets pt
    where pt.id = purchase_ticket_items.ticket_id
      and (
        public.is_house_member(pt.house_id)
        or public.is_house_creator(pt.house_id)
      )
  )
);

drop policy if exists "shared_expenses_select_if_member" on public.shared_expenses;
create policy "shared_expenses_select_if_member"
on public.shared_expenses
for select
to authenticated
using (
  public.is_house_member(house_id)
  or public.is_house_creator(house_id)
);

drop policy if exists "expense_participants_select_if_member" on public.expense_participants;
create policy "expense_participants_select_if_member"
on public.expense_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.shared_expenses se
    where se.id = expense_participants.expense_id
      and (
        public.is_house_member(se.house_id)
        or public.is_house_creator(se.house_id)
      )
  )
);

drop policy if exists "payments_select_if_member" on public.payments;
create policy "payments_select_if_member"
on public.payments
for select
to authenticated
using (
  public.is_house_member(house_id)
  or public.is_house_creator(house_id)
);


-- =========================================================
-- 6) FUNCIONES PARA LA PANTALLA
-- =========================================================

create or replace function public.get_house_purchase_tickets(
  p_house_public_code text,
  p_limit int default 5
)
returns table (
  ticket_id uuid,
  display_title text,
  merchant text,
  purchase_date date,
  paid_by_name text,
  total_amount numeric(10,2),
  currency text,
  ticket_file_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    pt.id as ticket_id,
    public.profile_display_name(pt.paid_by_profile_id)
      || ' - ' ||
      coalesce(nullif(trim(pt.title), ''), 'Compra ' || pt.merchant) as display_title,
    pt.merchant,
    pt.purchase_date,
    public.profile_display_name(pt.paid_by_profile_id) as paid_by_name,
    pt.total_amount,
    pt.currency,
    pt.ticket_file_path
  from public.purchase_tickets pt
  where pt.house_id = v_house_id
    and pt.status = 'active'
  order by pt.purchase_date desc, pt.created_at desc
  limit greatest(p_limit, 1);
end;
$$;


create or replace function public.get_house_shared_expenses(
  p_house_public_code text,
  p_limit int default 5
)
returns table (
  expense_id uuid,
  title text,
  expense_type text,
  expense_date date,
  paid_by_name text,
  participants_text text,
  participants_count int,
  total_amount numeric(10,2),
  currency text,
  source_ticket_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    se.id as expense_id,
    se.title,
    se.expense_type,
    se.expense_date,
    public.profile_display_name(se.paid_by_profile_id) as paid_by_name,
    coalesce(participants.participants_text, '') as participants_text,
    coalesce(participants.participants_count, 0) as participants_count,
    se.total_amount,
    se.currency,
    se.source_ticket_id
  from public.shared_expenses se
  left join lateral (
    select
      string_agg(
        public.profile_display_name(ep.profile_id),
        ', '
        order by public.profile_display_name(ep.profile_id)
      ) as participants_text,
      count(*)::int as participants_count
    from public.expense_participants ep
    where ep.expense_id = se.id
      and ep.is_waived = false
  ) participants on true
  where se.house_id = v_house_id
    and se.status = 'active'
  order by se.expense_date desc, se.created_at desc
  limit greatest(p_limit, 1);
end;
$$;


create or replace function public.get_house_payment_simplification(
  p_house_public_code text
)
returns table (
  from_profile_id uuid,
  from_name text,
  to_profile_id uuid,
  to_name text,
  amount numeric(10,2)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_creditor_id uuid;
  v_creditor_name text;
  v_credit numeric(12,2);
  v_debtor_id uuid;
  v_debtor_name text;
  v_debt numeric(12,2);
  v_transfer numeric(12,2);
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  drop table if exists pg_temp.tmp_settlement_balances;

  create temp table pg_temp.tmp_settlement_balances (
    profile_id uuid primary key,
    member_name text not null,
    balance numeric(12,2) not null
  ) on commit drop;

  insert into pg_temp.tmp_settlement_balances (profile_id, member_name, balance)
  with active_members as (
    select
      hm.profile_id,
      public.profile_display_name(hm.profile_id) as member_name
    from public.house_members hm
    where hm.house_id = v_house_id
      and hm.is_active = true
  ),
  paid_totals as (
    select
      se.paid_by_profile_id as profile_id,
      round(sum(se.total_amount), 2) as amount
    from public.shared_expenses se
    where se.house_id = v_house_id
      and se.status = 'active'
    group by se.paid_by_profile_id
  ),
  share_totals as (
    select
      ep.profile_id,
      round(sum(ep.share_amount), 2) as amount
    from public.expense_participants ep
    join public.shared_expenses se
      on se.id = ep.expense_id
    where se.house_id = v_house_id
      and se.status = 'active'
      and ep.is_waived = false
    group by ep.profile_id
  ),
  sent_payments as (
    select
      p.from_profile_id as profile_id,
      round(sum(p.amount), 2) as amount
    from public.payments p
    where p.house_id = v_house_id
      and p.status = 'completed'
    group by p.from_profile_id
  ),
  received_payments as (
    select
      p.to_profile_id as profile_id,
      round(sum(p.amount), 2) as amount
    from public.payments p
    where p.house_id = v_house_id
      and p.status = 'completed'
    group by p.to_profile_id
  )
  select
    am.profile_id,
    am.member_name,
    round(
      coalesce(pt.amount, 0)
      - coalesce(st.amount, 0)
      + coalesce(sp.amount, 0)
      - coalesce(rp.amount, 0),
      2
    ) as balance
  from active_members am
  left join paid_totals pt on pt.profile_id = am.profile_id
  left join share_totals st on st.profile_id = am.profile_id
  left join sent_payments sp on sp.profile_id = am.profile_id
  left join received_payments rp on rp.profile_id = am.profile_id;

  loop
    select profile_id, member_name, balance
    into v_creditor_id, v_creditor_name, v_credit
    from pg_temp.tmp_settlement_balances
    where balance > 0.009
    order by balance desc
    limit 1;

    select profile_id, member_name, balance
    into v_debtor_id, v_debtor_name, v_debt
    from pg_temp.tmp_settlement_balances
    where balance < -0.009
    order by balance asc
    limit 1;

    exit when v_creditor_id is null or v_debtor_id is null;

    v_transfer := round(least(v_credit, abs(v_debt)), 2);

    exit when v_transfer <= 0;

    from_profile_id := v_debtor_id;
    from_name := v_debtor_name;
    to_profile_id := v_creditor_id;
    to_name := v_creditor_name;
    amount := v_transfer;
    return next;

    update pg_temp.tmp_settlement_balances
    set balance = round(balance - v_transfer, 2)
    where profile_id = v_creditor_id;

    update pg_temp.tmp_settlement_balances
    set balance = round(balance + v_transfer, 2)
    where profile_id = v_debtor_id;

    v_creditor_id := null;
    v_debtor_id := null;
  end loop;
end;
$$;


create or replace function public.get_house_expenses_dashboard(
  p_house_public_code text,
  p_ticket_limit int default 5,
  p_expense_limit int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_result jsonb;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select jsonb_build_object(
    'house', (
      select jsonb_build_object(
        'id', h.id,
        'name', h.name,
        'public_code', h.public_code
      )
      from public.houses h
      where h.id = v_house_id
    ),
    'tickets', coalesce((
      select jsonb_agg(to_jsonb(t))
      from public.get_house_purchase_tickets(p_house_public_code, p_ticket_limit) t
    ), '[]'::jsonb),
    'shared_expenses', coalesce((
      select jsonb_agg(to_jsonb(e))
      from public.get_house_shared_expenses(p_house_public_code, p_expense_limit) e
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(to_jsonb(s))
      from public.get_house_payment_simplification(p_house_public_code) s
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;


grant execute on function public.profile_display_name(uuid) to authenticated;
grant execute on function public.get_accessible_house_id(text) to authenticated;
grant execute on function public.get_house_purchase_tickets(text, int) to authenticated;


-- =========================================================
-- AREA GRUPAL - LISTA DE LA COMPRA Y PRESUPUESTO MENSUAL
-- Añadido al final sin tocar bloques anteriores.
-- =========================================================

create table if not exists public.house_shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  text text not null,
  is_checked boolean not null default false,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  checked_by_profile_id uuid references public.profiles(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists house_shopping_list_items_house_created_idx
on public.house_shopping_list_items (house_id, created_at desc);

drop trigger if exists set_house_shopping_list_items_updated_at on public.house_shopping_list_items;
create trigger set_house_shopping_list_items_updated_at
before update on public.house_shopping_list_items
for each row execute function public.set_updated_at();

create table if not exists public.house_monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  budget_month date not null,
  amount numeric(10,2) not null default 0 check (amount >= 0),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (house_id, budget_month)
);

create index if not exists house_monthly_budgets_house_month_idx
on public.house_monthly_budgets (house_id, budget_month desc);

drop trigger if exists set_house_monthly_budgets_updated_at on public.house_monthly_budgets;
create trigger set_house_monthly_budgets_updated_at
before update on public.house_monthly_budgets
for each row execute function public.set_updated_at();

alter table public.house_shopping_list_items enable row level security;
alter table public.house_monthly_budgets enable row level security;

drop policy if exists "house_shopping_list_items_select_if_member" on public.house_shopping_list_items;
create policy "house_shopping_list_items_select_if_member"
on public.house_shopping_list_items
for select
to authenticated
using (
  exists (
    select 1
    from public.house_members hm
    where hm.house_id = house_shopping_list_items.house_id
      and hm.profile_id = auth.uid()
      and hm.is_active = true
  )
);

drop policy if exists "house_shopping_list_items_modify_if_member" on public.house_shopping_list_items;
create policy "house_shopping_list_items_modify_if_member"
on public.house_shopping_list_items
for all
to authenticated
using (
  exists (
    select 1
    from public.house_members hm
    where hm.house_id = house_shopping_list_items.house_id
      and hm.profile_id = auth.uid()
      and hm.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.house_members hm
    where hm.house_id = house_shopping_list_items.house_id
      and hm.profile_id = auth.uid()
      and hm.is_active = true
  )
);

drop policy if exists "house_monthly_budgets_select_if_member" on public.house_monthly_budgets;
create policy "house_monthly_budgets_select_if_member"
on public.house_monthly_budgets
for select
to authenticated
using (
  exists (
    select 1
    from public.house_members hm
    where hm.house_id = house_monthly_budgets.house_id
      and hm.profile_id = auth.uid()
      and hm.is_active = true
  )
);

drop policy if exists "house_monthly_budgets_modify_if_admin" on public.house_monthly_budgets;
create policy "house_monthly_budgets_modify_if_admin"
on public.house_monthly_budgets
for all
to authenticated
using (
  public.is_house_admin(house_monthly_budgets.house_id)
  or public.is_house_creator(house_monthly_budgets.house_id)
)
with check (
  public.is_house_admin(house_monthly_budgets.house_id)
  or public.is_house_creator(house_monthly_budgets.house_id)
);

create or replace function public.get_house_monthly_budget(
  p_house_public_code text,
  p_target_month date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_budget_month date;
  v_amount numeric(10,2);
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);
  v_budget_month := date_trunc('month', coalesce(p_target_month, current_date))::date;

  select hmb.amount
  into v_amount
  from public.house_monthly_budgets hmb
  where hmb.house_id = v_house_id
    and hmb.budget_month = v_budget_month
  limit 1;

  return jsonb_build_object(
    'budget_month', to_char(v_budget_month, 'YYYY-MM'),
    'budget_amount', coalesce(v_amount, 0),
    'can_edit',
      (
        public.is_house_admin(v_house_id)
        or public.is_house_creator(v_house_id)
      )
  );
end;
$$;

grant execute on function public.get_house_monthly_budget(text, date) to authenticated;

create or replace function public.set_house_monthly_budget(
  p_house_public_code text,
  p_amount numeric,
  p_target_month date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_budget_month date;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not (
    public.is_house_admin(v_house_id)
    or public.is_house_creator(v_house_id)
  ) then
    raise exception 'No autorizado para actualizar el presupuesto';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'El presupuesto debe ser 0 o mayor';
  end if;

  v_budget_month := date_trunc('month', coalesce(p_target_month, current_date))::date;

  insert into public.house_monthly_budgets (
    house_id,
    budget_month,
    amount,
    created_by_profile_id,
    updated_by_profile_id
  )
  values (
    v_house_id,
    v_budget_month,
    round(p_amount, 2),
    auth.uid(),
    auth.uid()
  )
  on conflict (house_id, budget_month)
  do update set
    amount = excluded.amount,
    updated_by_profile_id = auth.uid(),
    updated_at = now();

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'house_monthly_budget',
    null,
    'updated',
    jsonb_build_object(
      'budget_month', to_char(v_budget_month, 'YYYY-MM'),
      'amount', round(p_amount, 2)
    )
  );

  return jsonb_build_object(
    'budget_month', to_char(v_budget_month, 'YYYY-MM'),
    'budget_amount', round(p_amount, 2)
  );
end;
$$;

grant execute on function public.set_house_monthly_budget(text, numeric, date) to authenticated;

create or replace function public.get_house_shopping_list(
  p_house_public_code text
)
returns table (
  item_id uuid,
  text text,
  is_checked boolean,
  created_at timestamptz,
  created_by_profile_id uuid,
  created_by_name text,
  checked_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    hsli.id as item_id,
    hsli.text,
    hsli.is_checked,
    hsli.created_at,
    hsli.created_by_profile_id,
    public.profile_display_name(hsli.created_by_profile_id) as created_by_name,
    hsli.checked_at
  from public.house_shopping_list_items hsli
  where hsli.house_id = v_house_id
  order by hsli.is_checked asc, hsli.created_at desc;
end;
$$;

grant execute on function public.get_house_shopping_list(text) to authenticated;

create or replace function public.add_house_shopping_list_item(
  p_house_public_code text,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_item_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if p_text is null or length(trim(p_text)) = 0 then
    raise exception 'Debes escribir un artículo';
  end if;

  insert into public.house_shopping_list_items (
    house_id,
    text,
    created_by_profile_id
  )
  values (
    v_house_id,
    trim(p_text),
    auth.uid()
  )
  returning id into v_item_id;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'shopping_list_item',
    v_item_id,
    'created',
    jsonb_build_object('text', trim(p_text))
  );

  return jsonb_build_object('item_id', v_item_id);
end;
$$;

grant execute on function public.add_house_shopping_list_item(text, text) to authenticated;

create or replace function public.toggle_house_shopping_list_item(
  p_house_public_code text,
  p_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_item public.house_shopping_list_items%rowtype;
  v_next_checked boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select *
  into v_item
  from public.house_shopping_list_items hsli
  where hsli.id = p_item_id
    and hsli.house_id = v_house_id
  limit 1;

  if v_item.id is null then
    raise exception 'El artículo no existe';
  end if;

  v_next_checked := not v_item.is_checked;

  update public.house_shopping_list_items
  set
    is_checked = v_next_checked,
    checked_at = case when v_next_checked then now() else null end,
    checked_by_profile_id = case when v_next_checked then auth.uid() else null end,
    updated_at = now()
  where id = v_item.id;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'shopping_list_item',
    v_item.id,
    case when v_next_checked then 'checked' else 'unchecked' end,
    jsonb_build_object(
      'text', v_item.text,
      'is_checked', v_next_checked
    )
  );

  return jsonb_build_object(
    'item_id', v_item.id,
    'is_checked', v_next_checked
  );
end;
$$;

grant execute on function public.toggle_house_shopping_list_item(text, uuid) to authenticated;

create or replace function public.delete_house_shopping_list_item(
  p_house_public_code text,
  p_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_item public.house_shopping_list_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select *
  into v_item
  from public.house_shopping_list_items hsli
  where hsli.id = p_item_id
    and hsli.house_id = v_house_id
  limit 1;

  if v_item.id is null then
    raise exception 'El artículo no existe';
  end if;

  delete from public.house_shopping_list_items
  where id = v_item.id;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'shopping_list_item',
    v_item.id,
    'deleted',
    jsonb_build_object('text', v_item.text)
  );

  return jsonb_build_object('item_id', v_item.id);
end;
$$;

grant execute on function public.delete_house_shopping_list_item(text, uuid) to authenticated;

create or replace function public.clear_house_shopping_list(
  p_house_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_deleted_count int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  with deleted_rows as (
    delete from public.house_shopping_list_items hsli
    where hsli.house_id = v_house_id
    returning hsli.id
  )
  select count(*)::int
  into v_deleted_count
  from deleted_rows;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'shopping_list',
    null,
    'cleared',
    jsonb_build_object('deleted_count', coalesce(v_deleted_count, 0))
  );

  return jsonb_build_object('deleted_count', coalesce(v_deleted_count, 0));
end;
$$;

grant execute on function public.clear_house_shopping_list(text) to authenticated;
grant execute on function public.get_house_shared_expenses(text, int) to authenticated;
grant execute on function public.get_house_payment_simplification(text) to authenticated;
grant execute on function public.get_house_expenses_dashboard(text, int, int) to authenticated;


-- =========================================================
-- 7) INSERTS DE PRUEBA
-- Casa usada: 3f8c1d05-3b06-4969-ac22-ee3d3ee0ed5d
-- Miembros usados:
--   Adrián       -> eb07d3f6-902f-4f4a-a842-8a9c7e28b947
--   Manuela Ruiz -> 48d7f9ee-08c9-42c2-aa8b-5b0cb935dc1c
--   Manuela Palma-> 28b04090-7e3f-4a0f-a0a2-3425cafaf999
-- =========================================================

do $$
declare
  v_house_id uuid := '3f8c1d05-3b06-4969-ac22-ee3d3ee0ed5d';
  v_adrian uuid := 'eb07d3f6-902f-4f4a-a842-8a9c7e28b947';
  v_manu_ruiz uuid := '48d7f9ee-08c9-42c2-aa8b-5b0cb935dc1c';
  v_manu_palma uuid := '28b04090-7e3f-4a0f-a0a2-3425cafaf999';

  v_ticket_mercadona uuid;
  v_ticket_papel uuid;

  v_expense_mercadona uuid;
  v_expense_wifi uuid;
  v_expense_papel uuid;
begin
  if not exists (
    select 1 from public.houses where id = v_house_id
  ) then
    raise exception 'No existe la casa de pruebas %', v_house_id;
  end if;

  -- -----------------------------------------
  -- TICKET 1: MERCADONA
  -- -----------------------------------------
  select pt.id
  into v_ticket_mercadona
  from public.purchase_tickets pt
  where pt.house_id = v_house_id
    and pt.merchant = 'Mercadona'
    and pt.purchase_date = date '2026-03-26'
    and pt.total_amount = 23.00
  limit 1;

  if v_ticket_mercadona is null then
    insert into public.purchase_tickets (
      house_id,
      paid_by_profile_id,
      created_by_profile_id,
      merchant,
      title,
      purchase_date,
      total_amount,
      currency,
      ticket_file_path,
      notes
    )
    values (
      v_house_id,
      v_adrian,
      v_adrian,
      'Mercadona',
      'Compra Mercadona',
      date '2026-03-26',
      23.00,
      'EUR',
      'tickets/mercadona-2026-03-26.jpg',
      'Compra semanal del piso'
    )
    returning id into v_ticket_mercadona;

    insert into public.purchase_ticket_items (ticket_id, description, quantity, unit_price)
    values
      (v_ticket_mercadona, 'Leche', 2, 1.35),
      (v_ticket_mercadona, 'Pasta', 3, 1.20),
      (v_ticket_mercadona, 'Fruta', 1, 6.50),
      (v_ticket_mercadona, 'Limpieza', 1, 10.20);
  end if;

  -- -----------------------------------------
  -- TICKET 2: PAPEL
  -- -----------------------------------------
  select pt.id
  into v_ticket_papel
  from public.purchase_tickets pt
  where pt.house_id = v_house_id
    and pt.merchant = 'Carrefour'
    and pt.purchase_date = date '2026-03-27'
    and pt.total_amount = 25.00
  limit 1;

  if v_ticket_papel is null then
    insert into public.purchase_tickets (
      house_id,
      paid_by_profile_id,
      created_by_profile_id,
      merchant,
      title,
      purchase_date,
      total_amount,
      currency,
      ticket_file_path,
      notes
    )
    values (
      v_house_id,
      v_manu_palma,
      v_manu_palma,
      'Carrefour',
      'Compra papel',
      date '2026-03-27',
      25.00,
      'EUR',
      'tickets/papel-2026-03-27.jpg',
      'Papel, servilletas y bolsas'
    )
    returning id into v_ticket_papel;

    insert into public.purchase_ticket_items (ticket_id, description, quantity, unit_price)
    values
      (v_ticket_papel, 'Papel higiénico', 2, 6.00),
      (v_ticket_papel, 'Servilletas', 3, 2.50),
      (v_ticket_papel, 'Bolsas basura', 2, 2.75);
  end if;

  -- -----------------------------------------
  -- GASTO COMPARTIDO 1: MERCADONA
  -- Reparto para 3 personas
  -- -----------------------------------------
  select se.id
  into v_expense_mercadona
  from public.shared_expenses se
  where se.house_id = v_house_id
    and se.title = 'Compra Mercadona'
    and se.expense_date = date '2026-03-26'
  limit 1;

  if v_expense_mercadona is null then
    insert into public.shared_expenses (
      house_id,
      source_ticket_id,
      created_by_profile_id,
      paid_by_profile_id,
      title,
      description,
      expense_type,
      expense_date,
      total_amount,
      currency,
      split_method
    )
    values (
      v_house_id,
      v_ticket_mercadona,
      v_adrian,
      v_adrian,
      'Compra Mercadona',
      'Compra compartida del piso',
      'ticket',
      date '2026-03-26',
      23.00,
      'EUR',
      'equal'
    )
    returning id into v_expense_mercadona;

    insert into public.expense_participants (
      expense_id,
      profile_id,
      share_amount,
      status
    )
    values
      (v_expense_mercadona, v_adrian,      7.67, 'pending'),
      (v_expense_mercadona, v_manu_palma,  7.67, 'pending'),
      (v_expense_mercadona, v_manu_ruiz,   7.66, 'pending');
  end if;

  -- -----------------------------------------
  -- GASTO COMPARTIDO 2: WIFI
  -- Reparto para 3 personas
  -- -----------------------------------------
  select se.id
  into v_expense_wifi
  from public.shared_expenses se
  where se.house_id = v_house_id
    and se.title = 'Factura del wifi'
    and se.expense_date = date '2026-03-28'
  limit 1;

  if v_expense_wifi is null then
    insert into public.shared_expenses (
      house_id,
      source_ticket_id,
      created_by_profile_id,
      paid_by_profile_id,
      title,
      description,
      expense_type,
      expense_date,
      total_amount,
      currency,
      split_method
    )
    values (
      v_house_id,
      null,
      v_manu_ruiz,
      v_manu_ruiz,
      'Factura del wifi',
      'Factura mensual del wifi',
      'invoice',
      date '2026-03-28',
      36.00,
      'EUR',
      'equal'
    )
    returning id into v_expense_wifi;

    insert into public.expense_participants (
      expense_id,
      profile_id,
      share_amount,
      status
    )
    values
      (v_expense_wifi, v_adrian,      12.00, 'pending'),
      (v_expense_wifi, v_manu_palma,  12.00, 'pending'),
      (v_expense_wifi, v_manu_ruiz,   12.00, 'pending');
  end if;

  -- -----------------------------------------
  -- GASTO COMPARTIDO 3: PAPEL
  -- Reparto para 3 personas
  -- -----------------------------------------
  select se.id
  into v_expense_papel
  from public.shared_expenses se
  where se.house_id = v_house_id
    and se.title = 'Compra papel'
    and se.expense_date = date '2026-03-27'
  limit 1;

  if v_expense_papel is null then
    insert into public.shared_expenses (
      house_id,
      source_ticket_id,
      created_by_profile_id,
      paid_by_profile_id,
      title,
      description,
      expense_type,
      expense_date,
      total_amount,
      currency,
      split_method
    )
    values (
      v_house_id,
      v_ticket_papel,
      v_manu_palma,
      v_manu_palma,
      'Compra papel',
      'Papel y consumibles comunes',
      'ticket',
      date '2026-03-27',
      25.00,
      'EUR',
      'equal'
    )
    returning id into v_expense_papel;

    insert into public.expense_participants (
      expense_id,
      profile_id,
      share_amount,
      status
    )
    values
      (v_expense_papel, v_adrian,      8.33, 'pending'),
      (v_expense_papel, v_manu_palma,  8.33, 'pending'),
      (v_expense_papel, v_manu_ruiz,   8.34, 'pending');
  end if;
end $$;


-- =========================================================
-- 8) CONSULTAS RÁPIDAS DE PRUEBA
-- Reemplaza el public_code por el de tu casa si quieres probar
-- =========================================================

-- select * from public.get_house_purchase_tickets('TU_PUBLIC_CODE', 10);
-- select * from public.get_house_shared_expenses('TU_PUBLIC_CODE', 10);
-- select * from public.get_house_payment_simplification('TU_PUBLIC_CODE');
-- select public.get_house_expenses_dashboard('TU_PUBLIC_CODE', 10, 10);


-- =====================================================================
-- alteracion de la tabla de profiles que da un codigo para el usuario
-- =====================================================================
alter table public.profiles
add column if not exists public_code text;

create unique index if not exists profiles_public_code_uidx
on public.profiles (public_code);

do $$
declare
  r record;
  v_code text;
begin
  for r in
    select id
    from public.profiles
    where public_code is null
       or length(trim(public_code)) = 0
  loop
    v_code := public.generate_house_code(12);

    while exists (
      select 1
      from public.profiles
      where public_code = v_code
    ) loop
      v_code := public.generate_house_code(12);
    end loop;

    update public.profiles
    set public_code = v_code
    where id = r.id;
  end loop;
end $$;

-- =========================================================
-- CONVIVE - AÑADIR GASTO / PAGOS / AUDITORÍA
-- BLOQUE COMPLETO EN ORDEN Y CON DROPS
-- =========================================================


-- =========================================================
-- 0) LIMPIEZA DE FUNCIONES QUE PUEDEN CHOCAR
-- =========================================================

drop function if exists public.get_add_expense_form_options(text);
drop function if exists public.create_pending_ticket_expense(
  text,
  text,
  text,
  text,
  date,
  numeric,
  text[],
  uuid[],
  text,
  uuid
);
drop function if exists public.request_expense_payment_confirmation(
  text,
  uuid,
  text,
  numeric
);
drop function if exists public.admin_confirm_payment(text, uuid);
drop function if exists public.admin_reject_payment(text, uuid, text);
drop function if exists public.get_house_pending_payment_confirmations(text);
drop function if exists public.recalculate_expense_settlement(uuid);
drop function if exists public.is_house_admin(uuid);
drop function if exists public.profile_display_name(uuid);

-- estas dos son las que más suelen dar error por cambio de OUT params
drop function if exists public.get_house_shared_expenses(text, integer);
drop function if exists public.get_house_expenses_dashboard(text, integer, integer);


-- =========================================================
-- 1) AJUSTES SOBRE TABLAS YA EXISTENTES
-- =========================================================

alter table public.purchase_tickets
add column if not exists ticket_kind text not null default 'purchase';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_tickets_ticket_kind_check'
  ) then
    alter table public.purchase_tickets
    add constraint purchase_tickets_ticket_kind_check
    check (ticket_kind in ('purchase', 'unexpected'));
  end if;
end $$;


alter table public.shared_expenses
add column if not exists settlement_status text not null default 'open';

alter table public.shared_expenses
add column if not exists settled_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_expenses_settlement_status_check'
  ) then
    alter table public.shared_expenses
    add constraint shared_expenses_settlement_status_check
    check (settlement_status in ('open', 'partially_paid', 'settled'));
  end if;
end $$;


alter table public.payments
add column if not exists confirmed_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.payments
add column if not exists confirmed_at timestamptz;

alter table public.payments
add column if not exists rejected_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.payments
add column if not exists rejected_at timestamptz;

alter table public.payments
drop constraint if exists payments_status_check;

alter table public.payments
add constraint payments_status_check
check (status in ('pending', 'completed', 'cancelled', 'rejected'));


-- =========================================================
-- 2) TABLAS NUEVAS
-- =========================================================

create table if not exists public.house_item_catalog (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (house_id, normalized_name)
);

create table if not exists public.house_audit_log (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


-- =========================================================
-- 3) ÍNDICES
-- =========================================================

create index if not exists house_item_catalog_house_idx
on public.house_item_catalog (house_id, is_active, name);

create index if not exists house_audit_log_house_created_idx
on public.house_audit_log (house_id, created_at desc);

create index if not exists house_audit_log_entity_idx
on public.house_audit_log (entity_type, entity_id);

create index if not exists payments_related_expense_idx
on public.payments (related_expense_id, from_profile_id, status);


-- =========================================================
-- 4) TRIGGERS updated_at
-- Asume que public.set_updated_at() ya existe
-- =========================================================

drop trigger if exists set_purchase_tickets_updated_at on public.purchase_tickets;
create trigger set_purchase_tickets_updated_at
before update on public.purchase_tickets
for each row execute function public.set_updated_at();

drop trigger if exists set_shared_expenses_updated_at on public.shared_expenses;
create trigger set_shared_expenses_updated_at
before update on public.shared_expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_expense_participants_updated_at on public.expense_participants;
create trigger set_expense_participants_updated_at
before update on public.expense_participants
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();


-- =========================================================
-- 5) HELPERS
-- =========================================================

create function public.is_house_admin(p_house_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.house_members hm
      where hm.house_id = p_house_id
        and hm.profile_id = auth.uid()
        and hm.is_active = true
        and hm.role = 'admin'
    )
    or exists (
      select 1
      from public.houses h
      where h.id = p_house_id
        and h.created_by = auth.uid()
    );
$$;

grant execute on function public.is_house_admin(uuid) to authenticated;


create function public.profile_display_name(p_profile_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1))
  from public.profiles p
  where p.id = p_profile_id
$$;

grant execute on function public.profile_display_name(uuid) to authenticated;


create function public.recalculate_expense_settlement(p_expense_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_paid int;
  v_new_status text;
begin
  select count(*)::int
  into v_total
  from public.expense_participants ep
  where ep.expense_id = p_expense_id
    and ep.is_waived = false;

  select count(*)::int
  into v_paid
  from public.expense_participants ep
  where ep.expense_id = p_expense_id
    and ep.is_waived = false
    and ep.status = 'paid';

  if v_total = 0 then
    v_new_status := 'settled';
  elsif v_paid = 0 then
    v_new_status := 'open';
  elsif v_paid < v_total then
    v_new_status := 'partially_paid';
  else
    v_new_status := 'settled';
  end if;

  update public.shared_expenses
  set
    settlement_status = v_new_status,
    settled_at = case when v_new_status = 'settled' then now() else null end
  where id = p_expense_id;

  return v_new_status;
end;
$$;

grant execute on function public.recalculate_expense_settlement(uuid) to authenticated;


-- =========================================================
-- 6) RLS EN TABLAS NUEVAS
-- =========================================================

alter table public.house_item_catalog enable row level security;
alter table public.house_audit_log enable row level security;

drop policy if exists "house_item_catalog_select_if_member" on public.house_item_catalog;
create policy "house_item_catalog_select_if_member"
on public.house_item_catalog
for select
to authenticated
using (
  public.is_house_member(house_id)
  or public.is_house_creator(house_id)
);

drop policy if exists "house_audit_log_select_if_admin" on public.house_audit_log;
create policy "house_audit_log_select_if_admin"
on public.house_audit_log
for select
to authenticated
using (
  public.is_house_creator(house_id)
  or public.is_house_admin(house_id)
);


-- =========================================================
-- 7) OPCIONES PARA EL FORMULARIO "AÑADIR GASTO"
-- Miembros + artículos guardados a mano
-- =========================================================

create function public.get_add_expense_form_options(
  p_house_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_result jsonb;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'profile_id', hm.profile_id,
          'display_name', public.profile_display_name(hm.profile_id),
          'role', hm.role
        )
        order by public.profile_display_name(hm.profile_id)
      )
      from public.house_members hm
      where hm.house_id = v_house_id
        and hm.is_active = true
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item_id', hic.id,
          'name', hic.name
        )
        order by hic.name
      )
      from public.house_item_catalog hic
      where hic.house_id = v_house_id
        and hic.is_active = true
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_add_expense_form_options(text) to authenticated;


-- =========================================================
-- 8) CREAR GASTO PENDIENTE DESDE LA PANTALLA
-- Crea:
-- - purchase_tickets
-- - purchase_ticket_items
-- - house_item_catalog
-- - shared_expenses
-- - expense_participants
-- - auditoría
-- =========================================================

create function public.create_pending_ticket_expense(
  p_house_public_code text,
  p_ticket_kind text,
  p_title text,
  p_merchant text,
  p_purchase_date date,
  p_total_amount numeric,
  p_item_names text[],
  p_participant_profile_ids uuid[],
  p_notes text default null,
  p_paid_by_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_paid_by_profile_id uuid;
  v_ticket_id uuid;
  v_expense_id uuid;
  v_count int;
  v_valid_count int;
  v_base_share numeric(10,2);
  v_share numeric(10,2);
  v_remaining numeric(10,2);
  v_i int;
  v_item_name text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not (public.is_house_member(v_house_id) or public.is_house_creator(v_house_id)) then
    raise exception 'Sin acceso a la casa';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'El importe total debe ser mayor que 0';
  end if;

  if p_purchase_date is null then
    raise exception 'La fecha de compra es obligatoria';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'El título es obligatorio';
  end if;

  if p_ticket_kind is null or p_ticket_kind not in ('purchase', 'unexpected') then
    raise exception 'Tipo de ticket no válido';
  end if;

  v_paid_by_profile_id := coalesce(p_paid_by_profile_id, auth.uid());

  if not exists (
    select 1
    from public.house_members hm
    where hm.house_id = v_house_id
      and hm.profile_id = v_paid_by_profile_id
      and hm.is_active = true
  ) then
    raise exception 'La persona que paga no pertenece a la casa';
  end if;

  v_count := coalesce(array_length(p_participant_profile_ids, 1), 0);

  if v_count = 0 then
    raise exception 'Debes seleccionar al menos un participante';
  end if;

  select count(distinct x.profile_id)::int
  into v_valid_count
  from unnest(p_participant_profile_ids) as x(profile_id)
  join public.house_members hm
    on hm.house_id = v_house_id
   and hm.profile_id = x.profile_id
   and hm.is_active = true;

  if v_valid_count <> v_count then
    raise exception 'Hay participantes que no pertenecen a la casa o están repetidos';
  end if;

  insert into public.purchase_tickets (
    house_id,
    paid_by_profile_id,
    created_by_profile_id,
    merchant,
    title,
    purchase_date,
    total_amount,
    currency,
    notes,
    ticket_kind,
    status
  )
  values (
    v_house_id,
    v_paid_by_profile_id,
    auth.uid(),
    coalesce(nullif(trim(p_merchant), ''), 'Manual'),
    trim(p_title),
    p_purchase_date,
    round(p_total_amount, 2),
    'EUR',
    p_notes,
    p_ticket_kind,
    'active'
  )
  returning id into v_ticket_id;

  if p_item_names is not null then
    foreach v_item_name in array p_item_names
    loop
      if v_item_name is not null and length(trim(v_item_name)) > 0 then
        insert into public.purchase_ticket_items (
          ticket_id,
          description,
          quantity,
          unit_price
        )
        values (
          v_ticket_id,
          trim(v_item_name),
          1,
          0
        );

        insert into public.house_item_catalog (
          house_id,
          name,
          created_by_profile_id,
          is_active
        )
        values (
          v_house_id,
          trim(v_item_name),
          auth.uid(),
          true
        )
        on conflict (house_id, normalized_name)
        do update set is_active = true;
      end if;
    end loop;
  end if;

  insert into public.shared_expenses (
    house_id,
    source_ticket_id,
    created_by_profile_id,
    paid_by_profile_id,
    title,
    description,
    expense_type,
    expense_date,
    total_amount,
    currency,
    split_method,
    status,
    settlement_status
  )
  values (
    v_house_id,
    v_ticket_id,
    auth.uid(),
    v_paid_by_profile_id,
    trim(p_title),
    p_notes,
    'ticket',
    p_purchase_date,
    round(p_total_amount, 2),
    'EUR',
    'equal',
    'active',
    'open'
  )
  returning id into v_expense_id;

  v_base_share := trunc((p_total_amount / v_count)::numeric, 2);
  v_remaining := round(p_total_amount, 2);

  for v_i in 1..v_count
  loop
    if v_i < v_count then
      v_share := v_base_share;
    else
      v_share := round(v_remaining, 2);
    end if;

    insert into public.expense_participants (
      expense_id,
      profile_id,
      share_amount,
      status
    )
    values (
      v_expense_id,
      p_participant_profile_ids[v_i],
      v_share,
      'pending'
    );

    v_remaining := round(v_remaining - v_share, 2);
  end loop;

  perform public.recalculate_expense_settlement(v_expense_id);

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'shared_expense',
    v_expense_id,
    'created',
    jsonb_build_object(
      'ticket_id', v_ticket_id,
      'ticket_kind', p_ticket_kind,
      'title', p_title,
      'merchant', p_merchant,
      'purchase_date', p_purchase_date,
      'total_amount', round(p_total_amount, 2),
      'participant_profile_ids', to_jsonb(p_participant_profile_ids),
      'item_names', to_jsonb(p_item_names)
    )
  );

  return jsonb_build_object(
    'ticket_id', v_ticket_id,
    'expense_id', v_expense_id,
    'house_public_code', p_house_public_code
  );
end;
$$;

grant execute on function public.create_pending_ticket_expense(
  text,
  text,
  text,
  text,
  date,
  numeric,
  text[],
  uuid[],
  text,
  uuid
) to authenticated;


-- =========================================================
-- 9) USUARIO MARCA SU PARTE COMO PAGADA
-- Queda pendiente de confirmación de admin
-- =========================================================

create function public.request_expense_payment_confirmation(
  p_house_public_code text,
  p_expense_id uuid,
  p_note text default null,
  p_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_expense public.shared_expenses%rowtype;
  v_participant public.expense_participants%rowtype;
  v_amount numeric(10,2);
  v_payment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select *
  into v_expense
  from public.shared_expenses se
  where se.id = p_expense_id
    and se.house_id = v_house_id
    and se.status = 'active'
  limit 1;

  if v_expense.id is null then
    raise exception 'Gasto no encontrado';
  end if;

  select *
  into v_participant
  from public.expense_participants ep
  where ep.expense_id = p_expense_id
    and ep.profile_id = auth.uid()
  limit 1;

  if v_participant.id is null then
    raise exception 'No participas en este gasto';
  end if;

  if v_participant.status = 'paid' then
    raise exception 'Tu parte ya está marcada como pagada';
  end if;

  if exists (
    select 1
    from public.payments p
    where p.related_expense_id = p_expense_id
      and p.from_profile_id = auth.uid()
      and p.status = 'pending'
  ) then
    raise exception 'Ya tienes una confirmación pendiente para este gasto';
  end if;

  v_amount := coalesce(p_amount, v_participant.share_amount);

  if v_amount <= 0 then
    raise exception 'El importe debe ser mayor que 0';
  end if;

  insert into public.payments (
    house_id,
    from_profile_id,
    to_profile_id,
    related_expense_id,
    created_by_profile_id,
    amount,
    payment_date,
    status,
    note
  )
  values (
    v_house_id,
    auth.uid(),
    v_expense.paid_by_profile_id,
    p_expense_id,
    auth.uid(),
    round(v_amount, 2),
    current_date,
    'pending',
    p_note
  )
  returning id into v_payment_id;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'payment',
    v_payment_id,
    'requested_confirmation',
    jsonb_build_object(
      'expense_id', p_expense_id,
      'amount', round(v_amount, 2),
      'note', p_note
    )
  );

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'status', 'pending'
  );
end;
$$;

grant execute on function public.request_expense_payment_confirmation(
  text,
  uuid,
  text,
  numeric
) to authenticated;


-- =========================================================
-- 10) SOLO ADMIN PUEDE ACEPTAR COMO PAGADO
-- =========================================================

create function public.admin_confirm_payment(
  p_house_public_code text,
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_payment public.payments%rowtype;
  v_share_amount numeric(10,2);
  v_completed_sum numeric(10,2);
  v_new_status text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not public.is_house_admin(v_house_id) then
    raise exception 'Solo un admin puede aceptar pagos';
  end if;

  select *
  into v_payment
  from public.payments p
  where p.id = p_payment_id
    and p.house_id = v_house_id
  limit 1;

  if v_payment.id is null then
    raise exception 'Pago no encontrado';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Este pago ya no está pendiente';
  end if;

  update public.payments
  set
    status = 'completed',
    confirmed_by_profile_id = auth.uid(),
    confirmed_at = now(),
    updated_at = now()
  where id = p_payment_id;

  if v_payment.related_expense_id is not null then
    select ep.share_amount
    into v_share_amount
    from public.expense_participants ep
    where ep.expense_id = v_payment.related_expense_id
      and ep.profile_id = v_payment.from_profile_id
    limit 1;

    select coalesce(sum(p.amount), 0)::numeric(10,2)
    into v_completed_sum
    from public.payments p
    where p.related_expense_id = v_payment.related_expense_id
      and p.from_profile_id = v_payment.from_profile_id
      and p.status = 'completed';

    if v_completed_sum >= v_share_amount then
      update public.expense_participants
      set
        status = 'paid',
        updated_at = now()
      where expense_id = v_payment.related_expense_id
        and profile_id = v_payment.from_profile_id;
    end if;

    v_new_status := public.recalculate_expense_settlement(v_payment.related_expense_id);
  else
    v_new_status := null;
  end if;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'payment',
    p_payment_id,
    'confirmed',
    jsonb_build_object(
      'related_expense_id', v_payment.related_expense_id,
      'from_profile_id', v_payment.from_profile_id,
      'amount', v_payment.amount,
      'expense_settlement_status', v_new_status
    )
  );

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'status', 'completed',
    'expense_settlement_status', v_new_status
  );
end;
$$;

grant execute on function public.admin_confirm_payment(text, uuid) to authenticated;


-- =========================================================
-- 11) SOLO ADMIN PUEDE RECHAZAR
-- =========================================================

create function public.admin_reject_payment(
  p_house_public_code text,
  p_payment_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_payment public.payments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not public.is_house_admin(v_house_id) then
    raise exception 'Solo un admin puede rechazar pagos';
  end if;

  select *
  into v_payment
  from public.payments p
  where p.id = p_payment_id
    and p.house_id = v_house_id
  limit 1;

  if v_payment.id is null then
    raise exception 'Pago no encontrado';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Este pago ya no está pendiente';
  end if;

  update public.payments
  set
    status = 'rejected',
    rejected_by_profile_id = auth.uid(),
    rejected_at = now(),
    updated_at = now(),
    note = coalesce(v_payment.note || ' | ', '') || coalesce(p_reason, '')
  where id = p_payment_id;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'payment',
    p_payment_id,
    'rejected',
    jsonb_build_object(
      'reason', p_reason
    )
  );

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'status', 'rejected'
  );
end;
$$;

grant execute on function public.admin_reject_payment(text, uuid, text) to authenticated;


-- =========================================================
-- 12) LISTADO DE PAGOS PENDIENTES PARA ADMIN
-- =========================================================

create function public.get_house_pending_payment_confirmations(
  p_house_public_code text
)
returns table (
  payment_id uuid,
  expense_id uuid,
  expense_title text,
  from_profile_id uuid,
  from_name text,
  to_profile_id uuid,
  to_name text,
  amount numeric(10,2),
  payment_date date,
  note text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not public.is_house_admin(v_house_id) then
    raise exception 'Solo un admin puede ver confirmaciones pendientes';
  end if;

  return query
  select
    p.id as payment_id,
    p.related_expense_id as expense_id,
    se.title as expense_title,
    p.from_profile_id,
    public.profile_display_name(p.from_profile_id) as from_name,
    p.to_profile_id,
    public.profile_display_name(p.to_profile_id) as to_name,
    p.amount,
    p.payment_date,
    p.note,
    p.status
  from public.payments p
  left join public.shared_expenses se
    on se.id = p.related_expense_id
  where p.house_id = v_house_id
    and p.status = 'pending'
  order by p.created_at desc;
end;
$$;

grant execute on function public.get_house_pending_payment_confirmations(text) to authenticated;


-- =========================================================
-- 13) get_house_shared_expenses NUEVA VERSIÓN
-- Los gastos liquidados desaparecen de la pantalla
-- =========================================================

create function public.get_house_shared_expenses(
  p_house_public_code text,
  p_limit int default 5
)
returns table (
  expense_id uuid,
  title text,
  expense_type text,
  expense_date date,
  paid_by_name text,
  participants_text text,
  participants_count int,
  total_amount numeric(10,2),
  currency text,
  source_ticket_id uuid,
  settlement_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    se.id as expense_id,
    se.title,
    se.expense_type,
    se.expense_date,
    public.profile_display_name(se.paid_by_profile_id) as paid_by_name,
    coalesce(participants.participants_text, '') as participants_text,
    coalesce(participants.participants_count, 0) as participants_count,
    se.total_amount,
    se.currency,
    se.source_ticket_id,
    se.settlement_status
  from public.shared_expenses se
  left join lateral (
    select
      string_agg(
        public.profile_display_name(ep.profile_id),
        ', '
        order by public.profile_display_name(ep.profile_id)
      ) as participants_text,
      count(*)::int as participants_count
    from public.expense_participants ep
    where ep.expense_id = se.id
      and ep.is_waived = false
  ) participants on true
  where se.house_id = v_house_id
    and se.status = 'active'
    and coalesce(se.settlement_status, 'open') <> 'settled'
  order by se.expense_date desc, se.created_at desc
  limit greatest(p_limit, 1);
end;
$$;

grant execute on function public.get_house_shared_expenses(text, int) to authenticated;


-- =========================================================
-- 14) get_house_expenses_dashboard NUEVA VERSIÓN
-- Añade pagos pendientes para admin
-- =========================================================

create function public.get_house_expenses_dashboard(
  p_house_public_code text,
  p_ticket_limit int default 10,
  p_expense_limit int default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_result jsonb;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select jsonb_build_object(
    'house', (
      select jsonb_build_object(
        'id', h.id,
        'name', h.name,
        'public_code', h.public_code
      )
      from public.houses h
      where h.id = v_house_id
    ),
    'tickets', coalesce((
      select jsonb_agg(to_jsonb(t))
      from public.get_house_purchase_tickets(p_house_public_code, p_ticket_limit) t
    ), '[]'::jsonb),
    'shared_expenses', coalesce((
      select jsonb_agg(to_jsonb(e))
      from public.get_house_shared_expenses(p_house_public_code, p_expense_limit) e
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(to_jsonb(s))
      from public.get_house_payment_simplification(p_house_public_code) s
    ), '[]'::jsonb),
    'pending_payment_confirmations', case
      when public.is_house_admin(v_house_id) then coalesce((
        select jsonb_agg(to_jsonb(pp))
        from public.get_house_pending_payment_confirmations(p_house_public_code) pp
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_house_expenses_dashboard(text, int, int) to authenticated;


-- =========================================================
-- 15) INSERTS OPCIONALES DE CATÁLOGO MANUAL
-- =========================================================

insert into public.house_item_catalog (house_id, name, created_by_profile_id)
select
  '3f8c1d05-3b06-4969-ac22-ee3d3ee0ed5d'::uuid,
  x.name,
  'eb07d3f6-902f-4f4a-a842-8a9c7e28b947'::uuid
from (
  values
    ('Leche'),
    ('Huevos'),
    ('Agua'),
    ('Papel higiénico'),
    ('Detergente')
) as x(name)
on conflict (house_id, normalized_name)
do nothing;


-- =========================================================
-- 16) PRUEBAS RÁPIDAS
-- Sustituye TU_PUBLIC_CODE por el public_code real de tu casa
-- =========================================================

-- select public.get_add_expense_form_options('TU_PUBLIC_CODE');

-- select public.create_pending_ticket_expense(
--   'TU_PUBLIC_CODE',
--   'purchase',
--   'Compra Mercadona',
--   'Mercadona',
--   current_date,
--   24.50,
--   array['Leche', 'Huevos', 'Agua'],
--   array[
--     'eb07d3f6-902f-4f4a-a842-8a9c7e28b947'::uuid,
--     '48d7f9ee-08c9-42c2-aa8b-5b0cb935dc1c'::uuid,
--     '28b04090-7e3f-4a0f-a0a2-3425cafaf999'::uuid
--   ],
--   'Compra del sábado',
--   'eb07d3f6-902f-4f4a-a842-8a9c7e28b947'::uuid
-- );

-- select public.request_expense_payment_confirmation(
--   'TU_PUBLIC_CODE',
--   'UUID_DEL_EXPENSE',
--   'Bizum enviado'
-- );

-- select public.admin_confirm_payment(
--   'TU_PUBLIC_CODE',
--   'UUID_DEL_PAYMENT'
-- );

-- select public.admin_reject_payment(
--   'TU_PUBLIC_CODE',
--   'UUID_DEL_PAYMENT',
--   'No se ha recibido el Bizum'
-- );

-- select public.get_house_pending_payment_confirmations('TU_PUBLIC_CODE');

-- select public.get_house_expenses_dashboard('TU_PUBLIC_CODE', 10, 10);

-- select *
-- from public.house_audit_log
-- where house_id = '3f8c1d05-3b06-4969-ac22-ee3d3ee0ed5d'
-- order by created_at desc;

-- =========================================================
-- FIX PROFILES.PUBLIC_CODE
-- =========================================================

alter table public.profiles
add column if not exists public_code text;

create unique index if not exists profiles_public_code_uidx
on public.profiles (public_code);

do $$
declare
  r record;
  v_code text;
begin
  for r in
    select id
    from public.profiles
    where public_code is null
       or length(trim(public_code)) = 0
  loop
    v_code := public.generate_house_code(12);

    while exists (
      select 1
      from public.profiles
      where public_code = v_code
    ) loop
      v_code := public.generate_house_code(12);
    end loop;

    update public.profiles
    set public_code = v_code
    where id = r.id;
  end loop;
end $$;


create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := public.generate_house_code(12);

  while exists (
    select 1
    from public.profiles
    where public_code = v_code
  ) loop
    v_code := public.generate_house_code(12);
  end loop;

  insert into public.profiles (id, email, full_name, public_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_code
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    public_code = coalesce(public.profiles.public_code, excluded.public_code);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- CONVIVE - URL CON PUBLIC_CODE + INVITACIÓN SOLO CON HOUSE_INVITES.CODE
-- =========================================================


-- =========================================================
-- 0) HELPERS
-- =========================================================

create or replace function public.generate_invite_code(code_length int default 6)
returns text
language plpgsql
as $$
declare
  chars text := '0123456789';
  result text := '';
  i int;
begin
  for i in 1..code_length loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;

  return result;
end;
$$;


-- =========================================================
-- 1) ASEGURAR profiles.public_code
-- =========================================================

alter table public.profiles
add column if not exists public_code text;

create unique index if not exists profiles_public_code_uidx
on public.profiles (public_code);

do $$
declare
  r record;
  v_code text;
begin
  for r in
    select id
    from public.profiles
    where public_code is null
       or length(trim(public_code)) = 0
  loop
    v_code := public.generate_house_code(12);

    while exists (
      select 1
      from public.profiles
      where public_code = v_code
    ) loop
      v_code := public.generate_house_code(12);
    end loop;

    update public.profiles
    set public_code = v_code
    where id = r.id;
  end loop;
end $$;


-- =========================================================
-- 2) TRIGGER DE NUEVOS USUARIOS CON public_code
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := public.generate_house_code(12);

  while exists (
    select 1
    from public.profiles
    where public_code = v_code
  ) loop
    v_code := public.generate_house_code(12);
  end loop;

  insert into public.profiles (id, email, full_name, public_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_code
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    public_code = coalesce(public.profiles.public_code, excluded.public_code);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- =========================================================
-- 3) ASEGURAR houses.public_code
-- =========================================================

alter table public.houses
add column if not exists public_code text;

create unique index if not exists houses_public_code_uidx
on public.houses (public_code);

do $$
declare
  r record;
  v_code text;
begin
  for r in
    select id
    from public.houses
    where public_code is null
       or length(trim(public_code)) = 0
  loop
    v_code := public.generate_house_code(12);

    while exists (
      select 1
      from public.houses
      where public_code = v_code
    ) loop
      v_code := public.generate_house_code(12);
    end loop;

    update public.houses
    set public_code = v_code
    where id = r.id;
  end loop;
end $$;


-- =========================================================
-- 4) ASEGURAR INVITACIONES ACTIVAS PARA CASAS EXISTENTES
-- Si una casa no tiene invitación activa, se crea una.
-- join_code se mantiene solo por compatibilidad.
-- =========================================================

create unique index if not exists house_invites_code_uidx
on public.house_invites (code);

insert into public.house_invites (
  house_id,
  created_by,
  code,
  max_uses,
  used_count,
  is_active
)
select
  h.id,
  h.created_by,
  coalesce(nullif(trim(h.join_code), ''), public.generate_invite_code(6)),
  greatest(h.max_members - 1, 1),
  0,
  true
from public.houses h
where not exists (
  select 1
  from public.house_invites hi
  where hi.house_id = h.id
    and hi.is_active = true
);


-- =========================================================
-- 5) CREAR PISO
-- public_code solo para URL
-- house_invites.code solo para invitación
-- Se mantiene join_code por compatibilidad, pero no se usa para unirse.
-- =========================================================

create or replace function public.create_house(
  p_name text,
  p_max_members int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_public_code text;
  v_invite_code text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre del piso es obligatorio';
  end if;

  if p_max_members is null or p_max_members < 1 then
    raise exception 'El número de personas debe ser mayor que 0';
  end if;

  v_public_code := public.generate_house_code(12);

  while exists (
    select 1
    from public.houses
    where public_code = v_public_code
  ) loop
    v_public_code := public.generate_house_code(12);
  end loop;

  v_invite_code := public.generate_invite_code(6);

  while exists (
    select 1
    from public.house_invites
    where code = v_invite_code
  ) loop
    v_invite_code := public.generate_invite_code(6);
  end loop;

  insert into public.houses (
    name,
    created_by,
    join_code,
    public_code,
    max_members,
    status
  )
  values (
    trim(p_name),
    auth.uid(),
    v_invite_code,
    v_public_code,
    p_max_members,
    'active'
  )
  returning id into v_house_id;

  insert into public.house_members (
    house_id,
    profile_id,
    role
  )
  values (
    v_house_id,
    auth.uid(),
    'admin'
  );

  insert into public.house_invites (
    house_id,
    created_by,
    code,
    max_uses,
    used_count,
    is_active
  )
  values (
    v_house_id,
    auth.uid(),
    v_invite_code,
    greatest(p_max_members - 1, 1),
    0,
    true
  );

  return v_public_code;
end;
$$;

grant execute on function public.create_house(text, int) to authenticated;


-- =========================================================
-- 6) UNIRSE A PISO
-- SOLO por house_invites.code
-- YA NO por public_code
-- YA NO por join_code
-- =========================================================

drop function if exists public.join_house_by_code(text);

create function public.join_house_by_code(
  p_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses%rowtype;
  v_current_members int;
  v_invite public.house_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select hi.*
  into v_invite
  from public.house_invites hi
  where hi.code = trim(p_code)
    and hi.is_active = true
    and (hi.expires_at is null or hi.expires_at > now())
    and (
      hi.max_uses is null
      or hi.used_count < hi.max_uses
    )
  limit 1;

  if v_invite.id is null then
    raise exception 'Código de invitación no válido';
  end if;

  select *
  into v_house
  from public.houses
  where id = v_invite.house_id
    and status = 'active'
  limit 1;

  if v_house.id is null then
    raise exception 'Piso no disponible';
  end if;

  if exists (
    select 1
    from public.house_members
    where house_id = v_house.id
      and profile_id = auth.uid()
      and is_active = true
  ) then
    return v_house.public_code;
  end if;

  select count(*)
  into v_current_members
  from public.house_members
  where house_id = v_house.id
    and is_active = true;

  if v_current_members >= v_house.max_members then
    raise exception 'El piso ya está completo';
  end if;

  insert into public.house_members (
    house_id,
    profile_id,
    role
  )
  values (
    v_house.id,
    auth.uid(),
    'member'
  );

  update public.house_invites
  set used_count = used_count + 1
  where id = v_invite.id;

  return v_house.public_code;
end;
$$;

grant execute on function public.join_house_by_code(text) to authenticated;


-- =========================================================
-- 7) VER CÓDIGO DE INVITACIÓN ACTIVO
-- Solo admin/creador
-- =========================================================

create or replace function public.get_active_house_invite_code(
  p_house_public_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not (
    public.is_house_creator(v_house_id)
    or public.is_house_admin(v_house_id)
  ) then
    raise exception 'No autorizado para ver el código de invitación';
  end if;

  select hi.code
  into v_code
  from public.house_invites hi
  where hi.house_id = v_house_id
    and hi.is_active = true
    and (hi.expires_at is null or hi.expires_at > now())
  order by hi.created_at desc
  limit 1;

  return v_code;
end;
$$;

grant execute on function public.get_active_house_invite_code(text) to authenticated;


-- =========================================================
-- RPC CONTEXTO Y LECTURAS CENTRALIZADAS
-- Sustituye lecturas directas desde Next.js a profiles,
-- house_members, expense_participants y payments.
-- =========================================================

create or replace function public.get_authenticated_profile_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'public_code', p.public_code
  )
  into v_profile
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_profile is null or nullif(trim(v_profile ->> 'public_code'), '') is null then
    raise exception 'Perfil no encontrado';
  end if;

  return v_profile;
end;
$$;

grant execute on function public.get_authenticated_profile_context() to authenticated;


create or replace function public.get_accessible_house_context(
  p_user_public_code text,
  p_house_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_context jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_profile.id is null or nullif(trim(v_profile.public_code), '') is null then
    raise exception 'Perfil no encontrado';
  end if;

  if v_profile.public_code <> trim(p_user_public_code) then
    raise exception 'Usuario no encontrado';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'email', v_profile.email,
      'full_name', v_profile.full_name,
      'public_code', v_profile.public_code
    ),
    'house', jsonb_build_object(
      'id', h.id,
      'name', h.name,
      'public_code', h.public_code,
      'created_by', h.created_by
    ),
    'member_role', coalesce(hm.role, 'member')
  )
  into v_context
  from public.house_members hm
  join public.houses h on h.id = hm.house_id
  where hm.profile_id = auth.uid()
    and hm.is_active = true
    and h.public_code = trim(p_house_public_code)
    and h.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Piso no encontrado o sin acceso';
  end if;

  return v_context;
end;
$$;

grant execute on function public.get_accessible_house_context(text, text) to authenticated;


create or replace function public.get_default_dashboard_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_context jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_profile.id is null or nullif(trim(v_profile.public_code), '') is null then
    raise exception 'Perfil no encontrado';
  end if;

  select jsonb_build_object(
    'profile_public_code', v_profile.public_code,
    'house_public_code', h.public_code
  )
  into v_context
  from public.house_members hm
  join public.houses h on h.id = hm.house_id
  where hm.profile_id = auth.uid()
    and hm.is_active = true
    and h.status = 'active'
  order by hm.joined_at asc
  limit 1;

  return v_context;
end;
$$;

grant execute on function public.get_default_dashboard_context() to authenticated;


create or replace function public.get_current_user_expense_states(
  p_house_public_code text,
  p_expense_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_states jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_expense_ids is null or cardinality(p_expense_ids) = 0 then
    return '[]'::jsonb;
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  with requested_expenses as (
    select distinct unnest(p_expense_ids) as expense_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'expense_id', ep.expense_id,
        'profile_id', ep.profile_id,
        'share_amount', ep.share_amount,
        'participant_status', ep.status,
        'pending_payment_id', pending_payment.id,
        'pending_payment_amount', pending_payment.amount,
        'pending_payment_note', pending_payment.note
      )
      order by ep.expense_id
    ),
    '[]'::jsonb
  )
  into v_states
  from public.expense_participants ep
  join requested_expenses re on re.expense_id = ep.expense_id
  join public.shared_expenses se on se.id = ep.expense_id
  left join lateral (
    select p.id, p.amount, p.note
    from public.payments p
    where p.house_id = v_house_id
      and p.from_profile_id = auth.uid()
      and p.status = 'pending'
      and p.related_expense_id = ep.expense_id
    order by p.created_at desc
    limit 1
  ) pending_payment on true
  where se.house_id = v_house_id
    and ep.profile_id = auth.uid();

  return v_states;
end;
$$;

grant execute on function public.get_current_user_expense_states(text, uuid[]) to authenticated;


create or replace function public.get_house_member_count(
  p_house_public_code text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_member_count int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select count(*)::int
  into v_member_count
  from public.house_members hm
  where hm.house_id = v_house_id
    and hm.is_active = true;

  return coalesce(v_member_count, 0);
end;
$$;

grant execute on function public.get_house_member_count(text) to authenticated;


-- =========================================================
-- 8) REGENERAR CÓDIGO DE INVITACIÓN
-- Solo admin/creador
-- Desactiva el anterior y crea uno nuevo
-- =========================================================

create or replace function public.rotate_house_invite_code(
  p_house_public_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_created_by uuid;
  v_max_members int;
  v_new_code text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not (
    public.is_house_creator(v_house_id)
    or public.is_house_admin(v_house_id)
  ) then
    raise exception 'No autorizado para regenerar invitación';
  end if;

  select h.created_by, h.max_members
  into v_created_by, v_max_members
  from public.houses h
  where h.id = v_house_id
  limit 1;

  update public.house_invites
  set is_active = false
  where house_id = v_house_id
    and is_active = true;

  v_new_code := public.generate_invite_code(6);

  while exists (
    select 1
    from public.house_invites
    where code = v_new_code
  ) loop
    v_new_code := public.generate_invite_code(6);
  end loop;

  insert into public.house_invites (
    house_id,
    created_by,
    code,
    max_uses,
    used_count,
    is_active
  )
  values (
    v_house_id,
    v_created_by,
    v_new_code,
    greatest(v_max_members - 1, 1),
    0,
    true
  );

  return v_new_code;
end;
$$;

grant execute on function public.rotate_house_invite_code(text) to authenticated;


-- =========================================================
-- 9) RLS DE house_invites
-- Solo admin/creador puede leer invitaciones
-- =========================================================

alter table public.house_invites enable row level security;

drop policy if exists "invites_select_if_member" on public.house_invites;
drop policy if exists "house_invites_select_if_admin" on public.house_invites;

create policy "house_invites_select_if_admin"
on public.house_invites
for select
to authenticated
using (
  public.is_house_creator(house_id)
  or public.is_house_admin(house_id)
);

-- =========================================================
-- CONVIVE - PENDIENTES PERSONALES + HISTORIAL + REVISIÓN
-- CREADOR DEL GASTO O ADMIN
-- =========================================================

-- =========================================================
-- 0) LIMPIEZA DE FUNCIONES A REEMPLAZAR / CREAR
-- =========================================================

drop function if exists public.can_review_expense_payment(uuid, uuid);
drop function if exists public.get_my_pending_purchase_tickets(text, integer);
drop function if exists public.get_my_pending_shared_expenses(text, integer);
drop function if exists public.get_house_purchase_tickets_history(text, integer, integer);
drop function if exists public.get_house_shared_expenses_history(text, integer, integer);

drop function if exists public.create_pending_ticket_expense(
  text,
  text,
  text,
  text,
  date,
  numeric,
  text[],
  uuid[],
  text,
  uuid
);

drop function if exists public.request_expense_payment_confirmation(
  text,
  uuid,
  text,
  numeric
);

drop function if exists public.admin_confirm_payment(text, uuid);
drop function if exists public.admin_reject_payment(text, uuid, text);
drop function if exists public.get_house_pending_payment_confirmations(text);
drop function if exists public.get_house_expenses_dashboard(text, integer, integer);


-- =========================================================
-- 1) HELPER: QUIÉN PUEDE REVISAR/VALIDAR UN PAGO
-- Regla:
-- - el creador del gasto
-- - o un admin de la casa
-- =========================================================

create function public.can_review_expense_payment(
  p_house_id uuid,
  p_expense_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_house_admin(p_house_id)
    or exists (
      select 1
      from public.shared_expenses se
      where se.id = p_expense_id
        and se.house_id = p_house_id
        and se.created_by_profile_id = auth.uid()
    );
$$;

grant execute on function public.can_review_expense_payment(uuid, uuid) to authenticated;


-- =========================================================
-- 2) BACKFILL:
-- quien pagó el gasto debe quedar marcado como paid
-- si estaba como pending por el esquema anterior
-- =========================================================

update public.expense_participants ep
set
  status = 'paid',
  updated_at = now()
from public.shared_expenses se
where ep.expense_id = se.id
  and ep.profile_id = se.paid_by_profile_id
  and ep.status <> 'paid';

do $$
declare
  r record;
begin
  for r in
    select id
    from public.shared_expenses
  loop
    perform public.recalculate_expense_settlement(r.id);
  end loop;
end $$;


-- =========================================================
-- 3) CREAR GASTO:
-- el pagador queda automáticamente como paid
-- el resto como pending
-- =========================================================

create function public.create_pending_ticket_expense(
  p_house_public_code text,
  p_ticket_kind text,
  p_title text,
  p_merchant text,
  p_purchase_date date,
  p_total_amount numeric,
  p_item_names text[],
  p_participant_profile_ids uuid[],
  p_notes text default null,
  p_paid_by_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_paid_by_profile_id uuid;
  v_ticket_id uuid;
  v_expense_id uuid;
  v_count int;
  v_valid_count int;
  v_base_share numeric(10,2);
  v_share numeric(10,2);
  v_remaining numeric(10,2);
  v_i int;
  v_item_name text;
  v_participant_id uuid;
  v_participant_status text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not (public.is_house_member(v_house_id) or public.is_house_creator(v_house_id)) then
    raise exception 'Sin acceso a la casa';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'El importe total debe ser mayor que 0';
  end if;

  if p_purchase_date is null then
    raise exception 'La fecha de compra es obligatoria';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'El título es obligatorio';
  end if;

  if p_ticket_kind is null or p_ticket_kind not in ('purchase', 'unexpected') then
    raise exception 'Tipo de ticket no válido';
  end if;

  v_paid_by_profile_id := coalesce(p_paid_by_profile_id, auth.uid());

  if not exists (
    select 1
    from public.house_members hm
    where hm.house_id = v_house_id
      and hm.profile_id = v_paid_by_profile_id
      and hm.is_active = true
  ) then
    raise exception 'La persona que paga no pertenece a la casa';
  end if;

  v_count := coalesce(array_length(p_participant_profile_ids, 1), 0);

  if v_count = 0 then
    raise exception 'Debes seleccionar al menos un participante';
  end if;

  select count(distinct x.profile_id)::int
  into v_valid_count
  from unnest(p_participant_profile_ids) as x(profile_id)
  join public.house_members hm
    on hm.house_id = v_house_id
   and hm.profile_id = x.profile_id
   and hm.is_active = true;

  if v_valid_count <> v_count then
    raise exception 'Hay participantes que no pertenecen a la casa o están repetidos';
  end if;

  insert into public.purchase_tickets (
    house_id,
    paid_by_profile_id,
    created_by_profile_id,
    merchant,
    title,
    purchase_date,
    total_amount,
    currency,
    notes,
    ticket_kind,
    status
  )
  values (
    v_house_id,
    v_paid_by_profile_id,
    auth.uid(),
    coalesce(nullif(trim(p_merchant), ''), 'Manual'),
    trim(p_title),
    p_purchase_date,
    round(p_total_amount, 2),
    'EUR',
    p_notes,
    p_ticket_kind,
    'active'
  )
  returning id into v_ticket_id;

  if p_item_names is not null then
    foreach v_item_name in array p_item_names
    loop
      if v_item_name is not null and length(trim(v_item_name)) > 0 then
        insert into public.purchase_ticket_items (
          ticket_id,
          description,
          quantity,
          unit_price
        )
        values (
          v_ticket_id,
          trim(v_item_name),
          1,
          0
        );

        insert into public.house_item_catalog (
          house_id,
          name,
          created_by_profile_id,
          is_active
        )
        values (
          v_house_id,
          trim(v_item_name),
          auth.uid(),
          true
        )
        on conflict (house_id, normalized_name)
        do update set is_active = true;
      end if;
    end loop;
  end if;

  insert into public.shared_expenses (
    house_id,
    source_ticket_id,
    created_by_profile_id,
    paid_by_profile_id,
    title,
    description,
    expense_type,
    expense_date,
    total_amount,
    currency,
    split_method,
    status,
    settlement_status
  )
  values (
    v_house_id,
    v_ticket_id,
    auth.uid(),
    v_paid_by_profile_id,
    trim(p_title),
    p_notes,
    'ticket',
    p_purchase_date,
    round(p_total_amount, 2),
    'EUR',
    'equal',
    'active',
    'open'
  )
  returning id into v_expense_id;

  v_base_share := trunc((p_total_amount / v_count)::numeric, 2);
  v_remaining := round(p_total_amount, 2);

  for v_i in 1..v_count
  loop
    v_participant_id := p_participant_profile_ids[v_i];

    if v_i < v_count then
      v_share := v_base_share;
    else
      v_share := round(v_remaining, 2);
    end if;

    v_participant_status := case
      when v_participant_id = v_paid_by_profile_id then 'paid'
      else 'pending'
    end;

    insert into public.expense_participants (
      expense_id,
      profile_id,
      share_amount,
      status
    )
    values (
      v_expense_id,
      v_participant_id,
      v_share,
      v_participant_status
    );

    v_remaining := round(v_remaining - v_share, 2);
  end loop;

  perform public.recalculate_expense_settlement(v_expense_id);

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'shared_expense',
    v_expense_id,
    'created',
    jsonb_build_object(
      'ticket_id', v_ticket_id,
      'ticket_kind', p_ticket_kind,
      'title', p_title,
      'merchant', p_merchant,
      'purchase_date', p_purchase_date,
      'total_amount', round(p_total_amount, 2),
      'participant_profile_ids', to_jsonb(p_participant_profile_ids),
      'item_names', to_jsonb(p_item_names),
      'paid_by_profile_id', v_paid_by_profile_id
    )
  );

  return jsonb_build_object(
    'ticket_id', v_ticket_id,
    'expense_id', v_expense_id,
    'house_public_code', p_house_public_code
  );
end;
$$;

grant execute on function public.create_pending_ticket_expense(
  text,
  text,
  text,
  text,
  date,
  numeric,
  text[],
  uuid[],
  text,
  uuid
) to authenticated;


-- =========================================================
-- 4) MARCAR COMO PAGADO
-- - si lo hace el propio pagador del ticket y su participante existe:
--   se marca directamente como paid sin insertar payment
-- - si lo hace otro participante:
--   se crea payment pendiente de revisión
-- =========================================================

create function public.request_expense_payment_confirmation(
  p_house_public_code text,
  p_expense_id uuid,
  p_note text default null,
  p_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_expense public.shared_expenses%rowtype;
  v_participant public.expense_participants%rowtype;
  v_amount numeric(10,2);
  v_payment_id uuid;
  v_new_status text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select *
  into v_expense
  from public.shared_expenses se
  where se.id = p_expense_id
    and se.house_id = v_house_id
    and se.status = 'active'
  limit 1;

  if v_expense.id is null then
    raise exception 'Gasto no encontrado';
  end if;

  select *
  into v_participant
  from public.expense_participants ep
  where ep.expense_id = p_expense_id
    and ep.profile_id = auth.uid()
  limit 1;

  if v_participant.id is null then
    raise exception 'No participas en este gasto';
  end if;

  if v_participant.status = 'paid' then
    raise exception 'Tu parte ya está marcada como pagada';
  end if;

  if auth.uid() = v_expense.paid_by_profile_id then
    update public.expense_participants
    set
      status = 'paid',
      updated_at = now()
    where id = v_participant.id;

    v_new_status := public.recalculate_expense_settlement(p_expense_id);

    insert into public.house_audit_log (
      house_id,
      actor_profile_id,
      entity_type,
      entity_id,
      action,
      details
    )
    values (
      v_house_id,
      auth.uid(),
      'shared_expense',
      p_expense_id,
      'self_marked_paid',
      jsonb_build_object(
        'profile_id', auth.uid(),
        'share_amount', v_participant.share_amount,
        'expense_settlement_status', v_new_status
      )
    );

    return jsonb_build_object(
      'status', 'completed_self',
      'expense_id', p_expense_id,
      'expense_settlement_status', v_new_status
    );
  end if;

  if exists (
    select 1
    from public.payments p
    where p.related_expense_id = p_expense_id
      and p.from_profile_id = auth.uid()
      and p.status = 'pending'
  ) then
    raise exception 'Ya tienes una confirmación pendiente para este gasto';
  end if;

  v_amount := coalesce(p_amount, v_participant.share_amount);

  if v_amount <= 0 then
    raise exception 'El importe debe ser mayor que 0';
  end if;

  insert into public.payments (
    house_id,
    from_profile_id,
    to_profile_id,
    related_expense_id,
    created_by_profile_id,
    amount,
    payment_date,
    status,
    note
  )
  values (
    v_house_id,
    auth.uid(),
    v_expense.paid_by_profile_id,
    p_expense_id,
    auth.uid(),
    round(v_amount, 2),
    current_date,
    'pending',
    p_note
  )
  returning id into v_payment_id;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'payment',
    v_payment_id,
    'requested_confirmation',
    jsonb_build_object(
      'expense_id', p_expense_id,
      'amount', round(v_amount, 2),
      'note', p_note
    )
  );

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'status', 'pending'
  );
end;
$$;

grant execute on function public.request_expense_payment_confirmation(
  text,
  uuid,
  text,
  numeric
) to authenticated;


-- =========================================================
-- 5) VALIDAR PAGO
-- El nombre se mantiene por compatibilidad, pero ahora puede:
-- - el creador del gasto
-- - o un admin
-- =========================================================

create function public.admin_confirm_payment(
  p_house_public_code text,
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_payment public.payments%rowtype;
  v_share_amount numeric(10,2);
  v_completed_sum numeric(10,2);
  v_new_status text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select *
  into v_payment
  from public.payments p
  where p.id = p_payment_id
    and p.house_id = v_house_id
  limit 1;

  if v_payment.id is null then
    raise exception 'Pago no encontrado';
  end if;

  if not public.can_review_expense_payment(v_house_id, v_payment.related_expense_id) then
    raise exception 'Solo el creador del gasto o un admin puede validar pagos';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Este pago ya no está pendiente';
  end if;

  update public.payments
  set
    status = 'completed',
    confirmed_by_profile_id = auth.uid(),
    confirmed_at = now(),
    updated_at = now()
  where id = p_payment_id;

  if v_payment.related_expense_id is not null then
    select ep.share_amount
    into v_share_amount
    from public.expense_participants ep
    where ep.expense_id = v_payment.related_expense_id
      and ep.profile_id = v_payment.from_profile_id
    limit 1;

    select coalesce(sum(p.amount), 0)::numeric(10,2)
    into v_completed_sum
    from public.payments p
    where p.related_expense_id = v_payment.related_expense_id
      and p.from_profile_id = v_payment.from_profile_id
      and p.status = 'completed';

    if v_completed_sum >= v_share_amount then
      update public.expense_participants
      set
        status = 'paid',
        updated_at = now()
      where expense_id = v_payment.related_expense_id
        and profile_id = v_payment.from_profile_id;
    end if;

    v_new_status := public.recalculate_expense_settlement(v_payment.related_expense_id);
  else
    v_new_status := null;
  end if;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'payment',
    p_payment_id,
    'confirmed',
    jsonb_build_object(
      'related_expense_id', v_payment.related_expense_id,
      'from_profile_id', v_payment.from_profile_id,
      'amount', v_payment.amount,
      'expense_settlement_status', v_new_status
    )
  );

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'status', 'completed',
    'expense_settlement_status', v_new_status
  );
end;
$$;

grant execute on function public.admin_confirm_payment(text, uuid) to authenticated;


create function public.admin_reject_payment(
  p_house_public_code text,
  p_payment_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_payment public.payments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select *
  into v_payment
  from public.payments p
  where p.id = p_payment_id
    and p.house_id = v_house_id
  limit 1;

  if v_payment.id is null then
    raise exception 'Pago no encontrado';
  end if;

  if not public.can_review_expense_payment(v_house_id, v_payment.related_expense_id) then
    raise exception 'Solo el creador del gasto o un admin puede rechazar pagos';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Este pago ya no está pendiente';
  end if;

  update public.payments
  set
    status = 'rejected',
    rejected_by_profile_id = auth.uid(),
    rejected_at = now(),
    updated_at = now(),
    note = coalesce(v_payment.note || ' | ', '') || coalesce(p_reason, '')
  where id = p_payment_id;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'payment',
    p_payment_id,
    'rejected',
    jsonb_build_object(
      'reason', p_reason
    )
  );

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'status', 'rejected'
  );
end;
$$;

grant execute on function public.admin_reject_payment(text, uuid, text) to authenticated;


-- =========================================================
-- 6) LISTADO DE CONFIRMACIONES PENDIENTES
-- Visible para quien puede revisar ese gasto
-- =========================================================

create function public.get_house_pending_payment_confirmations(
  p_house_public_code text
)
returns table (
  payment_id uuid,
  expense_id uuid,
  expense_title text,
  from_profile_id uuid,
  from_name text,
  to_profile_id uuid,
  to_name text,
  amount numeric(10,2),
  payment_date date,
  note text,
  status text,
  can_review boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    p.id as payment_id,
    p.related_expense_id as expense_id,
    se.title as expense_title,
    p.from_profile_id,
    public.profile_display_name(p.from_profile_id) as from_name,
    p.to_profile_id,
    public.profile_display_name(p.to_profile_id) as to_name,
    p.amount,
    p.payment_date,
    p.note,
    p.status,
    public.can_review_expense_payment(v_house_id, p.related_expense_id) as can_review
  from public.payments p
  left join public.shared_expenses se
    on se.id = p.related_expense_id
  where p.house_id = v_house_id
    and p.status = 'pending'
    and public.can_review_expense_payment(v_house_id, p.related_expense_id)
  order by p.created_at desc;
end;
$$;

grant execute on function public.get_house_pending_payment_confirmations(text) to authenticated;


-- =========================================================
-- 7) PANTALLA PRINCIPAL:
-- SOLO lo que me queda por pagar a mí
-- =========================================================

create function public.get_my_pending_purchase_tickets(
  p_house_public_code text,
  p_limit int default 5
)
returns table (
  ticket_id uuid,
  expense_id uuid,
  display_title text,
  merchant text,
  purchase_date date,
  paid_by_name text,
  total_amount numeric(10,2),
  my_share_amount numeric(10,2),
  currency text,
  ticket_file_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    pt.id as ticket_id,
    se.id as expense_id,
    public.profile_display_name(pt.paid_by_profile_id)
      || ' - ' ||
      coalesce(nullif(trim(pt.title), ''), 'Compra ' || pt.merchant) as display_title,
    pt.merchant,
    pt.purchase_date,
    public.profile_display_name(pt.paid_by_profile_id) as paid_by_name,
    pt.total_amount,
    ep.share_amount as my_share_amount,
    pt.currency,
    pt.ticket_file_path
  from public.purchase_tickets pt
  join public.shared_expenses se
    on se.source_ticket_id = pt.id
   and se.house_id = pt.house_id
   and se.status = 'active'
  join public.expense_participants ep
    on ep.expense_id = se.id
   and ep.profile_id = auth.uid()
   and ep.is_waived = false
   and ep.status = 'pending'
  where pt.house_id = v_house_id
    and pt.status = 'active'
    and not exists (
      select 1
      from public.payments p
      where p.house_id = v_house_id
        and p.related_expense_id = se.id
        and p.from_profile_id = auth.uid()
        and p.status = 'pending'
    )
  order by pt.purchase_date desc, pt.created_at desc
  limit greatest(p_limit, 1);
end;
$$;

grant execute on function public.get_my_pending_purchase_tickets(text, int) to authenticated;


create function public.get_my_pending_shared_expenses(
  p_house_public_code text,
  p_limit int default 10
)
returns table (
  expense_id uuid,
  title text,
  expense_type text,
  expense_date date,
  paid_by_name text,
  participants_text text,
  participants_count int,
  total_amount numeric(10,2),
  my_share_amount numeric(10,2),
  my_status text,
  currency text,
  source_ticket_id uuid,
  settlement_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    se.id as expense_id,
    se.title,
    se.expense_type,
    se.expense_date,
    public.profile_display_name(se.paid_by_profile_id) as paid_by_name,
    coalesce(participants.participants_text, '') as participants_text,
    coalesce(participants.participants_count, 0) as participants_count,
    se.total_amount,
    ep.share_amount as my_share_amount,
    ep.status as my_status,
    se.currency,
    se.source_ticket_id,
    se.settlement_status
  from public.shared_expenses se
  join public.expense_participants ep
    on ep.expense_id = se.id
   and ep.profile_id = auth.uid()
   and ep.is_waived = false
   and ep.status = 'pending'
  left join lateral (
    select
      string_agg(
        public.profile_display_name(ep2.profile_id),
        ', '
        order by public.profile_display_name(ep2.profile_id)
      ) as participants_text,
      count(*)::int as participants_count
    from public.expense_participants ep2
    where ep2.expense_id = se.id
      and ep2.is_waived = false
  ) participants on true
  where se.house_id = v_house_id
    and se.status = 'active'
    and coalesce(se.settlement_status, 'open') <> 'settled'
    and not exists (
      select 1
      from public.payments p
      where p.house_id = v_house_id
        and p.related_expense_id = se.id
        and p.from_profile_id = auth.uid()
        and p.status = 'pending'
    )
  order by se.expense_date desc, se.created_at desc
  limit greatest(p_limit, 1);
end;
$$;

grant execute on function public.get_my_pending_shared_expenses(text, int) to authenticated;


-- =========================================================
-- 8) HISTORIAL PARA “VER TODO”
-- =========================================================

create function public.get_house_purchase_tickets_history(
  p_house_public_code text,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  ticket_id uuid,
  expense_id uuid,
  display_title text,
  merchant text,
  purchase_date date,
  paid_by_name text,
  total_amount numeric(10,2),
  currency text,
  ticket_file_path text,
  settlement_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    pt.id as ticket_id,
    se.id as expense_id,
    public.profile_display_name(pt.paid_by_profile_id)
      || ' - ' ||
      coalesce(nullif(trim(pt.title), ''), 'Compra ' || pt.merchant) as display_title,
    pt.merchant,
    pt.purchase_date,
    public.profile_display_name(pt.paid_by_profile_id) as paid_by_name,
    pt.total_amount,
    pt.currency,
    pt.ticket_file_path,
    coalesce(se.settlement_status, 'open') as settlement_status
  from public.purchase_tickets pt
  left join public.shared_expenses se
    on se.source_ticket_id = pt.id
   and se.house_id = pt.house_id
  where pt.house_id = v_house_id
    and pt.status = 'active'
  order by pt.purchase_date desc, pt.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.get_house_purchase_tickets_history(text, int, int) to authenticated;


create function public.get_house_shared_expenses_history(
  p_house_public_code text,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  expense_id uuid,
  title text,
  expense_type text,
  expense_date date,
  paid_by_name text,
  participants_text text,
  participants_count int,
  total_amount numeric(10,2),
  currency text,
  source_ticket_id uuid,
  settlement_status text,
  my_share_amount numeric(10,2),
  my_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    se.id as expense_id,
    se.title,
    se.expense_type,
    se.expense_date,
    public.profile_display_name(se.paid_by_profile_id) as paid_by_name,
    coalesce(participants.participants_text, '') as participants_text,
    coalesce(participants.participants_count, 0) as participants_count,
    se.total_amount,
    se.currency,
    se.source_ticket_id,
    coalesce(se.settlement_status, 'open') as settlement_status,
    ep.share_amount as my_share_amount,
    ep.status as my_status
  from public.shared_expenses se
  left join public.expense_participants ep
    on ep.expense_id = se.id
   and ep.profile_id = auth.uid()
  left join lateral (
    select
      string_agg(
        public.profile_display_name(ep2.profile_id),
        ', '
        order by public.profile_display_name(ep2.profile_id)
      ) as participants_text,
      count(*)::int as participants_count
    from public.expense_participants ep2
    where ep2.expense_id = se.id
      and ep2.is_waived = false
  ) participants on true
  where se.house_id = v_house_id
    and se.status = 'active'
  order by se.expense_date desc, se.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.get_house_shared_expenses_history(text, int, int) to authenticated;


-- =========================================================
-- 9) DASHBOARD PRINCIPAL
-- SOLO pendientes personales + validaciones revisables
-- =========================================================

create function public.get_house_expenses_dashboard(
  p_house_public_code text,
  p_ticket_limit int default 10,
  p_expense_limit int default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_result jsonb;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select jsonb_build_object(
    'house', (
      select jsonb_build_object(
        'id', h.id,
        'name', h.name,
        'public_code', h.public_code
      )
      from public.houses h
      where h.id = v_house_id
    ),
    'tickets', coalesce((
      select jsonb_agg(to_jsonb(t))
      from public.get_my_pending_purchase_tickets(p_house_public_code, p_ticket_limit) t
    ), '[]'::jsonb),
    'shared_expenses', coalesce((
      select jsonb_agg(to_jsonb(e))
      from public.get_my_pending_shared_expenses(p_house_public_code, p_expense_limit) e
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(to_jsonb(s))
      from public.get_house_payment_simplification(p_house_public_code) s
    ), '[]'::jsonb),
    'pending_payment_confirmations', coalesce((
      select jsonb_agg(to_jsonb(pp))
      from public.get_house_pending_payment_confirmations(p_house_public_code) pp
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_house_expenses_dashboard(text, int, int) to authenticated;


-- =========================================================
-- AREA PERSONAL
-- Datos personales del usuario actual dentro de un piso.
-- Reutiliza la misma regla de acceso y estados de gastos/pagos.
-- =========================================================

create or replace function public.get_personal_area_dashboard(
  p_house_public_code text,
  p_history_limit int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_month_start date := date_trunc('month', current_date)::date;
  v_next_month_start date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_previous_month_start date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  with debts as (
    select
      se.id as expense_id,
      pending_payment.id as payment_id,
      public.profile_display_name(se.paid_by_profile_id) as person_name,
      se.title,
      se.expense_date as item_date,
      ep.share_amount as amount,
      se.currency,
      case
        when pending_payment.id is null then 'pending'
        else 'pending_confirmation'
      end as status
    from public.shared_expenses se
    join public.expense_participants ep
      on ep.expense_id = se.id
     and ep.profile_id = auth.uid()
     and ep.is_waived = false
     and ep.status = 'pending'
    left join lateral (
      select p.id
      from public.payments p
      where p.house_id = v_house_id
        and p.related_expense_id = se.id
        and p.from_profile_id = auth.uid()
        and p.status = 'pending'
      order by p.created_at desc
      limit 1
    ) pending_payment on true
    where se.house_id = v_house_id
      and se.status = 'active'
      and coalesce(se.settlement_status, 'open') <> 'settled'
      and se.paid_by_profile_id <> auth.uid()
  ),
  receivables as (
    select
      se.id as expense_id,
      pending_payment.id as payment_id,
      public.profile_display_name(ep.profile_id) as person_name,
      se.title,
      coalesce(pending_payment.payment_date, se.expense_date) as item_date,
      coalesce(pending_payment.amount, ep.share_amount) as amount,
      se.currency,
      case
        when pending_payment.id is null then 'pending'
        else pending_payment.status
      end as status,
      (
        pending_payment.id is not null
        and public.can_review_expense_payment(v_house_id, se.id)
      ) as can_verify
    from public.shared_expenses se
    join public.expense_participants ep
      on ep.expense_id = se.id
     and ep.profile_id <> auth.uid()
     and ep.is_waived = false
     and ep.status = 'pending'
    left join lateral (
      select p.id, p.amount, p.payment_date, p.status
      from public.payments p
      where p.house_id = v_house_id
        and p.related_expense_id = se.id
        and p.from_profile_id = ep.profile_id
        and p.to_profile_id = auth.uid()
        and p.status = 'pending'
      order by p.created_at desc
      limit 1
    ) pending_payment on true
    where se.house_id = v_house_id
      and se.status = 'active'
      and coalesce(se.settlement_status, 'open') <> 'settled'
      and se.paid_by_profile_id = auth.uid()
  ),
  month_expenses as (
    select
      se.id as expense_id,
      se.title,
      se.expense_type,
      se.expense_date,
      ep.share_amount,
      se.currency,
      coalesce(ic.category_key, '') as category_key,
      coalesce(ic.name, '') as category_name,
      se.source_ticket_id
    from public.shared_expenses se
    join public.expense_participants ep
      on ep.expense_id = se.id
     and ep.profile_id = auth.uid()
     and ep.is_waived = false
    left join public.invoice_categories ic
      on ic.id = se.invoice_category_id
    where se.house_id = v_house_id
      and se.status = 'active'
      and se.expense_date >= v_month_start
      and se.expense_date < v_next_month_start
  ),
  previous_month_expenses as (
    select ep.share_amount
    from public.shared_expenses se
    join public.expense_participants ep
      on ep.expense_id = se.id
     and ep.profile_id = auth.uid()
     and ep.is_waived = false
    where se.house_id = v_house_id
      and se.status = 'active'
      and se.expense_date >= v_previous_month_start
      and se.expense_date < v_month_start
  ),
  chart_rows as (
    select
      case
        when expense_type = 'invoice'
          and (
            lower(category_key) in ('rent', 'alquiler')
            or lower(category_name) like '%alquiler%'
          )
          then 'Alquiler'
        when expense_type = 'invoice' then 'Facturas'
        when source_ticket_id is not null or expense_type in ('ticket', 'shared_purchase') then 'Compras'
        else 'Otros'
      end as name,
      sum(share_amount) as amount
    from month_expenses
    group by 1
  ),
  personal_history as (
    select
      'gasto'::text as item_type,
      se.id as item_id,
      se.title,
      case
        when se.paid_by_profile_id = auth.uid() then 'Pagado por ti'
        else 'Pagado por ' || public.profile_display_name(se.paid_by_profile_id)
      end as subtitle,
      se.expense_date as item_date,
      coalesce(ep.share_amount, se.total_amount) as amount,
      se.currency,
      coalesce(ep.status, se.settlement_status, 'open') as status,
      case
        when se.source_ticket_id is not null then 'purchase'
        when se.expense_type = 'invoice' then 'invoice'
        else 'expense'
      end as icon_type
    from public.shared_expenses se
    left join public.expense_participants ep
      on ep.expense_id = se.id
     and ep.profile_id = auth.uid()
     and ep.is_waived = false
    where se.house_id = v_house_id
      and se.status = 'active'
      and (ep.profile_id = auth.uid() or se.paid_by_profile_id = auth.uid())

    union all

    select
      case
        when p.from_profile_id = auth.uid() then 'pago_enviado'
        else 'pago_recibido'
      end as item_type,
      p.id as item_id,
      coalesce(se.title, 'Pago') as title,
      case
        when p.from_profile_id = auth.uid()
          then 'Pago a ' || public.profile_display_name(p.to_profile_id)
        else 'Pago de ' || public.profile_display_name(p.from_profile_id)
      end as subtitle,
      p.payment_date as item_date,
      p.amount,
      coalesce(se.currency, 'EUR') as currency,
      p.status,
      'payment'::text as icon_type
    from public.payments p
    left join public.shared_expenses se
      on se.id = p.related_expense_id
    where p.house_id = v_house_id
      and (p.from_profile_id = auth.uid() or p.to_profile_id = auth.uid())
  ),
  calendar_rows as (
    select
      'debt:' || expense_id::text as event_id,
      'deuda'::text as event_type,
      title,
      item_date as event_date,
      amount,
      currency,
      person_name
    from debts

    union all

    select
      'receivable:' || expense_id::text || ':' || person_name as event_id,
      'me_deben'::text as event_type,
      title,
      item_date as event_date,
      amount,
      currency,
      person_name
    from receivables
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'my_debts_total', coalesce((select sum(amount) from debts), 0),
      'my_debts_count', coalesce((select count(*) from debts), 0),
      'owed_to_me_total', coalesce((select sum(amount) from receivables), 0),
      'owed_to_me_count', coalesce((select count(*) from receivables), 0),
      'monthly_spending_total', coalesce((select sum(share_amount) from month_expenses), 0),
      'previous_month_spending_total', coalesce((select sum(share_amount) from previous_month_expenses), 0)
    ),
    'debts', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.item_date desc, d.title)
      from debts d
    ), '[]'::jsonb),
    'receivables', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.item_date desc, r.title, r.person_name)
      from receivables r
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.item_date desc, h.title)
      from (
        select *
        from personal_history
        order by item_date desc, title
        limit greatest(p_history_limit, 1)
      ) h
    ), '[]'::jsonb),
    'calendar_events', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.event_date, c.title)
      from calendar_rows c
    ), '[]'::jsonb),
    'chart', coalesce((
      select jsonb_agg(to_jsonb(cr) order by cr.name)
      from chart_rows cr
      where cr.amount > 0
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_personal_area_dashboard(text, int) to authenticated;

drop function if exists public.get_add_invoice_form_options(text);
drop function if exists public.get_house_invoices_dashboard(text, integer);
drop function if exists public.get_house_invoice_history(text, uuid, integer, integer);
drop function if exists public.admin_mark_invoice_paid(text, uuid, text);


create function public.get_add_invoice_form_options(
  p_house_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_result jsonb;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  v_result := jsonb_build_object(
    'members',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'profile_id', hm.profile_id,
          'display_name', public.profile_display_name(hm.profile_id),
          'role', hm.role
        )
        order by public.profile_display_name(hm.profile_id)
      )
      from public.house_members hm
      where hm.house_id = v_house_id
        and hm.is_active = true
    ), '[]'::jsonb),
    'invoice_categories',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'category_id', ic.id,
          'category_key', ic.category_key,
          'name', ic.name,
          'is_builtin', ic.is_builtin,
          'is_custom', (ic.house_id is not null)
        )
        order by ic.sort_order, ic.name
      )
      from public.invoice_categories ic
      where ic.is_active = true
        and (ic.house_id is null or ic.house_id = v_house_id)
    ), '[]'::jsonb),
    'allow_custom_category', true
  );

  return v_result;
end;
$$;

grant execute on function public.get_add_invoice_form_options(text) to authenticated;


create function public.get_house_invoices_dashboard(
  p_house_public_code text,
  p_limit_per_category int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_result jsonb;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  v_result := (
    with cats as (
      select
        ic.id,
        ic.category_key,
        ic.name,
        ic.sort_order
      from public.invoice_categories ic
      where ic.is_active = true
        and (ic.house_id is null or ic.house_id = v_house_id)
    )
    select jsonb_build_object(
      'categories',
      coalesce(jsonb_agg(
        jsonb_build_object(
          'category_id', c.id,
          'category_key', c.category_key,
          'name', c.name,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'expense_id', se.id,
                'title', se.title,
                'invoice_date', se.expense_date,
                'total_amount', se.total_amount,
                'currency', se.currency,
                'settlement_status', se.settlement_status,
                'participants_text', coalesce((
                  select string_agg(
                    public.profile_display_name(ep.profile_id),
                    ', '
                    order by public.profile_display_name(ep.profile_id)
                  )
                  from public.expense_participants ep
                  where ep.expense_id = se.id
                    and ep.is_waived = false
                ), ''),
                'can_mark_paid', public.is_house_admin(v_house_id),
                'invoice_file_path', se.invoice_file_path
              )
              order by se.expense_date desc, se.created_at desc
            )
            from (
              select *
              from public.shared_expenses se2
              where se2.house_id = v_house_id
                and se2.expense_type = 'invoice'
                and se2.invoice_category_id = c.id
                and se2.status = 'active'
                and coalesce(se2.settlement_status, 'open') <> 'settled'
              order by se2.expense_date desc, se2.created_at desc
              limit greatest(p_limit_per_category, 1)
            ) se
          ), '[]'::jsonb)
        )
        order by c.sort_order, c.name
      ), '[]'::jsonb)
    )
    from cats c
  );

  return v_result;
end;
$$;

grant execute on function public.get_house_invoices_dashboard(text, int) to authenticated;


create function public.get_house_invoice_history(
  p_house_public_code text,
  p_invoice_category_id uuid default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  expense_id uuid,
  category_id uuid,
  category_name text,
  category_key text,
  title text,
  invoice_date date,
  total_amount numeric(10,2),
  currency text,
  settlement_status text,
  invoice_paid_at timestamptz,
  participants_text text,
  can_mark_paid boolean,
  invoice_file_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    se.id as expense_id,
    ic.id as category_id,
    ic.name as category_name,
    ic.category_key,
    se.title,
    se.expense_date as invoice_date,
    se.total_amount,
    se.currency,
    coalesce(se.settlement_status, 'open') as settlement_status,
    se.invoice_paid_at,
    coalesce((
      select string_agg(
        public.profile_display_name(ep.profile_id),
        ', '
        order by public.profile_display_name(ep.profile_id)
      )
      from public.expense_participants ep
      where ep.expense_id = se.id
        and ep.is_waived = false
    ), '') as participants_text,
    public.is_house_admin(v_house_id) as can_mark_paid,
    se.invoice_file_path
  from public.shared_expenses se
  left join public.invoice_categories ic
    on ic.id = se.invoice_category_id
  where se.house_id = v_house_id
    and se.expense_type = 'invoice'
    and se.status = 'active'
    and (p_invoice_category_id is null or se.invoice_category_id = p_invoice_category_id)
  order by se.expense_date desc, se.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.get_house_invoice_history(text, uuid, int, int) to authenticated;


create function public.admin_mark_invoice_paid(
  p_house_public_code text,
  p_expense_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not public.is_house_admin(v_house_id) then
    raise exception 'Solo un admin puede marcar una factura como pagada';
  end if;

  if not exists (
    select 1
    from public.shared_expenses se
    where se.id = p_expense_id
      and se.house_id = v_house_id
      and se.expense_type = 'invoice'
      and se.status = 'active'
  ) then
    raise exception 'Factura no encontrada';
  end if;

  update public.expense_participants
  set
    status = 'paid',
    updated_at = now()
  where expense_id = p_expense_id
    and is_waived = false;

  update public.shared_expenses
  set
    settlement_status = 'settled',
    settled_at = now(),
    invoice_paid_at = now(),
    updated_at = now()
  where id = p_expense_id;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'invoice',
    p_expense_id,
    'marked_paid',
    jsonb_build_object('note', p_note)
  );

  return jsonb_build_object(
    'expense_id', p_expense_id,
    'status', 'settled'
  );
end;
$$;

grant execute on function public.admin_mark_invoice_paid(text, uuid, text) to authenticated;

-- =========================================================
-- CONVIVE - MÓDULO LIMPIEZA
-- Zonas + tareas + rotación + histórico
-- =========================================================

-- =========================================================
-- 0) LIMPIEZA DE FUNCIONES / TABLAS SI CHOCAN
-- =========================================================

drop function if exists public.get_add_cleaning_task_form_options(text);
drop function if exists public.create_cleaning_task(text, text, date, uuid, uuid, text, text);
drop function if exists public.rotate_cleaning_tasks(text, uuid, uuid, text);
drop function if exists public.get_house_cleaning_dashboard(text, integer);
drop function if exists public.get_house_cleaning_task_history(text, uuid, integer, integer);

-- =========================================================
-- 1) TABLAS NUEVAS
-- =========================================================

create table if not exists public.cleaning_zones (
  id uuid primary key default gen_random_uuid(),
  house_id uuid references public.houses(id) on delete cascade,
  zone_key text not null,
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  is_builtin boolean not null default false,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  zone_id uuid not null references public.cleaning_zones(id) on delete restrict,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  assigned_to_profile_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  due_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'archived')),
  sort_order int not null default 100,
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 2) ÍNDICES
-- =========================================================

create unique index if not exists cleaning_zones_global_key_uidx
on public.cleaning_zones (zone_key)
where house_id is null;

create unique index if not exists cleaning_zones_house_name_uidx
on public.cleaning_zones (house_id, normalized_name)
where house_id is not null;

create index if not exists cleaning_zones_house_active_idx
on public.cleaning_zones (house_id, is_active, sort_order, name);

create index if not exists cleaning_tasks_house_zone_status_idx
on public.cleaning_tasks (house_id, zone_id, status, due_date);

create index if not exists cleaning_tasks_assigned_idx
on public.cleaning_tasks (assigned_to_profile_id, status, due_date);

create index if not exists cleaning_tasks_house_created_idx
on public.cleaning_tasks (house_id, created_at desc);

-- =========================================================
-- 3) UPDATED_AT
-- Asume que public.set_updated_at() ya existe
-- =========================================================

drop trigger if exists set_cleaning_zones_updated_at on public.cleaning_zones;
create trigger set_cleaning_zones_updated_at
before update on public.cleaning_zones
for each row execute function public.set_updated_at();

drop trigger if exists set_cleaning_tasks_updated_at on public.cleaning_tasks;
create trigger set_cleaning_tasks_updated_at
before update on public.cleaning_tasks
for each row execute function public.set_updated_at();

-- =========================================================
-- 4) RLS
-- =========================================================

alter table public.cleaning_zones enable row level security;
alter table public.cleaning_tasks enable row level security;

drop policy if exists "cleaning_zones_select_if_member" on public.cleaning_zones;
create policy "cleaning_zones_select_if_member"
on public.cleaning_zones
for select
to authenticated
using (
  house_id is null
  or public.is_house_member(house_id)
  or public.is_house_creator(house_id)
);

drop policy if exists "cleaning_tasks_select_if_member" on public.cleaning_tasks;
create policy "cleaning_tasks_select_if_member"
on public.cleaning_tasks
for select
to authenticated
using (
  public.is_house_member(house_id)
  or public.is_house_creator(house_id)
);

-- =========================================================
-- 5) SEED DE ZONAS BASE
-- =========================================================

insert into public.cleaning_zones (
  house_id,
  zone_key,
  name,
  is_builtin,
  sort_order,
  is_active,
  created_by_profile_id
)
values
  (null, 'kitchen', 'Cocina', true, 10, true, null),
  (null, 'living_room', 'Salón', true, 20, true, null),
  (null, 'bathroom', 'Baño', true, 30, true, null),
  (null, 'hallway', 'Recibidor', true, 40, true, null)
on conflict do nothing;

-- =========================================================
-- 6) OPCIONES DEL FORMULARIO "AÑADIR TAREA"
-- - miembros reales
-- - zonas reales
-- - bandera para permitir zona manual
-- =========================================================

create function public.get_add_cleaning_task_form_options(
  p_house_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_result jsonb;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  v_result := jsonb_build_object(
    'members',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'profile_id', hm.profile_id,
          'display_name', public.profile_display_name(hm.profile_id),
          'role', hm.role
        )
        order by public.profile_display_name(hm.profile_id)
      )
      from public.house_members hm
      where hm.house_id = v_house_id
        and hm.is_active = true
    ), '[]'::jsonb),
    'zones',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'zone_id', cz.id,
          'zone_key', cz.zone_key,
          'name', cz.name,
          'is_builtin', cz.is_builtin,
          'is_custom', (cz.house_id is not null)
        )
        order by cz.sort_order, cz.name
      )
      from public.cleaning_zones cz
      where cz.is_active = true
        and (cz.house_id is null or cz.house_id = v_house_id)
    ), '[]'::jsonb),
    'allow_custom_zone', true
  );

  return v_result;
end;
$$;

grant execute on function public.get_add_cleaning_task_form_options(text) to authenticated;

-- =========================================================
-- 7) CREAR TAREA DE LIMPIEZA
-- - zona existente o zona manual
-- - miembro asignado real
-- - fecha real
-- - auditoría
-- =========================================================

create function public.create_cleaning_task(
  p_house_public_code text,
  p_title text,
  p_due_date date,
  p_assigned_profile_id uuid,
  p_zone_id uuid,
  p_custom_zone_name text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_zone_id uuid;
  v_task_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not (public.is_house_member(v_house_id) or public.is_house_creator(v_house_id)) then
    raise exception 'Sin acceso a la casa';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'El título de la tarea es obligatorio';
  end if;

  if p_due_date is null then
    raise exception 'La fecha de la tarea es obligatoria';
  end if;

  if p_assigned_profile_id is null then
    raise exception 'Debes seleccionar una persona';
  end if;

  if not exists (
    select 1
    from public.house_members hm
    where hm.house_id = v_house_id
      and hm.profile_id = p_assigned_profile_id
      and hm.is_active = true
  ) then
    raise exception 'La persona asignada no pertenece a la casa';
  end if;

  if p_custom_zone_name is not null and length(trim(p_custom_zone_name)) > 0 then
    select cz.id
    into v_zone_id
    from public.cleaning_zones cz
    where cz.house_id = v_house_id
      and cz.normalized_name = lower(btrim(p_custom_zone_name))
    limit 1;

    if v_zone_id is null then
      insert into public.cleaning_zones (
        house_id,
        zone_key,
        name,
        is_builtin,
        sort_order,
        is_active,
        created_by_profile_id
      )
      values (
        v_house_id,
        'custom_' || substring(gen_random_uuid()::text from 1 for 8),
        trim(p_custom_zone_name),
        false,
        200,
        true,
        auth.uid()
      )
      returning id into v_zone_id;
    end if;
  else
    select cz.id
    into v_zone_id
    from public.cleaning_zones cz
    where cz.id = p_zone_id
      and cz.is_active = true
      and (cz.house_id is null or cz.house_id = v_house_id)
    limit 1;

    if v_zone_id is null then
      raise exception 'Debes seleccionar una zona válida o escribir una manual';
    end if;
  end if;

  insert into public.cleaning_tasks (
    house_id,
    zone_id,
    created_by_profile_id,
    assigned_to_profile_id,
    title,
    description,
    due_date,
    status,
    sort_order
  )
  values (
    v_house_id,
    v_zone_id,
    auth.uid(),
    p_assigned_profile_id,
    trim(p_title),
    p_notes,
    p_due_date,
    'pending',
    100
  )
  returning id into v_task_id;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'cleaning_task',
    v_task_id,
    'created',
    jsonb_build_object(
      'title', p_title,
      'due_date', p_due_date,
      'assigned_to_profile_id', p_assigned_profile_id,
      'zone_id', v_zone_id,
      'custom_zone_name', p_custom_zone_name,
      'notes', p_notes
    )
  );

  return jsonb_build_object(
    'task_id', v_task_id,
    'zone_id', v_zone_id,
    'house_public_code', p_house_public_code
  );
end;
$$;

grant execute on function public.create_cleaning_task(
  text,
  text,
  date,
  uuid,
  uuid,
  text,
  text
) to authenticated;

-- =========================================================
-- 8) ROTAR 2 TAREAS
-- - intercambia las personas asignadas
-- - por ahora cualquier miembro activo del piso puede hacerlo
-- =========================================================

create function public.rotate_cleaning_tasks(
  p_house_public_code text,
  p_task_a_id uuid,
  p_task_b_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_task_a public.cleaning_tasks%rowtype;
  v_task_b public.cleaning_tasks%rowtype;
  v_old_a_assignee uuid;
  v_old_b_assignee uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not (public.is_house_member(v_house_id) or public.is_house_creator(v_house_id)) then
    raise exception 'Sin acceso a la casa';
  end if;

  if p_task_a_id is null or p_task_b_id is null then
    raise exception 'Debes seleccionar dos tareas';
  end if;

  if p_task_a_id = p_task_b_id then
    raise exception 'Debes seleccionar dos tareas distintas';
  end if;

  select *
  into v_task_a
  from public.cleaning_tasks
  where id = p_task_a_id
    and house_id = v_house_id
    and status = 'pending'
  limit 1;

  select *
  into v_task_b
  from public.cleaning_tasks
  where id = p_task_b_id
    and house_id = v_house_id
    and status = 'pending'
  limit 1;

  if v_task_a.id is null or v_task_b.id is null then
    raise exception 'Una o ambas tareas no existen o no están pendientes';
  end if;

  v_old_a_assignee := v_task_a.assigned_to_profile_id;
  v_old_b_assignee := v_task_b.assigned_to_profile_id;

  update public.cleaning_tasks
  set
    assigned_to_profile_id = v_old_b_assignee,
    rotated_at = now(),
    updated_at = now()
  where id = v_task_a.id;

  update public.cleaning_tasks
  set
    assigned_to_profile_id = v_old_a_assignee,
    rotated_at = now(),
    updated_at = now()
  where id = v_task_b.id;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'cleaning_rotation',
    null,
    'swapped_assignees',
    jsonb_build_object(
      'task_a_id', v_task_a.id,
      'task_b_id', v_task_b.id,
      'task_a_old_assignee', v_old_a_assignee,
      'task_b_old_assignee', v_old_b_assignee,
      'task_a_new_assignee', v_old_b_assignee,
      'task_b_new_assignee', v_old_a_assignee,
      'note', p_note
    )
  );

  return jsonb_build_object(
    'task_a_id', v_task_a.id,
    'task_b_id', v_task_b.id,
    'task_a_assigned_to', v_old_b_assignee,
    'task_b_assigned_to', v_old_a_assignee
  );
end;
$$;

grant execute on function public.rotate_cleaning_tasks(text, uuid, uuid, text) to authenticated;

-- =========================================================
-- 9) DASHBOARD DE LIMPIEZA
-- - por zonas
-- - solo tareas pendientes
-- - sin lógica del panel derecho todavía
-- =========================================================

create function public.get_house_cleaning_dashboard(
  p_house_public_code text,
  p_limit_per_zone int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_result jsonb;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  v_result := (
    with zones as (
      select
        cz.id,
        cz.zone_key,
        cz.name,
        cz.sort_order
      from public.cleaning_zones cz
      where cz.is_active = true
        and (cz.house_id is null or cz.house_id = v_house_id)
    )
    select jsonb_build_object(
      'zones',
      coalesce(jsonb_agg(
        jsonb_build_object(
          'zone_id', z.id,
          'zone_key', z.zone_key,
          'name', z.name,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'task_id', ct.id,
                'title', ct.title,
                'due_date', ct.due_date,
                'assigned_to_profile_id', ct.assigned_to_profile_id,
                'assigned_to_name', public.profile_display_name(ct.assigned_to_profile_id),
                'notes', ct.description,
                'status', ct.status
              )
              order by ct.due_date asc, ct.created_at desc
            )
            from (
              select *
              from public.cleaning_tasks ct2
              where ct2.house_id = v_house_id
                and ct2.zone_id = z.id
                and ct2.status = 'pending'
              order by ct2.due_date asc, ct2.created_at desc
              limit greatest(p_limit_per_zone, 1)
            ) ct
          ), '[]'::jsonb)
        )
        order by z.sort_order, z.name
      ), '[]'::jsonb),
      'can_add_task', true,
      'can_rotate', true
    )
    from zones z
  );

  return v_result;
end;
$$;

grant execute on function public.get_house_cleaning_dashboard(text, int) to authenticated;

-- =========================================================
-- 10) HISTORIAL DE TAREAS DE LIMPIEZA
-- - sirve para “Ver todo”
-- - por zona o general
-- =========================================================

create function public.get_house_cleaning_task_history(
  p_house_public_code text,
  p_zone_id uuid default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  task_id uuid,
  zone_id uuid,
  zone_name text,
  title text,
  assigned_to_profile_id uuid,
  assigned_to_name text,
  due_date date,
  status text,
  notes text,
  rotated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    ct.id as task_id,
    cz.id as zone_id,
    cz.name as zone_name,
    ct.title,
    ct.assigned_to_profile_id,
    public.profile_display_name(ct.assigned_to_profile_id) as assigned_to_name,
    ct.due_date,
    ct.status,
    ct.description as notes,
    ct.rotated_at,
    ct.completed_at,
    ct.created_at
  from public.cleaning_tasks ct
  join public.cleaning_zones cz
    on cz.id = ct.zone_id
  where ct.house_id = v_house_id
    and (p_zone_id is null or ct.zone_id = p_zone_id)
  order by ct.due_date asc, ct.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.get_house_cleaning_task_history(text, uuid, int, int) to authenticated;

-- =========================================================
-- 11) DATOS DE PRUEBA OPCIONALES
-- =========================================================

-- select public.get_add_cleaning_task_form_options('TU_PUBLIC_CODE');

-- select public.create_cleaning_task(
--   'TU_PUBLIC_CODE',
--   'Barrer la cocina',
--   current_date,
--   'eb07d3f6-902f-4f4a-a842-8a9c7e28b947'::uuid,
--   (select id from public.cleaning_zones where house_id is null and zone_key = 'kitchen' limit 1),
--   null,
--   'Pasar también la fregona'
-- );

-- select public.create_cleaning_task(
--   'TU_PUBLIC_CODE',
--   'Limpiar trastero',
--   current_date + 1,
--   '48d7f9ee-08c9-42c2-aa8b-5b0cb935dc1c'::uuid,
--   null,
--   'Trastero',
--   'Zona extra'
-- );

-- select public.rotate_cleaning_tasks(
--   'TU_PUBLIC_CODE',
--   'UUID_TASK_A',
--   'UUID_TASK_B',
--   'Rotación manual'
-- );

-- select public.get_house_cleaning_dashboard('TU_PUBLIC_CODE', 50);

-- select * from public.get_house_cleaning_task_history('TU_PUBLIC_CODE', null, 100, 0);

create or replace function public.complete_cleaning_task(
  p_house_public_code text,
  p_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_task public.cleaning_tasks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not (public.is_house_member(v_house_id) or public.is_house_creator(v_house_id)) then
    raise exception 'Sin acceso a la casa';
  end if;

  if p_task_id is null then
    raise exception 'Debes seleccionar una tarea';
  end if;

  select *
  into v_task
  from public.cleaning_tasks
  where id = p_task_id
    and house_id = v_house_id
  limit 1;

  if v_task.id is null then
    raise exception 'La tarea no existe o no pertenece a este piso';
  end if;

  if v_task.status <> 'pending' then
    raise exception 'La tarea no está pendiente';
  end if;

  update public.cleaning_tasks
  set
    status = 'done',
    completed_by_profile_id = auth.uid(),
    completed_at = now(),
    updated_at = now()
  where id = v_task.id;

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'cleaning_task',
    v_task.id,
    'completed',
    jsonb_build_object(
      'title', v_task.title,
      'due_date', v_task.due_date,
      'assigned_to_profile_id', v_task.assigned_to_profile_id,
      'zone_id', v_task.zone_id,
      'previous_status', v_task.status,
      'new_status', 'done'
    )
  );

  return jsonb_build_object(
    'task_id', v_task.id,
    'status', 'done',
    'completed_by_profile_id', auth.uid(),
    'completed_at', now()
  );
end;
$$;

grant execute on function public.complete_cleaning_task(text, uuid) to authenticated;


-- =========================================================
-- GASTOS - VISIBILIDAD GLOBAL DE DIVISION Y VALIDACIONES
-- Incremental: no cambia tablas ni columnas.
-- - Division de gastos usa vista global del piso.
-- - Validaciones pendientes son visibles para todos los miembros.
-- - can_review indica si el usuario actual puede confirmar/rechazar.
-- =========================================================

create or replace function public.get_house_pending_payment_confirmations(
  p_house_public_code text
)
returns table (
  payment_id uuid,
  expense_id uuid,
  expense_title text,
  from_profile_id uuid,
  from_name text,
  to_profile_id uuid,
  to_name text,
  amount numeric(10,2),
  payment_date date,
  note text,
  status text,
  can_review boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    p.id as payment_id,
    p.related_expense_id as expense_id,
    se.title as expense_title,
    p.from_profile_id,
    public.profile_display_name(p.from_profile_id) as from_name,
    p.to_profile_id,
    public.profile_display_name(p.to_profile_id) as to_name,
    p.amount,
    p.payment_date,
    p.note,
    p.status,
    public.can_review_expense_payment(v_house_id, p.related_expense_id) as can_review
  from public.payments p
  left join public.shared_expenses se
    on se.id = p.related_expense_id
   and se.house_id = v_house_id
  where p.house_id = v_house_id
    and p.status = 'pending'
  order by p.created_at desc;
end;
$$;

grant execute on function public.get_house_pending_payment_confirmations(text) to authenticated;


create or replace function public.get_house_expenses_dashboard(
  p_house_public_code text,
  p_ticket_limit int default 10,
  p_expense_limit int default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  select jsonb_build_object(
    'house', (
      select jsonb_build_object(
        'id', h.id,
        'name', h.name,
        'public_code', h.public_code
      )
      from public.houses h
      where h.id = v_house_id
    ),
    'tickets', coalesce((
      select jsonb_agg(to_jsonb(t))
      from public.get_house_purchase_tickets(p_house_public_code, p_ticket_limit) t
    ), '[]'::jsonb),
    'shared_expenses', coalesce((
      select jsonb_agg(to_jsonb(e))
      from public.get_house_shared_expenses(p_house_public_code, p_expense_limit) e
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(to_jsonb(s))
      from public.get_house_payment_simplification(p_house_public_code) s
    ), '[]'::jsonb),
    'pending_payment_confirmations', coalesce((
      select jsonb_agg(to_jsonb(pp))
      from public.get_house_pending_payment_confirmations(p_house_public_code) pp
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_house_expenses_dashboard(text, int, int) to authenticated;


-- =========================================================
-- GASTOS - TICKETS ABIERTOS SOLO SI SIGUEN PENDIENTES
-- Primera pantalla de Gastos: no mostrar tickets ya liquidados.
-- "Ver todo" (historial) mantiene el comportamiento completo.
-- =========================================================

create or replace function public.get_house_purchase_tickets(
  p_house_public_code text,
  p_limit int default 5
)
returns table (
  ticket_id uuid,
  display_title text,
  merchant text,
  purchase_date date,
  paid_by_name text,
  total_amount numeric(10,2),
  currency text,
  ticket_file_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  v_house_id := public.get_accessible_house_id(p_house_public_code);

  return query
  select
    pt.id as ticket_id,
    public.profile_display_name(pt.paid_by_profile_id)
      || ' - ' ||
      coalesce(nullif(trim(pt.title), ''), 'Compra ' || pt.merchant) as display_title,
    pt.merchant,
    pt.purchase_date,
    public.profile_display_name(pt.paid_by_profile_id) as paid_by_name,
    pt.total_amount,
    pt.currency,
    pt.ticket_file_path
  from public.purchase_tickets pt
  left join public.shared_expenses se
    on se.source_ticket_id = pt.id
   and se.house_id = pt.house_id
   and se.status = 'active'
  where pt.house_id = v_house_id
    and pt.status = 'active'
    and (
      se.id is null
      or coalesce(se.settlement_status, 'open') <> 'settled'
    )
  order by pt.purchase_date desc, pt.created_at desc
  limit greatest(p_limit, 1);
end;
$$;

grant execute on function public.get_house_purchase_tickets(text, int) to authenticated;

-- =========================================================
-- PERFIL - DATOS REALES Y CONFIGURACION POR PISO
-- Añadido incremental. No sustituye bloques anteriores.

-- =========================================================

alter table public.house_members
add column if not exists room_label text,
add column if not exists room_size text,
add column if not exists stay_start_date date,
add column if not exists stay_end_date date;


create or replace function public.get_profile_settings(
  p_house_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_is_admin boolean;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);
  v_is_admin := public.is_house_admin(v_house_id);

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url,
      'public_code', p.public_code
    ),
    'house_member', jsonb_build_object(
      'role', hm.role,
      'room_label', hm.room_label,
      'room_size', hm.room_size,
      'stay_start_date', hm.stay_start_date,
      'stay_end_date', hm.stay_end_date
    ),
    'can_remove_members', v_is_admin,
    'removable_members', case
      when v_is_admin then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'profile_id', member.profile_id,
            'display_name', public.profile_display_name(member.profile_id),
            'role', member.role
          )
          order by public.profile_display_name(member.profile_id)
        )
        from public.house_members member
        where member.house_id = v_house_id
          and member.is_active = true
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  )
  into v_result
  from public.profiles p
  join public.house_members hm
    on hm.profile_id = p.id
   and hm.house_id = v_house_id
   and hm.is_active = true
  where p.id = auth.uid()
  limit 1;

  if v_result is null then
    raise exception 'Perfil no encontrado';
  end if;

  return v_result;
end;
$$;

grant execute on function public.get_profile_settings(text) to authenticated;


create or replace function public.update_own_profile_settings(
  p_full_name text,
  p_email text,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  update public.profiles
  set
    full_name = nullif(trim(p_full_name), ''),
    email = nullif(trim(p_email), ''),
    avatar_url = nullif(trim(coalesce(p_avatar_url, '')), '')
  where id = auth.uid();

  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  return jsonb_build_object('status', 'updated');
end;
$$;

grant execute on function public.update_own_profile_settings(text, text, text) to authenticated;


create or replace function public.update_own_house_member_settings(
  p_house_public_code text,
  p_room_label text default null,
  p_room_size text default null,
  p_stay_start_date date default null,
  p_stay_end_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if p_stay_start_date is not null
     and p_stay_end_date is not null
     and p_stay_end_date < p_stay_start_date then
    raise exception 'La fecha de fin no puede ser anterior al inicio';
  end if;

  update public.house_members
  set
    room_label = nullif(trim(coalesce(p_room_label, '')), ''),
    room_size = nullif(trim(coalesce(p_room_size, '')), ''),
    stay_start_date = p_stay_start_date,
    stay_end_date = p_stay_end_date
  where house_id = v_house_id
    and profile_id = auth.uid()
    and is_active = true;

  if not found then
    raise exception 'Participante no encontrado';
  end if;

  return jsonb_build_object('status', 'updated');
end;
$$;

grant execute on function public.update_own_house_member_settings(
  text,
  text,
  text,
  date,
  date
) to authenticated;


create or replace function public.remove_house_member(
  p_house_public_code text,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_target public.house_members%rowtype;
  v_active_admin_count int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not public.is_house_admin(v_house_id) then
    raise exception 'Solo un admin puede eliminar participantes';
  end if;

  select *
  into v_target
  from public.house_members hm
  where hm.house_id = v_house_id
    and hm.profile_id = p_profile_id
    and hm.is_active = true
  limit 1;

  if v_target.id is null then
    raise exception 'Participante no encontrado';
  end if;

  if v_target.role = 'admin' then
    select count(*)::int
    into v_active_admin_count
    from public.house_members hm
    where hm.house_id = v_house_id
      and hm.is_active = true
      and hm.role = 'admin';

    if v_active_admin_count <= 1 then
      raise exception 'No se puede eliminar el unico admin activo del piso';
    end if;
  end if;

  update public.house_members
  set
    is_active = false,
    left_at = now()
  where id = v_target.id;

  return jsonb_build_object(
    'status', 'removed',
    'profile_id', p_profile_id
  );
end;
$$;

grant execute on function public.remove_house_member(text, uuid) to authenticated;


-- =========================================================
-- CONVIVE - DOCUMENTOS PRIVADOS DE TICKETS Y FACTURAS
-- Supabase Storage privado + paths en base de datos + signed URLs temporales
-- Ejecutar este bloque al final, sin borrar los bloques anteriores.
-- =========================================================

-- 1) Bucket privado recomendado: convive-documents
-- Se crea por SQL para evitar depender de codigo runtime de la app.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'convive-documents',
  'convive-documents',
  false,
  10485760,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];


-- 2) Helper seguro para extraer house_id desde paths:
-- house/{house_id}/expenses/{expense_id}/ticket/{file}
-- house/{house_id}/invoices/{expense_id}/invoice/{file}
create or replace function public.storage_path_house_id(p_name text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
begin
  if split_part(p_name, '/', 1) <> 'house' then
    return null;
  end if;

  return split_part(p_name, '/', 2)::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;


-- 3) Politicas RLS para Storage.
-- El bucket es privado. La app solo crea signed URLs temporales desde backend.
drop policy if exists "convive_documents_select_if_house_member" on storage.objects;
create policy "convive_documents_select_if_house_member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'convive-documents'
  and (
    public.is_house_member(public.storage_path_house_id(name))
    or public.is_house_creator(public.storage_path_house_id(name))
  )
);

drop policy if exists "convive_documents_insert_if_house_member" on storage.objects;
create policy "convive_documents_insert_if_house_member"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'convive-documents'
  and (
    public.is_house_member(public.storage_path_house_id(name))
    or public.is_house_creator(public.storage_path_house_id(name))
  )
);

drop policy if exists "convive_documents_update_if_house_member" on storage.objects;
create policy "convive_documents_update_if_house_member"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'convive-documents'
  and (
    owner = auth.uid()
    or public.is_house_admin(public.storage_path_house_id(name))
  )
  and (
    public.is_house_member(public.storage_path_house_id(name))
    or public.is_house_creator(public.storage_path_house_id(name))
  )
)
with check (
  bucket_id = 'convive-documents'
  and (
    owner = auth.uid()
    or public.is_house_admin(public.storage_path_house_id(name))
  )
  and (
    public.is_house_member(public.storage_path_house_id(name))
    or public.is_house_creator(public.storage_path_house_id(name))
  )
);

drop policy if exists "convive_documents_delete_if_house_member" on storage.objects;
create policy "convive_documents_delete_if_house_member"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'convive-documents'
  and (
    owner = auth.uid()
    or public.is_house_admin(public.storage_path_house_id(name))
  )
  and (
    public.is_house_member(public.storage_path_house_id(name))
    or public.is_house_creator(public.storage_path_house_id(name))
  )
);


-- 4) Asegurar columnas de paths existentes/reutilizadas.
alter table public.purchase_tickets
add column if not exists ticket_file_path text;

create table if not exists public.invoice_categories (
  id uuid primary key default gen_random_uuid(),
  house_id uuid references public.houses(id) on delete cascade,
  category_key text not null,
  name text not null,
  sort_order int not null default 100,
  is_builtin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_expenses
add column if not exists invoice_category_id uuid references public.invoice_categories(id) on delete set null;

alter table public.shared_expenses
add column if not exists invoice_file_path text;

alter table public.shared_expenses
add column if not exists invoice_paid_at timestamptz;

insert into public.invoice_categories (category_key, name, sort_order, is_builtin, is_active)
select *
from (
  values
    ('alquiler', 'Alquiler', 10, true, true),
    ('suscripciones', 'Suscripciones', 20, true, true),
    ('wifi', 'Wifi', 30, true, true),
    ('agua', 'Agua', 40, true, true),
    ('luz', 'Luz', 50, true, true)
) as seed(category_key, name, sort_order, is_builtin, is_active)
where not exists (
  select 1
  from public.invoice_categories ic
  where ic.house_id is null
    and lower(ic.category_key) = lower(seed.category_key)
);


-- 5) Alta de ticket con IDs/path generados por backend.
create or replace function public.create_pending_ticket_expense(
  p_house_public_code text,
  p_ticket_kind text,
  p_title text,
  p_merchant text,
  p_purchase_date date,
  p_total_amount numeric,
  p_item_names text[],
  p_participant_profile_ids uuid[],
  p_notes text default null,
  p_paid_by_profile_id uuid default null,
  p_ticket_file_path text default null,
  p_ticket_id uuid default null,
  p_expense_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_paid_by_profile_id uuid;
  v_ticket_id uuid := coalesce(p_ticket_id, gen_random_uuid());
  v_expense_id uuid := coalesce(p_expense_id, gen_random_uuid());
  v_count int;
  v_valid_count int;
  v_base_share numeric(10,2);
  v_share numeric(10,2);
  v_remaining numeric(10,2);
  v_i int;
  v_item_name text;
  v_participant_id uuid;
  v_participant_status text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not (public.is_house_member(v_house_id) or public.is_house_creator(v_house_id)) then
    raise exception 'Sin acceso a la casa';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'El importe total debe ser mayor que 0';
  end if;

  if p_purchase_date is null then
    raise exception 'La fecha de compra es obligatoria';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'El titulo es obligatorio';
  end if;

  if p_ticket_kind is null or p_ticket_kind not in ('purchase', 'unexpected') then
    raise exception 'Tipo de ticket no valido';
  end if;

  v_paid_by_profile_id := coalesce(p_paid_by_profile_id, auth.uid());

  if not exists (
    select 1
    from public.house_members hm
    where hm.house_id = v_house_id
      and hm.profile_id = v_paid_by_profile_id
      and hm.is_active = true
  ) then
    raise exception 'La persona que paga no pertenece a la casa';
  end if;

  v_count := coalesce(array_length(p_participant_profile_ids, 1), 0);

  if v_count = 0 then
    raise exception 'Debes seleccionar al menos un participante';
  end if;

  select count(distinct x.profile_id)::int
  into v_valid_count
  from unnest(p_participant_profile_ids) as x(profile_id)
  join public.house_members hm
    on hm.house_id = v_house_id
   and hm.profile_id = x.profile_id
   and hm.is_active = true;

  if v_valid_count <> v_count then
    raise exception 'Hay participantes que no pertenecen a la casa o estan repetidos';
  end if;

  insert into public.purchase_tickets (
    id,
    house_id,
    paid_by_profile_id,
    created_by_profile_id,
    merchant,
    title,
    purchase_date,
    total_amount,
    currency,
    ticket_file_path,
    notes,
    ticket_kind,
    status
  )
  values (
    v_ticket_id,
    v_house_id,
    v_paid_by_profile_id,
    auth.uid(),
    coalesce(nullif(trim(p_merchant), ''), 'Manual'),
    trim(p_title),
    p_purchase_date,
    round(p_total_amount, 2),
    'EUR',
    nullif(trim(coalesce(p_ticket_file_path, '')), ''),
    p_notes,
    p_ticket_kind,
    'active'
  );

  if p_item_names is not null then
    foreach v_item_name in array p_item_names
    loop
      if v_item_name is not null and length(trim(v_item_name)) > 0 then
        insert into public.purchase_ticket_items (
          ticket_id,
          description,
          quantity,
          unit_price
        )
        values (
          v_ticket_id,
          trim(v_item_name),
          1,
          0
        );

        insert into public.house_item_catalog (
          house_id,
          name,
          created_by_profile_id,
          is_active
        )
        values (
          v_house_id,
          trim(v_item_name),
          auth.uid(),
          true
        )
        on conflict (house_id, normalized_name)
        do update set is_active = true;
      end if;
    end loop;
  end if;

  insert into public.shared_expenses (
    id,
    house_id,
    source_ticket_id,
    created_by_profile_id,
    paid_by_profile_id,
    title,
    description,
    expense_type,
    expense_date,
    total_amount,
    currency,
    split_method,
    status,
    settlement_status
  )
  values (
    v_expense_id,
    v_house_id,
    v_ticket_id,
    auth.uid(),
    v_paid_by_profile_id,
    trim(p_title),
    p_notes,
    'ticket',
    p_purchase_date,
    round(p_total_amount, 2),
    'EUR',
    'equal',
    'active',
    'open'
  );

  v_base_share := trunc((p_total_amount / v_count)::numeric, 2);
  v_remaining := round(p_total_amount, 2);

  for v_i in 1..v_count
  loop
    v_participant_id := p_participant_profile_ids[v_i];

    if v_i < v_count then
      v_share := v_base_share;
    else
      v_share := round(v_remaining, 2);
    end if;

    v_participant_status := case
      when v_participant_id = v_paid_by_profile_id then 'paid'
      else 'pending'
    end;

    insert into public.expense_participants (
      expense_id,
      profile_id,
      share_amount,
      status
    )
    values (
      v_expense_id,
      v_participant_id,
      v_share,
      v_participant_status
    );

    v_remaining := round(v_remaining - v_share, 2);
  end loop;

  perform public.recalculate_expense_settlement(v_expense_id);

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'shared_expense',
    v_expense_id,
    'created',
    jsonb_build_object(
      'ticket_id', v_ticket_id,
      'ticket_kind', p_ticket_kind,
      'title', p_title,
      'merchant', p_merchant,
      'purchase_date', p_purchase_date,
      'total_amount', round(p_total_amount, 2),
      'participant_profile_ids', to_jsonb(p_participant_profile_ids),
      'item_names', to_jsonb(p_item_names),
      'paid_by_profile_id', v_paid_by_profile_id,
      'ticket_file_path', p_ticket_file_path
    )
  );

  return jsonb_build_object(
    'ticket_id', v_ticket_id,
    'expense_id', v_expense_id,
    'house_public_code', p_house_public_code
  );
end;
$$;

grant execute on function public.create_pending_ticket_expense(
  text,
  text,
  text,
  text,
  date,
  numeric,
  text[],
  uuid[],
  text,
  uuid,
  text,
  uuid,
  uuid
) to authenticated;


-- 6) Alta de factura con ID/path generado por backend.
create or replace function public.create_pending_invoice_expense(
  p_house_public_code text,
  p_title text,
  p_invoice_date date,
  p_total_amount numeric,
  p_participant_profile_ids uuid[],
  p_invoice_category_id uuid default null,
  p_custom_category_name text default null,
  p_notes text default null,
  p_paid_by_profile_id uuid default null,
  p_invoice_file_path text default null,
  p_expense_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_paid_by_profile_id uuid;
  v_expense_id uuid := coalesce(p_expense_id, gen_random_uuid());
  v_invoice_category_id uuid;
  v_custom_category_key text;
  v_count int;
  v_valid_count int;
  v_base_share numeric(10,2);
  v_share numeric(10,2);
  v_remaining numeric(10,2);
  v_i int;
  v_participant_id uuid;
  v_participant_status text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);

  if not (public.is_house_member(v_house_id) or public.is_house_creator(v_house_id)) then
    raise exception 'Sin acceso a la casa';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'El importe total debe ser mayor que 0';
  end if;

  if p_invoice_date is null then
    raise exception 'La fecha de factura es obligatoria';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'El titulo es obligatorio';
  end if;

  v_paid_by_profile_id := coalesce(p_paid_by_profile_id, auth.uid());

  if not exists (
    select 1
    from public.house_members hm
    where hm.house_id = v_house_id
      and hm.profile_id = v_paid_by_profile_id
      and hm.is_active = true
  ) then
    raise exception 'La persona que paga no pertenece a la casa';
  end if;

  if p_invoice_category_id is not null then
    select ic.id
    into v_invoice_category_id
    from public.invoice_categories ic
    where ic.id = p_invoice_category_id
      and ic.is_active = true
      and (ic.house_id is null or ic.house_id = v_house_id)
    limit 1;

    if v_invoice_category_id is null then
      raise exception 'Categoria de factura no valida';
    end if;
  elsif p_custom_category_name is not null and length(trim(p_custom_category_name)) > 0 then
    v_custom_category_key := lower(regexp_replace(trim(p_custom_category_name), '[^a-zA-Z0-9]+', '-', 'g'));
    v_custom_category_key := trim(both '-' from v_custom_category_key);

    if v_custom_category_key is null or v_custom_category_key = '' then
      v_custom_category_key := 'personalizada';
    end if;

    select ic.id
    into v_invoice_category_id
    from public.invoice_categories ic
    where ic.house_id = v_house_id
      and lower(ic.category_key) = lower(v_custom_category_key)
    limit 1;

    if v_invoice_category_id is null then
      insert into public.invoice_categories (
        house_id,
        category_key,
        name,
        sort_order,
        is_builtin,
        is_active
      )
      values (
        v_house_id,
        v_custom_category_key,
        trim(p_custom_category_name),
        100,
        false,
        true
      )
      returning id into v_invoice_category_id;
    end if;
  else
    raise exception 'Selecciona un tipo de factura';
  end if;

  v_count := coalesce(array_length(p_participant_profile_ids, 1), 0);

  if v_count = 0 then
    raise exception 'Debes seleccionar al menos un participante';
  end if;

  select count(distinct x.profile_id)::int
  into v_valid_count
  from unnest(p_participant_profile_ids) as x(profile_id)
  join public.house_members hm
    on hm.house_id = v_house_id
   and hm.profile_id = x.profile_id
   and hm.is_active = true;

  if v_valid_count <> v_count then
    raise exception 'Hay participantes que no pertenecen a la casa o estan repetidos';
  end if;

  insert into public.shared_expenses (
    id,
    house_id,
    source_ticket_id,
    created_by_profile_id,
    paid_by_profile_id,
    title,
    description,
    expense_type,
    expense_date,
    total_amount,
    currency,
    split_method,
    status,
    settlement_status,
    invoice_category_id,
    invoice_file_path
  )
  values (
    v_expense_id,
    v_house_id,
    null,
    auth.uid(),
    v_paid_by_profile_id,
    trim(p_title),
    p_notes,
    'invoice',
    p_invoice_date,
    round(p_total_amount, 2),
    'EUR',
    'equal',
    'active',
    'open',
    v_invoice_category_id,
    nullif(trim(coalesce(p_invoice_file_path, '')), '')
  );

  v_base_share := trunc((p_total_amount / v_count)::numeric, 2);
  v_remaining := round(p_total_amount, 2);

  for v_i in 1..v_count
  loop
    v_participant_id := p_participant_profile_ids[v_i];

    if v_i < v_count then
      v_share := v_base_share;
    else
      v_share := round(v_remaining, 2);
    end if;

    v_participant_status := case
      when v_participant_id = v_paid_by_profile_id then 'paid'
      else 'pending'
    end;

    insert into public.expense_participants (
      expense_id,
      profile_id,
      share_amount,
      status
    )
    values (
      v_expense_id,
      v_participant_id,
      v_share,
      v_participant_status
    );

    v_remaining := round(v_remaining - v_share, 2);
  end loop;

  perform public.recalculate_expense_settlement(v_expense_id);

  insert into public.house_audit_log (
    house_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_house_id,
    auth.uid(),
    'invoice',
    v_expense_id,
    'created',
    jsonb_build_object(
      'title', p_title,
      'invoice_date', p_invoice_date,
      'total_amount', round(p_total_amount, 2),
      'participant_profile_ids', to_jsonb(p_participant_profile_ids),
      'paid_by_profile_id', v_paid_by_profile_id,
      'invoice_category_id', v_invoice_category_id,
      'invoice_file_path', p_invoice_file_path
    )
  );

  return jsonb_build_object(
    'expense_id', v_expense_id,
    'house_public_code', p_house_public_code
  );
end;
$$;

grant execute on function public.create_pending_invoice_expense(
  text,
  text,
  date,
  numeric,
  uuid[],
  uuid,
  text,
  text,
  uuid,
  text,
  uuid
) to authenticated;


-- =========================================================
-- AREA GRUPAL - SACAR PARTICIPANTE DEL PISO SIN BORRAR USUARIO
-- Endurece la RPC existente:
-- - no borra profiles ni auth.users
-- - solo marca house_members como inactivo y registra left_at
-- - solo un admin activo puede sacar a otro miembro
-- - no permite autosalida desde esta accion
-- - no permite sacar al creador del piso
-- - no permite dejar el piso sin admin activo
-- =========================================================

create or replace function public.remove_house_member(
  p_house_public_code text,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_created_by uuid;
  v_target public.house_members%rowtype;
  v_active_admin_count int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select h.id, h.created_by
  into v_house_id, v_created_by
  from public.houses h
  where h.public_code = trim(p_house_public_code)
    and h.status = 'active'
  limit 1;

  if v_house_id is null then
    raise exception 'Piso no encontrado';
  end if;

  if not exists (
    select 1
    from public.house_members hm
    where hm.house_id = v_house_id
      and hm.profile_id = auth.uid()
      and hm.is_active = true
      and hm.role = 'admin'
  ) then
    raise exception 'Solo un admin activo puede sacar participantes';
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'No puedes sacarte a ti mismo del piso desde esta accion';
  end if;

  if p_profile_id = v_created_by then
    raise exception 'No se puede sacar al creador del piso';
  end if;

  select *
  into v_target
  from public.house_members hm
  where hm.house_id = v_house_id
    and hm.profile_id = p_profile_id
    and hm.is_active = true
  limit 1;

  if v_target.id is null then
    raise exception 'Participante no encontrado';
  end if;

  if v_target.role = 'admin' then
    select count(*)::int
    into v_active_admin_count
    from public.house_members hm
    where hm.house_id = v_house_id
      and hm.is_active = true
      and hm.role = 'admin';

    if v_active_admin_count <= 1 then
      raise exception 'No se puede sacar al unico admin activo del piso';
    end if;
  end if;

  update public.house_members
  set
    is_active = false,
    left_at = now()
  where id = v_target.id;

  return jsonb_build_object(
    'status', 'removed_from_house',
    'profile_id', p_profile_id,
    'house_id', v_house_id
  );
end;
$$;

grant execute on function public.remove_house_member(text, uuid) to authenticated;


-- =========================================================
-- MIGRACION USUARIOS - profiles.public_code -> profiles.user_hash_id
-- Identificador opaco, estable y seguro para URL.
-- houses.public_code se mantiene sin cambios.
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
add column if not exists user_hash_id text;

create unique index if not exists profiles_user_hash_id_uidx
on public.profiles (user_hash_id);

create or replace function public.generate_user_hash_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash_id text;
begin
  loop
    v_hash_id := 'usr_' || rtrim(
      translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
      '='
    );

    exit when not exists (
      select 1
      from public.profiles p
      where p.user_hash_id = v_hash_id
    );
  end loop;

  return v_hash_id;
end;
$$;

grant execute on function public.generate_user_hash_id() to authenticated;

do $$
declare
  r record;
  v_hash_id text;
begin
  for r in
    select id
    from public.profiles
    where user_hash_id is null
       or length(trim(user_hash_id)) = 0
  loop
    v_hash_id := public.generate_user_hash_id();

    update public.profiles
    set user_hash_id = v_hash_id
    where id = r.id;
  end loop;
end $$;

alter table public.profiles
alter column user_hash_id set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, user_hash_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    public.generate_user_hash_id()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    user_hash_id = coalesce(public.profiles.user_hash_id, excluded.user_hash_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.get_authenticated_profile_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url,
    'user_hash_id', p.user_hash_id
  )
  into v_profile
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_profile is null or nullif(trim(v_profile ->> 'user_hash_id'), '') is null then
    raise exception 'Perfil no encontrado';
  end if;

  return v_profile;
end;
$$;

grant execute on function public.get_authenticated_profile_context() to authenticated;

drop function if exists public.get_accessible_house_context(text, text);

create function public.get_accessible_house_context(
  p_user_hash_id text,
  p_house_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_context jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_profile.id is null or nullif(trim(v_profile.user_hash_id), '') is null then
    raise exception 'Perfil no encontrado';
  end if;

  if v_profile.user_hash_id <> trim(p_user_hash_id) then
    raise exception 'Usuario no encontrado';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'email', v_profile.email,
      'full_name', v_profile.full_name,
      'avatar_url', v_profile.avatar_url,
      'user_hash_id', v_profile.user_hash_id
    ),
    'house', jsonb_build_object(
      'id', h.id,
      'name', h.name,
      'public_code', h.public_code,
      'created_by', h.created_by
    ),
    'member_role', coalesce(hm.role, 'member')
  )
  into v_context
  from public.house_members hm
  join public.houses h on h.id = hm.house_id
  where hm.profile_id = auth.uid()
    and hm.is_active = true
    and h.public_code = trim(p_house_public_code)
    and h.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Piso no encontrado o sin acceso';
  end if;

  return v_context;
end;
$$;

grant execute on function public.get_accessible_house_context(text, text) to authenticated;

create or replace function public.get_default_dashboard_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_context jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_profile.id is null or nullif(trim(v_profile.user_hash_id), '') is null then
    raise exception 'Perfil no encontrado';
  end if;

  select jsonb_build_object(
    'user_hash_id', v_profile.user_hash_id,
    'house_public_code', h.public_code
  )
  into v_context
  from public.house_members hm
  join public.houses h on h.id = hm.house_id
  where hm.profile_id = auth.uid()
    and hm.is_active = true
    and h.status = 'active'
  order by hm.joined_at asc
  limit 1;

  return v_context;
end;
$$;

grant execute on function public.get_default_dashboard_context() to authenticated;

create or replace function public.get_profile_settings(
  p_house_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_is_admin boolean;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);
  v_is_admin := public.is_house_admin(v_house_id);

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url,
      'user_hash_id', p.user_hash_id
    ),
    'house_member', jsonb_build_object(
      'role', hm.role,
      'room_label', hm.room_label,
      'room_size', hm.room_size,
      'stay_start_date', hm.stay_start_date,
      'stay_end_date', hm.stay_end_date
    ),
    'can_remove_members', v_is_admin,
    'removable_members', case
      when v_is_admin then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'profile_id', member.profile_id,
            'display_name', public.profile_display_name(member.profile_id),
            'role', member.role
          )
          order by public.profile_display_name(member.profile_id)
        )
        from public.house_members member
        where member.house_id = v_house_id
          and member.is_active = true
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  )
  into v_result
  from public.profiles p
  join public.house_members hm
    on hm.profile_id = p.id
   and hm.house_id = v_house_id
   and hm.is_active = true
  where p.id = auth.uid()
  limit 1;

  if v_result is null then
    raise exception 'Perfil no encontrado';
  end if;

  return v_result;
end;
$$;

grant execute on function public.get_profile_settings(text) to authenticated;

drop index if exists public.profiles_public_code_uidx;

alter table public.profiles
drop column if exists public_code;


-- =========================================================
-- AVATAR PRIVADO DE PERFIL
-- =========================================================

-- Guarda la ultima foto personalizada subida aunque el avatar activo sea
-- uno de los iconos internos de la aplicacion.
alter table public.profiles
add column if not exists avatar_storage_path text;


-- Helper seguro para rutas:
-- profiles/{profile_id}/avatar/{uuid}.{ext}
create or replace function public.storage_path_profile_id(p_name text)
returns uuid
language plpgsql
stable
as $$
declare
  v_profile_id_text text;
begin
  if p_name is null or p_name !~ '^profiles/[0-9a-fA-F-]+/avatar/[^/]+$' then
    return null;
  end if;

  v_profile_id_text := split_part(p_name, '/', 2);
  return v_profile_id_text::uuid;
exception
  when others then
    return null;
end;
$$;


-- Politicas adicionales para avatares dentro del bucket privado existente.
-- Mantiene convive-documents privado y permite solo al usuario autenticado
-- operar sobre su propia carpeta profiles/{auth.uid()}/avatar/.
drop policy if exists "convive_documents_profile_avatar_select_own" on storage.objects;
create policy "convive_documents_profile_avatar_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'convive-documents'
  and public.storage_path_profile_id(name) = auth.uid()
);

drop policy if exists "convive_documents_profile_avatar_insert_own" on storage.objects;
create policy "convive_documents_profile_avatar_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'convive-documents'
  and public.storage_path_profile_id(name) = auth.uid()
);

drop policy if exists "convive_documents_profile_avatar_update_own" on storage.objects;
create policy "convive_documents_profile_avatar_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'convive-documents'
  and public.storage_path_profile_id(name) = auth.uid()
)
with check (
  bucket_id = 'convive-documents'
  and public.storage_path_profile_id(name) = auth.uid()
);

drop policy if exists "convive_documents_profile_avatar_delete_own" on storage.objects;
create policy "convive_documents_profile_avatar_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'convive-documents'
  and public.storage_path_profile_id(name) = auth.uid()
);


-- Funcion especifica para cambiar el avatar activo sin mezclarlo con el
-- guardado de nombre/email/contrasena.
create or replace function public.set_own_profile_avatar(
  p_avatar_url text,
  p_avatar_storage_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avatar_url text;
  v_avatar_storage_path text;
  v_current_storage_path text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_avatar_url := nullif(trim(coalesce(p_avatar_url, '')), '');
  v_avatar_storage_path := nullif(trim(coalesce(p_avatar_storage_path, '')), '');

  if v_avatar_storage_path is not null
     and public.storage_path_profile_id(v_avatar_storage_path) is distinct from auth.uid() then
    raise exception 'Ruta de avatar no permitida';
  end if;

  select avatar_storage_path
  into v_current_storage_path
  from public.profiles
  where id = auth.uid()
  limit 1;

  if v_avatar_url is not null
     and v_avatar_url not in ('/images/IconoperfilM.webp', '/images/IconoperfilH.webp') then
    if public.storage_path_profile_id(v_avatar_url) is distinct from auth.uid() then
      raise exception 'Avatar no permitido';
    end if;

    if v_avatar_storage_path is null and v_current_storage_path is distinct from v_avatar_url then
      raise exception 'La foto seleccionada no pertenece a tu perfil';
    end if;
  end if;

  update public.profiles
  set
    avatar_url = v_avatar_url,
    avatar_storage_path = coalesce(v_avatar_storage_path, avatar_storage_path)
  where id = auth.uid();

  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  return jsonb_build_object(
    'avatar_url', v_avatar_url,
    'avatar_storage_path', coalesce(v_avatar_storage_path, v_current_storage_path)
  );
end;
$$;

grant execute on function public.set_own_profile_avatar(text, text) to authenticated;


create or replace function public.update_own_profile_settings(
  p_full_name text,
  p_email text,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avatar_url text;
  v_current_storage_path text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_avatar_url := nullif(trim(coalesce(p_avatar_url, '')), '');

  if v_avatar_url is not null
     and v_avatar_url not in ('/images/IconoperfilM.webp', '/images/IconoperfilH.webp') then
    if public.storage_path_profile_id(v_avatar_url) is distinct from auth.uid() then
      raise exception 'Avatar no permitido';
    end if;

    select avatar_storage_path
    into v_current_storage_path
    from public.profiles
    where id = auth.uid()
    limit 1;

    if v_current_storage_path is distinct from v_avatar_url then
      raise exception 'La foto seleccionada no pertenece a tu perfil';
    end if;
  end if;

  update public.profiles
  set
    full_name = nullif(trim(p_full_name), ''),
    email = nullif(trim(p_email), ''),
    avatar_url = v_avatar_url
  where id = auth.uid();

  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  return jsonb_build_object('status', 'updated');
end;
$$;

grant execute on function public.update_own_profile_settings(text, text, text) to authenticated;


create or replace function public.get_profile_settings(
  p_house_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_is_admin boolean;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  v_house_id := public.get_accessible_house_id(p_house_public_code);
  v_is_admin := public.is_house_admin(v_house_id);

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url,
      'avatar_storage_path', p.avatar_storage_path,
      'user_hash_id', p.user_hash_id
    ),
    'house_member', jsonb_build_object(
      'role', hm.role,
      'room_label', hm.room_label,
      'room_size', hm.room_size,
      'stay_start_date', hm.stay_start_date,
      'stay_end_date', hm.stay_end_date
    ),
    'can_remove_members', v_is_admin,
    'removable_members', case
      when v_is_admin then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'profile_id', member.profile_id,
            'display_name', public.profile_display_name(member.profile_id),
            'role', member.role
          )
          order by public.profile_display_name(member.profile_id)
        )
        from public.house_members member
        where member.house_id = v_house_id
          and member.is_active = true
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  )
  into v_result
  from public.profiles p
  join public.house_members hm
    on hm.profile_id = p.id
   and hm.house_id = v_house_id
   and hm.is_active = true
  where p.id = auth.uid()
  limit 1;

  if v_result is null then
    raise exception 'Perfil no encontrado';
  end if;

  return v_result;
end;
$$;

grant execute on function public.get_profile_settings(text) to authenticated;


-- =========================================================
-- AVATAR PRIVADO - LECTURA ENTRE MIEMBROS DEL MISMO PISO
-- =========================================================

-- Permite mostrar avatares personalizados en Area grupal y pantallas de
-- gastos/limpieza solo entre miembros activos que comparten piso.
-- La escritura sigue limitada a profiles/{auth.uid()}/avatar/.
drop policy if exists "convive_documents_profile_avatar_select_own" on storage.objects;
create policy "convive_documents_profile_avatar_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'convive-documents'
  and (
    public.storage_path_profile_id(name) = auth.uid()
    or exists (
      select 1
      from public.house_members viewer
      join public.house_members owner_member
        on owner_member.house_id = viewer.house_id
       and owner_member.is_active = true
      where viewer.profile_id = auth.uid()
        and viewer.is_active = true
        and owner_member.profile_id = public.storage_path_profile_id(name)
    )
  )
);
