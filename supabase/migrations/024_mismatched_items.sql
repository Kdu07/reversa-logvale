-- =====================================================================
-- Produto não corresponde no recebimento
--
-- Às vezes o produto que vem na caixa não é o da NF. Na Etapa 3 ("Itens")
-- o operador ganha uma 4ª opção de estado, exclusiva como as outras:
-- "Produto não corresponde", com quantos itens não correspondem (1..N) e
-- uma descrição obrigatória do que veio na caixa.
--
--   mismatched_item_count null → não é "não corresponde" (Bom/Avaria/Caixa
--                                vazia seguem como em 019/021)
--   mismatched_item_count n    → Produto não corresponde (n de item_count);
--                                damaged_item_count fica 0
--
-- Só informa, como Bom/Avaria/Caixa vazia: não altera as decisões do
-- cliente nem a auto-decisão de 72h.
-- =====================================================================

alter table returns add column if not exists mismatched_item_count integer;
alter table returns add column if not exists mismatch_description text;

alter table returns drop constraint if exists mismatch_consistency;
alter table returns add constraint mismatch_consistency check (
  (mismatched_item_count is null and mismatch_description is null)
  or (
    mismatched_item_count between 1 and item_count
    and damaged_item_count = 0
    and char_length(btrim(mismatch_description)) between 1 and 500
  )
);
