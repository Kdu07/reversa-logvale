/**
 * Edição de devolução (operador / gerente) — regras puras, sem Supabase.
 *
 * `normalizeReturnEdit` valida o formulário contra o estado atual e devolve as
 * colunas a gravar; `diffReturnEdit` monta o histórico legível (antes/depois)
 * que vai para `return_edits.changes`.
 */
import { isValidAccessKey, normalizeAccessKey } from '@/lib/access-key'
import { identifierLabel, itemConditionLabel } from '@/lib/format'
import type { IdentifierType } from '@/types'

/** Campos editáveis, como chegam do formulário. */
export interface ReturnEditInput {
  rv:                string
  identifierType:    IdentifierType
  accessKey:         string | null
  postalCode:        string | null
  logisticsCode:     string | null
  itemCount:         number
  /** null só é aceito se a devolução já estava "não avaliada" (antes da 019). */
  damagedItemCount:  number | null
  depositorId:       string | null
  finalCustomerName: string | null
  /** Escolha de quem edita ao trocar o depositante de uma devolução aguardando
   *  decisão: true = reinicia o prazo de 72h agora, false = mantém. */
  restartDeadline:   boolean | null
}

/** Estado atual das colunas editáveis (snake_case, como vem do banco). */
export interface ReturnEditCurrent {
  rv:                  string
  identifier_type:     IdentifierType
  access_key:          string | null
  postal_code:         string | null
  logistics_code:      string | null
  illegible_token:     string | null
  item_count:          number
  damaged_item_count:  number | null
  depositor_id:        string | null
  final_customer_name: string | null
}

/** Colunas gravadas pela edição — as mesmas do estado atual. */
export type ReturnEditPatch = ReturnEditCurrent

export interface ReturnEditChange {
  field: 'rv' | 'identifier' | 'depositor' | 'items' | 'final_customer'
  label: string
  from:  string
  to:    string
}

function emptyToNull(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t ? t : null
}

/** Token de "Ilegível" no mesmo formato do recebimento (Etapa 1). */
export function newIllegibleToken(now = Date.now()): string {
  return `ILEG-${now.toString(36).toUpperCase()}`
}

export function normalizeReturnEdit(
  input:   ReturnEditInput,
  current: ReturnEditCurrent,
): { patch: ReturnEditPatch } | { error: string } {
  const rv = input.rv.trim()
  if (!rv) return { error: 'Informe o RV.' }

  // Chave de acesso: obrigatória quando é o tipo de identificação; nos demais
  // tipos é opcional (a "chave informada depois"). DV só é exigido se mudou —
  // chaves antigas gravadas sem a checagem continuam salváveis.
  const accessKey = input.accessKey ? normalizeAccessKey(input.accessKey) || null : null
  if (input.identifierType === 'access_key' && !accessKey) {
    return { error: 'Informe a chave de acesso (44 dígitos).' }
  }
  if (accessKey && accessKey !== current.access_key && !isValidAccessKey(accessKey)) {
    return { error: 'Chave de acesso inválida: confira os 44 dígitos (dígito verificador não confere).' }
  }

  // Os demais identificadores são mutuamente exclusivos (constraint
  // identifier_consistency): só o do tipo escolhido fica preenchido.
  let postalCode:     string | null = null
  let logisticsCode:  string | null = null
  let illegibleToken: string | null = null

  if (input.identifierType === 'postal_code') {
    postalCode = (input.postalCode ?? '').replace(/\D/g, '')
    if (postalCode.length !== 8) return { error: 'CEP inválido: deve ter 8 dígitos.' }
  } else if (input.identifierType === 'logistics_code') {
    logisticsCode = emptyToNull(input.logisticsCode)
    if (!logisticsCode) return { error: 'Informe o Código de Logística Reversa.' }
  } else if (input.identifierType === 'illegible') {
    illegibleToken = current.illegible_token ?? newIllegibleToken()
  }

  // Quantidade + estado (Etapa 3): 0 itens = Caixa vazia (estado 0).
  const itemCount = input.itemCount
  if (!Number.isInteger(itemCount) || itemCount < 0) {
    return { error: 'Quantidade de itens inválida.' }
  }
  let damaged = input.damagedItemCount
  if (itemCount === 0) {
    damaged = 0
  } else if (damaged === null) {
    if (current.damaged_item_count !== null) {
      return { error: 'Informe o estado dos produtos (Bom ou Avaria).' }
    }
  } else if (!Number.isInteger(damaged) || damaged < 0 || damaged > itemCount) {
    return { error: 'Quantidade de itens avariados inválida.' }
  }

  return {
    patch: {
      rv,
      identifier_type:     input.identifierType,
      access_key:          accessKey,
      postal_code:         postalCode,
      logistics_code:      logisticsCode,
      illegible_token:     illegibleToken,
      item_count:          itemCount,
      damaged_item_count:  damaged,
      depositor_id:        input.depositorId || null,
      final_customer_name: emptyToNull(input.finalCustomerName),
    },
  }
}

function identifierText(r: ReturnEditCurrent): string {
  return identifierLabel({
    identifierType: r.identifier_type,
    accessKey:      r.access_key,
    postalCode:     r.postal_code,
    logisticsCode:  r.logistics_code,
    illegibleToken: r.illegible_token,
  })
}

function itemsText(r: ReturnEditCurrent): string {
  const n         = r.item_count
  const condition = itemConditionLabel(n, r.damaged_item_count)
  if (n === 0) return 'Caixa vazia'
  const qty = `${n} ${n === 1 ? 'item' : 'itens'}`
  return condition ? `${qty} · ${condition}` : `${qty} · não avaliado`
}

/**
 * Antes/depois legível dos campos que mudaram. `depositorNames` resolve os ids
 * (antigo e novo) para a razão social.
 */
export function diffReturnEdit(
  before:         ReturnEditCurrent,
  after:          ReturnEditCurrent,
  depositorNames: Record<string, string>,
): ReturnEditChange[] {
  const changes: ReturnEditChange[] = []
  const dep = (id: string | null) => (id ? depositorNames[id] ?? id : '—')

  if (before.rv !== after.rv) {
    changes.push({ field: 'rv', label: 'RV', from: before.rv, to: after.rv })
  }
  const idFrom = identifierText(before)
  const idTo   = identifierText(after)
  if (idFrom !== idTo) {
    changes.push({ field: 'identifier', label: 'Identificação', from: idFrom, to: idTo })
  }
  if ((before.depositor_id ?? null) !== (after.depositor_id ?? null)) {
    changes.push({ field: 'depositor', label: 'Depositante', from: dep(before.depositor_id), to: dep(after.depositor_id) })
  }
  const itemsFrom = itemsText(before)
  const itemsTo   = itemsText(after)
  if (itemsFrom !== itemsTo) {
    changes.push({ field: 'items', label: 'Itens / estado', from: itemsFrom, to: itemsTo })
  }
  if ((before.final_customer_name ?? null) !== (after.final_customer_name ?? null)) {
    changes.push({
      field: 'final_customer',
      label: 'Cliente final',
      from:  before.final_customer_name ?? '—',
      to:    after.final_customer_name  ?? '—',
    })
  }
  return changes
}
