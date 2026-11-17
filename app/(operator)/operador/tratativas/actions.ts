'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isSuperUser } from '@/lib/auth/super'
import { buildSignedUrlMap } from '@/lib/supabase/storage'
import type { ReturnDecision, IdentifierType } from '@/types'

export interface TrativaRow {
  id:             string
  rv:             string
  identifierType: IdentifierType
  accessKey:      string | null
  postalCode:     string | null
  logisticsCode:  string | null
  illegibleToken: string | null
  itemCount:      number
  /** Estado no recebimento: null = não avaliado, 0 = Bom, >0 = itens avariados. */
  damagedItemCount: number | null
  /** Produto não corresponde à NF (migration 024): quantos itens · o que veio. */
  mismatchedItemCount: number | null
  mismatchDescription: string | null
  receivedAt:     string
  decidedAt:      string
  decidedByType:  'client' | 'auto'
  decision:       ReturnDecision
  depositorId:    string | null
  depositorName:  string | null
  clientName:     string | null
  finalCustomerName: string | null
  returnInvoiceXmlPath: string | null
  /** Etiqueta da decisão Reenvio (PDF em `reship-files`). */
  reshipLabelPath:      string | null
  /** DANFE anexada no Reenvio (PDF em `reship-files`). */
  reshipDanfePath:      string | null
  boxPhotoUrls:   string[]
  itemPhotoUrls:  string[]
}

export interface GetTrativasFilters {
  rv?:          string
  decision?:    ReturnDecision
  depositorId?: string
  page?:        number
}

const PAGE_SIZE = 50

export async function getTrativasAction(
  filters: GetTrativasFilters = {},
): Promise<{ rows: TrativaRow[]; total: number } | { error: string }> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'operator' && !isSuperUser(user)) return { error: 'Acesso negado' }

    const supabase = createClient()
    const page     = Math.max(1, filters.page ?? 1)
    const offset   = (page - 1) * PAGE_SIZE

    let query = supabase
      .from('returns')
      .select(
        `id, rv, identifier_type, access_key, postal_code, logistics_code, illegible_token,
         item_count, damaged_item_count, mismatched_item_count, mismatch_description, received_at, decided_at, decided_by_type, decision,
         depositor_id, return_invoice_xml_url, reship_label_url, reship_danfe_url, final_customer_name,
         depositors!depositor_id(razao_social),
         profiles!decided_by(full_name),
         return_photos(storage_path, photo_type, position)`,
        { count: 'exact' },
      )
      .eq('status', 'decided')
      // Decididas mais recentemente primeiro (mesma ordem da visão geral).
      .order('decided_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (filters.rv)       query = query.ilike('rv', `%${filters.rv}%`)
    if (filters.decision)    query = query.eq('decision', filters.decision)
    if (filters.depositorId) query = query.eq('depositor_id', filters.depositorId)

    const { data: returns, count, error } = await query
    if (error) return { error: error.message }

    const allReturns = returns ?? []

    const boxPaths:  string[] = []
    const itemPaths: string[] = []
    for (const r of allReturns) {
      const photos = (r.return_photos as { storage_path: string; photo_type: string; position: number }[]) ?? []
      for (const p of photos) {
        if (p.photo_type === 'box')  boxPaths.push(p.storage_path)
        if (p.photo_type === 'item') itemPaths.push(p.storage_path)
      }
    }

    const [boxMap, itemMap] = await Promise.all([
      buildSignedUrlMap(supabase, 'box-photos',  boxPaths),
      buildSignedUrlMap(supabase, 'item-photos', itemPaths),
    ])

    const rows: TrativaRow[] = allReturns.map((r) => {
      const photos = (r.return_photos as { storage_path: string; photo_type: string; position: number }[]) ?? []
      const boxUrls = photos
        .filter((p) => p.photo_type === 'box')
        .sort((a, b) => a.position - b.position)
        .map((p) => boxMap.get(p.storage_path) ?? '')
        .filter(Boolean)
      const itemUrls = photos
        .filter((p) => p.photo_type === 'item')
        .sort((a, b) => a.position - b.position)
        .map((p) => itemMap.get(p.storage_path) ?? '')
        .filter(Boolean)

      const dep    = r.depositors as unknown as { razao_social: string } | null
      const client = r.profiles   as unknown as { full_name: string }    | null

      return {
        id:             r.id,
        rv:             r.rv,
        identifierType: r.identifier_type,
        accessKey:      r.access_key,
        postalCode:     r.postal_code,
        logisticsCode:  r.logistics_code,
        illegibleToken: r.illegible_token,
        itemCount:      r.item_count,
        damagedItemCount: r.damaged_item_count ?? null,
        mismatchedItemCount: r.mismatched_item_count ?? null,
        mismatchDescription: r.mismatch_description ?? null,
        receivedAt:     r.received_at,
        decidedAt:      r.decided_at,
        decidedByType:  r.decided_by_type,
        decision:       r.decision,
        depositorId:    r.depositor_id,
        depositorName:  dep?.razao_social    ?? null,
        clientName:     r.decided_by_type === 'client' ? (client?.full_name ?? null) : null,
        finalCustomerName: r.final_customer_name ?? null,
        returnInvoiceXmlPath: r.return_invoice_xml_url ?? null,
        reshipLabelPath:      r.reship_label_url       ?? null,
        reshipDanfePath:      r.reship_danfe_url       ?? null,
        boxPhotoUrls:   boxUrls,
        itemPhotoUrls:  itemUrls,
      }
    })

    return { rows, total: count ?? 0 }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export interface TrativaDepositor {
  id:    string
  name:  string
  /** Tratativas pendentes desse depositante. */
  count: number
}

/** O PostgREST corta cada resposta em 1000 linhas: lê em lotes desse tamanho. */
const DEPOSITORS_BATCH_SIZE = 1000
/** Teto de segurança da varredura (50 lotes = 50 mil tratativas pendentes). */
const DEPOSITORS_MAX_BATCHES = 50

/**
 * Depositantes com tratativa pendente (status `decided`), com a contagem de
 * cada um, ordenados por nome — opções do filtro de depositante.
 */
export async function getTrativaDepositorsAction(): Promise<TrativaDepositor[]> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'operator' && !isSuperUser(user)) return []

    const supabase = createClient()
    const byId     = new Map<string, TrativaDepositor>()

    for (let batch = 0; batch < DEPOSITORS_MAX_BATCHES; batch++) {
      const offset = batch * DEPOSITORS_BATCH_SIZE
      const { data, error } = await supabase
        .from('returns')
        .select('id, depositor_id, depositors!depositor_id(razao_social)')
        .eq('status', 'decided')
        .not('depositor_id', 'is', null)
        // Ordem estável: sem ela os lotes podem repetir ou pular linhas.
        .order('id', { ascending: true })
        .range(offset, offset + DEPOSITORS_BATCH_SIZE - 1)
      if (error) return []

      const rows = data ?? []
      for (const r of rows) {
        const id   = r.depositor_id as string | null
        const name = (r.depositors as unknown as { razao_social: string } | null)?.razao_social
        if (!id || !name) continue
        const entry = byId.get(id)
        if (entry) entry.count++
        else byId.set(id, { id, name, count: 1 })
      }
      if (rows.length < DEPOSITORS_BATCH_SIZE) break
    }

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  } catch {
    return []
  }
}

export async function processReturnAction(
  returnId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'operator' && !isSuperUser(user)) return { error: 'Acesso negado' }

    const supabase = createClient()

    const { error } = await supabase
      .from('returns')
      .update({
        status:       'processed',
        processed_at: new Date().toISOString(),
        processed_by: user.id,
      })
      .eq('id', returnId)
      .eq('status', 'decided')

    if (error) return { error: error.message }

    revalidatePath('/operador/tratativas')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
