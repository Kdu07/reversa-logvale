-- =====================================================================
-- Chave de acesso informada pelo cliente
--
-- Decisão de negócio: da NF de origem (a NF de venda do depositante) o
-- sistema guarda só a CHAVE DE ACESSO (44 dígitos) — o arquivo XML/DANFE
-- não é mais necessário. Devoluções identificadas sem chave (CEP, Código de
-- Logística Reversa ou Ilegível) entram sem ela, e o cliente a informa
-- depois em /cliente/notas-pendentes.
--
-- `identifier_type` continua dizendo COMO a caixa foi identificada no
-- recebimento; `access_key` passa a poder ser preenchida também nas
-- devoluções que não foram identificadas por ela (a chave informada depois).
-- Os demais identificadores seguem mutuamente exclusivos.
-- =====================================================================

alter table returns drop constraint if exists identifier_consistency;

alter table returns add constraint identifier_consistency check (
  (identifier_type = 'access_key' and access_key is not null
    and postal_code is null and illegible_token is null and logistics_code is null) or
  (identifier_type = 'postal_code' and postal_code is not null
    and illegible_token is null and logistics_code is null) or
  (identifier_type = 'logistics_code' and logistics_code is not null
    and postal_code is null and illegible_token is null) or
  (identifier_type = 'illegible' and illegible_token is not null
    and postal_code is null and logistics_code is null)
);

-- Procedência da chave informada pelo cliente (nulas = bipada no recebimento)
alter table returns add column if not exists access_key_informed_by uuid references profiles(id);
alter table returns add column if not exists access_key_informed_at timestamptz;

-- Chave (44 dígitos) da NF de DEVOLUÇÃO, lida do XML enviado pelo cliente na
-- decisão — para os relatórios não precisarem baixar o XML a cada emissão.
-- As decididas antes desta migration são preenchidas na primeira emissão de
-- relatório que as incluir (lib/return-invoice-key.ts).
alter table returns add column if not exists return_invoice_key text;

-- A fila agora é "sem chave de acesso" — o índice de 013 (sem arquivo de NF)
-- deixa de ser usado.
drop index if exists idx_returns_missing_invoice;

create index if not exists idx_returns_missing_access_key
  on returns (received_at)
  where access_key is null;
