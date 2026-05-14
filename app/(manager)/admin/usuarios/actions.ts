'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertManager } from '@/lib/supabase/assert-role'
import { sendAccountCreatedEmail } from '@/lib/integrations/resend'
import { env } from '@/lib/env'
import { revalidatePath } from 'next/cache'
import type { User } from '@supabase/auth-js'
import type { UserRole } from '@/types'

export interface UserRow {
  id:           string
  email:        string
  full_name:    string
  phone:        string | null
  role:         UserRole
  active:       boolean
  createdAt:    string
  depositorIds: string[]
}

export interface DepositorOption {
  id:           string
  razao_social: string
}

export async function getUsersAction(): Promise<UserRow[] | { error: string }> {
  try {
    await assertManager()
    const admin    = createAdminClient()
    const supabase = createClient()

    const allAuthUsers: User[] = []
    let page = 1
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 200, page })
      if (error) throw error
      allAuthUsers.push(...data.users)
      if (!data.nextPage) break
      page = data.nextPage
    }

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

    const rows: UserRow[] = allAuthUsers
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
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''

    const { data: createData, error: createErr } = await admin.auth.admin.createUser({
      email:         payload.email,
      email_confirm: true,
    })
    if (createErr) throw createErr
    const userId = createData.user.id

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type:    'magiclink',
      email:   payload.email,
      options: { redirectTo: `${appUrl}/auth/callback` },
    })
    if (linkErr) throw linkErr
    const magicLink = (linkData as { properties?: { action_link?: string } }).properties?.action_link

    if (magicLink && env.resendApiKey) {
      await sendAccountCreatedEmail({ to: payload.email, name: payload.full_name, magicLink })
        .catch((e) => console.error('[resend] createUser email failed:', e))
    }

    const { error: profileErr } = await supabase.from('profiles').insert({
      id:        userId,
      role:      payload.role,
      full_name: payload.full_name,
      phone:     payload.phone || null,
    })
    if (profileErr) throw profileErr

    if (payload.role === 'client' && payload.depositorIds.length > 0) {
      const rows = payload.depositorIds.map((did) => ({ client_id: userId, depositor_id: did }))
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
    const admin    = createAdminClient()
    const supabase = createClient()
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''

    const { data, error } = await admin.auth.admin.generateLink({
      type:    'magiclink',
      email,
      options: { redirectTo: `${appUrl}/auth/callback` },
    })
    if (error) throw error

    const link = (data as { properties?: { action_link?: string } }).properties?.action_link
    if (!link) throw new Error('Link não gerado')

    if (env.resendApiKey) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.user.id)
        .single()
      await sendAccountCreatedEmail({ to: email, name: profile?.full_name ?? '', magicLink: link })
        .catch((e) => console.error('[resend] resendMagicLink email failed:', e))
    }

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
