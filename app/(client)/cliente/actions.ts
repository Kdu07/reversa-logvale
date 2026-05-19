'use server'

import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { buildSignedUrlMap } from '@/lib/supabase/storage'
import { DECISION_LABELS } from '@/lib/decisions'
import { formatDate, identifierLabel } from '@/lib/format'
import type { ReturnDecision, DecisionSource, IdentifierType } from '@/types'

export interface ReturnRow {
  id:             string
  identifierType: IdentifierType
  accessKey:      string | null
  postalCode:     string | null
  illegibleToken: string | null
  rv:             string
  itemCount:      number
  receivedAt:     string
  depositorId:    string | null
  depositorName:  string | null
  invoiceXmlUrl:  string | null
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
    if (user.profile.role !== 'client') return { error: 'Acesso negado' }

    const supabase = createClient()
    const page     = Math.max(1, filters.page ?? 1)
    const offset   = (page - 1) * PAGE_SIZE

    let query = supabase
      .from('returns')
      .select(
        `id, identifier_type, access_key, postal_code, illegible_token,
         rv, item_count, received_at, depositor_id, invoice_xml_url,
         depositors!depositor_id(razao_social),
         return_photos(storage_path, photo_type, position)`,
        { count: 'exact' },
      )
      .eq('status', 'awaiting_decision')
      .order('received_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (filters.depositorId) query = query.eq('depositor_id', filters.depositorId)
    if (filters.from)        query = query.gte('received_at', filters.from)
    if (filters.to)          query = query.lte('received_at', filters.to)

    const [
      { data: returns, count, error },
      { data: cdRows },
    ] = await Promise.all([
      query,
      supabase
        .from('client_depositors')
        .select('depositor_id, depositors!depositor_id(razao_social)')
        .eq('client_id', user.id),
    ])

    if (error) return { error: error.message }

    const depositors: DepositorOption[] = (cdRows ?? []).map((r) => ({
      id:   r.depositor_id,
      name: (r.depositors as unknown as { razao_social: string } | null)?.razao_social ?? r.depositor_id,
    }))

    const allReturns = returns ?? []
    const boxPaths:  string[] = []
    const itemPaths: string[] = []
    const xmlPaths:  string[] = []
    for (const r of allReturns) {
      const photos = (r.return_photos as RawPhoto[]) ?? []
      for (const p of photos) {
        if (p.photo_type === 'box')  boxPaths.push(p.storage_path)
        if (p.photo_type === 'item') itemPaths.push(p.storage_path)
      }
      if (r.invoice_xml_url) xmlPaths.push(r.invoice_xml_url)
    }

    const [boxMap, itemMap, xmlMap] = await Promise.all([
      buildSignedUrlMap(supabase, 'box-photos',   boxPaths),
      buildSignedUrlMap(supabase, 'item-photos',  itemPaths),
      buildSignedUrlMap(supabase, 'invoice-xmls', xmlPaths),
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
        illegibleToken: r.illegible_token,
        rv:             r.rv,
        itemCount:      r.item_count,
        receivedAt:     r.received_at,
        depositorId:    r.depositor_id,
        depositorName:  dep?.razao_social ?? null,
        invoiceXmlUrl:  r.invoice_xml_url ? (xmlMap.get(r.invoice_xml_url) ?? null) : null,
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
    if (user.profile.role !== 'client') return { error: 'Acesso negado' }

    const supabase = createClient()
    const page     = Math.max(1, filters.page ?? 1)
    const offset   = (page - 1) * PAGE_SIZE

    let query = supabase
      .from('returns')
      .select(
        `id, identifier_type, access_key, postal_code, illegible_token,
         rv, item_count, received_at, depositor_id, invoice_xml_url,
         decision, decided_at, decided_by_type,
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

    const [
      { data: returns, count, error },
      { data: cdRows },
    ] = await Promise.all([
      query,
      supabase
        .from('client_depositors')
        .select('depositor_id, depositors!depositor_id(razao_social)')
        .eq('client_id', user.id),
    ])

    if (error) return { error: error.message }

    const depositors: DepositorOption[] = (cdRows ?? []).map((r) => ({
      id:   r.depositor_id,
      name: (r.depositors as unknown as { razao_social: string } | null)?.razao_social ?? r.depositor_id,
    }))

    const allReturns = returns ?? []
    const boxPaths:  string[] = []
    const itemPaths: string[] = []
    const xmlPaths:  string[] = []
    for (const r of allReturns) {
      const photos = (r.return_photos as RawPhoto[]) ?? []
      for (const p of photos) {
        if (p.photo_type === 'box')  boxPaths.push(p.storage_path)
        if (p.photo_type === 'item') itemPaths.push(p.storage_path)
      }
      if (r.invoice_xml_url) xmlPaths.push(r.invoice_xml_url)
    }

    const [boxMap, itemMap, xmlMap] = await Promise.all([
      buildSignedUrlMap(supabase, 'box-photos',   boxPaths),
      buildSignedUrlMap(supabase, 'item-photos',  itemPaths),
      buildSignedUrlMap(supabase, 'invoice-xmls', xmlPaths),
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
        illegibleToken: r.illegible_token,
        rv:             r.rv,
        itemCount:      r.item_count,
        receivedAt:     r.received_at,
        depositorId:    r.depositor_id,
        depositorName:  dep?.razao_social ?? null,
        invoiceXmlUrl:  r.invoice_xml_url ? (xmlMap.get(r.invoice_xml_url) ?? null) : null,
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
}

export async function submitDecisionAction(
  payload: SubmitPayload,
): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'client') return { error: 'Acesso negado' }

    if (payload.decision !== 'store_for_handling' && !payload.returnInvoiceXmlPath) {
      return { error: 'XML da NF de devolução é obrigatório para esta decisão.' }
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('returns')
      .update({
        status:                 'decided',
        decision:               payload.decision,
        decided_at:             new Date().toISOString(),
        decided_by:             user.id,
        decided_by_type:        'client',
        return_invoice_xml_url: payload.returnInvoiceXmlPath,
      })
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

const IDENTIFIER_TYPE_PT: Record<IdentifierType, string> = {
  access_key:  'Chave NF',
  postal_code: 'CEP',
  illegible:   'Ilegível',
}

const DECIDED_BY_PT: Record<string, string> = {
  client: 'Cliente',
  auto:   'Automático',
}

export async function exportHistoryAction(): Promise<
  { base64: string; filename: string } | { error: string }
> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'client') return { error: 'Acesso negado' }

    const supabase = createClient()

    const [{ data: returns, error }, { data: cdRows }] = await Promise.all([
      supabase
        .from('returns')
        .select(
          `id, identifier_type, access_key, postal_code, illegible_token,
           rv, item_count, received_at, depositor_id, decision, decided_at, decided_by_type, status,
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

    const allowedDepositorIds = new Set((cdRows ?? []).map((r) => r.depositor_id))

    const rows = (returns ?? [])
      .filter((r) => allowedDepositorIds.has((r as unknown as { depositor_id: string | null }).depositor_id ?? ''))
      .map((r) => {
        const dep = r.depositors as unknown as { razao_social: string } | null
        const row: ReturnRow = {
          id:             r.id,
          identifierType: r.identifier_type as IdentifierType,
          accessKey:      r.access_key,
          postalCode:     r.postal_code,
          illegibleToken: r.illegible_token,
          rv:             r.rv,
          itemCount:      r.item_count,
          receivedAt:     r.received_at,
          depositorId:    null,
          depositorName:  dep?.razao_social ?? null,
          invoiceXmlUrl:  null,
          decision:       r.decision as ReturnDecision | null,
          decidedAt:      r.decided_at,
          decidedByType:  r.decided_by_type as DecisionSource | null,
          boxPhotoUrls:   [],
          itemPhotoUrls:  [],
        }
        return {
          'Data Recebimento':    formatDate(r.received_at),
          'RV':                  r.rv,
          'Tipo Identificador':  IDENTIFIER_TYPE_PT[r.identifier_type as IdentifierType] ?? r.identifier_type,
          'Identificador':       identifierLabel(row),
          'Depositante':         dep?.razao_social ?? '—',
          'Nº Itens':            r.item_count,
          'Decisão':             r.decision ? (DECISION_LABELS[r.decision as ReturnDecision] ?? r.decision) : '—',
          'Decidido por':        r.decided_by_type ? (DECIDED_BY_PT[r.decided_by_type] ?? r.decided_by_type) : '—',
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
