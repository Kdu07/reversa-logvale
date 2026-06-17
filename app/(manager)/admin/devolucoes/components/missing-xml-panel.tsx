'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileSearch, RefreshCw } from 'lucide-react'
import { retryMissingInvoiceXmlAction } from '../actions'

interface Props {
  count: number
}

type Feedback = { tone: 'info' | 'success' | 'error'; text: string }

export function MissingXmlPanel({ count }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  function handleRetry() {
    setFeedback(null)
    startTransition(async () => {
      const result = await retryMissingInvoiceXmlAction()
      if ('error' in result) {
        setFeedback({ tone: 'error', text: result.error })
        return
      }
      if (result.notImplemented) {
        setFeedback({ tone: 'info', text: result.message })
        return
      }
      setFeedback({ tone: 'success', text: result.message })
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
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
