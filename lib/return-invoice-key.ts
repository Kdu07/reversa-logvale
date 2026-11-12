import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseNfeAccessKey } from '@/lib/nfe-xml'

/** Bucket onde o cliente envia o XML da NF de devolução (DecisionModal). */
const RETURN_XML_BUCKET = 'invoice-xmls'

/** Downloads simultâneos no preenchimento retroativo. */
const CONCURRENCY = 8

/** Lê a chave da NF de devolução direto do XML no storage. Falha → `null`, nunca lança. */
export async function readReturnInvoiceKey(
  supabase: Pick<SupabaseClient, 'storage'>,
  path:     string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(RETURN_XML_BUCKET).download(path)
    if (error || !data) return null
    return parseNfeAccessKey(await data.text())
  } catch {
    return null
  }
}

export interface ReturnInvoiceRef {
  id:                   string
  returnInvoiceXmlPath: string | null
  returnInvoiceKey:     string | null
}

/**
 * Chave da NF de devolução de cada devolução, para os relatórios.
 *
 * Desde a migration 018 a chave é gravada na decisão (`return_invoice_key`).
 * As decididas antes disso só têm o XML: aqui a chave é lida do arquivo e
 * gravada de volta — o preenchimento retroativo acontece uma vez só, na
 * primeira emissão que incluir a devolução. Roda no admin client porque o
 * cliente não tem UPDATE em devolução já decidida; quem chama já filtrou as
 * linhas que o usuário pode ver.
 */
export async function resolveReturnInvoiceKeys(rows: ReturnInvoiceRef[]): Promise<Map<string, string | null>> {
  const result  = new Map<string, string | null>()
  const missing: ReturnInvoiceRef[] = []

  for (const row of rows) {
    if (row.returnInvoiceKey)          result.set(row.id, row.returnInvoiceKey)
    else if (row.returnInvoiceXmlPath) missing.push(row)
    else                               result.set(row.id, null)
  }
  if (missing.length === 0) return result

  const admin = createAdminClient()
  let next = 0
  async function worker() {
    while (next < missing.length) {
      const row = missing[next++]
      const key = await readReturnInvoiceKey(admin, row.returnInvoiceXmlPath as string)
      result.set(row.id, key)
      if (key) {
        // Best-effort: se a gravação falhar, a próxima emissão tenta de novo
        await admin.from('returns').update({ return_invoice_key: key }).eq('id', row.id)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, missing.length) }, worker))

  return result
}
