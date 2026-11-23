-- =====================================================================
-- 027 — CNPJ de depositante desativado fica livre para outro depositante
--
-- Até a 026, um CNPJ pertencia a um só depositante para sempre: `unique` em
-- `depositors.cnpj` e PK em `depositor_cnpjs.cnpj`, ativo ou não. Como um
-- depositante com devoluções só pode ser desativado (não excluído), o CNPJ
-- dele ficava preso.
--
-- A partir daqui a regra "um CNPJ, um depositante" vale só entre os ATIVOS:
--
--   * `depositors`: unique de `cnpj` vira índice parcial `where active`;
--   * `depositor_cnpjs`: ganha `active` (espelho de `depositors.active`,
--     mantido por trigger), a PK passa a ser (depositor_id, cnpj) e o CNPJ é
--     único só `where active`.
--
-- O depositante desativado mantém os CNPJs dele (histórico, relatório,
-- validação de chave das devoluções antigas); um ativo pode usar o mesmo
-- CNPJ. Reativar um depositante cujo CNPJ já está em uso por outro ativo
-- falha com 23505 (o app avisa antes, dizendo quem usa o CNPJ).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. depositors — CNPJ principal único só entre os ativos
-- ---------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.depositors'::regclass
      and con.contype = 'u'
      and con.conkey = array[(
        select a.attnum from pg_attribute a
        where a.attrelid = 'public.depositors'::regclass and a.attname = 'cnpj'
      )]::smallint[]
  loop
    execute format('alter table public.depositors drop constraint %I', c.conname);
  end loop;
end;
$$;

create unique index if not exists depositors_active_cnpj_key on depositors (cnpj) where active;

-- ---------------------------------------------------------------------
-- 2. depositor_cnpjs — espelho de `active` e unicidade só entre ativos
-- ---------------------------------------------------------------------
alter table depositor_cnpjs add column if not exists active boolean not null default true;

update depositor_cnpjs dc
set active = d.active
from depositors d
where d.id = dc.depositor_id and dc.active is distinct from d.active;

alter table depositor_cnpjs drop constraint if exists depositor_cnpjs_pkey;
alter table depositor_cnpjs add constraint depositor_cnpjs_pkey primary key (depositor_id, cnpj);

create unique index if not exists depositor_cnpjs_active_cnpj_key on depositor_cnpjs (cnpj) where active;
create index if not exists idx_depositor_cnpjs_cnpj on depositor_cnpjs (cnpj);
-- coberto pela PK (depositor_id, cnpj)
drop index if exists idx_depositor_cnpjs_depositor;

comment on column depositor_cnpjs.active is
  'Espelho de depositors.active (trigger). O CNPJ é único só entre as linhas ativas.';

-- `active` sempre igual ao do depositante, em qualquer insert/update.
create or replace function set_depositor_cnpj_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
begin
  select d.active into v_active from depositors d where d.id = new.depositor_id;
  new.active := coalesce(v_active, true);
  return new;
end;
$$;

drop trigger if exists depositor_cnpjs_set_active on depositor_cnpjs;
create trigger depositor_cnpjs_set_active
  before insert or update on depositor_cnpjs
  for each row execute function set_depositor_cnpj_active();

-- ---------------------------------------------------------------------
-- 3. Sincronia a partir de `depositors` (substitui a da 026)
--    * active mudou → espelha em todos os CNPJs do depositante (reativar
--      com CNPJ em uso por outro ativo estoura 23505 aqui);
--    * o principal sempre existe em depositor_cnpjs. Conflito com outro
--      ativo estoura 23505 no índice parcial (só a PK é árbitro do on conflict).
-- ---------------------------------------------------------------------
create or replace function sync_depositor_principal_cnpj()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.active is distinct from old.active then
    update depositor_cnpjs set active = new.active where depositor_id = new.id;
  end if;

  insert into depositor_cnpjs (cnpj, depositor_id, active)
  values (new.cnpj, new.id, new.active)
  on conflict (depositor_id, cnpj) do nothing;

  return null;
end;
$$;

drop trigger if exists depositors_sync_principal_cnpj on depositors;
create trigger depositors_sync_principal_cnpj
  after insert or update of cnpj, active on depositors
  for each row execute function sync_depositor_principal_cnpj();
