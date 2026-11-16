-- =====================================================================
-- 022 — Edição de devoluções (operador / gerente) + histórico
--
-- O operador pode corrigir uma devolução enquanto ela aguarda a decisão do
-- cliente; o gerente, em qualquer status. Campos editáveis: RV, identificação
-- (tipo + chave de acesso / CEP / código de logística), depositante,
-- quantidade + estado dos itens e nome do cliente final. Fotos não.
--
-- 1. `return_edits` — histórico completo: quem, quando e o antes/depois de
--    cada campo (`changes` = [{ field, label, from, to }], com os valores já
--    legíveis — nome do depositante, "Avaria (2 de 5)" etc.).
--
-- 2. `returns.decision_deadline_from` — base do prazo de 72h. Ao trocar o
--    depositante de uma devolução aguardando decisão, quem edita escolhe se o
--    prazo do novo cliente continua contando do recebimento (fica null) ou
--    reinicia na edição (= now(), e o aviso de 48h volta a poder ser enviado).
--    null = conta de `received_at`, como sempre foi.
-- =====================================================================

alter table returns add column if not exists decision_deadline_from timestamptz;

comment on column returns.decision_deadline_from is
  'Base do prazo de decisão de 72h (null = received_at). Reiniciado ao trocar o depositante, se quem editou escolheu.';

create table if not exists return_edits (
  id                 uuid primary key default gen_random_uuid(),
  return_id          uuid not null references returns(id) on delete cascade,
  edited_by          uuid not null references profiles(id),
  edited_at          timestamptz not null default now(),
  changes            jsonb not null,
  deadline_restarted boolean not null default false
);

create index if not exists idx_return_edits_return on return_edits (return_id, edited_at desc);

alter table return_edits enable row level security;

create policy "staff see return edits" on return_edits
  for select using (is_operator() or is_manager());

create policy "staff log return edits" on return_edits
  for insert with check ((is_operator() or is_manager()) and edited_by = auth.uid());

-- Auto-decisão e aviso de 48h passam a contar da base do prazo.
create or replace function job_auto_decision()
returns void as $$
begin
  update returns r
  set
    status = 'decided',
    decision = 'store_for_handling',
    decided_at = now(),
    decided_by_type = 'auto'
  where
    r.status = 'awaiting_decision'
    and coalesce(r.decision_deadline_from, r.received_at) < now() - interval '72 hours'
    and not exists (
      select 1 from depositors d
      where d.id = r.depositor_id and d.no_decision_deadline
    );
end;
$$ language plpgsql security definer;

create or replace view returns_needing_warning as
  select
    r.id, r.received_at, r.depositor_id, r.rv, r.access_key, r.postal_code,
    cd.client_id
  from returns r
  join client_depositors cd on cd.depositor_id = r.depositor_id
  join depositors d on d.id = r.depositor_id
  where r.status = 'awaiting_decision'
    and r.warning_sent_at is null
    and coalesce(r.decision_deadline_from, r.received_at) < now() - interval '48 hours'
    and coalesce(r.decision_deadline_from, r.received_at) >= now() - interval '72 hours'
    and not d.no_decision_deadline;
