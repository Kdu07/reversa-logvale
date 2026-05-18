-- =====================================================================
-- LOGVALE — Schema Completo do Banco de Dados
-- PostgreSQL via Supabase
-- =====================================================================

-- =====================================================================
-- EXTENSÕES
-- =====================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- =====================================================================
-- ENUMS
-- =====================================================================
create type user_role as enum ('operator', 'client', 'manager');
create type return_status as enum ('awaiting_decision', 'decided', 'processed');
create type return_decision as enum (
  'return_to_stock',
  'store_for_handling',
  'discard',
  'repackage'
);
create type decision_source as enum ('client', 'auto');
create type identifier_type as enum ('access_key', 'postal_code', 'illegible');
create type photo_type as enum ('box', 'item');

-- =====================================================================
-- TABELA: profiles (estende auth.users do Supabase)
-- =====================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text not null,
  phone text,
  active boolean not null default true,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on profiles(role) where active = true;
create index idx_profiles_active on profiles(active);

-- =====================================================================
-- TABELA: depositors
-- =====================================================================
create table depositors (
  id uuid primary key default uuid_generate_v4(),
  cnpj text not null unique,
  razao_social text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cnpj_format check (cnpj ~ '^[0-9]{14}$')
);

create index idx_depositors_cnpj on depositors(cnpj);
create index idx_depositors_active on depositors(active);

-- =====================================================================
-- TABELA: client_depositors (associação N:N)
-- =====================================================================
create table client_depositors (
  client_id uuid not null references profiles(id) on delete cascade,
  depositor_id uuid not null references depositors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, depositor_id)
);

create index idx_client_depositors_client on client_depositors(client_id);
create index idx_client_depositors_depositor on client_depositors(depositor_id);

-- =====================================================================
-- TABELA: invoice_cache (cache de NFs Webmania)
-- =====================================================================
create table invoice_cache (
  access_key text primary key,
  xml_url text not null,
  emitter_cnpj text not null,
  invoice_number text,
  emitted_at timestamptz,
  raw_response jsonb,
  fetched_at timestamptz not null default now(),
  constraint access_key_format check (access_key ~ '^[0-9]{44}$')
);

create index idx_invoice_cache_emitter on invoice_cache(emitter_cnpj);

-- =====================================================================
-- TABELA: returns (entidade central)
-- =====================================================================
create table returns (
  id uuid primary key default uuid_generate_v4(),

  -- Identificação
  identifier_type identifier_type not null,
  access_key text,           -- preenchido se identifier_type = 'access_key'
  postal_code text,          -- preenchido se identifier_type = 'postal_code'
  illegible_token text,      -- preenchido se identifier_type = 'illegible'
  rv text not null unique,
  item_count integer not null check (item_count > 0),

  -- Vínculos
  depositor_id uuid references depositors(id),  -- pode ser null se ilegível inicial
  invoice_xml_url text,                          -- URL do XML cacheado

  -- Recebimento
  status return_status not null default 'awaiting_decision',
  received_at timestamptz not null default now(),
  received_by uuid not null references profiles(id),

  -- Decisão
  decision return_decision,
  decided_at timestamptz,
  decided_by uuid references profiles(id),
  decided_by_type decision_source,
  return_invoice_xml_url text,  -- XML de NF de devolução enviado pelo cliente

  -- Tratativa
  processed_at timestamptz,
  processed_by uuid references profiles(id),

  -- Notificações
  warning_sent_at timestamptz,

  -- Auditoria leve
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Constraints
  constraint identifier_consistency check (
    (identifier_type = 'access_key' and access_key is not null
      and postal_code is null and illegible_token is null) or
    (identifier_type = 'postal_code' and postal_code is not null
      and access_key is null and illegible_token is null) or
    (identifier_type = 'illegible' and illegible_token is not null
      and access_key is null and postal_code is null)
  ),
  constraint decision_consistency check (
    (status = 'awaiting_decision' and decision is null and decided_at is null) or
    (status in ('decided', 'processed') and decision is not null and decided_at is not null)
  ),
  constraint processed_consistency check (
    (status != 'processed' and processed_at is null and processed_by is null) or
    (status = 'processed' and processed_at is not null and processed_by is not null)
  )
);

create index idx_returns_status on returns(status);
create index idx_returns_depositor on returns(depositor_id);
create index idx_returns_received_at on returns(received_at desc);
create index idx_returns_decided_at on returns(decided_at desc);
create index idx_returns_rv on returns(rv);
create index idx_returns_access_key on returns(access_key) where access_key is not null;
create index idx_returns_postal_code on returns(postal_code) where postal_code is not null;
create index idx_returns_pending_warning on returns(received_at)
  where status = 'awaiting_decision' and warning_sent_at is null;
create index idx_returns_pending_auto on returns(received_at)
  where status = 'awaiting_decision';

-- =====================================================================
-- TABELA: return_photos
-- =====================================================================
create table return_photos (
  id uuid primary key default uuid_generate_v4(),
  return_id uuid not null references returns(id) on delete cascade,
  photo_type photo_type not null,
  storage_path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_return_photos_return on return_photos(return_id);
create index idx_return_photos_type on return_photos(return_id, photo_type);

-- =====================================================================
-- TRIGGER: updated_at automático
-- =====================================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_profiles
  before update on profiles
  for each row execute function update_updated_at_column();

create trigger set_updated_at_depositors
  before update on depositors
  for each row execute function update_updated_at_column();

create trigger set_updated_at_returns
  before update on returns
  for each row execute function update_updated_at_column();

-- =====================================================================
-- FUNÇÕES AUXILIARES
-- =====================================================================

create or replace function auth_role()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function is_manager()
returns boolean as $$
  select role = 'manager' from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function is_operator()
returns boolean as $$
  select role = 'operator' from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function is_client()
returns boolean as $$
  select role = 'client' from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function client_has_depositor(dep_id uuid)
returns boolean as $$
  select exists (
    select 1 from client_depositors
    where client_id = auth.uid() and depositor_id = dep_id
  );
$$ language sql security definer stable;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

-- profiles
alter table profiles enable row level security;

create policy "users see own profile" on profiles
  for select using (id = auth.uid());

create policy "managers see all profiles" on profiles
  for select using (is_manager());

create policy "managers manage profiles" on profiles
  for all using (is_manager()) with check (is_manager());

create policy "users update own profile" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

-- depositors
alter table depositors enable row level security;

create policy "operators see all depositors" on depositors
  for select using (is_operator() or is_manager());

create policy "clients see their depositors" on depositors
  for select using (
    is_client() and exists (
      select 1 from client_depositors
      where client_id = auth.uid() and depositor_id = depositors.id
    )
  );

create policy "managers manage depositors" on depositors
  for all using (is_manager()) with check (is_manager());

-- client_depositors
alter table client_depositors enable row level security;

create policy "clients see own associations" on client_depositors
  for select using (client_id = auth.uid());

create policy "operators see all associations" on client_depositors
  for select using (is_operator() or is_manager());

create policy "managers manage associations" on client_depositors
  for all using (is_manager()) with check (is_manager());

-- invoice_cache
alter table invoice_cache enable row level security;

create policy "authenticated read invoice cache" on invoice_cache
  for select using (auth.uid() is not null);

create policy "operators write invoice cache" on invoice_cache
  for insert with check (is_operator() or is_manager());

-- returns
alter table returns enable row level security;

create policy "operators see all returns" on returns
  for select using (is_operator() or is_manager());

create policy "clients see their returns" on returns
  for select using (
    is_client() and depositor_id is not null
    and client_has_depositor(depositor_id)
  );

create policy "operators create returns" on returns
  for insert with check (is_operator());

create policy "operators update returns at handling" on returns
  for update using (is_operator()) with check (is_operator());

create policy "clients decide their returns" on returns
  for update using (
    is_client() and status = 'awaiting_decision'
    and depositor_id is not null
    and client_has_depositor(depositor_id)
  ) with check (
    is_client() and status in ('awaiting_decision', 'decided')
  );

create policy "managers full access returns" on returns
  for all using (is_manager()) with check (is_manager());

-- return_photos
alter table return_photos enable row level security;

create policy "operators see all photos" on return_photos
  for select using (is_operator() or is_manager());

create policy "clients see photos of their returns" on return_photos
  for select using (
    is_client() and exists (
      select 1 from returns r
      where r.id = return_photos.return_id
      and r.depositor_id is not null
      and client_has_depositor(r.depositor_id)
    )
  );

create policy "operators create photos" on return_photos
  for insert with check (is_operator());

create policy "managers full access photos" on return_photos
  for all using (is_manager()) with check (is_manager());

-- =====================================================================
-- JOBS AGENDADOS (pg_cron)
-- =====================================================================

create or replace function job_auto_decision()
returns void as $$
begin
  update returns
  set
    status = 'decided',
    decision = 'store_for_handling',
    decided_at = now(),
    decided_by_type = 'auto'
  where
    status = 'awaiting_decision'
    and received_at < now() - interval '72 hours';
end;
$$ language plpgsql security definer;

select cron.schedule(
  'auto-decision-job',
  '0 * * * *',
  $$select job_auto_decision()$$
);

create or replace view returns_needing_warning as
  select
    r.id, r.received_at, r.depositor_id, r.rv, r.access_key, r.postal_code,
    cd.client_id
  from returns r
  join client_depositors cd on cd.depositor_id = r.depositor_id
  where r.status = 'awaiting_decision'
    and r.warning_sent_at is null
    and r.received_at < now() - interval '48 hours'
    and r.received_at >= now() - interval '72 hours';

create or replace function job_photo_cleanup_marker()
returns table(photo_id uuid, storage_path text) as $$
  select rp.id, rp.storage_path
  from return_photos rp
  join returns r on r.id = rp.return_id
  where r.status = 'processed'
    and r.processed_at < now() - interval '12 months';
$$ language sql security definer;

-- =====================================================================
-- GRANTS
-- =====================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
