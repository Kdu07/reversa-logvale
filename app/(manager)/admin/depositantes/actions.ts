'use server'

import { createClient } from '@/lib/supabase/server'
import { assertManager } from '@/lib/supabase/assert-role'
import { revalidatePath } from 'next/cache'
import { extraDepositorCnpjs, formatCnpj, normalizeCnpj, type DepositorCnpjSource } from '@/lib/depositor-cnpjs'

export interface DepositorRow {
  id:           string
  /** CNPJ principal. */
  cnpj:         string
  /** CNPJs adicionais (migration 026), sem o principal. */
  extraCnpjs:   string[]
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
      .select(
        'id, cnpj, razao_social, active, depositor_cnpjs(cnpj), client_depositors(profiles!client_id(full_name))',
        { count: 'exact' },
      )
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
        extraCnpjs:   extraDepositorCnpjs(d as unknown as DepositorCnpjSource),
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

type ServerClient = ReturnType<typeof createClient>

const DUPLICATE_CNPJ = 'Este CNPJ já está cadastrado em outro depositante ativo.'

interface CnpjOwner {
  depositorId: string
  name:        string
  active:      boolean
}

/**
 * Depositantes que têm o CNPJ (principal ou adicional — `depositor_cnpjs`,
 * migration 026), ativos ou não, para o erro dizer onde o CNPJ já está. Só
 * um ATIVO bloqueia o uso do CNPJ em outro depositante (027).
 */
async function findCnpjOwners(supabase: ServerClient, cnpj: string): Promise<CnpjOwner[]> {
  const { data, error } = await supabase
    .from('depositor_cnpjs')
    .select('depositor_id, active, depositors!inner(razao_social)')
    .eq('cnpj', cnpj)
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as {
    depositor_id: string; active: boolean; depositors: { razao_social: string } | null
  }[]).map((r) => ({
    depositorId: r.depositor_id,
    name:        r.depositors?.razao_social ?? 'outro depositante',
    active:      r.active,
  }))
}

export async function createDepositorAction(payload: {
  cnpj:         string
  razao_social: string
}): Promise<{ ok: true; id: string; razao_social: string } | { error: string }> {
  try {
    await assertManager()
    const cnpj         = normalizeCnpj(payload.cnpj)
    const razao_social = payload.razao_social.trim()
    if (cnpj.length !== 14) return { error: 'CNPJ deve ter 14 dígitos' }

    const supabase = createClient()
    const owner = (await findCnpjOwners(supabase, cnpj)).find((o) => o.active)
    if (owner) return { error: `Este CNPJ já está cadastrado em ${owner.name}.` }

    const { data, error } = await supabase
      .from('depositors')
      .insert({ cnpj, razao_social })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') return { error: DUPLICATE_CNPJ }
      throw new Error(error.message)
    }

    revalidatePath('/admin/depositantes')
    return { ok: true, id: data.id, razao_social }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

/**
 * CNPJ adicional do depositante — NFs emitidas por ele passam a ser
 * reconhecidas como deste depositante (recebimento, chave informada pelo
 * cliente, edição). Um CNPJ pertence a um só depositante ativo; o de um
 * desativado pode ser reaproveitado (027).
 */
export async function addDepositorCnpjAction(payload: {
  depositorId: string
  cnpj:        string
}): Promise<{ ok: true; cnpj: string } | { error: string }> {
  try {
    await assertManager()
    const cnpj = normalizeCnpj(payload.cnpj ?? '')
    if (!payload.depositorId) return { error: 'Depositante não informado.' }
    if (cnpj.length !== 14) return { error: 'CNPJ deve ter 14 dígitos' }

    const supabase = createClient()
    const owners = await findCnpjOwners(supabase, cnpj)
    if (owners.some((o) => o.depositorId === payload.depositorId)) {
      return { error: 'Este CNPJ já está cadastrado neste depositante.' }
    }
    const other = owners.find((o) => o.active)
    if (other) return { error: `Este CNPJ já está cadastrado em ${other.name}.` }

    const { error } = await supabase
      .from('depositor_cnpjs')
      .insert({ cnpj, depositor_id: payload.depositorId })
    if (error) {
      if (error.code === '23505') return { error: DUPLICATE_CNPJ }
      throw new Error(error.message)
    }

    revalidatePath('/admin/depositantes')
    return { ok: true, cnpj }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

/** Remove um CNPJ adicional. O principal (`depositors.cnpj`) não sai. */
export async function removeDepositorCnpjAction(payload: {
  depositorId: string
  cnpj:        string
}): Promise<{ ok: true } | { error: string }> {
  try {
    await assertManager()
    const cnpj = normalizeCnpj(payload.cnpj ?? '')
    if (!payload.depositorId || cnpj.length !== 14) return { error: 'CNPJ inválido.' }

    const supabase = createClient()
    const { data: dep, error: depError } = await supabase
      .from('depositors')
      .select('cnpj')
      .eq('id', payload.depositorId)
      .maybeSingle()
    if (depError) throw new Error(depError.message)
    if (!dep) return { error: 'Depositante não encontrado.' }
    if (normalizeCnpj(dep.cnpj) === cnpj) return { error: 'O CNPJ principal não pode ser removido.' }

    const { error } = await supabase
      .from('depositor_cnpjs')
      .delete()
      .eq('depositor_id', payload.depositorId)
      .eq('cnpj', cnpj)
    if (error) throw new Error(error.message)

    revalidatePath('/admin/depositantes')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export interface DepositorUsage {
  /** Devoluções com este depositante (qualquer status). */
  returns:  number
  /** Dessas, quantas aguardam decisão. */
  awaiting: number
  /** Clientes vinculados. */
  clients:  number
}

/** O que a remoção vai afetar — mostrado na confirmação. */
export async function getDepositorUsageAction(
  id: string,
): Promise<{ data: DepositorUsage } | { error: string }> {
  try {
    await assertManager()
    if (!id) return { error: 'Depositante não informado.' }

    const supabase = createClient()
    const [returns, awaiting, clients] = await Promise.all([
      supabase.from('returns').select('id', { count: 'exact', head: true }).eq('depositor_id', id),
      supabase
        .from('returns')
        .select('id', { count: 'exact', head: true })
        .eq('depositor_id', id)
        .eq('status', 'awaiting_decision'),
      supabase.from('client_depositors').select('client_id', { count: 'exact', head: true }).eq('depositor_id', id),
    ])
    for (const r of [returns, awaiting, clients]) {
      if (r.error) throw new Error(r.error.message)
    }

    return {
      data: { returns: returns.count ?? 0, awaiting: awaiting.count ?? 0, clients: clients.count ?? 0 },
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

async function deactivateDepositor(supabase: ServerClient, id: string): Promise<void> {
  const { error } = await supabase.from('depositors').update({ active: false }).eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Remove um depositante. `returns.depositor_id` não tem `on delete`, então
 * um depositante com devoluções não pode ser apagado sem perder o histórico:
 *
 *   - sem devoluções → exclui de vez (vínculos com clientes e CNPJs vão junto,
 *     por cascade);
 *   - com devoluções → desativa (`active = false`): some do recebimento, da
 *     sugestão pela NF e das listas de seleção; o histórico fica, os CNPJs
 *     ficam livres para outro depositante (027) e dá para reativar.
 *
 * Se uma devolução entrar entre a contagem e o delete (FK 23503), desativa.
 */
export async function removeDepositorAction(
  id: string,
): Promise<{ ok: true; mode: 'deleted' | 'deactivated' } | { error: string }> {
  try {
    await assertManager()
    if (!id) return { error: 'Depositante não informado.' }

    const supabase = createClient()
    const { count, error: countError } = await supabase
      .from('returns')
      .select('id', { count: 'exact', head: true })
      .eq('depositor_id', id)
    if (countError) throw new Error(countError.message)

    let mode: 'deleted' | 'deactivated' = 'deleted'
    if ((count ?? 0) > 0) {
      await deactivateDepositor(supabase, id)
      mode = 'deactivated'
    } else {
      const { data: deleted, error } = await supabase
        .from('depositors')
        .delete()
        .eq('id', id)
        .select('id')
      if (error) {
        if (error.code !== '23503') throw new Error(error.message)
        await deactivateDepositor(supabase, id)
        mode = 'deactivated'
      } else if (!deleted || deleted.length === 0) {
        return { error: 'Depositante não encontrado.' }
      }
    }

    revalidatePath('/admin/depositantes')
    return { ok: true, mode }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

/**
 * Reativa um depositante desativado. Enquanto ele esteve inativo, um CNPJ
 * dele pode ter ido para outro depositante ativo (027) — aí a reativação é
 * recusada, dizendo qual CNPJ e quem o usa.
 */
export async function reactivateDepositorAction(id: string): Promise<{ ok: true } | { error: string }> {
  try {
    await assertManager()
    if (!id) return { error: 'Depositante não informado.' }

    const supabase = createClient()
    const [{ data: dep, error: depError }, { data: own, error: ownError }] = await Promise.all([
      supabase.from('depositors').select('cnpj').eq('id', id).maybeSingle(),
      supabase.from('depositor_cnpjs').select('cnpj').eq('depositor_id', id),
    ])
    if (depError) throw new Error(depError.message)
    if (ownError) throw new Error(ownError.message)
    if (!dep) return { error: 'Depositante não encontrado.' }

    const cnpjs = Array.from(new Set([dep.cnpj, ...(own ?? []).map((r) => r.cnpj)]))
    const { data: clash, error: clashError } = await supabase
      .from('depositor_cnpjs')
      .select('cnpj, depositors!inner(razao_social)')
      .in('cnpj', cnpjs)
      .eq('active', true)
      .neq('depositor_id', id)
    if (clashError) throw new Error(clashError.message)

    const first = (clash ?? [])[0] as unknown as { cnpj: string; depositors: { razao_social: string } | null } | undefined
    if (first) {
      const who = first.depositors?.razao_social ?? 'outro depositante'
      return {
        error: first.cnpj === dep.cnpj
          ? `Não dá para reativar: o CNPJ principal ${formatCnpj(first.cnpj)} está em uso por ${who}.`
          : `Não dá para reativar: o CNPJ ${formatCnpj(first.cnpj)} está em uso por ${who}. ` +
            'Remova esse CNPJ adicional deste depositante (Editar) e tente de novo.',
      }
    }

    const { error } = await supabase.from('depositors').update({ active: true }).eq('id', id)
    if (error) {
      if (error.code === '23505') {
        return { error: 'Não dá para reativar: um CNPJ deste depositante está em uso por outro depositante ativo.' }
      }
      throw new Error(error.message)
    }

    revalidatePath('/admin/depositantes')
    return { ok: true }
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
