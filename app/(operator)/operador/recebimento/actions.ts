'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isSuperUser } from '@/lib/auth/super'
import { lookupInvoice } from '@/lib/integrations/webmania'
import type { InvoiceData } from '@/lib/integrations/webmania'
import type { IdentifierType } from '@/types'

export type { InvoiceData }

export interface DepositorOption {
  id:          string
  razao_social: string
  cnpj:        string
}

export async function getDepositorsAction(): Promise<
  { data: DepositorOption[] } | { error: string }
> {
  try {
    await getCurrentUser()
    const supabase = createClient()
    const { data, error } = await supabase
      .from('depositors')
      .select('id, razao_social, cnpj')
      .eq('active', true)
      .order('razao_social')
    if (error) return { error: error.message }
    return { data: (data ?? []) as DepositorOption[] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao buscar depositantes' }
  }
}

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
  identifierType:  IdentifierType
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
    if (user.profile.role !== 'operator' && !isSuperUser(user)) return { error: 'Acesso negado' }

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
