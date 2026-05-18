-- =====================================================================
-- AUTH HOOK: Custom Access Token
-- Injeta role, active e terms_accepted_at no JWT para evitar DB hits
-- no middleware a cada requisição.
--
-- Após executar esta migration, registre o hook no Supabase Dashboard:
--   Authentication > Hooks > Custom Access Token Hook
--   Function: public.custom_access_token_hook
-- =====================================================================

-- Permissão para o auth admin ler a tabela profiles
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.profiles TO supabase_auth_admin;

-- Função chamada pelo Supabase ao gerar/renovar o JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims           jsonb;
  user_role        text;
  user_active      boolean;
  user_terms       text;
BEGIN
  SELECT
    role,
    active,
    terms_accepted_at::text
  INTO user_role, user_active, user_terms
  FROM public.profiles
  WHERE id = (event->>'user_id')::uuid;

  -- Só injeta se o profile existir (novo usuário pode não ter ainda)
  IF user_role IS NOT NULL THEN
    claims := event->'claims';
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb) || jsonb_build_object(
        'role',             user_role,
        'active',           COALESCE(user_active, false),
        'terms_accepted_at', user_terms
      )
    );
    event := jsonb_set(event, '{claims}', claims);
  END IF;

  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
