'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { lookupInvoice } from '@/lib/integrations/webmania'
import type { InvoiceData } from '@/lib/integrations/webmania'

export type { InvoiceData }

export async function lookupInvoiceAction(
  accessKey: string
): Promise<{ data: InvoiceData } | { error: string }> {
  if (!/^\d{44}$/.test(accessKey)) return { error: 'Chave de acesso inválida (44 dígitos)' }
  try {
    const data = await lookupInvoice(accessKey)
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao consultar NF' }
  }
}

interface CreateReturnPayload {
  identifierType:  'access_key' | 'postal_code' | 'illegible'
  accessKey:       string | null
  postalCode:      string | null
  illegibleToken:  string | null
  rv:              string
  itemCount:       number
  depositorId:     string | null
  invoiceXmlPath:  string | null
  boxPhotosPaths:  string[]
  itemPhotosPaths: string[]
}

export async function createReturnAction(
  payload: CreateReturnPayload
): Promise<{ returnId: string } | { error: string }> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'operator') return { error: 'Acesso negado' }

    const supabase = createClient()

    const { data: record, error: insertError } = await supabase
      .from('returns')
      .insert({
        identifier_type:  payload.identifierType,
        access_key:       payload.accessKey,
        postal_code:      payload.postalCode,
        illegible_token:  payload.illegibleToken,
        rv:               payload.rv,
        item_count:       payload.itemCount,
        depositor_id:     payload.depositorId,
        invoice_xml_url:  payload.invoiceXmlPath,
        received_by:      user.id,
      })
      .select('id')
      .single()

    if (insertError) return { error: insertError.message }

    const returnId = record.id

    const photos = [
      ...payload.boxPhotosPaths.map((path, i) => ({
        return_id:    returnId,
        photo_type:   'box' as const,
        storage_path: path,
        position:     i,
      })),
      ...payload.itemPhotosPaths.map((path, i) => ({
        return_id:    returnId,
        photo_type:   'item' as const,
        storage_path: path,
        position:     i,
      })),
    ]

    if (photos.length > 0) {
      const { error: photoError } = await supabase.from('return_photos').insert(photos)
      if (photoError) return { error: photoError.message }
    }

    return { returnId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
