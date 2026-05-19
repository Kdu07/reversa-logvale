'use client'

import { useState } from 'react'
import { exportHistoryAction } from '../actions'

export function ExportButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const result = await exportHistoryAction()
      if ('error' in result) {
        alert(result.error)
        return
      }
      const a    = document.createElement('a')
      a.href     = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.base64}`
      a.download = result.filename
      a.click()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="px-3 py-1.5 rounded-md border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
    >
      {loading ? 'Gerando...' : 'Exportar XLSX'}
    </button>
  )
}
