-- =====================================================================
-- ACTIVATION TOKENS: link de ativação de uso único, válido até o uso
--
-- O link de ativação enviado por e-mail deixa de depender do OTP do Supabase
-- (que expira em 1h). Em vez disso, geramos um segredo aleatório próprio cujo
-- HASH (sha256) fica aqui; o segredo plaintext vai só na URL do e-mail.
--
-- Propriedades:
--   • Não expira por tempo — vale até o usuário ativar a conta.
--   • Uso único — `used_at` é marcado ao concluir a ativação; o reenvio apaga
--     os tokens anteriores do mesmo usuário (invalida o link antigo).
--   • O gate autoritativo de "já ativado" continua sendo profiles.terms_accepted_at;
--     a rota /ativar recusa o token quando a conta já está ativada.
--
-- Acesso somente via service role (admin client). RLS habilitado sem policies
-- bloqueia qualquer acesso anon/authenticated.
-- Execute no SQL Editor do Supabase Dashboard (ou via supabase db push).
-- =====================================================================

create table if not exists public.activation_tokens (
  token_hash text        primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at    timestamptz
);

create index if not exists activation_tokens_user_id_idx
  on public.activation_tokens (user_id);

alter table public.activation_tokens enable row level security;
-- Sem policies: nem anon nem authenticated acessam; apenas o service role
-- (que ignora RLS) opera nesta tabela através do admin client.
