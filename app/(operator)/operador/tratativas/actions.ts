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
  illegibleToken: string | null
  itemCount:      number
  receivedAt:     string
  decidedAt:      string
  decidedByType:  'client' | 'auto'
  decision:       ReturnDecision
  depositorId:    string | null
  depositorName:  string | null
  clientName:     string | null
  finalCustomerName: string | null
  invoiceXmlPath:       string | null
  invoicePdfPath:       string | null
  returnInvoiceXmlPath: string | null
  boxPhotoUrls:   string[]
  itemPhotoUrls:  string[]
}

export interface GetTrativasFilters {
  rv?:   string
  page?: number
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
        `id, rv, identifier_type, access_key, postal_code, illegible_token,
         item_count, received_at, decided_at, decided_by_type, decision,
         depositor_id, invoice_xml_url, invoice_pdf_url, return_invoice_xml_url, final_customer_name,
         depositors!depositor_id(razao_social),
         profiles!decided_by(full_name),
         return_photos(storage_path, photo_type, position)`,
        { count: 'exact' },
      )
      .eq('status', 'decided')
      .order('decided_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (filters.rv) query = query.ilike('rv', `%${filters.rv}%`)

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
        illegibleToken: r.illegible_token,
        itemCount:      r.item_count,
        receivedAt:     r.received_at,
        decidedAt:      r.decided_at,
        decidedByType:  r.decided_by_type,
        decision:       r.decision,
        depositorId:    r.depositor_id,
        depositorName:  dep?.razao_social    ?? null,
        clientName:     r.decided_by_type === 'client' ? (client?.full_name ?? null) : null,
        finalCustomerName: r.final_customer_name ?? null,
        invoiceXmlPath:       r.invoice_xml_url        ?? null,
        invoicePdfPath:       r.invoice_pdf_url        ?? null,
        returnInvoiceXmlPath: r.return_invoice_xml_url ?? null,
        boxPhotoUrls:   boxUrls,
        itemPhotoUrls:  itemUrls,
      }
    })

    return { rows, total: count ?? 0 }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
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
