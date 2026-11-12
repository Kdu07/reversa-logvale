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
  finalCustomerName:   string | null
  identifierType:      IdentifierType
  accessKey:           string | null
  postalCode:          string | null
  logisticsCode:       string | null
  illegibleToken:      string | null
  itemCount:           number
  /** Estado no recebimento: null = não avaliado, 0 = Bom, >0 = itens avariados. */
  damagedItemCount: number | null
  returnInvoiceXmlPath: string | null
  /** Etiqueta da decisão Reenvio (PDF em `reship-files`). */
  reshipLabelPath:      string | null
  /** DANFE anexada no Reenvio (PDF em `reship-files`). */
  reshipDanfePath:      string | null
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
         identifier_type, access_key, postal_code, logistics_code, illegible_token, item_count, damaged_item_count,
         return_invoice_xml_url, reship_label_url, reship_danfe_url, final_customer_name,
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
        finalCustomerName:   r.final_customer_name ?? null,
        identifierType:      r.identifier_type as IdentifierType,
        accessKey:           r.access_key,
        postalCode:          r.postal_code,
        logisticsCode:       r.logistics_code,
        illegibleToken:      r.illegible_token,
        itemCount:           r.item_count,
        damagedItemCount: r.damaged_item_count ?? null,
        returnInvoiceXmlPath: r.return_invoice_xml_url ?? null,
        reshipLabelPath:      r.reship_label_url       ?? null,
        reshipDanfePath:      r.reship_danfe_url       ?? null,
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
        reship_label_url:       null,
        reship_danfe_url:       null,
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

// =====================================================================
// Remoção definitiva de devolução (restrita ao gerente)
// =====================================================================

export async function deleteReturnAction(
  returnId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await assertManager()
    const supabase = createClient()

    // Carrega fotos + XML de devolução para limpar o storage. As linhas de
    // return_photos somem por FK cascade; os arquivos no storage, não.
    const { data: ret, error: fetchErr } = await supabase
      .from('returns')
      .select('return_invoice_xml_url, reship_label_url, reship_danfe_url, return_photos(storage_path, photo_type)')
      .eq('id', returnId)
      .single()
    if (fetchErr) throw fetchErr

    const photos    = (ret.return_photos as { storage_path: string; photo_type: string }[]) ?? []
    const boxPaths  = photos.filter((p) => p.photo_type === 'box').map((p)  => p.storage_path)
    const itemPaths = photos.filter((p) => p.photo_type === 'item').map((p) => p.storage_path)
    const returnXml = ret.return_invoice_xml_url as string | null

    // Best-effort: remove os arquivos por-devolução. NÃO removemos
    // invoice_xml_url/invoice_pdf_url (`ak/<chave>.{xml,pdf}`), que são
    // compartilhados por NF entre devoluções. Falha aqui não bloqueia o delete
    // (o job photo-cleanup recolhe órfãos depois).
    const removals: Promise<unknown>[] = []
    if (boxPaths.length)  removals.push(supabase.storage.from('box-photos').remove(boxPaths))
    if (itemPaths.length) removals.push(supabase.storage.from('item-photos').remove(itemPaths))
    if (returnXml?.startsWith('decisions/')) {
      removals.push(supabase.storage.from('invoice-xmls').remove([returnXml]))
    }
    const reshipFiles = [ret.reship_label_url, ret.reship_danfe_url].filter(Boolean) as string[]
    if (reshipFiles.length) {
      removals.push(supabase.storage.from('reship-files').remove(reshipFiles))
    }
    await Promise.all(removals)

    const { error } = await supabase.from('returns').delete().eq('id', returnId)
    if (error) throw error

    revalidatePath('/admin/devolucoes')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
