-- =====================================================================
-- FIX: Top Clientes por Volume agora agrupa por depositante (empresa)
-- em vez de pelo perfil da pessoa que decidiu.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_d1  timestamptz,
  p_d7  timestamptz,
  p_d30 timestamptz,
  p_d48 timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  counts      jsonb;
  top_clients jsonb;
  urgent      jsonb;
BEGIN
  -- Apenas managers podem chamar esta função
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Todos os counts e médias em uma única varredura da tabela
  SELECT jsonb_build_object(
    'today',             COUNT(*) FILTER (WHERE received_at >= p_d1),
    'last7d',            COUNT(*) FILTER (WHERE received_at >= p_d7),
    'last30d',           COUNT(*) FILTER (WHERE received_at >= p_d30),
    'cnt_awaiting',      COUNT(*) FILTER (WHERE status = 'awaiting_decision'),
    'cnt_decided',       COUNT(*) FILTER (WHERE status = 'decided'),
    'cnt_processed',     COUNT(*) FILTER (WHERE status = 'processed'),
    'cnt_rts',           COUNT(*) FILTER (WHERE decision = 'return_to_stock'),
    'cnt_sfh',           COUNT(*) FILTER (WHERE decision = 'store_for_handling'),
    'cnt_disc',          COUNT(*) FILTER (WHERE decision = 'discard'),
    'cnt_repk',          COUNT(*) FILTER (WHERE decision = 'repackage'),
    'avg_decision_hours', ROUND(
      AVG(EXTRACT(EPOCH FROM (decided_at - received_at)) / 3600.0)
      FILTER (WHERE decided_at IS NOT NULL)::numeric, 1
    ),
    'avg_process_hours', ROUND(
      AVG(EXTRACT(EPOCH FROM (processed_at - decided_at)) / 3600.0)
      FILTER (WHERE decided_at IS NOT NULL AND processed_at IS NOT NULL)::numeric, 1
    ),
    'decided_total',     COUNT(*) FILTER (WHERE decided_at IS NOT NULL),
    'decided_auto',      COUNT(*) FILTER (WHERE decided_at IS NOT NULL AND decided_by_type = 'auto')
  )
  INTO counts
  FROM public.returns;

  -- Top 10 depositantes (empresas) por volume total de devoluções
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO top_clients
  FROM (
    SELECT jsonb_build_object(
      'name',  COALESCE(d.razao_social, 'Desconhecido'),
      'count', COUNT(*)
    ) AS row
    FROM public.returns r
    LEFT JOIN public.depositors d ON r.depositor_id = d.id
    GROUP BY d.id, d.razao_social
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) sub;

  -- Devoluções urgentes (>48h aguardando decisão)
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO urgent
  FROM (
    SELECT jsonb_build_object(
      'id',            r.id,
      'rv',            r.rv,
      'receivedAt',    r.received_at,
      'depositorName', d.razao_social
    ) AS row
    FROM public.returns r
    LEFT JOIN public.depositors d ON r.depositor_id = d.id
    WHERE r.status = 'awaiting_decision'
      AND r.received_at < p_d48
    ORDER BY r.received_at
    LIMIT 20
  ) sub;

  RETURN jsonb_build_object(
    'counts',        counts,
    'topClients',    top_clients,
    'urgentPending', urgent
  );
END;
$$;
