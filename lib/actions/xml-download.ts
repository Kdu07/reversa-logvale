'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserOrNull } from '@/lib/supabase/get-current-user'

const SIGNED_URL_TTL = 3600 // 1h

/**
 * Gera uma signed URL para um XML em `invoice-xmls` que força o download no
 * navegador — a opção `download` faz o storage responder com
 * `Content-Disposition: attachment`, então o arquivo cai direto na pasta de
 * Downloads do usuário (em vez de abrir inline). `filename` vira o nome salvo.
 *
 * Assina sob demanda (on-click), o que permite um nome de arquivo amigável por
 * arquivo — algo que o batch `createSignedUrls` (usado para fotos) não permite.
 * A guarda de auth é defesa em profundidade; a RLS do bucket já exige sessão.
 *
 * `bucket` cobre o XML (default `invoice-xmls`) e o DANFE (`invoice-pdfs`).
 */
export async function getXmlDownloadUrlAction(
  path:     string,
  filename: string,
  bucket:   string = 'invoice-xmls',
): Promise<string | null> {
  if (!path) return null
  if (!(await getCurrentUserOrNull())) return null

  const supabase = createClient()
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL, { download: filename })

  return data?.signedUrl ?? null
}
