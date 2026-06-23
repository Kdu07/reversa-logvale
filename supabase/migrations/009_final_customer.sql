-- =====================================================================
-- Cliente final (destinatário da NF)
-- Coluna `final_customer_name` em returns — nome de quem recebeu/comprou o
-- produto, extraído do `<dest><xNome>` do XML da NF-e na bipagem (Etapa 1).
-- O emitente (`<emit>`) já corresponde ao depositante; o destinatário é o
-- cliente final. Devoluções sem chave de acesso (CEP/ilegível) ficam null.
-- Execute no SQL Editor do Supabase Dashboard (ou via supabase db push).
-- =====================================================================

alter table returns add column if not exists final_customer_name text;
