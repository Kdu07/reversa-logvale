'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertManager } from '@/lib/supabase/assert-role'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isSuperUser } from '@/lib/auth/super'
import { buildSignedUrlMap } from '@/lib/supabase/storage'
import { persistInvoiceFiles } from '@/lib/integrations/nfeio'
import { invoiceFetchReasonLabel } from '@/lib/integrations/invoice-fetch-reason'
import { env } from '@/lib/env'
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
  illegibleToken:      string | null
  itemCount:           number
  invoiceXmlPath:       string | null
  invoicePdfPath:       string | null
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
         invoice_xml_url, invoice_pdf_url, return_invoice_xml_url, final_customer_name,
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
        illegibleToken:      r.illegible_token,
        itemCount:           r.item_count,
        invoiceXmlPath:       r.invoice_xml_url        ?? null,
        invoicePdfPath:       r.invoice_pdf_url        ?? null,
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

// =====================================================================
// Retry de consulta de NF — buscar XMLs faltantes (restrito ao super)
// =====================================================================

/** Log de uma chave de acesso que falhou na consulta — exibido no painel ("Ver mais"). */
export interface InvoiceFetchError {
  accessKey: string
  message:   string
}

export interface RetryInvoiceFetchResult {
  pending:  number
  fetched:  number
  failed:   number
  disabled: boolean
  message:  string
  errors:   InvoiceFetchError[]
}

export async function getMissingInvoiceXmlCountAction(): Promise<
  { count: number } | { error: string }
> {
  try {
    if (!isSuperUser(await getCurrentUser())) return { error: 'Acesso negado' }
    const supabase = createClient()
    const { count, error } = await supabase
      .from('returns')
      .select('id', { count: 'exact', head: true })
      .eq('identifier_type', 'access_key')
      .is('invoice_xml_url', null)
    if (error) throw error
    return { count: count ?? 0 }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

export async function retryMissingInvoiceXmlAction(): Promise<
  RetryInvoiceFetchResult | { error: string }
> {
  try {
    if (!isSuperUser(await getCurrentUser())) return { error: 'Acesso negado' }

    // Integração desligada (sem NFEIO_ACCESS_KEY): não há o que buscar
    if (!env.nfeioEnabled) {
      return { pending: 0, fetched: 0, failed: 0, disabled: true, message: 'Integração NFEio desativada (NFEIO_ACCESS_KEY ausente).', errors: [] }
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('returns')
      .select('access_key')
      .eq('identifier_type', 'access_key')
      .is('invoice_xml_url', null)
    if (error) throw error

    // O XML/DANFE é por NF (chave de acesso), não por devolução — busca cada chave uma vez
    const keys = Array.from(
      new Set((data ?? []).map((r) => r.access_key).filter((k): k is string => !!k)),
    )

    if (keys.length === 0) {
      return { pending: 0, fetched: 0, failed: 0, disabled: false, message: 'Nenhuma NF pendente de XML.', errors: [] }
    }

    let fetched = 0
    let failed  = 0
    const errors: InvoiceFetchError[] = []

    for (const accessKey of keys) {
      // persistInvoiceFiles baixa XML + DANFE, faz upload (upsert) nos buckets
      // e extrai o nome do cliente final (destinatário) do XML
      const { xmlPath, pdfPath, finalCustomerName, xmlReason } = await persistInvoiceFiles(accessKey)

      if (!xmlPath) {
        failed++
        errors.push({ accessKey, message: invoiceFetchReasonLabel(xmlReason) })
        continue
      }

      const { error: updateErr } = await supabase
        .from('returns')
        .update({ invoice_xml_url: xmlPath, invoice_pdf_url: pdfPath, final_customer_name: finalCustomerName })
        .eq('identifier_type', 'access_key')
        .eq('access_key', accessKey)
        .is('invoice_xml_url', null)
      if (updateErr) {
        failed++
        errors.push({ accessKey, message: `falha ao gravar no banco: ${updateErr.message}` })
        continue
      }

      fetched++
    }

    revalidatePath('/admin/devolucoes')
    return {
      pending:  keys.length,
      fetched,
      failed,
      disabled: false,
      message:  `${fetched} XML(s) baixado(s), ${failed} falha(s) de ${keys.length} NF(s) pendente(s).`,
      errors,
    }
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
      .select('return_invoice_xml_url, return_photos(storage_path, photo_type)')
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
    await Promise.all(removals)

    const { error } = await supabase.from('returns').delete().eq('id', returnId)
    if (error) throw error

    revalidatePath('/admin/devolucoes')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
