'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { revalidatePath } from 'next/cache'
import type { ReturnStatus, ReturnDecision } from '@/types'

export interface AdminReturnRow {
  id:            string
  rv:            string
  status:        ReturnStatus
  decision:      ReturnDecision | null
  decidedByType: 'client' | 'auto' | null
  receivedAt:    string
  decidedAt:     string | null
  processedAt:   string | null
  depositorName: string | null
  operatorName:  string | null
  identifierType: string
  accessKey:      string | null
  postalCode:     string | null
  illegibleToken: string | null
  itemCount:      number
  invoiceXmlUrl:  string | null
  returnInvoiceXmlUrl: string | null
  boxPhotoUrls:   string[]
  itemPhotoUrls:  string[]
}

async function assertManager() {
  const user = await getCurrentUser()
  if (user.profile.role !== 'manager') throw new Error('Acesso negado')
}

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

    const pathsByReturn = new Map<string, { box: string[]; item: string[] }>()
    const allPaths: string[] = []
    for (const r of data ?? []) {
      const photos = r.return_photos as unknown as { photo_type: string; storage_path: string; position: number }[]
      const box  = (photos ?? []).filter((p) => p.photo_type === 'box').sort((a,b) => a.position-b.position).map((p) => p.storage_path)
      const item = (photos ?? []).filter((p) => p.photo_type === 'item').sort((a,b) => a.position-b.position).map((p) => p.storage_path)
      pathsByReturn.set(r.id, { box, item })
      allPaths.push(...box, ...item)
    }

    const signedMap = new Map<string, string>()
    if (allPaths.length > 0) {
      const { data: signed } = await supabase.storage
        .from('return-photos')
        .createSignedUrls(allPaths, 3600)
      for (const entry of signed ?? []) {
        if (entry.path && entry.signedUrl) signedMap.set(entry.path, entry.signedUrl)
      }
    }

    const rows: AdminReturnRow[] = (data ?? []).map((r) => {
      const photos = pathsByReturn.get(r.id) ?? { box: [], item: [] }
      return {
        id:              r.id,
        rv:              r.rv,
        status:          r.status as ReturnStatus,
        decision:        r.decision as ReturnDecision | null,
        decidedByType:   r.decided_by_type as 'client' | 'auto' | null,
        receivedAt:      r.received_at,
        decidedAt:       r.decided_at,
        processedAt:     r.processed_at,
        depositorName:   (r.depositors as unknown as { razao_social: string } | null)?.razao_social ?? null,
        operatorName:    (r.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
        identifierType:  r.identifier_type,
        accessKey:       r.access_key,
        postalCode:      r.postal_code,
        illegibleToken:  r.illegible_token,
        itemCount:       r.item_count,
        invoiceXmlUrl:   r.invoice_xml_url,
        returnInvoiceXmlUrl: r.return_invoice_xml_url,
        boxPhotoUrls:    photos.box.map((p) => signedMap.get(p) ?? '').filter(Boolean),
        itemPhotoUrls:   photos.item.map((p) => signedMap.get(p) ?? '').filter(Boolean),
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
