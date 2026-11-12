'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isSuperUser } from '@/lib/auth/super'
import { buildSignedUrlMap } from '@/lib/supabase/storage'
import { normalizeAccessKey, isValidAccessKey, accessKeyEmitterCnpj } from '@/lib/access-key'
import type {
  IdentifierType, ReturnStatus, ReturnDecision, DecisionSource,
} from '@/types'

export interface PendingKeyRow {
  id:                string
  rv:                string
  identifierType:    IdentifierType
  postalCode:        string | null
  logisticsCode:     string | null
  illegibleToken:    string | null
  itemCount:         number
  receivedAt:        string
  depositorName:     string | null
  finalCustomerName: string | null
  status:            ReturnStatus
  decision:          ReturnDecision | null
  decidedAt:         string | null
  decidedByType:     DecisionSource | null
  boxPhotoUrls:      string[]
  itemPhotoUrls:     string[]
}

export interface PendingKeysData {
  /** Ainda em `awaiting_decision` — o cliente vai decidir e precisa da chave. */
  awaiting:          PendingKeyRow[]
  /** Já decididas (pelo cliente ou pela auto-decisão de 72h) e ainda sem chave. */
  decided:           PendingKeyRow[]
  awaitingTruncated: boolean
  decidedTruncated:  boolean
}

type PendingResult = PendingKeysData | { error: string }

/** Teto por grupo — a fila é naturalmente curta, mas nada no schema garante isso. */
const MAX_ROWS = 100

export type InformAccessKeyResult = { ok: true; accessKey: string } | { error: string }

const SELECT_COLUMNS = `id, rv, identifier_type, postal_code, logistics_code, illegible_token,
   item_count, received_at, final_customer_name,
   status, decision, decided_at, decided_by_type,
   depositors!depositor_id(razao_social),
   return_photos(storage_path, photo_type, position)`

type RawPhoto = { storage_path: string; photo_type: string; position: number }

function photoUrls(photos: RawPhoto[], type: 'box' | 'item', map: Map<string, string>): string[] {
  return photos
    .filter((p) => p.photo_type === type)
    .sort((a, b) => a.position - b.position)
    .map((p) => map.get(p.storage_path) ?? '')
    .filter(Boolean)
}

/**
 * Devoluções do cliente ainda sem a chave de acesso da NF de origem.
 *
 * São as identificadas no recebimento por CEP, Código de Logística Reversa ou
 * Ilegível. Separadas em "aguardando decisão" e "decididas": a auto-decisão de
 * 72h não informa a chave, e sem o grupo das decididas a pendência mais antiga
 * seria justamente a que sumiria da tela.
 *
 * Cada grupo vem do mais antigo para o mais recente: pendência velha é a mais urgente.
 */
export async function getPendingKeysAction(): Promise<PendingResult> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'client' && !isSuperUser(user)) return { error: 'Acesso negado' }

    const supabase = createClient()

    const [awaitingRes, decidedRes] = await Promise.all([
      supabase
        .from('returns')
        .select(SELECT_COLUMNS)
        .is('access_key', null)
        .eq('status', 'awaiting_decision')
        .order('received_at', { ascending: true })
        .limit(MAX_ROWS),
      supabase
        .from('returns')
        .select(SELECT_COLUMNS)
        .is('access_key', null)
        .neq('status', 'awaiting_decision')
        .order('received_at', { ascending: true })
        .limit(MAX_ROWS),
    ])

    if (awaitingRes.error) return { error: awaitingRes.error.message }
    if (decidedRes.error)  return { error: decidedRes.error.message }

    const awaitingRaw = awaitingRes.data ?? []
    const decidedRaw  = decidedRes.data ?? []

    const boxPaths:  string[] = []
    const itemPaths: string[] = []
    for (const r of [...awaitingRaw, ...decidedRaw]) {
      for (const p of ((r.return_photos as RawPhoto[]) ?? [])) {
        if (p.photo_type === 'box')  boxPaths.push(p.storage_path)
        if (p.photo_type === 'item') itemPaths.push(p.storage_path)
      }
    }

    const [boxMap, itemMap] = await Promise.all([
      buildSignedUrlMap(supabase, 'box-photos',  boxPaths),
      buildSignedUrlMap(supabase, 'item-photos', itemPaths),
    ])

    const toRow = (r: (typeof awaitingRaw)[number]): PendingKeyRow => {
      const photos = (r.return_photos as RawPhoto[]) ?? []
      const dep    = r.depositors as unknown as { razao_social: string } | null
      return {
        id:                r.id,
        rv:                r.rv,
        identifierType:    r.identifier_type as IdentifierType,
        postalCode:        r.postal_code,
        logisticsCode:     r.logistics_code,
        illegibleToken:    r.illegible_token,
        itemCount:         r.item_count,
        receivedAt:        r.received_at,
        depositorName:     dep?.razao_social ?? null,
        finalCustomerName: r.final_customer_name ?? null,
        status:            r.status as ReturnStatus,
        decision:          r.decision as ReturnDecision | null,
        decidedAt:         r.decided_at,
        decidedByType:     r.decided_by_type as DecisionSource | null,
        boxPhotoUrls:      photoUrls(photos, 'box',  boxMap),
        itemPhotoUrls:     photoUrls(photos, 'item', itemMap),
      }
    }

    return {
      awaiting:          awaitingRaw.map(toRow),
      decided:           decidedRaw.map(toRow),
      awaitingTruncated: awaitingRaw.length === MAX_ROWS,
      decidedTruncated:  decidedRaw.length === MAX_ROWS,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

/**
 * Grava a chave de acesso da NF de origem informada pelo cliente.
 *
 * Roda com o admin client de propósito: a policy `clients decide their returns`
 * só autoriza UPDATE em `awaiting_decision`, e a chave também precisa poder ser
 * informada nas já decididas (inclusive pela auto-decisão de 72h). O vínculo
 * cliente ↔ depositante é verificado explicitamente abaixo, no lugar da RLS.
 *
 * A NF de origem é sempre a NF de venda do depositante, então o CNPJ do
 * emitente codificado na chave precisa ser o do depositante da devolução.
 */
export async function informAccessKeyAction(
  returnId: string,
  rawKey:   string,
): Promise<InformAccessKeyResult> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'client' && !isSuperUser(user)) return { error: 'Acesso negado' }

    if (!returnId) return { error: 'Devolução não informada.' }

    const accessKey = normalizeAccessKey(rawKey ?? '')
    if (accessKey.length !== 44) {
      return { error: `A chave de acesso tem 44 dígitos (você informou ${accessKey.length}).` }
    }
    if (!isValidAccessKey(accessKey)) {
      return { error: 'Chave de acesso inválida — confira os dígitos (o dígito verificador não confere).' }
    }

    const admin = createAdminClient()

    const { data: ret, error: retError } = await admin
      .from('returns')
      .select('id, depositor_id, access_key, depositors!depositor_id(cnpj)')
      .eq('id', returnId)
      .maybeSingle()

    if (retError) return { error: retError.message }
    if (!ret)     return { error: 'Devolução não encontrada.' }

    // Autorização — o super vê tudo; o cliente, só os depositantes vinculados a ele.
    if (!isSuperUser(user)) {
      if (!ret.depositor_id) return { error: 'Acesso negado' }
      const { data: link } = await admin
        .from('client_depositors')
        .select('client_id')
        .eq('client_id', user.id)
        .eq('depositor_id', ret.depositor_id)
        .maybeSingle()
      if (!link) return { error: 'Acesso negado' }
    }

    // Nunca sobrescrever a chave — nem a bipada no recebimento, nem uma já informada.
    if (ret.access_key) return { error: 'Esta devolução já tem a chave de acesso.' }

    const depositorCnpj = (ret.depositors as unknown as { cnpj: string } | null)?.cnpj ?? null
    if (depositorCnpj && accessKeyEmitterCnpj(accessKey) !== depositorCnpj) {
      return { error: 'Esta chave é de uma NF emitida por outro CNPJ, não pelo depositante desta devolução.' }
    }

    const { data: updated, error: updateError } = await admin
      .from('returns')
      .update({
        access_key:             accessKey,
        access_key_informed_by: user.id,
        access_key_informed_at: new Date().toISOString(),
      })
      .eq('id', returnId)
      .is('access_key', null) // corrida: outro usuário pode ter informado no meio-tempo
      .select('id')

    if (updateError) return { error: updateError.message }
    if (!updated || updated.length === 0) return { error: 'Esta devolução já tem a chave de acesso.' }

    revalidatePath('/cliente')
    revalidatePath('/cliente/historico')
    revalidatePath('/cliente/notas-pendentes')

    return { ok: true, accessKey }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
