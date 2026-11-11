'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DECISION_META } from '@/lib/decisions'
import { formatDate, identifierLabel } from '@/lib/format'
import { submitDecisionAction } from '../actions'
import type { ReturnRow } from '../actions'
import type { ReturnDecision } from '@/types'

interface DecisionModalProps {
  row:       ReturnRow
  decision:  ReturnDecision
  onClose:   () => void
  onSuccess: () => void
}

// Reenvio não leva XML (segue com a mesma NF): os anexos são a etiqueta e a DANFE em PDF
const needsXml = (d: ReturnDecision) => d !== 'store_for_handling' && d !== 'reship'

const PDF_MAX_BYTES = 5 * 1024 * 1024 // mesmo teto do bucket reship-files

type ReshipKind = 'etiqueta' | 'danfe'

const RESHIP_FIELDS: { kind: ReshipKind; label: string; noun: string }[] = [
  { kind: 'etiqueta', label: 'Etiqueta de reenvio (PDF)', noun: 'A etiqueta' },
  { kind: 'danfe',    label: 'DANFE (PDF)',               noun: 'A DANFE' },
]

export function DecisionModal({ row, decision, onClose, onSuccess }: DecisionModalProps) {
  const router                        = useRouter()
  const [countdown, setCountdown]     = useState(2)
  const [xmlFile, setXmlFile]         = useState<File | null>(null)
  const [reshipFiles, setReshipFiles] = useState<Record<ReshipKind, File | null>>({ etiqueta: null, danfe: null })
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const inputRef                      = useRef<HTMLInputElement>(null)

  const meta = DECISION_META[decision]

  useEffect(() => {
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  const xmlRequired    = needsXml(decision)
  const isReship       = decision === 'reship'
  const canConfirm     = countdown === 0 && !isSubmitting
    && (!xmlRequired || xmlFile !== null)
    && (!isReship || (reshipFiles.etiqueta !== null && reshipFiles.danfe !== null))

  function handleReshipFile(kind: ReshipKind, noun: string, file: File | null) {
    setError(null)
    let accepted = file
    if (file && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError(`${noun} precisa ser um arquivo PDF.`)
      accepted = null
    } else if (file && file.size > PDF_MAX_BYTES) {
      setError(`${noun} excede o limite de 5 MB.`)
      accepted = null
    }
    setReshipFiles((prev) => ({ ...prev, [kind]: accepted }))
  }

  async function handleConfirm() {
    setError(null)
    setSubmitting(true)

    let xmlPath: string | null = null
    const reshipPaths: Record<ReshipKind, string | null> = { etiqueta: null, danfe: null }

    if (isReship) {
      const supabase = createClient()
      const ts       = Date.now()
      for (const { kind, noun } of RESHIP_FIELDS) {
        const file = reshipFiles[kind]
        if (!file) continue
        const path = `${row.id}/${ts}-${kind}.pdf`
        const { error: uploadError } = await supabase.storage
          .from('reship-files')
          .upload(path, file, { contentType: 'application/pdf' })
        if (uploadError) {
          setError(`Erro ao enviar ${noun.toLowerCase()}: ${uploadError.message}`)
          setSubmitting(false)
          return
        }
        reshipPaths[kind] = path
      }
    }

    if (xmlRequired && xmlFile) {
      const supabase = createClient()
      const path     = `decisions/${row.id}/${Date.now()}.xml`
      const { error: uploadError } = await supabase.storage
        .from('invoice-xmls')
        .upload(path, xmlFile, { contentType: 'text/xml' })
      if (uploadError) {
        setError(`Erro ao enviar XML: ${uploadError.message}`)
        setSubmitting(false)
        return
      }
      xmlPath = path
    }

    const result = await submitDecisionAction({
      returnId:             row.id,
      decision,
      returnInvoiceXmlPath: xmlPath,
      reshipLabelPath:      reshipPaths.etiqueta,
      reshipDanfePath:      reshipPaths.danfe,
    })

    if ('error' in result) {
      // Se o return já foi decidido por outra fonte (auto-decisão concorrente), fechar modal
      const alreadyDecided =
        result.error.toLowerCase().includes('0 rows') ||
        result.error.toLowerCase().includes('nenhum registro')
      if (alreadyDecided) {
        onClose()
        router.refresh()
        return
      }
      setError(result.error)
      setSubmitting(false)
      return
    }

    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Confirmar Decisão</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${meta.badge} text-sm font-semibold`}>
          {meta.label}
        </div>

        {meta.description && meta.descStyle && (
          <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${meta.descStyle}`}>
            {meta.description}
          </div>
        )}

        <p className="text-sm font-medium text-destructive">Esta decisão é irreversível.</p>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1">Resumo da Devolução</p>
          <p><span className="text-muted-foreground">Data:</span> {formatDate(row.receivedAt)}</p>
          <p><span className="text-muted-foreground">Itens:</span> {row.itemCount}</p>
          <p><span className="text-muted-foreground">Identificador:</span> <span className="font-mono text-xs break-all">{identifierLabel(row)}</span></p>
          {row.depositorName && (
            <p><span className="text-muted-foreground">Depositante:</span> {row.depositorName}</p>
          )}
          {row.finalCustomerName && (
            <p><span className="text-muted-foreground">Cliente final:</span> {row.finalCustomerName}</p>
          )}
        </div>

        {xmlRequired && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              XML da NF de Devolução <span className="text-destructive">*</span>
            </label>
            <input
              ref={inputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={(e) => setXmlFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white cursor-pointer"
            />
            {xmlFile && (
              <p className="text-xs text-muted-foreground">{xmlFile.name}</p>
            )}
          </div>
        )}

        {isReship && RESHIP_FIELDS.map(({ kind, label, noun }) => (
          <div key={kind} className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              {label} <span className="text-destructive">*</span>
            </label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => handleReshipFile(kind, noun, e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white cursor-pointer"
            />
            {reshipFiles[kind] && (
              <p className="text-xs text-muted-foreground">{reshipFiles[kind]?.name}</p>
            )}
          </div>
        ))}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSubmitting ? 'Confirmando...' : countdown > 0 ? `Confirmar (${countdown}s)` : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
