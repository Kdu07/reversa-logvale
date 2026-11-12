'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { normalizeAccessKey } from '@/lib/access-key'
import { CheckCircle2 } from 'lucide-react'
import { informAccessKeyAction } from '../notas-pendentes/actions'

interface AccessKeyFormProps {
  returnId:   string
  /** Chamado após gravar — o card/modal decide se some da tela ou fecha. */
  onSuccess?: () => void
  className?: string
}

/** Agrupa de 4 em 4 só para leitura — o valor enviado é sempre só dígitos. */
function groupDigits(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function AccessKeyForm({ returnId, onSuccess, className }: AccessKeyFormProps) {
  const router                        = useRouter()
  const [digits, setDigits]           = useState('')
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [saved, setSaved]             = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (digits.length !== 44) return
    setError(null)
    setSubmitting(true)

    const result = await informAccessKeyAction(returnId, digits)

    if ('error' in result) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    setSaved(result.accessKey)
    setSubmitting(false)
    router.refresh()
    onSuccess?.()
  }

  if (saved) {
    return (
      <div className={cn('flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800', className)}>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-0.5 min-w-0">
          <p className="font-medium">Chave de acesso registrada.</p>
          <p className="font-mono text-xs break-all">{groupDigits(saved)}</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-2', className)}>
      <label htmlFor={`access-key-${returnId}`} className="text-xs font-medium text-muted-foreground">
        Chave de acesso da NF de origem
      </label>
      <input
        id={`access-key-${returnId}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="44 dígitos"
        value={groupDigits(digits)}
        onChange={(e) => {
          setError(null)
          setDigits(normalizeAccessKey(e.target.value).slice(0, 44))
        }}
        disabled={isSubmitting}
        className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('text-xs', digits.length === 44 ? 'text-green-700' : 'text-muted-foreground')}>
          {digits.length}/44 dígitos
        </span>
        <Button type="submit" size="sm" disabled={digits.length !== 44 || isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar chave'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}
