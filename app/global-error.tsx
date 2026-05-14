'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', textAlign: 'center', padding: '0 16px', fontFamily: 'Arial, sans-serif' }}>
          <p style={{ fontSize: '18px', fontWeight: '600', color: '#18181b' }}>Algo deu errado.</p>
          <p style={{ fontSize: '14px', color: '#71717a' }}>O erro foi registrado e nossa equipe foi notificada.</p>
          <button
            onClick={reset}
            style={{ padding: '8px 20px', background: '#08366D', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
