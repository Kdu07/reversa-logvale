-- =====================================================================
-- 023 — Protege as colunas sensíveis do próprio perfil
--
-- Problema: a policy "users update own profile" (000_schema) só impede trocar o
-- `role`. Qualquer usuário logado podia, direto pela API (ex.: console do
-- navegador), alterar o resto da própria linha — em especial `active`, o que
-- permitia a um usuário DESATIVADO se reativar sozinho, e `terms_accepted_at`.
--
-- Correção: trigger BEFORE UPDATE que, quando quem altera NÃO é um gestor
-- ativo nem o service role, bloqueia mudanças em id / role / active /
-- created_at e só deixa `terms_accepted_at` sair de NULL para uma data (o
-- aceite do primeiro acesso). full_name e phone continuam editáveis.
--
-- Não muda nenhuma policy: o gestor segue gerenciando perfis via RLS e o
-- primeiro acesso (/primeiro-acesso) segue gravando o aceite dos termos.
-- Execute no SQL Editor do Supabase Dashboard (ou via supabase db push).
-- =====================================================================

create or replace function public.protect_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / SQL direto (sem usuário no JWT): sem restrição.
  if auth.uid() is null then
    return new;
  end if;

  -- Gestor ATIVO: sem restrição. (Um gestor desativado cai nas regras abaixo,
  -- então também não consegue se reativar.)
  if exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'manager' and p.active
  ) then
    return new;
  end if;

  if new.id         is distinct from old.id
  or new.role       is distinct from old.role
  or new.active     is distinct from old.active
  or new.created_at is distinct from old.created_at then
    raise exception 'Alteração não permitida no perfil'
      using errcode = '42501';
  end if;

  -- O aceite dos termos só pode ser registrado uma vez (NULL → data).
  if new.terms_accepted_at is distinct from old.terms_accepted_at
     and old.terms_accepted_at is not null then
    raise exception 'Alteração não permitida no perfil'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_self_update on public.profiles;
create trigger protect_profile_self_update
  before update on public.profiles
  for each row execute function public.protect_profile_self_update();
