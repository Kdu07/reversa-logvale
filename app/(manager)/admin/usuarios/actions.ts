'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/types'

export interface UserRow {
  id:          string
  email:       string
  full_name:   string
  phone:       string | null
  role:        UserRole
  active:      boolean
  createdAt:   string
  depositorIds: string[]
}

export interface DepositorOption {
  id:           string
  razao_social: string
}

async function assertManager() {
  const user = await getCurrentUser()
  if (user.profile.role !== 'manager') throw new Error('Acesso negado')
}

export async function getUsersAction(): Promise<UserRow[] | { error: string }> {
  try {
    await assertManager()
    const admin    = createAdminClient()
    const supabase = createClient()

    const { data: authUsers, error: authErr } = await admin.auth.admin.listUsers({ perPage: 200 })
    if (authErr) throw authErr

    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, active, created_at')
    if (profErr) throw profErr

    const { data: clientDeps, error: cdErr } = await supabase
      .from('client_depositors')
      .select('client_id, depositor_id')
    if (cdErr) throw cdErr

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
    const depMap = new Map<string, string[]>()
    for (const cd of clientDeps ?? []) {
      if (!depMap.has(cd.client_id)) depMap.set(cd.client_id, [])
      depMap.get(cd.client_id)!.push(cd.depositor_id)
    }

    const rows: UserRow[] = (authUsers.users ?? [])
      .map((u) => {
        const p = profileMap.get(u.id)
        if (!p) return null
        return {
          id:           u.id,
          email:        u.email ?? '',
          full_name:    p.full_name,
          phone:        p.phone,
          role:         p.role as UserRole,
          active:       p.active,
          createdAt:    p.created_at,
          depositorIds: depMap.get(u.id) ?? [],
        }
      })
      .filter((r): r is UserRow => r !== null)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))

    return rows
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function createUserAction(payload: {
  email:        string
  full_name:    string
  phone:        string
  role:         UserRole
  depositorIds: string[]
}): Promise<{ ok: true } | { error: string }> {
  try {
    await assertManager()
    const admin    = createAdminClient()
    const supabase = createClient()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      payload.email,
      { redirectTo: `${appUrl}/auth/callback` },
    )
    if (inviteErr) throw inviteErr
    const userId = inviteData.user.id

    const { error: profErr } = await supabase.from('profiles').insert({
      id:        userId,
      role:      payload.role,
      full_name: payload.full_name,
      phone:     payload.phone || null,
    })
    if (profErr) throw profErr

    if (payload.role === 'client' && payload.depositorIds.length > 0) {
      const rows = payload.depositorIds.map((did) => ({
        client_id:    userId,
        depositor_id: did,
      }))
      const { error: cdErr } = await supabase.from('client_depositors').insert(rows)
      if (cdErr) throw cdErr
    }

    revalidatePath('/admin/usuarios')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function updateUserAction(payload: {
  id:           string
  full_name:    string
  phone:        string
  role:         UserRole
  depositorIds: string[]
}): Promise<{ ok: true } | { error: string }> {
  try {
    await assertManager()
    const supabase = createClient()

    const { error: profErr } = await supabase
      .from('profiles')
      .update({ full_name: payload.full_name, phone: payload.phone || null, role: payload.role })
      .eq('id', payload.id)
    if (profErr) throw profErr

    const { error: delErr } = await supabase
      .from('client_depositors')
      .delete()
      .eq('client_id', payload.id)
    if (delErr) throw delErr

    if (payload.role === 'client' && payload.depositorIds.length > 0) {
      const rows = payload.depositorIds.map((did) => ({
        client_id:    payload.id,
        depositor_id: did,
      }))
      const { error: cdErr } = await supabase.from('client_depositors').insert(rows)
      if (cdErr) throw cdErr
    }

    revalidatePath('/admin/usuarios')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function toggleActiveAction(
  userId: string,
  active: boolean,
): Promise<{ ok: true } | { error: string }> {
  try {
    await assertManager()
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ active }).eq('id', userId)
    if (error) throw error
    revalidatePath('/admin/usuarios')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function resendMagicLinkAction(
  email: string,
): Promise<{ link: string } | { error: string }> {
  try {
    await assertManager()
    const admin  = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    const { data, error } = await admin.auth.admin.generateLink({
      type:    'magiclink',
      email,
      options: { redirectTo: `${appUrl}/auth/callback` },
    })
    if (error) throw error

    const link = (data as { properties?: { action_link?: string } }).properties?.action_link
    if (!link) throw new Error('Link não gerado')

    return { link }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function getDepositorsListAction(): Promise<DepositorOption[] | { error: string }> {
  try {
    await assertManager()
    const supabase = createClient()
    const { data, error } = await supabase
      .from('depositors')
      .select('id, razao_social')
      .eq('active', true)
      .order('razao_social')
    if (error) throw error
    return (data ?? []) as DepositorOption[]
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
