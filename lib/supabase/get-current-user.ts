import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AuthUser } from '@/types'

const fetchCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) return null
  return { id: user.id, email: user.email!, profile }
})

export async function getCurrentUser(): Promise<AuthUser> {
  const user = await fetchCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function getCurrentUserOrNull(): Promise<AuthUser | null> {
  return fetchCurrentUser()
}
