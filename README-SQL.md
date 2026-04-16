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