'use client'

import { useState, useTransition } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ptBR } from '@/lib/i18n/pt-BR'
import type { PeriodInput } from '@/lib/reports/period'
import type { ReturnStatus } from '@/types'
import { generateReturnsReportAction, type ReportDepositorOption } from '../actions'

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

type Mode = 'month' | 'last_90d' | 'custom'

const MODE_LABELS: Record<Mode, string> = {
  month:    'Mês de referência',
  last_90d: 'Últimos 90 dias',
  custom:   'Intervalo personalizado',
}

const STATUSES: ReturnStatus[] = ['awaiting_decision', 'decided', 'processed']

interface Props {
  depositors:        ReportDepositorOption[]
  /** Mês anterior ("2026-07"), calculado no servidor para o padrão do form. */
  defaultMonth:      string
  /** Hoje em São Paulo ("2026-08-04"), teto dos campos de data. */
  today:             string
}

type Feedback = { tone: 'info' | 'success' | 'error'; text: string }

export function ReportForm({ depositors, defaultMonth, today }: Props) {
  const [mode,        setMode]        = useState<Mode>('month')
  const [month,       setMonth]       = useState(defaultMonth)
  const [from,        setFrom]        = useState(defaultMonth ? `${defaultMonth}-01` : today)
  const [to,          setTo]          = useState(today)
  const [depositorId, setDepositorId] = useState('all')
  const [status,      setStatus]      = useState('all')
  const [feedback,    setFeedback]    = useState<Feedback | null>(null)
  const [pending, startTransition]    = useTransition()

  function buildPeriod(): PeriodInput | null {
    if (mode === 'last_90d') return { kind: 'preset', preset: 'last_90d' }
    if (mode === 'custom') {
      if (!from || !to) {
        setFeedback({ tone: 'error', text: 'Informe a data inicial e a final.' })
        return null
      }
      return { kind: 'custom', from, to }
    }
    const [year, m] = month.split('-').map(Number)
    if (!year || !m) {
      setFeedback({ tone: 'error', text: 'Selecione o mês de referência.' })
      return null
    }
    return { kind: 'month', year, month: m }
  }

  function handleGenerate() {
    setFeedback(null)
    const period = buildPeriod()
    if (!period) return

    startTransition(async () => {
      const result = await generateReturnsReportAction({
        period,
        depositorId: depositorId === 'all' ? undefined : depositorId,
        status:      status === 'all' ? undefined : (status as ReturnStatus),
      })

      if ('error' in result) {
        setFeedback({ tone: 'error', text: result.error })
        return
      }
      if ('empty' in result) {
        setFeedback({ tone: 'info', text: result.message })
        return
      }

      const a    = document.createElement('a')
      a.href     = `data:${XLSX_MIME};base64,${result.base64}`
      a.download = result.filename
      a.click()

      setFeedback({
        tone: 'success',
        text: `${result.rowCount} devolução(ões) exportada(s) em ${result.filename}.`,
      })
    })
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2.5">
        <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Relatório de devoluções (XLSX)</p>
          <p className="text-muted-foreground">
            Resumo, detalhamento e consolidado por depositante. As devoluções entram pela
            <span className="font-medium text-foreground"> data de recebimento</span>.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="report-mode">Período</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger id="report-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODE_LABELS) as Mode[]).map((key) => (
                <SelectItem key={key} value={key}>{MODE_LABELS[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === 'month' && (
          <div className="space-y-1.5">
            <Label htmlFor="report-month">Mês</Label>
            <Input
              id="report-month"
              type="month"
              value={month}
              max={today.slice(0, 7)}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
        )}

        {mode === 'custom' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="report-from">De</Label>
              <Input
                id="report-from"
                type="date"
                value={from}
                max={to || today}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-to">Até</Label>
              <Input
                id="report-to"
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="report-depositor">Depositante</Label>
          <Select value={depositorId} onValueChange={setDepositorId}>
            <SelectTrigger id="report-depositor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os depositantes</SelectItem>
              {depositors.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="report-status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="report-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{ptBR.returnStatus[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleGenerate} disabled={pending}>
          <Download className={`mr-2 h-4 w-4${pending ? ' animate-pulse' : ''}`} />
          {pending ? 'Gerando…' : 'Gerar relatório'}
        </Button>
        {mode === 'month' && (
          <span className="text-xs text-muted-foreground">
            O padrão é o mês anterior — o do fechamento.
          </span>
        )}
      </div>

      {feedback && (
        <Alert variant={feedback.tone === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
