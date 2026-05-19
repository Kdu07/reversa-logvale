'use server'

import { createClient } from '@/lib/supabase/server'
import { assertManager } from '@/lib/supabase/assert-role'
import { revalidatePath } from 'next/cache'

export interface DepositorRow {
  id:           string
  cnpj:         string
  razao_social: string
  active:       boolean
  clientNames:  string[]
}

export async function getDepositorsAction(filters?: {
  page?:   number
  search?: string
}): Promise<{ rows: DepositorRow[]; total: number } | { error: string }> {
  try {
    await assertManager()
    const supabase = createClient()

    const page   = Math.max(1, filters?.page ?? 1)
    const search = filters?.search?.trim() ?? ''
    const limit  = 50
    const offset = (page - 1) * limit

    let query = supabase
      .from('depositors')
      .select('id, cnpj, razao_social, active, client_depositors(profiles!client_id(full_name))', { count: 'exact' })
      .order('razao_social')
      .range(offset, offset + limit - 1)

    if (search) query = query.ilike('razao_social', `%${search}%`)

    const { data, count, error } = await query
    if (error) throw error

    const rows: DepositorRow[] = (data ?? []).map((d) => {
      const cds = d.client_depositors as unknown as { profiles: { full_name: string } | null }[]
      return {
        id:           d.id,
        cnpj:         d.cnpj,
        razao_social: d.razao_social,
        active:       d.active,
        clientNames:  cds.map((cd) => cd.profiles?.full_name ?? '').filter(Boolean),
      }
    })

    return { rows, total: count ?? 0 }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function createDepositorAction(payload: {
  cnpj:         string
  razao_social: string
}): Promise<{ ok: true; id: string; razao_social: string } | { error: string }> {
  try {
    await assertManager()
    const cnpj         = payload.cnpj.replace(/\D/g, '')
    const razao_social = payload.razao_social.trim()
    if (cnpj.length !== 14) return { error: 'CNPJ deve ter 14 dígitos' }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('depositors')
      .insert({ cnpj, razao_social })
      .select('id')
      .single()
    if (error) throw error

    revalidatePath('/admin/depositantes')
    return { ok: true, id: data.id, razao_social }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function updateDepositorAction(payload: {
  id:           string
  razao_social: string
}): Promise<{ ok: true } | { error: string }> {
  try {
    await assertManager()
    const supabase = createClient()
    const { error } = await supabase
      .from('depositors')
      .update({ razao_social: payload.razao_social.trim() })
      .eq('id', payload.id)
    if (error) throw error

    revalidatePath('/admin/depositantes')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
