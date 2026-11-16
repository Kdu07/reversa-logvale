'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/format'
import { getReturnEditsAction, type ReturnEditEntry } from '@/lib/actions/edit-return'

/** Histórico de edições (return_edits) mostrado nos detalhes da devolução. */
export function ReturnEditHistory({ returnId }: { returnId: string }) {
  const [entries, setEntries] = useState<ReturnEditEntry[] | null>(null)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setEntries(null)
    setError(null)
    getReturnEditsAction(returnId).then((res) => {
      if (!alive) return
      if ('error' in res) setError(res.error)
      else setEntries(res.entries)
    })
    return () => { alive = false }
  }, [returnId])

  // Sem edições não ocupa espaço no modal.
  if (error || !entries || entries.length === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Histórico de edições</p>
      <ol className="space-y-3">
        {entries.map((e) => (
          <li key={e.id} className="rounded-md border border-border p-3 text-xs space-y-1.5">
            <p className="text-muted-foreground">
              {formatDate(e.editedAt)} · <span className="font-medium text-foreground">{e.editorName ?? '—'}</span>
            </p>
            <ul className="space-y-1">
              {e.changes.map((c, i) => (
                <li key={i} className="break-words">
                  <span className="font-medium">{c.label}:</span>{' '}
                  <span className="text-muted-foreground line-through">{c.from}</span>{' → '}
                  <span>{c.to}</span>
                </li>
              ))}
              {e.deadlineRestarted && (
                <li className="text-info">Prazo de 72h reiniciado na edição.</li>
              )}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
