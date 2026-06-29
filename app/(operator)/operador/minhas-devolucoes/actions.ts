'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isSuperUser } from '@/lib/auth/super'
import { buildSignedUrlMap } from '@/lib/supabase/storage'
import type { ReturnStatus, ReturnDecision, IdentifierType } from '@/types'

export interface MyReturnRow {
  id:                   string
  rv:                   string
  status:               ReturnStatus
  decision:             ReturnDecision | null
  decidedByType:        'client' | 'auto' | null
  receivedAt:           string
  decidedAt:            string | null
  processedAt:          string | null
  depositorName:        string | null
  finalCustomerName:    string | null
  identifierType:       IdentifierType
  accessKey:            string | null
  postalCode:           string | null
  illegibleToken:       string | null
  itemCount:            number
  invoiceXmlPath:       string | null
  invoicePdfPath:       string | null
  returnInvoiceXmlPath: string | null
  boxPhotoUrls:         string[]
  itemPhotoUrls:        string[]
}

export interface GetMyReturnsFilters {
  rv?:          string
  depositorId?: string
  from?:        string  // YYYY-MM-DD (início do período, inclusivo)
  to?:          string  // YYYY-MM-DD (fim do período, inclusivo)
  page?:        number
}

type RawPhoto = { photo_type: string; storage_path: string; position: number }

const PAGE_SIZE = 50

/** Converte uma data local (YYYY-MM-DD) para ISO no início/fim do dia. */
function dayBoundary(date: string, edge: 'start' | 'end'): string | null {
  const suffix = edge === 'start' ? 'T00:00:00.000' : 'T23:59:59.999'
  const d = new Date(`${date}${suffix}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function getMyReturnsAction(
  filters: GetMyReturnsFilters = {},
): Promise<{ rows: MyReturnRow[]; total: number } | { error: string }> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'operator' && !isSuperUser(user)) return { error: 'Acesso negado' }

    const supabase = createClient()
    const page     = Math.max(1, filters.page ?? 1)
    const offset   = (page - 1) * PAGE_SIZE

    let query = supabase
      .from('returns')
      .select(
        `id, rv, status, decision, decided_by_type, received_at, decided_at, processed_at,
         identifier_type, access_key, postal_code, illegible_token, item_count,
         invoice_xml_url, invoice_pdf_url, return_invoice_xml_url, final_customer_name,
         depositors!depositor_id(razao_social),
         return_photos(photo_type, storage_path, position)`,
        { count: 'exact' },
      )
      .eq('received_by', user.id)
      .order('received_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (filters.rv)          query = query.ilike('rv', `%${filters.rv}%`)
    if (filters.depositorId) query = query.eq('depositor_id', filters.depositorId)

    const fromIso = filters.from ? dayBoundary(filters.from, 'start') : null
    const toIso   = filters.to   ? dayBoundary(filters.to,   'end')   : null
    if (fromIso) query = query.gte('received_at', fromIso)
    if (toIso)   query = query.lte('received_at', toIso)

    const { data, count, error } = await query
    if (error) return { error: error.message }

    const boxPaths:  string[] = []
    const itemPaths: string[] = []
    const photosByReturn = new Map<string, { box: RawPhoto[]; item: RawPhoto[] }>()
    for (const r of data ?? []) {
      const photos = (r.return_photos as unknown as RawPhoto[]) ?? []
      const box  = photos.filter((p) => p.photo_type === 'box').sort((a, b) => a.position - b.position)
      const item = photos.filter((p) => p.photo_type === 'item').sort((a, b) => a.position - b.position)
      photosByReturn.set(r.id, { box, item })
      box.forEach((p)  => boxPaths.push(p.storage_path))
      item.forEach((p) => itemPaths.push(p.storage_path))
    }

    // XMLs/DANFEs são assinados on-click pelo DownloadXmlButton; só as fotos entram no batch.
    const [boxMap, itemMap] = await Promise.all([
      buildSignedUrlMap(supabase, 'box-photos',  boxPaths),
      buildSignedUrlMap(supabase, 'item-photos', itemPaths),
    ])

    const rows: MyReturnRow[] = (data ?? []).map((r) => {
      const photos = photosByReturn.get(r.id) ?? { box: [], item: [] }
      return {
        id:                   r.id,
        rv:                   r.rv,
        status:               r.status as ReturnStatus,
        decision:             r.decision as ReturnDecision | null,
        decidedByType:        r.decided_by_type as 'client' | 'auto' | null,
        receivedAt:           r.received_at,
        decidedAt:            r.decided_at,
        processedAt:          r.processed_at,
        depositorName:        (r.depositors as unknown as { razao_social: string } | null)?.razao_social ?? null,
        finalCustomerName:    r.final_customer_name ?? null,
        identifierType:       r.identifier_type as IdentifierType,
        accessKey:            r.access_key,
        postalCode:           r.postal_code,
        illegibleToken:       r.illegible_token,
        itemCount:            r.item_count,
        invoiceXmlPath:       r.invoice_xml_url        ?? null,
        invoicePdfPath:       r.invoice_pdf_url        ?? null,
        returnInvoiceXmlPath: r.return_invoice_xml_url ?? null,
        boxPhotoUrls:         photos.box.map((p)  => boxMap.get(p.storage_path)  ?? '').filter(Boolean),
        itemPhotoUrls:        photos.item.map((p) => itemMap.get(p.storage_path) ?? '').filter(Boolean),
      }
    })

    return { rows, total: count ?? 0 }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export interface MyReturnDepositor {
  id:   string
  name: string
}

/** Depositantes distintos das devoluções recebidas pelo operador (para o filtro). */
export async function getMyReturnDepositorsAction(): Promise<MyReturnDepositor[]> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'operator' && !isSuperUser(user)) return []

    const supabase = createClient()
    const { data, error } = await supabase
      .from('returns')
      .select('depositor_id, depositors!depositor_id(razao_social)')
      .eq('received_by', user.id)
      .not('depositor_id', 'is', null)
    if (error) return []

    const byId = new Map<string, string>()
    for (const r of data ?? []) {
      const id   = r.depositor_id as string | null
      const name = (r.depositors as unknown as { razao_social: string } | null)?.razao_social
      if (id && name && !byId.has(id)) byId.set(id, name)
    }

    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    )
  } catch {
    return []
  }
}
