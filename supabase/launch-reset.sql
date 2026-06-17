-- =====================================================================
-- LOGVALE — Launch Reset
-- Remove TODOS os dados de desenvolvimento/seed, deixando o banco limpo
-- para o go-live. Depois, crie o usuário super com scripts/bootstrap-super.mjs.
--
-- COMO EXECUTAR (escolha um):
--   A) Supabase Dashboard → SQL Editor (projeto de PRODUÇÃO ahmzfvsxthutumwfmhqx)
--   B) psql "<connection string do projeto>" -f supabase/launch-reset.sql
--
-- ⚠️  IRREVERSÍVEL. Confirme que está no projeto de LANÇAMENTO antes de rodar.
--     O schema (tabelas, RLS, funções, pg_cron, auth hook) é preservado —
--     isto apaga apenas LINHAS, não estrutura.
-- =====================================================================

begin;

-- 1. Dados de negócio
--    returns → return_photos (cascade); depositors → client_depositors (cascade)
truncate table
  public.return_photos,
  public.returns,
  public.client_depositors,
  public.invoice_cache,
  public.depositors
restart identity cascade;

-- 2. Usuários — profiles é apagado em cascata ao remover de auth.users.
--    Nenhum usuário deve sobrar antes do launch; o super é criado depois.
delete from auth.users;

commit;

-- =====================================================================
-- Verificação (deve retornar 0 em todas as linhas)
-- =====================================================================
select 'profiles'          as tabela, count(*) from public.profiles
union all select 'depositors',         count(*) from public.depositors
union all select 'client_depositors',  count(*) from public.client_depositors
union all select 'invoice_cache',      count(*) from public.invoice_cache
union all select 'returns',            count(*) from public.returns
union all select 'return_photos',      count(*) from public.return_photos
union all select 'auth.users',         count(*) from auth.users;

-- Observação: as fotos do seed são caminhos placeholder (arquivos reais nunca
-- foram enviados ao Storage), então os buckets não precisam de limpeza.
