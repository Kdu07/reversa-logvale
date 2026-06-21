'use client'

import { useState } from 'react'
import { getXmlDownloadUrlAction } from '@/lib/actions/xml-download'

interface DownloadXmlButtonProps {
  /** Caminho do arquivo no bucket (relativo ao bucket). */
  path:          string
  /** Nome com que o arquivo será salvo (ver `xmlDownloadName`/`danfeDownloadName`). */
  filename:      string
  /** Bucket de origem: `invoice-xmls` (default) ou `invoice-pdfs`. */
  bucket?:       string
  label?:        string
  loadingLabel?: string
  className?:    string
}

/**
 * Baixa um XML do bucket `invoice-xmls` direto para a pasta de Downloads.
 *
 * Assina a URL on-click via `getXmlDownloadUrlAction` (que injeta
 * `Content-Disposition: attachment`) e dispara o download por uma âncora
 * temporária — sem navegar para fora da página nem abrir aba. O atributo HTML
 * `download` não é usado de propósito: ele é ignorado em URLs cross-origin
 * (signed URL fica em *.supabase.co), então quem força o download é o header.
 */
export function DownloadXmlButton({
  path,
  filename,
  bucket,
  label        = 'Baixar XML',
  loadingLabel = 'Baixando…',
  className,
}: DownloadXmlButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const url = await getXmlDownloadUrlAction(path, filename, bucket)
    setLoading(false)
    if (!url) return

    const a = document.createElement('a')
    a.href = url
    a.rel  = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading} className={className}>
      {loading ? loadingLabel : label}
    </button>
  )
}
