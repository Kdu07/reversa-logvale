'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { CheckCircle2, FileText, Upload, X } from 'lucide-react'
import { uploadInvoiceFileAction } from '../notas-pendentes/actions'

interface InvoiceUploadFormProps {
  returnId: string
  /** Chamado após o upload concluir — o card/modal decide se some da tela ou fecha. */
  onSuccess?: () => void
  className?: string
}

const ACCEPT = '.xml,.pdf,text/xml,application/xml,application/pdf'

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function InvoiceUploadForm({ returnId, onSuccess, className }: InvoiceUploadFormProps) {
  const router                        = useRouter()
  const inputRef                      = useRef<HTMLInputElement>(null)
  const [file, setFile]               = useState<File | null>(null)
  const [dragging, setDragging]       = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState<{ kind: 'xml' | 'pdf'; finalCustomerName: string | null } | null>(null)

  function selectFile(next: File | null) {
    setError(null)
    setFile(next)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    selectFile(e.dataTransfer.files?.[0] ?? null)
  }

  async function handleSubmit() {
    if (!file) return
    setError(null)
    setSubmitting(true)

    const formData = new FormData()
    formData.set('returnId', returnId)
    formData.set('file', file)

    const result = await uploadInvoiceFileAction(formData)

    if ('error' in result) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    setSuccess({ kind: result.kind, finalCustomerName: result.finalCustomerName })
    setSubmitting(false)
    router.refresh()
    onSuccess?.()
  }

  if (success) {
    return (
      <div className={cn('flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800', className)}>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-0.5">
          <p className="font-medium">
            {success.kind === 'xml' ? 'XML da NF anexado.' : 'DANFE anexado.'}
          </p>
          {success.finalCustomerName && (
            <p className="text-xs">Cliente final identificado: {success.finalCustomerName}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <button
        type="button"
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ease-quint focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
        )}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          Arraste o XML ou o PDF da NF aqui
        </p>
        <p className="text-xs text-muted-foreground">ou clique para selecionar — máximo 5 MB</p>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
      />

      {file && (
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{fileSizeLabel(file.size)}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); selectFile(null) }}
            disabled={isSubmitting}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            aria-label="Remover arquivo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!file || isSubmitting}
        className="w-full sm:w-auto"
        size="sm"
      >
        {isSubmitting ? 'Enviando…' : 'Anexar NF'}
      </Button>
    </div>
  )
}
