-- 020 — Depositantes sem prazo de decisão (hoje: só a Blackskull).
--
-- Para depositantes com `no_decision_deadline = true` a regra das 72h não se
-- aplica: a auto-decisão (job_auto_decision) e o e-mail de aviso de 48h
-- (view returns_needing_warning → Edge Function warning-email) os ignoram, e a
-- tabela do cliente não mostra contagem regressiva. A devolução fica em
-- "Aguardando decisão" até o cliente decidir.
--
-- Também devolve para "Aguardando decisão" as devoluções desses depositantes que
-- a auto-decisão já tinha decidido e que ainda NÃO foram processadas pelo
-- operador (status = 'decided'). As já processadas ficam como estão.
--
-- Conferir antes de aplicar (produção):
--   select r.rv, r.status, r.decided_at, r.received_at
--   from returns r join depositors d on d.id = r.depositor_id
--   where d.cnpj = '19897687000219' and r.decided_by_type = 'auto'
--   order by r.received_at;

alter table depositors
  add column if not exists no_decision_deadline boolean not null default false;

comment on column depositors.no_decision_deadline is
  'Sem prazo de decisão: ignora a auto-decisão de 72h e o aviso de 48h.';

-- Blackskull (BLACK SKULL-GDS).
update depositors set no_decision_deadline = true
where regexp_replace(cnpj, '\D', '', 'g') = '19897687000219';

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
    and r.received_at < now() - interval '72 hours'
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
    and r.received_at < now() - interval '48 hours'
    and r.received_at >= now() - interval '72 hours'
    and not d.no_decision_deadline;

-- Desfaz as auto-decisões ainda não processadas desses depositantes
-- (mesmos campos que o "Reverter" do admin limpa).
update returns r
set
  status                 = 'awaiting_decision',
  decision               = null,
  decided_at             = null,
  decided_by             = null,
  decided_by_type        = null,
  return_invoice_xml_url = null,
  reship_label_url       = null,
  reship_danfe_url       = null
from depositors d
where d.id = r.depositor_id
  and d.no_decision_deadline
  and r.status = 'decided'
  and r.decided_by_type = 'auto';
