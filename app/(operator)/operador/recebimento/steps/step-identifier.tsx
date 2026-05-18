'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { useAudioFeedback } from '@/hooks/use-audio-feedback'
import { lookupInvoiceAction } from '../actions'
import type { InvoiceData } from '../actions'

type Mode = 'scanner_key' | 'manual_key' | 'scanner_postal' | 'manual_postal' | 'illegible_confirm'

interface StepIdentifierProps {
  onComplete: (params: {
    identifierType: 'access_key' | 'postal_code' | 'illegible'
    accessKey?:     string
    postalCode?:    string
    illegibleToken?: string
    invoiceData?:   InvoiceData | null
  }) => void
}

export function StepIdentifier({ onComplete }: StepIdentifierProps) {
  const [mode, setMode]       = useState<Mode>('scanner_key')
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [flash, setFlash]     = useState<'success' | 'error' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { beep } = useAudioFeedback()

  useEffect(() => {
    if (mode === 'manual_key' || mode === 'manual_postal') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    setInput('')
    setError(null)
  }, [mode])

  function triggerFlash(type: 'success' | 'error') {
    setFlash(type)
    beep(type)
    setTimeout(() => setFlash(null), 700)
  }

  const handleAccessKey = useCallback(async (key: string) => {
    if (!/^\d{44}$/.test(key)) {
      setError('Chave de acesso inválida. Deve ter exatamente 44 dígitos numéricos.')
      triggerFlash('error')
      return
    }
    setLoading(true)
    setError(null)
    const result = await lookupInvoiceAction(key)
    setLoading(false)
    if ('error' in result) {
      setError(`${result.error}. Você pode tentar Código Postal ou marcar como Ilegível.`)
      triggerFlash('error')
      return
    }
    triggerFlash('success')
    setTimeout(() => onComplete({ identifierType: 'access_key', accessKey: key, invoiceData: result.data }), 300)
  }, [onComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePostalCode = useCallback((code: string) => {
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 8) {
      setError('CEP inválido. Deve ter 8 dígitos.')
      triggerFlash('error')
      return
    }
    triggerFlash('success')
    setTimeout(() => onComplete({ identifierType: 'postal_code', postalCode: clean }), 300)
  }, [onComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  useBarcodeScanner({
    onScan: (value) => {
      if (mode === 'scanner_key') handleAccessKey(value)
      else if (mode === 'scanner_postal') handlePostalCode(value)
    },
    minLength: 8,
    enabled: mode === 'scanner_key' || mode === 'scanner_postal',
  })

  function handleManualKeySubmit() {
    handleAccessKey(input.trim())
  }

  function handleManualPostalSubmit() {
    handlePostalCode(input.trim())
  }

  function handleIllegible() {
    const token = `ILEG-${Date.now().toString(36).toUpperCase()}`
    triggerFlash('success')
    setTimeout(() => onComplete({ identifierType: 'illegible', illegibleToken: token }), 300)
  }

  return (
    <div className={cn(
      'space-y-6 rounded-xl p-1 transition-colors duration-500',
      flash === 'success' && 'bg-green-50',
      flash === 'error'   && 'bg-red-50',
    )}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary">Etapa 1 — Identificação da NF</h2>
        {mode === 'scanner_key' && (
          <p className="text-sm text-muted-foreground">Bipe a chave de acesso (44 dígitos) no leitor.</p>
        )}
        {mode === 'manual_key' && (
          <p className="text-sm text-muted-foreground">Digite a chave de acesso manualmente (44 dígitos).</p>
        )}
        {mode === 'scanner_postal' && (
          <p className="text-sm text-muted-foreground">Bipe o Código Postal (CEP).</p>
        )}
        {mode === 'manual_postal' && (
          <p className="text-sm text-muted-foreground">Digite o CEP (8 dígitos).</p>
        )}
        {mode === 'illegible_confirm' && (
          <p className="text-sm text-muted-foreground">NF ilegível — o recebimento será registrado sem vínculo de NF.</p>
        )}
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground animate-pulse">Consultando NF na Webmania...</div>
      )}

      {(mode === 'manual_key') && (
        <div className="space-y-3">
          <Label htmlFor="access-key">Chave de Acesso (44 dígitos)</Label>
          <Input
            id="access-key"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 44))}
            placeholder="00000000000000000000000000000000000000000000"
            maxLength={44}
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleManualKeySubmit()}
          />
          <Button
            type="button"
            onClick={handleManualKeySubmit}
            disabled={input.length !== 44 || loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Confirmar Chave
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode('scanner_key')} className="w-full">
            ← Voltar ao leitor
          </Button>
        </div>
      )}

      {(mode === 'manual_postal') && (
        <div className="space-y-3">
          <Label htmlFor="postal-code">CEP (8 dígitos)</Label>
          <Input
            id="postal-code"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="00000000"
            maxLength={8}
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleManualPostalSubmit()}
          />
          <Button
            type="button"
            onClick={handleManualPostalSubmit}
            disabled={input.replace(/\D/g, '').length !== 8}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Confirmar CEP
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode('scanner_postal')} className="w-full">
            ← Voltar ao leitor
          </Button>
        </div>
      )}

      {mode === 'illegible_confirm' && (
        <Button
          type="button"
          onClick={handleIllegible}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-base py-6"
        >
          Confirmar: NF Ilegível
        </Button>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {mode !== 'illegible_confirm' && (
        <div className="border-t pt-4 space-y-2">
          {(mode === 'scanner_key' || mode === 'manual_key') && (
            <>
              <Button
                type="button" variant="ghost" size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setMode(mode === 'scanner_key' ? 'manual_key' : 'scanner_key')}
              >
                {mode === 'scanner_key' ? 'Não consigo bipar — digitar à mão' : 'Usar leitor de barras'}
              </Button>
              <Button
                type="button" variant="ghost" size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setMode('scanner_postal')}
              >
                NF ilegível — usar Código Postal
              </Button>
            </>
          )}
          {(mode === 'scanner_postal' || mode === 'manual_postal') && (
            <>
              <Button
                type="button" variant="ghost" size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setMode(mode === 'scanner_postal' ? 'manual_postal' : 'scanner_postal')}
              >
                {mode === 'scanner_postal' ? 'Não consigo bipar — digitar CEP à mão' : 'Usar leitor de barras'}
              </Button>
              <Button
                type="button" variant="ghost" size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setMode('illegible_confirm')}
              >
                CEP também ilegível — marcar como ilegível
              </Button>
              <Button
                type="button" variant="ghost" size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setMode('scanner_key')}
              >
                ← Voltar para Chave de Acesso
              </Button>
            </>
          )}
        </div>
      )}

      {mode === 'illegible_confirm' && (
        <Button
          type="button" variant="ghost" size="sm"
          className="w-full"
          onClick={() => setMode('scanner_postal')}
        >
          ← Voltar para Código Postal
        </Button>
      )}

      {mode === 'scanner_key' && !loading && (
        <div className="text-center text-4xl text-primary/20 py-4 select-none">
          ▋ aguardando leitura...
        </div>
      )}

      {mode === 'scanner_postal' && !loading && (
        <div className="text-center text-4xl text-primary/20 py-4 select-none">
          ▋ aguardando leitura do CEP...
        </div>
      )}
    </div>
  )
}
