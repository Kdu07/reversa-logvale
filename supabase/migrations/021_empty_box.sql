-- =====================================================================
-- Caixa vazia no recebimento
--
-- Algumas devoluções chegam com a caixa vazia, sem nenhum item dentro. Na
-- Etapa 3 ("Itens") o operador passa a ter, ao lado de Bom e Avaria, a
-- opção "Caixa vazia". Sem coluna nova: caixa vazia é simplesmente
-- `item_count = 0` (com `damaged_item_count = 0`), então o estado continua
-- derivado das colunas existentes e nunca fica incoerente:
--
--   item_count = 0          → Caixa vazia
--   damaged_item_count = 0  → Bom          (item_count > 0)
--   damaged_item_count > 0  → Avaria (n de item_count)
--   damaged_item_count null → não avaliado (antes da migration 019)
--
-- Só informa, como Bom/Avaria: não altera as decisões do cliente nem a
-- auto-decisão de 72h. Caixa vazia dispensa as fotos de itens (a etapa 5
-- é pulada no app); a foto da caixa continua obrigatória.
-- =====================================================================

-- O check inline de 000_schema (`item_count > 0`) ganhou nome automático
-- (normalmente `returns_item_count_check`); procura pelo conteúdo para não
-- depender do nome.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.returns'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~ 'item_count > 0'
      and pg_get_constraintdef(oid) !~ 'damaged_item_count'
  loop
    execute format('alter table public.returns drop constraint %I', c.conname);
  end loop;
end $$;

alter table returns drop constraint if exists item_count_non_negative;
alter table returns add constraint item_count_non_negative check (item_count >= 0);

-- Caixa vazia sempre registra o estado (não existe caixa vazia "não avaliada").
alter table returns drop constraint if exists empty_box_condition;
alter table returns add constraint empty_box_condition check (
  item_count > 0 or damaged_item_count = 0
);
