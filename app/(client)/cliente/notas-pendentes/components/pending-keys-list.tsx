'use client'

import { PhotoThumbs } from '@/components/shared/photo-thumbs'
import { CopyButton } from '@/components/shared/copy-button'
import { DecisionPill } from '@/components/shared/decision-pill'
import { AccessKeyForm } from '../../components/access-key-form'
import { formatDate } from '@/lib/format'
import { Info } from 'lucide-react'
import type { PendingKeyRow } from '../actions'
import type { IdentifierType } from '@/types'

const IDENTIFIER_LABEL: Record<IdentifierType, string> = {
  access_key:     'Chave NF',
  postal_code:    'CEP',
  logistics_code: 'Cód. Logística Reversa',
  illegible:      'Ilegível',
}

function identifierValue(row: PendingKeyRow): string | null {
  if (row.identifierType === 'postal_code')    return row.postalCode
  if (row.identifierType === 'logistics_code') return row.logisticsCode
  return row.illegibleToken
}

function PendingKeyCard({ row }: { row: PendingKeyRow }) {
  const label = IDENTIFIER_LABEL[row.identifierType]
  const value = identifierValue(row)

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-elev-sm sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-mono text-sm font-semibold text-foreground">{row.rv}</p>
          <p className="flex items-center gap-1.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}:</span>
            <span className="font-mono text-foreground">{value ?? '—'}</span>
            {value && <CopyButton value={value} title={`Copiar ${label}`} />}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          Chave pendente
        </span>
      </header>

      <p className="mt-2 text-sm text-muted-foreground">
        Recebida em {formatDate(row.receivedAt)} · {row.itemCount} {row.itemCount === 1 ? 'item' : 'itens'}
        {row.depositorName     && <> · {row.depositorName}</>}
        {row.finalCustomerName && <> · Cliente: {row.finalCustomerName}</>}
      </p>

      {(row.boxPhotoUrls.length > 0 || row.itemPhotoUrls.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          {row.boxPhotoUrls.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Caixa</span>
              <PhotoThumbs urls={row.boxPhotoUrls} size="sm" maxVisible={3} />
            </div>
          )}
          {row.itemPhotoUrls.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Itens</span>
              <PhotoThumbs urls={row.itemPhotoUrls} size="sm" maxVisible={3} />
            </div>
          )}
        </div>
      )}

      <AccessKeyForm returnId={row.id} className="mt-4" />

      {row.status !== 'awaiting_decision' && row.decision && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Decidida como
          <DecisionPill decision={row.decision} />
          {row.decidedAt && <>em {formatDate(row.decidedAt)}</>}
          {row.decidedByType === 'auto' && <>(automático, após 72h)</>}
        </p>
      )}
    </article>
  )
}

interface PendingKeysSectionProps {
  title:       string
  description: string
  emptyText:   string
  rows:        PendingKeyRow[]
  truncated:   boolean
}

export function PendingKeysSection({ title, description, emptyText, rows, truncated }: PendingKeysSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {title}{' '}
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {rows.length}{truncated ? '+' : ''}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <>
          {truncated && (
            <p className="text-sm text-muted-foreground">
              Mostrando as 100 pendências mais antigas. Informe estas para ver as seguintes.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((row) => (
              <PendingKeyCard key={row.id} row={row} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
