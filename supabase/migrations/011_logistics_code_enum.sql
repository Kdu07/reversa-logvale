-- =====================================================================
-- Etapa 1 do recebimento: terceira via de identificação, o "Código de
-- Logística Reversa" (código próprio do cliente, consultado manualmente
-- com ele — sem lookup automático como a chave de acesso).
-- ADD VALUE de enum precisa estar em transação própria (não pode ser
-- usado como literal antes de commitado) — por isso fica separado da
-- migration que adiciona a coluna/constraint (012).
-- =====================================================================

alter type identifier_type add value if not exists 'logistics_code';
