-- =====================================================================
-- 026 — Vários CNPJs por depositante
--
-- Um depositante pode emitir NF por mais de um CNPJ (ex.: matriz e filial,
-- ou duas empresas do mesmo grupo). Até aqui `depositors.cnpj` era o único
-- CNPJ, e os pontos que comparam o CNPJ emitente da chave de acesso com o do
-- depositante (sugestão no recebimento, chave informada pelo cliente, aviso
-- na edição) recusavam NFs do segundo CNPJ.
--
-- `depositor_cnpjs` guarda TODOS os CNPJs de cada depositante, inclusive o
-- principal (`depositors.cnpj`, que segue sendo o exibido nos relatórios e o
-- usado pelo Reenvio). A PK em `cnpj` garante que um CNPJ pertence a um só
-- depositante.
--
--   * backfill: o CNPJ atual de cada depositante entra como principal;
--   * insert/update do CNPJ em `depositors` mantém o principal na tabela
--     (no update, o CNPJ antigo continua como adicional);
--   * o principal não pode ser removido enquanto o depositante existir.
-- =====================================================================

create table if not exists depositor_cnpjs (
  cnpj         text primary key,
  depositor_id uuid not null references depositors(id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint depositor_cnpjs_format check (cnpj ~ '^[0-9]{14}$')
);

create index if not exists idx_depositor_cnpjs_depositor on depositor_cnpjs (depositor_id);

insert into depositor_cnpjs (cnpj, depositor_id)
select cnpj, id from depositors
on conflict (cnpj) do nothing;

-- ---------------------------------------------------------------------
-- O CNPJ principal sempre está em depositor_cnpjs.
-- security definer: não depende das policies de quem cadastra o depositante.
-- ---------------------------------------------------------------------
create or replace function sync_depositor_principal_cnpj()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select depositor_id into v_owner from depositor_cnpjs where cnpj = new.cnpj;
  if v_owner is null then
    insert into depositor_cnpjs (cnpj, depositor_id) values (new.cnpj, new.id);
  elsif v_owner <> new.id then
    raise exception 'O CNPJ % já está cadastrado em outro depositante', new.cnpj
      using errcode = '23505';
  end if;
  return null;
end;
$$;

drop trigger if exists depositors_sync_principal_cnpj on depositors;
create trigger depositors_sync_principal_cnpj
  after insert or update of cnpj on depositors
  for each row execute function sync_depositor_principal_cnpj();

-- ---------------------------------------------------------------------
-- O principal não sai de depositor_cnpjs enquanto o depositante existir.
-- No `on delete cascade` o depositante já foi apagado, então passa.
-- ---------------------------------------------------------------------
create or replace function protect_depositor_principal_cnpj()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from depositors d
    where d.id = old.depositor_id and d.cnpj = old.cnpj
  ) then
    raise exception 'O CNPJ principal do depositante não pode ser removido'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

drop trigger if exists depositor_cnpjs_protect_principal on depositor_cnpjs;
create trigger depositor_cnpjs_protect_principal
  before delete on depositor_cnpjs
  for each row execute function protect_depositor_principal_cnpj();

-- ---------------------------------------------------------------------
-- RLS — espelha `depositors` (000_schema.sql).
-- ---------------------------------------------------------------------
alter table depositor_cnpjs enable row level security;

drop policy if exists "staff see depositor cnpjs" on depositor_cnpjs;
create policy "staff see depositor cnpjs" on depositor_cnpjs
  for select using (is_operator() or is_manager());

drop policy if exists "clients see their depositor cnpjs" on depositor_cnpjs;
create policy "clients see their depositor cnpjs" on depositor_cnpjs
  for select using (
    is_client() and exists (
      select 1 from client_depositors cd
      where cd.client_id = auth.uid() and cd.depositor_id = depositor_cnpjs.depositor_id
    )
  );

drop policy if exists "managers manage depositor cnpjs" on depositor_cnpjs;
create policy "managers manage depositor cnpjs" on depositor_cnpjs
  for all using (is_manager()) with check (is_manager());
