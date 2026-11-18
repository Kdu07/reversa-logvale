-- =====================================================================
-- 025 — Dashboard do admin (/admin)
--
-- Uma chamada devolve tudo o que a página mostra (formato lido por
-- `lib/admin-dashboard/rpc.ts` → `AdminDashboardData`):
--
--   attention  → foto de AGORA (não depende do período nem do depositante):
--                aguardando decisão por prazo, decididas sem tratativa,
--                sem chave de acesso, avisos de 48h e "vencidas e a vencer".
--   volume / quality / depositors → devoluções RECEBIDAS no período
--                [p_from, p_to) — mesmo critério do relatório mensal
--                (`received_at` é o único critério de data), para o número
--                bater com a lista aberta pelo clique.
--   team       → atividade no período pela data em que aconteceu
--                (received_at, processed_at, edited_at).
--
-- Prazo de decisão = coalesce(decision_deadline_from, received_at) + 72h,
-- como em job_auto_decision (022). Depositantes com no_decision_deadline
-- (020) nunca entram em vencidas/a vencer: ficam em `noDeadline`.
--
-- Só cria a função nova; não altera tabelas nem a get_dashboard_stats antiga.
-- =====================================================================

create or replace function public.get_admin_dashboard(
  p_from             timestamptz,
  p_to               timestamptz,
  p_prev_from        timestamptz,
  p_prev_to          timestamptz,
  p_depositor        uuid default null,
  p_urgent_depositor uuid default null,
  p_bucket           text default 'day'   -- 'hour' | 'day' | 'week'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_now      timestamptz := now();
  v_tz       constant text := 'America/Sao_Paulo';
  v_step     interval;
  v_first    timestamp;
  v_last     timestamp;
  v_awaiting jsonb;
  v_urgent   jsonb;
  v_urg_deps jsonb;
  v_backlog  jsonb;
  v_back_by  jsonb;
  v_nokey    jsonb;
  v_warn     bigint;
  v_kpis     jsonb;
  v_series   jsonb;
  v_by_dec   jsonb;
  v_cond     jsonb;
  v_ident    jsonb;
  v_deps     jsonb;
  v_team     jsonb;
  v_options  jsonb;
begin
  -- Só gerente ativo
  if not exists (
    select 1 from profiles where id = auth.uid() and role = 'manager' and active
  ) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if p_bucket not in ('hour', 'day', 'week') then
    raise exception 'Agrupamento inválido: %', p_bucket using errcode = '22023';
  end if;
  if p_to <= p_from or p_to - p_from > interval '367 days'
     or p_prev_to <= p_prev_from or p_prev_to - p_prev_from > interval '367 days' then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  -- ------------------------------------------------------------------
  -- 1. Precisa de ação agora (foto atual)
  -- ------------------------------------------------------------------
  select jsonb_build_object(
    'total',      count(*),
    'overdue',    count(*) filter (where not p.no_deadline and p.deadline_at <  v_now),
    'dueSoon',    count(*) filter (where not p.no_deadline and p.deadline_at >= v_now
                                                         and p.deadline_at <  v_now + interval '24 hours'),
    'onTime',     count(*) filter (where not p.no_deadline and p.deadline_at >= v_now + interval '24 hours'),
    'noDeadline', count(*) filter (where p.no_deadline)
  )
  into v_awaiting
  from (
    select coalesce(d.no_decision_deadline, false) as no_deadline,
           coalesce(r.decision_deadline_from, r.received_at) + interval '72 hours' as deadline_at
    from returns r
    left join depositors d on d.id = r.depositor_id
    where r.status = 'awaiting_decision'
  ) p;

  -- Vencidas e a vencer (< 24h): até 20, mais urgentes primeiro
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',            u.id,
           'rv',            u.rv,
           'depositorId',   u.depositor_id,
           'depositorName', u.razao_social,
           'hoursLeft',     round((extract(epoch from u.deadline_at - v_now) / 3600.0)::numeric, 1)
         ) order by u.deadline_at), '[]'::jsonb)
  into v_urgent
  from (
    select r.id, r.rv, r.depositor_id, d.razao_social,
           coalesce(r.decision_deadline_from, r.received_at) + interval '72 hours' as deadline_at
    from returns r
    left join depositors d on d.id = r.depositor_id
    where r.status = 'awaiting_decision'
      and not coalesce(d.no_decision_deadline, false)
      and coalesce(r.decision_deadline_from, r.received_at) < v_now - interval '48 hours'
      and (p_urgent_depositor is null or r.depositor_id = p_urgent_depositor)
    order by deadline_at
    limit 20
  ) u;

  -- Opções do filtro do quadro (sem limite e sem o filtro aplicado)
  select coalesce(jsonb_agg(jsonb_build_object('id', g.depositor_id, 'name', g.razao_social, 'count', g.n)
                            order by g.n desc, g.razao_social), '[]'::jsonb)
  into v_urg_deps
  from (
    select r.depositor_id, d.razao_social, count(*) as n
    from returns r
    join depositors d on d.id = r.depositor_id
    where r.status = 'awaiting_decision'
      and not d.no_decision_deadline
      and coalesce(r.decision_deadline_from, r.received_at) < v_now - interval '48 hours'
    group by r.depositor_id, d.razao_social
  ) g;

  -- Decididas que ainda não viraram tratativa concluída
  select jsonb_build_object(
    'total',       count(*),
    'oldestHours', round((extract(epoch from v_now - min(decided_at)) / 3600.0)::numeric, 1)
  )
  into v_backlog
  from returns
  where status = 'decided';

  select coalesce(jsonb_agg(jsonb_build_object('decision', b.decision, 'count', b.n) order by b.n desc), '[]'::jsonb)
  into v_back_by
  from (
    select decision, count(*) as n from returns where status = 'decided' group by decision
  ) b;

  -- Sem chave de acesso (mesma divisão de /cliente/notas-pendentes)
  select jsonb_build_object(
    'awaiting', count(*) filter (where status =  'awaiting_decision'),
    'decided',  count(*) filter (where status <> 'awaiting_decision')
  )
  into v_nokey
  from returns
  where access_key is null;

  select count(*) into v_warn
  from returns
  where warning_sent_at >= v_now - interval '24 hours';

  -- ------------------------------------------------------------------
  -- 2. Volume e tempos — recebidas no período e no período anterior
  -- ------------------------------------------------------------------
  select jsonb_object_agg(k.which, k.obj)
  into v_kpis
  from (
    select c.which, jsonb_build_object(
      'received',        count(*),
      'decidedByClient', count(*) filter (where c.decided_by_type = 'client'),
      'decidedAuto',     count(*) filter (where c.decided_by_type = 'auto'),
      'processed',       count(*) filter (where c.status = 'processed'),
      'medianDecisionHours', round((percentile_cont(0.5) within group (
          order by extract(epoch from c.decided_at - c.received_at) / 3600.0
        ) filter (where c.decided_by_type = 'client'))::numeric, 1),
      'medianProcessHours',  round((percentile_cont(0.5) within group (
          order by extract(epoch from c.processed_at - c.decided_at) / 3600.0
        ) filter (where c.processed_at is not null and c.decided_at is not null))::numeric, 1)
    ) as obj
    from (
      select 'current' as which, r.status, r.decided_by_type, r.received_at, r.decided_at, r.processed_at
      from returns r
      where r.received_at >= p_from and r.received_at < p_to
        and (p_depositor is null or r.depositor_id = p_depositor)
      union all
      select 'previous', r.status, r.decided_by_type, r.received_at, r.decided_at, r.processed_at
      from returns r
      where r.received_at >= p_prev_from and r.received_at < p_prev_to
        and (p_depositor is null or r.depositor_id = p_depositor)
    ) c
    group by c.which
  ) k;

  -- Série: por hora / dia / semana (semanas contadas a partir de p_from),
  -- em hora de São Paulo, só até agora.
  v_step  := case p_bucket when 'hour' then interval '1 hour'
                           when 'day'  then interval '1 day'
                           else             interval '7 days' end;
  v_first := case when p_bucket = 'hour' then date_trunc('hour', p_from at time zone v_tz)
                  else date_trunc('day', p_from at time zone v_tz) end;
  v_last  := (least(p_to, v_now) at time zone v_tz) - interval '1 microsecond';

  select coalesce(jsonb_agg(jsonb_build_object(
           'start',    to_char(s.b_start, 'YYYY-MM-DD"T"HH24:MI'),
           'received', (
             select count(*)
             from returns r
             where r.received_at >= (s.b_start at time zone v_tz)
               and r.received_at <  (least(s.b_start + v_step, p_to at time zone v_tz) at time zone v_tz)
               and (p_depositor is null or r.depositor_id = p_depositor)
           )
         ) order by s.b_start), '[]'::jsonb)
  into v_series
  from generate_series(v_first, v_last, v_step) as s(b_start);

  -- Decisões das recebidas no período
  select coalesce(jsonb_agg(jsonb_build_object('decision', x.decision, 'count', x.n) order by x.n desc), '[]'::jsonb)
  into v_by_dec
  from (
    select r.decision, count(*) as n
    from returns r
    where r.received_at >= p_from and r.received_at < p_to
      and (p_depositor is null or r.depositor_id = p_depositor)
      and r.decision is not null
    group by r.decision
  ) x;

  -- ------------------------------------------------------------------
  -- 3. Qualidade no recebimento
  --    Bom: item_count > 0, damaged = 0, sem "não corresponde"
  --    Avaria: damaged > 0 · Caixa vazia: item_count = 0
  --    Não corresponde: mismatched_item_count não nulo
  --    Não avaliado: recebida antes da 019 (damaged_item_count nulo)
  -- ------------------------------------------------------------------
  select jsonb_build_object(
    'good',       jsonb_build_object(
                    'returns', count(*) filter (where r.item_count > 0 and r.damaged_item_count = 0 and r.mismatched_item_count is null),
                    'items',   coalesce(sum(r.item_count) filter (where r.item_count > 0 and r.damaged_item_count = 0 and r.mismatched_item_count is null), 0)),
    'damaged',    jsonb_build_object(
                    'returns', count(*) filter (where r.damaged_item_count > 0),
                    'items',   coalesce(sum(r.damaged_item_count) filter (where r.damaged_item_count > 0), 0)),
    'empty',      jsonb_build_object(
                    'returns', count(*) filter (where r.item_count = 0),
                    'items',   0),
    'mismatched', jsonb_build_object(
                    'returns', count(*) filter (where r.mismatched_item_count is not null),
                    'items',   coalesce(sum(r.mismatched_item_count), 0)),
    'notEvaluated', count(*) filter (where r.item_count > 0 and r.damaged_item_count is null and r.mismatched_item_count is null),
    'totalItems',   coalesce(sum(r.item_count), 0)
  )
  into v_cond
  from returns r
  where r.received_at >= p_from and r.received_at < p_to
    and (p_depositor is null or r.depositor_id = p_depositor);

  select coalesce(jsonb_agg(jsonb_build_object('type', i.identifier_type, 'count', i.n) order by i.n desc), '[]'::jsonb)
  into v_ident
  from (
    select r.identifier_type, count(*) as n
    from returns r
    where r.received_at >= p_from and r.received_at < p_to
      and (p_depositor is null or r.depositor_id = p_depositor)
    group by r.identifier_type
  ) i;

  -- ------------------------------------------------------------------
  -- 4. Por depositante (recebidas no período) + aguardando agora
  -- ------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',                  g.id,
           'name',                g.razao_social,
           'noDeadline',          g.no_decision_deadline,
           'received',            g.received,
           'awaiting',            g.awaiting,
           'autoRate',            case when g.decided > 0 then round(g.auto * 100.0 / g.decided, 1) end,
           'medianDecisionHours', round(g.med::numeric, 1),
           'damagedRate',         case when g.evaluated > 0 then round(g.damaged * 100.0 / g.evaluated, 1) end
         ) order by g.received desc, g.razao_social), '[]'::jsonb)
  into v_deps
  from (
    select d.id, d.razao_social, d.no_decision_deadline,
           count(r.id) as received,
           (select count(*) from returns a
             where a.depositor_id = d.id and a.status = 'awaiting_decision') as awaiting,
           count(r.id) filter (where r.decided_by_type = 'auto')     as auto,
           count(r.id) filter (where r.decided_by_type is not null)  as decided,
           percentile_cont(0.5) within group (
             order by extract(epoch from r.decided_at - r.received_at) / 3600.0
           ) filter (where r.decided_by_type = 'client')             as med,
           count(r.id) filter (where r.damaged_item_count > 0)       as damaged,
           count(r.id) filter (where r.item_count > 0 and r.damaged_item_count is not null) as evaluated
    from depositors d
    join returns r on r.depositor_id = d.id
                  and r.received_at >= p_from and r.received_at < p_to
    where p_depositor is null or d.id = p_depositor
    group by d.id, d.razao_social, d.no_decision_deadline
  ) g;

  -- Equipe: atividade no período, cada uma pela própria data
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'name', t.full_name,
           'received', t.received, 'processed', t.processed, 'edits', t.edits
         ) order by t.received desc, t.processed desc, t.full_name), '[]'::jsonb)
  into v_team
  from (
    select pr.id, pr.full_name,
           sum(a.rec)  as received,
           sum(a.proc) as processed,
           sum(a.ed)   as edits
    from (
      select r.received_by as uid, 1 as rec, 0 as proc, 0 as ed
      from returns r
      where r.received_at >= p_from and r.received_at < p_to
        and (p_depositor is null or r.depositor_id = p_depositor)
      union all
      select r.processed_by, 0, 1, 0
      from returns r
      where r.processed_at >= p_from and r.processed_at < p_to
        and r.processed_by is not null
        and (p_depositor is null or r.depositor_id = p_depositor)
      union all
      select e.edited_by, 0, 0, 1
      from return_edits e
      join returns r on r.id = e.return_id
      where e.edited_at >= p_from and e.edited_at < p_to
        and (p_depositor is null or r.depositor_id = p_depositor)
    ) a
    join profiles pr on pr.id = a.uid
    group by pr.id, pr.full_name
  ) t;

  -- Depositantes para o filtro do período
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.razao_social) order by d.razao_social), '[]'::jsonb)
  into v_options
  from depositors d
  where d.active or d.id = p_depositor;

  return jsonb_build_object(
    'generatedAt', v_now,
    'attention', jsonb_build_object(
      'awaiting',         v_awaiting,
      'decidedBacklog',   v_backlog || jsonb_build_object('byDecision', v_back_by),
      'withoutKey',       v_nokey,
      'warnings24h',      v_warn,
      'urgent',           v_urgent,
      'urgentDepositors', v_urg_deps
    ),
    'volume', jsonb_build_object(
      'current',    coalesce(v_kpis -> 'current',  '{}'::jsonb),
      'previous',   coalesce(v_kpis -> 'previous', '{}'::jsonb),
      'series',     v_series,
      'byDecision', v_by_dec
    ),
    'quality', jsonb_build_object(
      'conditions',     v_cond,
      'identification', v_ident
    ),
    'depositors',       v_deps,
    'team',             v_team,
    'depositorOptions', v_options
  );
end;
$$;

revoke all on function public.get_admin_dashboard(timestamptz, timestamptz, timestamptz, timestamptz, uuid, uuid, text) from public, anon;
grant execute on function public.get_admin_dashboard(timestamptz, timestamptz, timestamptz, timestamptz, uuid, uuid, text) to authenticated;

comment on function public.get_admin_dashboard(timestamptz, timestamptz, timestamptz, timestamptz, uuid, uuid, text) is
  'Dashboard do admin (/admin): foto atual + recebidas no período [p_from, p_to). Só gerente ativo.';
