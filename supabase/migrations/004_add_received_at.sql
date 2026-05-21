-- Adiciona received_at à tabela returns, caso não exista.
-- Backfill: usa created_at como valor histórico para rows existentes.
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS received_at timestamptz;

UPDATE public.returns
  SET received_at = created_at
  WHERE received_at IS NULL;

ALTER TABLE public.returns
  ALTER COLUMN received_at SET NOT NULL,
  ALTER COLUMN received_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_returns_received_at
  ON public.returns(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_returns_pending_warning
  ON public.returns(received_at)
  WHERE status = 'awaiting_decision' AND warning_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_returns_pending_auto
  ON public.returns(received_at)
  WHERE status = 'awaiting_decision';
