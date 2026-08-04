-- =====================================================================
-- Anexo manual da NF pelo cliente
--
-- Devoluções identificadas sem chave de acesso (Código de Logística
-- Reversa, CEP ou Ilegível) entram sem NF: o lookup da NFEio depende da
-- chave. O cliente regulariza depois, anexando o XML ou o DANFE em
-- /cliente/notas-pendentes. Os arquivos reusam `invoice_xml_url` /
-- `invoice_pdf_url` (assim todos os botões de download existentes passam
-- a funcionar sem alteração) e estas colunas registram a procedência:
-- preenchidas = enviado pelo cliente, nulas = veio da NFEio.
-- =====================================================================

alter table returns add column if not exists invoice_uploaded_by uuid references profiles(id);
alter table returns add column if not exists invoice_uploaded_at timestamptz;

-- Fila de pendências: sem chave de acesso e sem nenhum documento fiscal.
create index if not exists idx_returns_missing_invoice
  on returns (received_at)
  where invoice_xml_url is null
    and invoice_pdf_url is null
    and identifier_type <> 'access_key'::identifier_type;
