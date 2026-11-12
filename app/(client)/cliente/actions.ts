'use server'

import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { env } from '@/lib/env'
import { isSuperUser } from '@/lib/auth/super'
import { buildSignedUrlMap } from '@/lib/supabase/storage'
import { DECISION_LABELS, isReshipDepositor } from '@/lib/decisions'
import { readReturnInvoiceKey, resolveReturnInvoiceKeys } from '@/lib/return-invoice-key'
import {
  DECIDED_BY_LABELS, IDENTIFIER_TYPE_LABELS, formatDate, originNfLabel, returnNfLabel,
} from '@/lib/format'
import type { ReturnDecision, DecisionSource, IdentifierType } from '@/types'

export interface ReturnRow {
  id:             string
  identifierType: IdentifierType
  accessKey:      string | null
  postalCode:     string | null
  logisticsCode:  string | null
  illegibleToken: string | null
  rv:             string
  itemCount:      number
  /** Estado no recebimento: null = não avaliado, 0 = Bom, >0 = itens avariados. */
  damagedItemCount: number | null
  receivedAt:     string
  depositorId:    string | null
  depositorName:  string | null
  finalCustomerName: string | null
  returnInvoiceXmlPath: string | null
  /** Decisão "Reenvio" liberada para o depositante desta devolução
   *  (RESHIP_DEPOSITOR_CNPJS). Só é calculado nas pendências; o servidor
   *  revalida em submitDecisionAction. */
  reshipEnabled?:  boolean
  /** Depositante sem prazo de decisão (depositors.no_decision_deadline — hoje a
   *  Blackskull): sem auto-decisão de 72h nem contagem regressiva. */
  noDecisionDeadline?: boolean
  /** Etiqueta de reenvio (PDF em `reship-files`) — só nas decididas como Reenvio. */
  reshipLabelPath?: string | null
  /** DANFE anexada no Reenvio (PDF em `reship-files`). */
  reshipDanfePath?: string | null
  decision:       ReturnDecision | null
  decidedAt:      string | null
  decidedByType:  DecisionSource | null
  boxPhotoUrls:   string[]
  itemPhotoUrls:  string[]
}

export interface GetReturnsFilters {
  depositorId?: string
  from?:        string
  to?:          string
  page?:        number
}

export interface DepositorOption {
  id:   string
  name: string
}

type ReturnsResult = {
  rows:       ReturnRow[]
  total:      number
  depositors: DepositorOption[]
} | { error: string }

const PAGE_SIZE = 50

type RawPhoto = { storage_path: string; photo_type: string; position: number }

function resolvePhotos(
  photos: RawPhoto[],
  boxMap: Map<string, string>,
  itemMap: Map<string, string>,
): { boxUrls: string[]; itemUrls: string[] } {
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
  return { boxUrls, itemUrls }
}

export async function getClientReturnsAction(
  filters: GetReturnsFilters = {},
): Promise<ReturnsResult> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'client' && !isSuperUser(user)) return { error: 'Acesso negado' }

    const supabase = createClient()
    const page     = Math.max(1, filters.page ?? 1)
    const offset   = (page - 1) * PAGE_SIZE

    let query = supabase
      .from('returns')
      .select(
        `id, identifier_type, access_key, postal_code, logistics_code, illegible_token,
         rv, item_count, damaged_item_count, received_at, depositor_id, final_customer_name,
         depositors!depositor_id(razao_social, cnpj, no_decision_deadline),
         return_photos(storage_path, photo_type, position)`,
        { count: 'exact' },
      )
      .eq('status', 'awaiting_decision')
      .order('received_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (filters.depositorId) query = query.eq('depositor_id', filters.depositorId)
    if (filters.from)        query = query.gte('received_at', filters.from)
    if (filters.to)          query = query.lte('received_at', filters.to)

    const superUser = isSuperUser(user)
    const [
      { data: returns, count, error },
      { data: cdRows },
    ] = await Promise.all([
      query,
      superUser
        ? supabase
            .from('depositors')
            .select('id, razao_social')
            .eq('active', true)
            .order('razao_social')
        : supabase
            .from('client_depositors')
            .select('depositor_id, depositors!depositor_id(razao_social)')
            .eq('client_id', user.id),
    ])

    if (error) return { error: error.message }

    const depositors: DepositorOption[] = superUser
      ? ((cdRows as unknown as { id: string; razao_social: string }[]) ?? []).map((r) => ({
          id:   r.id,
          name: r.razao_social,
        }))
      : ((cdRows as unknown as { depositor_id: string; depositors: { razao_social: string } | null }[]) ?? []).map((r) => ({
          id:   r.depositor_id,
          name: r.depositors?.razao_social ?? r.depositor_id,
        }))

    const allReturns = returns ?? []
    const boxPaths:  string[] = []
    const itemPaths: string[] = []
    for (const r of allReturns) {
      const photos = (r.return_photos as RawPhoto[]) ?? []
      for (const p of photos) {
        if (p.photo_type === 'box')  boxPaths.push(p.storage_path)
        if (p.photo_type === 'item') itemPaths.push(p.storage_path)
      }
    }

    const [boxMap, itemMap] = await Promise.all([
      buildSignedUrlMap(supabase, 'box-photos',  boxPaths),
      buildSignedUrlMap(supabase, 'item-photos', itemPaths),
    ])

    const rows: ReturnRow[] = allReturns.map((r) => {
      const photos = (r.return_photos as RawPhoto[]) ?? []
      const { boxUrls, itemUrls } = resolvePhotos(photos, boxMap, itemMap)
      const dep = r.depositors as unknown as
        { razao_social: string; cnpj: string; no_decision_deadline?: boolean | null } | null
      return {
        id:             r.id,
        identifierType: r.identifier_type as IdentifierType,
        accessKey:      r.access_key,
        postalCode:     r.postal_code,
        logisticsCode:  r.logistics_code,
        illegibleToken: r.illegible_token,
        rv:             r.rv,
        itemCount:      r.item_count,
        damagedItemCount: r.damaged_item_count ?? null,
        receivedAt:     r.received_at,
        depositorId:    r.depositor_id,
        depositorName:  dep?.razao_social ?? null,
        finalCustomerName: r.final_customer_name ?? null,
        returnInvoiceXmlPath: null, // pendentes ainda não têm decisão/XML de devolução
        reshipEnabled:  isReshipDepositor(dep?.cnpj, env.reshipDepositorCnpjs),
        noDecisionDeadline: dep?.no_decision_deadline === true,
        decision:       null,
        decidedAt:      null,
        decidedByType:  null,
        boxPhotoUrls:   boxUrls,
        itemPhotoUrls:  itemUrls,
      }
    })

    return { rows, total: count ?? 0, depositors }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function getClientHistoryAction(
  filters: GetReturnsFilters = {},
): Promise<ReturnsResult> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'client' && !isSuperUser(user)) return { error: 'Acesso negado' }

    const supabase = createClient()
    const page     = Math.max(1, filters.page ?? 1)
    const offset   = (page - 1) * PAGE_SIZE

    let query = supabase
      .from('returns')
      .select(
        `id, identifier_type, access_key, postal_code, logistics_code, illegible_token,
         rv, item_count, damaged_item_count, received_at, depositor_id, return_invoice_xml_url, final_customer_name,
         decision, decided_at, decided_by_type, reship_label_url, reship_danfe_url,
         depositors!depositor_id(razao_social),
         return_photos(storage_path, photo_type, position)`,
        { count: 'exact' },
      )
      .eq('status', 'decided')
      .order('decided_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (filters.depositorId) query = query.eq('depositor_id', filters.depositorId)
    if (filters.from)        query = query.gte('decided_at', filters.from)
    if (filters.to)          query = query.lte('decided_at', filters.to)

    const superUser = isSuperUser(user)
    const [
      { data: returns, count, error },
      { data: cdRows },
    ] = await Promise.all([
      query,
      superUser
        ? supabase
            .from('depositors')
            .select('id, razao_social')
            .eq('active', true)
            .order('razao_social')
        : supabase
            .from('client_depositors')
            .select('depositor_id, depositors!depositor_id(razao_social)')
            .eq('client_id', user.id),
    ])

    if (error) return { error: error.message }

    const depositors: DepositorOption[] = superUser
      ? ((cdRows as unknown as { id: string; razao_social: string }[]) ?? []).map((r) => ({
          id:   r.id,
          name: r.razao_social,
        }))
      : ((cdRows as unknown as { depositor_id: string; depositors: { razao_social: string } | null }[]) ?? []).map((r) => ({
          id:   r.depositor_id,
          name: r.depositors?.razao_social ?? r.depositor_id,
        }))

    const allReturns = returns ?? []
    const boxPaths:  string[] = []
    const itemPaths: string[] = []
    for (const r of allReturns) {
      const photos = (r.return_photos as RawPhoto[]) ?? []
      for (const p of photos) {
        if (p.photo_type === 'box')  boxPaths.push(p.storage_path)
        if (p.photo_type === 'item') itemPaths.push(p.storage_path)
      }
    }

    const [boxMap, itemMap] = await Promise.all([
      buildSignedUrlMap(supabase, 'box-photos',  boxPaths),
      buildSignedUrlMap(supabase, 'item-photos', itemPaths),
    ])

    const rows: ReturnRow[] = allReturns.map((r) => {
      const photos = (r.return_photos as RawPhoto[]) ?? []
      const { boxUrls, itemUrls } = resolvePhotos(photos, boxMap, itemMap)
      const dep = r.depositors as unknown as { razao_social: string } | null
      return {
        id:             r.id,
        identifierType: r.identifier_type as IdentifierType,
        accessKey:      r.access_key,
        postalCode:     r.postal_code,
        logisticsCode:  r.logistics_code,
        illegibleToken: r.illegible_token,
        rv:             r.rv,
        itemCount:      r.item_count,
        damagedItemCount: r.damaged_item_count ?? null,
        receivedAt:     r.received_at,
        depositorId:    r.depositor_id,
        depositorName:  dep?.razao_social ?? null,
        finalCustomerName: r.final_customer_name ?? null,
        returnInvoiceXmlPath: r.return_invoice_xml_url ?? null,
        reshipLabelPath:      r.reship_label_url       ?? null,
        reshipDanfePath:      r.reship_danfe_url       ?? null,
        decision:       r.decision as ReturnDecision | null,
        decidedAt:      r.decided_at,
        decidedByType:  r.decided_by_type as DecisionSource | null,
        boxPhotoUrls:   boxUrls,
        itemPhotoUrls:  itemUrls,
      }
    })

    return { rows, total: count ?? 0, depositors }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

interface SubmitPayload {
  returnId:             string
  decision:             ReturnDecision
  returnInvoiceXmlPath: string | null
  /** Etiqueta de reenvio e DANFE (PDFs) — obrigatórias só na decisão `reship`. */
  reshipLabelPath?:     string | null
  reshipDanfePath?:     string | null
}

/** PDF enviado pelo modal para a pasta desta devolução em `reship-files`. */
function isReshipPdfPath(path: string | null | undefined, returnId: string): path is string {
  return !!path && path.startsWith(`${returnId}/`) && path.toLowerCase().endsWith('.pdf')
}

/** Reenvio só para os depositantes liberados — revalidado aqui, a flag da row é só UI. */
async function isReshipAllowedReturn(
  supabase: ReturnType<typeof createClient>,
  returnId: string,
): Promise<boolean> {
  if (env.reshipDepositorCnpjs.length === 0) return false
  const { data } = await supabase
    .from('returns')
    .select('depositors!depositor_id(cnpj)')
    .eq('id', returnId)
    .single()
  const dep = data?.depositors as unknown as { cnpj: string } | null
  return isReshipDepositor(dep?.cnpj, env.reshipDepositorCnpjs)
}

export async function submitDecisionAction(
  payload: SubmitPayload,
): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'client' && !isSuperUser(user)) return { error: 'Acesso negado' }

    const supabase = createClient()

    if (payload.decision === 'reship') {
      // Reenvio vai com a mesma NF do pedido: os anexos obrigatórios são a
      // etiqueta e a DANFE (PDFs), na pasta desta devolução no bucket.
      if (!isReshipPdfPath(payload.reshipLabelPath, payload.returnId)) {
        return { error: 'A etiqueta de reenvio (PDF) é obrigatória.' }
      }
      if (!isReshipPdfPath(payload.reshipDanfePath, payload.returnId)) {
        return { error: 'A DANFE (PDF) é obrigatória para o reenvio.' }
      }
      if (!(await isReshipAllowedReturn(supabase, payload.returnId))) {
        return { error: 'Reenvio não está disponível para este depositante.' }
      }
    } else if (payload.decision !== 'store_for_handling' && !payload.returnInvoiceXmlPath) {
      return { error: 'XML da NF de devolução é obrigatório para esta decisão.' }
    }

    const update: Record<string, unknown> = {
      status:          'decided',
      decision:        payload.decision,
      decided_at:      new Date().toISOString(),
      decided_by:      user.id,
      decided_by_type: 'client',
    }
    if (payload.decision === 'reship') {
      update.reship_label_url = payload.reshipLabelPath
      update.reship_danfe_url = payload.reshipDanfePath
    } else {
      update.return_invoice_xml_url = payload.returnInvoiceXmlPath
      // Chave da NF de devolução para os relatórios (best-effort: XML ilegível
      // não bloqueia a decisão — fica só sem a chave)
      if (payload.returnInvoiceXmlPath) {
        const key = await readReturnInvoiceKey(supabase, payload.returnInvoiceXmlPath)
        if (key) update.return_invoice_key = key
      }
    }

    const { error } = await supabase
      .from('returns')
      .update(update)
      .eq('id', payload.returnId)
      .eq('status', 'awaiting_decision')

    if (error) return { error: error.message }

    revalidatePath('/cliente')
    revalidatePath('/cliente/historico')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function exportHistoryAction(): Promise<
  { base64: string; filename: string } | { error: string }
> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'client' && !isSuperUser(user)) return { error: 'Acesso negado' }

    const supabase = createClient()

    const [{ data: returns, error }, { data: cdRows }] = await Promise.all([
      supabase
        .from('returns')
        .select(
          `id, identifier_type, access_key, postal_code, logistics_code, illegible_token,
           rv, item_count, received_at, depositor_id, decision, decided_at, decided_by_type, status, final_customer_name,
           return_invoice_xml_url, return_invoice_key,
           depositors!depositor_id(razao_social)`,
        )
        .neq('status', 'awaiting_decision')
        .order('decided_at', { ascending: false }),
      supabase
        .from('client_depositors')
        .select('depositor_id')
        .eq('client_id', user.id),
    ])

    if (error) return { error: error.message }

    const superUser = isSuperUser(user)
    const allowedDepositorIds = new Set((cdRows ?? []).map((r) => r.depositor_id))

    const visible = (returns ?? [])
      .filter((r) => superUser || allowedDepositorIds.has((r as unknown as { depositor_id: string | null }).depositor_id ?? ''))

    const returnKeys = await resolveReturnInvoiceKeys(visible.map((r) => ({
      id:                   r.id,
      returnInvoiceXmlPath: r.return_invoice_xml_url ?? null,
      returnInvoiceKey:     r.return_invoice_key ?? null,
    })))

    const rows = visible
      .map((r) => {
        const dep = r.depositors as unknown as { razao_social: string } | null
        const row: ReturnRow = {
          id:             r.id,
          identifierType: r.identifier_type as IdentifierType,
          accessKey:      r.access_key,
          postalCode:     r.postal_code,
          logisticsCode:  r.logistics_code,
          illegibleToken: r.illegible_token,
          rv:             r.rv,
          itemCount:      r.item_count,
          damagedItemCount: null, // não exportado
          receivedAt:     r.received_at,
          depositorId:    null,
          depositorName:  dep?.razao_social ?? null,
          finalCustomerName: r.final_customer_name ?? null,
          returnInvoiceXmlPath: null,
          decision:       r.decision as ReturnDecision | null,
          decidedAt:      r.decided_at,
          decidedByType:  r.decided_by_type as DecisionSource | null,
          boxPhotoUrls:   [],
          itemPhotoUrls:  [],
        }
        return {
          'Data Recebimento':    formatDate(r.received_at),
          'RV':                  r.rv,
          'Tipo Identificador':  IDENTIFIER_TYPE_LABELS[r.identifier_type as IdentifierType] ?? r.identifier_type,
          'NF Origem':           originNfLabel(row),
          'NF Devolução':        returnNfLabel({
            returnInvoiceKey: returnKeys.get(r.id) ?? null,
            hasReturnInvoice: !!r.return_invoice_xml_url,
          }),
          'Depositante':         dep?.razao_social ?? '—',
          'Cliente Final':       r.final_customer_name ?? '—',
          'Nº Itens':            r.item_count,
          'Decisão':             r.decision ? (DECISION_LABELS[r.decision as ReturnDecision] ?? r.decision) : '—',
          'Decidido por':        r.decided_by_type ? (DECIDED_BY_LABELS[r.decided_by_type as DecisionSource] ?? r.decided_by_type) : '—',
          'Data Decisão':        r.decided_at ? formatDate(r.decided_at) : '—',
          'Status':              r.status,
        }
      })

    const wb  = XLSX.utils.book_new()
    const ws  = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const date     = new Date().toISOString().slice(0, 10)
    const filename = `historico-devolucoes-${date}.xlsx`

    return { base64: Buffer.from(buf).toString('base64'), filename }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
