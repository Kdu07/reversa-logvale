'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isSuperUser } from '@/lib/auth/super'
import { buildSignedUrlMap } from '@/lib/supabase/storage'
import { parseFinalCustomerName } from '@/lib/integrations/nfeio'
import type {
  IdentifierType, ReturnStatus, ReturnDecision, DecisionSource,
} from '@/types'

export interface PendingInvoiceRow {
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

type PendingResult = { rows: PendingInvoiceRow[]; truncated: boolean } | { error: string }

/** Teto da listagem — a fila é naturalmente curta, mas nada no schema garante isso. */
const MAX_ROWS = 100

export type UploadKind = 'xml' | 'pdf'

export type UploadInvoiceResult =
  | { ok: true; kind: UploadKind; finalCustomerName: string | null }
  | { error: string }

/** 5 MB — DANFEs ficam na casa das centenas de KB; XMLs, dezenas. */
const MAX_FILE_BYTES = 5 * 1024 * 1024

const BUCKET: Record<UploadKind, string> = {
  xml: 'invoice-xmls',
  pdf: 'invoice-pdfs',
}

const CONTENT_TYPE: Record<UploadKind, string> = {
  xml: 'application/xml',
  pdf: 'application/pdf',
}

type RawPhoto = { storage_path: string; photo_type: string; position: number }

function photoUrls(photos: RawPhoto[], type: 'box' | 'item', map: Map<string, string>): string[] {
  return photos
    .filter((p) => p.photo_type === type)
    .sort((a, b) => a.position - b.position)
    .map((p) => map.get(p.storage_path) ?? '')
    .filter(Boolean)
}

/** Detecta o tipo pelo nome do arquivo — o MIME enviado pelo browser é inconsistente entre SOs. */
function detectKind(fileName: string): UploadKind | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.xml')) return 'xml'
  if (lower.endsWith('.pdf')) return 'pdf'
  return null
}

/**
 * Devoluções do cliente que entraram sem NF.
 *
 * São as identificadas sem chave de acesso (Código de Logística Reversa, CEP
 * ou Ilegível): sem chave não há consulta NFEio, então nenhum documento fiscal
 * foi anexado no recebimento. A fila inclui devoluções já decididas de
 * propósito — a auto-decisão de 72h não regulariza a NF, e sem isso o item mais
 * atrasado seria justamente o que sumiria da lista.
 *
 * Ordenado do mais antigo para o mais recente: pendência velha é a mais urgente.
 */
export async function getPendingInvoicesAction(): Promise<PendingResult> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'client' && !isSuperUser(user)) return { error: 'Acesso negado' }

    const supabase = createClient()

    const { data: returns, error } = await supabase
      .from('returns')
      .select(
        `id, rv, identifier_type, postal_code, logistics_code, illegible_token,
         item_count, received_at, final_customer_name,
         status, decision, decided_at, decided_by_type,
         depositors!depositor_id(razao_social),
         return_photos(storage_path, photo_type, position)`,
      )
      .neq('identifier_type', 'access_key')
      .is('invoice_xml_url', null)
      .is('invoice_pdf_url', null)
      .order('received_at', { ascending: true })
      .limit(MAX_ROWS)

    if (error) return { error: error.message }

    const allReturns = returns ?? []
    const boxPaths:  string[] = []
    const itemPaths: string[] = []
    for (const r of allReturns) {
      for (const p of ((r.return_photos as RawPhoto[]) ?? [])) {
        if (p.photo_type === 'box')  boxPaths.push(p.storage_path)
        if (p.photo_type === 'item') itemPaths.push(p.storage_path)
      }
    }

    const [boxMap, itemMap] = await Promise.all([
      buildSignedUrlMap(supabase, 'box-photos',  boxPaths),
      buildSignedUrlMap(supabase, 'item-photos', itemPaths),
    ])

    const rows: PendingInvoiceRow[] = allReturns.map((r) => {
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
    })

    return { rows, truncated: rows.length === MAX_ROWS }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}

/** Contagem da fila, para o badge do menu lateral. Erro nunca quebra o layout: devolve 0. */
export async function countPendingInvoicesAction(): Promise<number> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'client' && !isSuperUser(user)) return 0

    const supabase = createClient()
    const { count } = await supabase
      .from('returns')
      .select('id', { count: 'exact', head: true })
      .neq('identifier_type', 'access_key')
      .is('invoice_xml_url', null)
      .is('invoice_pdf_url', null)

    return count ?? 0
  } catch {
    return 0
  }
}

/**
 * Anexa a NF (XML ou DANFE) enviada pelo cliente a uma devolução.
 *
 * Roda com o admin client de propósito, por três limites de RLS que se somam:
 * a policy `clients decide their returns` só autoriza UPDATE em
 * `awaiting_decision` (o item auto-decidido em 72h travaria), o bucket
 * `invoice-pdfs` não tem policy de insert para cliente, e a validação de tipo
 * e tamanho precisa acontecer no servidor. O vínculo cliente ↔ depositante é
 * verificado explicitamente abaixo, no lugar da RLS.
 */
export async function uploadInvoiceFileAction(formData: FormData): Promise<UploadInvoiceResult> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'client' && !isSuperUser(user)) return { error: 'Acesso negado' }

    const returnId = formData.get('returnId')
    const file     = formData.get('file')

    if (typeof returnId !== 'string' || !returnId) return { error: 'Devolução não informada.' }
    if (!(file instanceof File) || file.size === 0) return { error: 'Selecione um arquivo.' }

    const kind = detectKind(file.name)
    if (!kind) return { error: 'Formato não aceito. Envie o XML ou o PDF (DANFE) da NF.' }
    if (file.size > MAX_FILE_BYTES) {
      return { error: `Arquivo muito grande (máximo ${MAX_FILE_BYTES / 1024 / 1024} MB).` }
    }

    const admin = createAdminClient()

    const { data: ret, error: retError } = await admin
      .from('returns')
      .select('id, depositor_id, invoice_xml_url, invoice_pdf_url, final_customer_name')
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

    // Nunca sobrescrever um documento já existente (inclusive o que veio da NFEio).
    if (kind === 'xml' && ret.invoice_xml_url) return { error: 'Esta devolução já tem o XML da NF anexado.' }
    if (kind === 'pdf' && ret.invoice_pdf_url) return { error: 'Esta devolução já tem o DANFE anexado.' }

    const bytes = new Uint8Array(await file.arrayBuffer())

    // O nome enviado pelo usuário não entra no path — só o id da devolução.
    const path = `manual/${returnId}/${Date.now()}.${kind}`
    const { error: uploadError } = await admin.storage
      .from(BUCKET[kind])
      .upload(path, bytes, { contentType: CONTENT_TYPE[kind], upsert: false })

    if (uploadError) return { error: `Erro ao enviar o arquivo: ${uploadError.message}` }

    // O XML traz o destinatário; aproveita para preencher o cliente final quando
    // o recebimento ficou sem ele (sem chave de acesso, não havia de onde tirar).
    let finalCustomerName: string | null = null
    if (kind === 'xml' && !ret.final_customer_name) {
      finalCustomerName = parseFinalCustomerName(new TextDecoder().decode(bytes))
    }

    const patch: Record<string, unknown> = {
      invoice_uploaded_by: user.id,
      invoice_uploaded_at: new Date().toISOString(),
      ...(kind === 'xml' ? { invoice_xml_url: path } : { invoice_pdf_url: path }),
      ...(finalCustomerName ? { final_customer_name: finalCustomerName } : {}),
    }

    const { error: updateError } = await admin.from('returns').update(patch).eq('id', returnId)

    if (updateError) {
      // O arquivo já subiu mas a devolução não aponta para ele — remove o órfão.
      await admin.storage.from(BUCKET[kind]).remove([path])
      return { error: updateError.message }
    }

    revalidatePath('/cliente')
    revalidatePath('/cliente/historico')
    revalidatePath('/cliente/notas-pendentes')

    return { ok: true, kind, finalCustomerName }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
