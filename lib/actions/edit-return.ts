'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import {
  diffReturnEdit,
  normalizeReturnEdit,
  type ReturnEditChange,
  type ReturnEditCurrent,
  type ReturnEditInput,
} from '@/lib/return-edit'
import type { AuthUser, ReturnStatus } from '@/types'

/**
 * Edição de devolução — compartilhada entre operador (Minhas Devoluções) e
 * gerente (/admin/devolucoes). Operador só edita enquanto aguarda decisão;
 * gerente edita em qualquer status. Cada edição grava o antes/depois em
 * `return_edits` (migration 022).
 */

const EDITABLE_COLUMNS =
  'rv, identifier_type, access_key, postal_code, logistics_code, illegible_token, ' +
  'item_count, damaged_item_count, mismatched_item_count, mismatch_description, depositor_id, final_customer_name'

export interface EditDepositorOption {
  id:                 string
  name:               string
  cnpj:               string
  noDecisionDeadline: boolean
}

export interface EditReturnData {
  id:                 string
  status:             ReturnStatus
  receivedAt:         string
  /** Base atual do prazo de 72h (decision_deadline_from ?? received_at). */
  deadlineFrom:       string
  rv:                 string
  identifierType:     ReturnEditCurrent['identifier_type']
  accessKey:          string | null
  postalCode:         string | null
  logisticsCode:      string | null
  illegibleToken:     string | null
  itemCount:          number
  damagedItemCount:   number | null
  mismatchedItemCount: number | null
  mismatchDescription: string | null
  depositorId:        string | null
  finalCustomerName:  string | null
  depositors:         EditDepositorOption[]
}

export interface ReturnEditEntry {
  id:                string
  editedAt:          string
  editorName:        string | null
  changes:           ReturnEditChange[]
  deadlineRestarted: boolean
}

type Guard = { user: AuthUser; isManager: boolean } | { error: string }

async function guard(): Promise<Guard> {
  const user = await getCurrentUser()
  const role = user.profile.role
  if (role !== 'operator' && role !== 'manager') return { error: 'Acesso negado' }
  return { user, isManager: role === 'manager' }
}

function canEdit(isManager: boolean, status: ReturnStatus): boolean {
  return isManager || status === 'awaiting_decision'
}

const OPERATOR_STATUS_ERROR =
  'Esta devolução já foi decidida pelo cliente — só o gerente pode editá-la.'

export async function getEditReturnDataAction(
  returnId: string,
): Promise<{ data: EditReturnData } | { error: string }> {
  try {
    const g = await guard()
    if ('error' in g) return g

    const supabase = createClient()
    const [{ data: r, error }, { data: deps, error: depErr }] = await Promise.all([
      supabase
        .from('returns')
        .select(`id, status, received_at, decision_deadline_from, ${EDITABLE_COLUMNS}`)
        .eq('id', returnId)
        .single(),
      supabase
        .from('depositors')
        .select('id, razao_social, cnpj, active, no_decision_deadline')
        .order('razao_social'),
    ])
    if (error || !r) return { error: error?.message ?? 'Devolução não encontrada.' }
    if (depErr) return { error: depErr.message }

    const row = r as unknown as ReturnEditCurrent & {
      id: string; status: ReturnStatus; received_at: string; decision_deadline_from: string | null
    }
    if (!canEdit(g.isManager, row.status)) return { error: OPERATOR_STATUS_ERROR }

    // Ativos + o depositante atual (mesmo se inativo, para não sumir do select).
    const depositors = ((deps ?? []) as {
      id: string; razao_social: string; cnpj: string; active: boolean; no_decision_deadline: boolean | null
    }[])
      .filter((d) => d.active || d.id === row.depositor_id)
      .map((d) => ({
        id:                 d.id,
        name:               d.razao_social,
        cnpj:               d.cnpj,
        noDecisionDeadline: d.no_decision_deadline === true,
      }))

    return {
      data: {
        id:                row.id,
        status:            row.status,
        receivedAt:        row.received_at,
        deadlineFrom:      row.decision_deadline_from ?? row.received_at,
        rv:                row.rv,
        identifierType:    row.identifier_type,
        accessKey:         row.access_key,
        postalCode:        row.postal_code,
        logisticsCode:     row.logistics_code,
        illegibleToken:    row.illegible_token,
        itemCount:         row.item_count,
        damagedItemCount:  row.damaged_item_count,
        mismatchedItemCount: row.mismatched_item_count ?? null,
        mismatchDescription: row.mismatch_description ?? null,
        depositorId:       row.depositor_id,
        finalCustomerName: row.final_customer_name,
        depositors,
      },
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function updateReturnAction(
  returnId: string,
  input:    ReturnEditInput,
): Promise<{ ok: true } | { error: string }> {
  try {
    const g = await guard()
    if ('error' in g) return g

    const supabase = createClient()
    const { data: r, error: fetchErr } = await supabase
      .from('returns')
      .select(`id, status, ${EDITABLE_COLUMNS}`)
      .eq('id', returnId)
      .single()
    if (fetchErr || !r) return { error: fetchErr?.message ?? 'Devolução não encontrada.' }

    const current = r as unknown as ReturnEditCurrent & { status: ReturnStatus }
    if (!canEdit(g.isManager, current.status)) return { error: OPERATOR_STATUS_ERROR }

    const normalized = normalizeReturnEdit(input, current)
    if ('error' in normalized) return normalized
    const { patch } = normalized

    // Depositantes envolvidos: nomes para o histórico + validação do novo.
    const depIds = Array.from(
      new Set([current.depositor_id, patch.depositor_id].filter(Boolean) as string[]),
    )
    const depositorNames: Record<string, string> = {}
    let newDepositorHasDeadline = false
    if (depIds.length) {
      const { data: deps, error: depErr } = await supabase
        .from('depositors')
        .select('id, razao_social, active, no_decision_deadline')
        .in('id', depIds)
      if (depErr) return { error: depErr.message }
      for (const d of (deps ?? []) as {
        id: string; razao_social: string; active: boolean; no_decision_deadline: boolean | null
      }[]) {
        depositorNames[d.id] = d.razao_social
        if (d.id === patch.depositor_id) newDepositorHasDeadline = d.no_decision_deadline !== true
      }
      if (patch.depositor_id && !depositorNames[patch.depositor_id]) {
        return { error: 'Depositante não encontrado.' }
      }
    }

    const changes = diffReturnEdit(current, patch, depositorNames)
    if (changes.length === 0) return { error: 'Nenhuma alteração para salvar.' }

    // Troca de depositante aguardando decisão: quem edita decide se o prazo
    // de 72h do novo cliente reinicia agora ou segue contando do recebimento.
    const depositorChanged = (current.depositor_id ?? null) !== (patch.depositor_id ?? null)
    const asksDeadline =
      depositorChanged && current.status === 'awaiting_decision' && !!patch.depositor_id && newDepositorHasDeadline
    if (asksDeadline && input.restartDeadline === null) {
      return { error: 'Escolha se o prazo de 72h do cliente reinicia ou continua do recebimento.' }
    }
    const restartDeadline = asksDeadline && input.restartDeadline === true

    const update: Record<string, unknown> = { ...patch }
    // Chave trocada/removida pela equipe deixa de ser "informada pelo cliente".
    if (patch.access_key !== current.access_key) {
      update.access_key_informed_by = null
      update.access_key_informed_at = null
    }
    if (restartDeadline) {
      update.decision_deadline_from = new Date().toISOString()
      update.warning_sent_at        = null
    }

    const { error: updErr } = await supabase.from('returns').update(update).eq('id', returnId)
    if (updErr) {
      if (updErr.code === '23505') return { error: `Já existe outra devolução com o RV "${patch.rv}".` }
      return { error: updErr.message }
    }

    const { error: logErr } = await supabase.from('return_edits').insert({
      return_id:          returnId,
      edited_by:          g.user.id,
      changes,
      deadline_restarted: restartDeadline,
    })
    if (logErr) console.error('[updateReturnAction] histórico não gravado:', logErr.message)

    // Afeta as listas de operador, gerente e cliente.
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function getReturnEditsAction(
  returnId: string,
): Promise<{ entries: ReturnEditEntry[] } | { error: string }> {
  try {
    const g = await guard()
    if ('error' in g) return g

    const supabase = createClient()
    const { data, error } = await supabase
      .from('return_edits')
      .select('id, edited_at, edited_by, changes, deadline_restarted')
      .eq('return_id', returnId)
      .order('edited_at', { ascending: false })
    if (error) return { error: error.message }

    const rows = (data ?? []) as {
      id: string; edited_at: string; edited_by: string; changes: ReturnEditChange[]; deadline_restarted: boolean
    }[]

    // Operador não lê o profile dos outros (RLS) — nomes via service role.
    const editorIds = Array.from(new Set(rows.map((r) => r.edited_by)))
    const names = new Map<string, string>()
    if (editorIds.length) {
      const { data: profiles } = await createAdminClient()
        .from('profiles')
        .select('id, full_name')
        .in('id', editorIds)
      for (const p of (profiles ?? []) as { id: string; full_name: string }[]) names.set(p.id, p.full_name)
    }

    return {
      entries: rows.map((r) => ({
        id:                r.id,
        editedAt:          r.edited_at,
        editorName:        names.get(r.edited_by) ?? null,
        changes:           Array.isArray(r.changes) ? r.changes : [],
        deadlineRestarted: r.deadline_restarted,
      })),
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
