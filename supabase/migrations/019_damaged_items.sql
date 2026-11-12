-- =====================================================================
-- Estado dos produtos no recebimento (Bom / Avaria)
--
-- Na Etapa 3 do recebimento ("Itens") o operador informa, além da
-- quantidade, se os produtos chegaram bons ou avariados e, havendo avaria,
-- quantos itens estão avariados. Uma coluna só — o estado é derivado dela,
-- então nunca fica incoerente com `item_count`:
--
--   null → não avaliado (devoluções recebidas antes desta etapa existir)
--   0    → Bom
--   > 0  → Avaria (n de item_count)
--
-- Só informa: não altera as opções de decisão do cliente nem a
-- auto-decisão de 72h.
-- =====================================================================

alter table returns add column if not exists damaged_item_count integer;

alter table returns drop constraint if exists damaged_item_count_range;
alter table returns add constraint damaged_item_count_range check (
  damaged_item_count is null or damaged_item_count between 0 and item_count
);
