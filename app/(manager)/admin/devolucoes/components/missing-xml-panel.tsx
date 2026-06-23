'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChevronDown, ChevronUp, FileSearch, RefreshCw } from 'lucide-react'
import { retryMissingInvoiceXmlAction, type InvoiceFetchError } from '../actions'

interface Props {
  count: number
}

type Feedback = {
  tone: 'info' | 'success' | 'error'
  text: string
  errors?: InvoiceFetchError[]
}

export function MissingXmlPanel({ count }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [showLogs, setShowLogs] = useState(false)

  function handleRetry() {
    setFeedback(null)
    setShowLogs(false)
    startTransition(async () => {
      const result = await retryMissingInvoiceXmlAction()
      if ('error' in result) {
        setFeedback({ tone: 'error', text: result.error })
        return
      }
      if (result.disabled) {
        setFeedback({ tone: 'info', text: result.message })
        return
      }
      setFeedback({
        tone: result.failed > 0 ? 'info' : 'success',
        text: result.message,
        errors: result.errors,
      })
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileSearch className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Consulta de NF</p>
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{count}</span>{' '}
              NF(s) recebida(s) sem XML.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={pending || count === 0}
        >
          <RefreshCw className={`mr-2 h-4 w-4${pending ? ' animate-spin' : ''}`} />
          {pending ? 'Consultando…' : 'Tentar consultas novamente'}
        </Button>
      </div>

      {feedback && (
        <Alert
          variant={feedback.tone === 'error' ? 'destructive' : 'default'}
          className="mt-3"
        >
          <AlertDescription>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{feedback.text}</span>
              {feedback.errors && feedback.errors.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowLogs((v) => !v)}
                  className="inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline"
                >
                  {showLogs ? (
                    <>
                      Ver menos <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      Ver mais <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>

            {showLogs && feedback.errors && feedback.errors.length > 0 && (
              <ul className="mt-2 space-y-1 border-t pt-2 text-xs">
                {feedback.errors.map((e) => (
                  <li key={e.accessKey} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <span className="font-mono text-muted-foreground break-all">{e.accessKey}</span>
                    <span>— {e.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
