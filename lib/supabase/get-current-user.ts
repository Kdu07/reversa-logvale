import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AuthUser } from '@/types'

/**
 * Retorna o usuário autenticado com seu profile (role incluída).
 * Deve ser chamado apenas em Server Components e Server Actions.
 * Se não autenticado, redireciona para /login.
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  return {
    id:      user.id,
    email:   user.email!,
    profile: profile,
  }
}

/**
 * Versão que retorna null em vez de redirecionar.
 * Útil para páginas públicas que exibem conteúdo diferente se logado.
 */
export async function getCurrentUserOrNull(): Promise<AuthUser | null> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    id:      user.id,
    email:   user.email!,
    profile: profile,
  }
}
