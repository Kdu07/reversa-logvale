'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { useAudioFeedback } from '@/hooks/use-audio-feedback'
import { lookupInvoiceAction, getDepositorsAction } from '../actions'
import type { InvoiceData, DepositorOption } from '../actions'
import { invoiceFetchReasonLabel } from '@/lib/integrations/invoice-fetch-reason'

type Mode = 'scanner_key' | 'manual_key' | 'scanner_postal' | 'manual_postal' | 'illegible_confirm' | 'depositor_picker'

interface PendingComplete {
  identifierType:  'access_key' | 'postal_code' | 'illegible'
  accessKey?:      string
  postalCode?:     string
  illegibleToken?: string
  invoiceData?:    InvoiceData | null
}

interface StepIdentifierProps {
  onComplete: (params: PendingComplete & {
    depositorId?:   string | null
    depositorName?: string | null
  }) => void
}

function formatCnpj(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function StepIdentifier({ onComplete }: StepIdentifierProps) {
  const [mode, setMode]       = useState<Mode>('scanner_key')
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [flash, setFlash]     = useState<'success' | 'error' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { beep } = useAudioFeedback()

  // Depositor picker state
  const [pendingComplete, setPendingComplete]         = useState<PendingComplete | null>(null)
  const [depositors, setDepositors]                   = useState<DepositorOption[]>([])
  const [depositorsLoading, setDepositorsLoading]     = useState(false)
  const [selectedDepositorId, setSelectedDepositorId] = useState('')
  const [selectedDepositorName, setSelectedDepositorName] = useState('')

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

  async function enterDepositorPicker(params: PendingComplete) {
    setPendingComplete(params)
    // Pré-seleciona o depositante sugerido pela NF (quando houver), permitindo override manual
    setSelectedDepositorId(params.invoiceData?.depositorId ?? '')
    setSelectedDepositorName(params.invoiceData?.depositorName ?? '')
    setMode('depositor_picker')
    setDepositorsLoading(true)
    const result = await getDepositorsAction()
    setDepositorsLoading(false)
    if ('data' in result) setDepositors(result.data)
  }

  function handleDepositorProceed() {
    if (!pendingComplete) return
    onComplete({
      ...pendingComplete,
      depositorId:   selectedDepositorId   || null,
      depositorName: selectedDepositorName || null,
    })
  }

  function handleDepositorBack() {
    if (!pendingComplete) { setMode('scanner_key'); return }
    if (pendingComplete.identifierType === 'postal_code') setMode('scanner_postal')
    else if (pendingComplete.identifierType === 'illegible') setMode('illegible_confirm')
    else setMode('scanner_key')
    setPendingComplete(null)
    setSelectedDepositorId('')
    setSelectedDepositorName('')
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
    // Sempre abre o seletor de depositante: confirma o sugerido pela NF ou permite trocar manualmente
    setTimeout(() => enterDepositorPicker({ identifierType: 'access_key', accessKey: key, invoiceData: result.data }), 300)
  }, [onComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePostalCode = useCallback((code: string) => {
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 8) {
      setError('CEP inválido. Deve ter 8 dígitos.')
      triggerFlash('error')
      return
    }
    triggerFlash('success')
    setTimeout(() => enterDepositorPicker({ identifierType: 'postal_code', postalCode: clean }), 300)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleIllegible() {
    const token = `ILEG-${Date.now().toString(36).toUpperCase()}`
    triggerFlash('success')
    setTimeout(() => enterDepositorPicker({ identifierType: 'illegible', illegibleToken: token }), 300)
  }

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
        {mode === 'depositor_picker' && (
          <p className="text-sm text-muted-foreground">Confirme o depositante sugerido pela NF ou selecione manualmente.</p>
        )}
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground animate-pulse">Identificando NF...</div>
      )}

      {/* Depositor picker */}
      {mode === 'depositor_picker' && pendingComplete && (
        <div className="space-y-4">
          {pendingComplete.invoiceData?.depositorId && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              Depositante sugerido pela NF (CNPJ {formatCnpj(pendingComplete.invoiceData.emitterCnpj)}). Confirme ou troque abaixo.
            </p>
          )}
          {pendingComplete.invoiceData && !pendingComplete.invoiceData.depositorId && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              CNPJ {formatCnpj(pendingComplete.invoiceData.emitterCnpj)} não está cadastrado no sistema.
            </p>
          )}
          {pendingComplete.identifierType === 'access_key' &&
            pendingComplete.invoiceData &&
            !pendingComplete.invoiceData.xmlFetched && (
              <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-800 [&>svg]:text-amber-600">
                <AlertDescription>
                  NF identificada pelo CNPJ, mas a NFEio não retornou o XML/DANFE
                  ({invoiceFetchReasonLabel(pendingComplete.invoiceData.invoiceFetchReason)}). A
                  devolução será registrada sem o arquivo — é possível recuperá-lo depois no painel
                  de devoluções.
                </AlertDescription>
              </Alert>
            )}

          {depositorsLoading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Carregando depositantes...</p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="depositor-select">Depositante</Label>
              <select
                id="depositor-select"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                value={selectedDepositorId}
                onChange={(e) => {
                  const dep = depositors.find((d) => d.id === e.target.value)
                  setSelectedDepositorId(e.target.value)
                  setSelectedDepositorName(dep?.razao_social ?? '')
                }}
              >
                <option value="">— Nenhum depositante —</option>
                {depositors.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.razao_social} ({formatCnpj(dep.cnpj)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            type="button"
            onClick={handleDepositorProceed}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {selectedDepositorId ? 'Vincular e Avançar' : 'Avançar sem Depositante'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDepositorBack}
            className="w-full"
          >
            ← Voltar
          </Button>
        </div>
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

      {mode !== 'illegible_confirm' && mode !== 'depositor_picker' && (
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
