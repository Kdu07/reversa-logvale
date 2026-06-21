'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  /** Valor completo a ser copiado para a área de transferência. */
  value:      string
  className?: string
  /** Texto do `title`/`aria-label` quando ocioso. Default: "Copiar". */
  title?:     string
}

/**
 * Botão de copiar valor para a área de transferência.
 *
 * Copia o `value` completo (independente do que estiver sendo exibido),
 * troca o ícone para um "check" por ~1,5s como feedback e impede que o clique
 * propague para handlers de linha (`stopPropagation`).
 */
export function CopyButton({ value, className, title = 'Copiar' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard indisponível — silencioso */
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? 'Copiado!' : title}
      aria-label={copied ? 'Copiado!' : title}
      className={cn(
        'inline-flex items-center gap-1 text-muted-foreground transition-colors ease-quint hover:text-foreground',
        copied && 'text-success',
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied && <span className="text-[10px] font-medium">Copiado!</span>}
    </button>
  )
}
