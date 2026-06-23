-- =====================================================================
-- Normaliza URLs de NF gravadas como string vazia ('') para NULL.
--
-- Bug: quando a consulta NFEio falhava na bipagem, `lookupInvoice` retornava
-- string vazia em vez de `null`, e o recebimento gravava `invoice_xml_url = ''`.
-- Como `''` não é `NULL`, o contador e o backfill super-only (que filtram por
-- `IS NULL`) ignoravam esses registros — daí "0 NF(s) sem XML" enquanto a NF não
-- aparecia para download. A origem foi corrigida em lib/integrations/nfeio.ts
-- (passa a gravar NULL); esta migração limpa o legado para devolver visibilidade
-- ao painel /admin/devolucoes.
--
-- Execute no SQL Editor do Supabase Dashboard (ou via supabase db push).
-- =====================================================================

update returns set invoice_xml_url        = null where invoice_xml_url        = '';
update returns set invoice_pdf_url        = null where invoice_pdf_url        = '';
update returns set return_invoice_xml_url = null where return_invoice_xml_url = '';
