'use server'

import { createClient } from '@/lib/supabase/server'
import { assertManager } from '@/lib/supabase/assert-role'
import { buildSignedUrlMap } from '@/lib/supabase/storage'
import { revalidatePath } from 'next/cache'
import type { ReturnStatus, ReturnDecision, IdentifierType } from '@/types'

export interface AdminReturnRow {
  id:                  string
  rv:                  string
  status:              ReturnStatus
  decision:            ReturnDecision | null
  decidedByType:       'client' | 'auto' | null
  receivedAt:          string
  decidedAt:           string | null
  processedAt:         string | null
  depositorName:       string | null
  operatorName:        string | null
  identifierType:      IdentifierType
  accessKey:           string | null
  postalCode:          string | null
  illegibleToken:      string | null
  itemCount:           number
  invoiceXmlPath:       string | null
  returnInvoiceXmlPath: string | null
  boxPhotoUrls:        string[]
  itemPhotoUrls:       string[]
}

type RawPhoto = { photo_type: string; storage_path: string; position: number }

export async function getAdminReturnsAction(filters?: {
  rv?:     string
  status?: ReturnStatus
  page?:   number
}): Promise<{ rows: AdminReturnRow[]; total: number } | { error: string }> {
  try {
    await assertManager()
    const supabase = createClient()

    const page   = Math.max(1, filters?.page ?? 1)
    const limit  = 50
    const offset = (page - 1) * limit

    let query = supabase
      .from('returns')
      .select(
        `id, rv, status, decision, decided_by_type, received_at, decided_at, processed_at,
         identifier_type, access_key, postal_code, illegible_token, item_count,
         invoice_xml_url, return_invoice_xml_url,
         depositors!depositor_id(razao_social),
         profiles!received_by(full_name),
         return_photos(photo_type, storage_path, position)`,
        { count: 'exact' },
      )
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filters?.rv)     query = query.ilike('rv', `%${filters.rv}%`)
    if (filters?.status) query = query.eq('status', filters.status)

    const { data, count, error } = await query
    if (error) throw error

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

    // XMLs não entram no batch: são assinados on-click (com nome de arquivo
    // amigável e download forçado) pelo DownloadXmlButton.
    const [boxMap, itemMap] = await Promise.all([
      buildSignedUrlMap(supabase, 'box-photos',  boxPaths),
      buildSignedUrlMap(supabase, 'item-photos', itemPaths),
    ])

    const rows: AdminReturnRow[] = (data ?? []).map((r) => {
      const photos = photosByReturn.get(r.id) ?? { box: [], item: [] }
      return {
        id:                  r.id,
        rv:                  r.rv,
        status:              r.status as ReturnStatus,
        decision:            r.decision as ReturnDecision | null,
        decidedByType:       r.decided_by_type as 'client' | 'auto' | null,
        receivedAt:          r.received_at,
        decidedAt:           r.decided_at,
        processedAt:         r.processed_at,
        depositorName:       (r.depositors as unknown as { razao_social: string } | null)?.razao_social ?? null,
        operatorName:        (r.profiles   as unknown as { full_name:   string } | null)?.full_name   ?? null,
        identifierType:      r.identifier_type as IdentifierType,
        accessKey:           r.access_key,
        postalCode:          r.postal_code,
        illegibleToken:      r.illegible_token,
        itemCount:           r.item_count,
        invoiceXmlPath:       r.invoice_xml_url        ?? null,
        returnInvoiceXmlPath: r.return_invoice_xml_url ?? null,
        boxPhotoUrls:        photos.box.map((p)  => boxMap.get(p.storage_path)  ?? '').filter(Boolean),
        itemPhotoUrls:       photos.item.map((p) => itemMap.get(p.storage_path) ?? '').filter(Boolean),
      }
    })

    return { rows, total: count ?? 0 }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function revertReturnStatusAction(
  returnId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await assertManager()
    const supabase = createClient()

    const { data: current, error: fetchErr } = await supabase
      .from('returns')
      .select('status')
      .eq('id', returnId)
      .single()
    if (fetchErr) throw fetchErr

    let update: Record<string, unknown>

    if (current.status === 'decided') {
      update = {
        status:                 'awaiting_decision',
        decision:               null,
        decided_at:             null,
        decided_by:             null,
        decided_by_type:        null,
        return_invoice_xml_url: null,
      }
    } else if (current.status === 'processed') {
      update = {
        status:        'decided',
        processed_at:  null,
        processed_by:  null,
      }
    } else {
      return { error: `Status "${current.status}" não pode ser revertido` }
    }

    const { error } = await supabase.from('returns').update(update).eq('id', returnId)
    if (error) throw error

    revalidatePath('/admin/devolucoes')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
