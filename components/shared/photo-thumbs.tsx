'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ImageIcon } from 'lucide-react'

interface PhotoThumbsProps {
  urls?: string[]
  photos?: string[]
  onOpen?: (index: number) => void
  size?: 'sm' | 'md'
  maxVisible?: number
  max?: number
  emptyText?: string | null
  className?: string
}

export function PhotoThumbs({
  urls,
  photos,
  onOpen,
  size = 'md',
  maxVisible,
  max = 3,
  emptyText = null,
  className,
}: PhotoThumbsProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const allUrls = photos ?? urls ?? []
  const effectiveMax = maxVisible ?? max
  const visible = allUrls.slice(0, effectiveMax)
  const extra = allUrls.length - visible.length
  const dim = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10'

  if (allUrls.length === 0) {
    return emptyText
      ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" />{emptyText}</span>
      : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> sem fotos</span>
  }

  const handleOpen = (i: number) => {
    if (onOpen) onOpen(i)
    else setOpenIndex(i)
  }

  return (
    <>
      <div className={cn('flex -space-x-2', className)}>
        {visible.map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => handleOpen(i)}
            className={cn(dim, 'relative overflow-hidden rounded-md border-2 border-card bg-muted ring-1 ring-border transition hover:z-10 hover:scale-110 ease-quint focus:outline-none')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
        {extra > 0 && (
          <button
            type="button"
            onClick={() => handleOpen(visible.length)}
            className={cn(dim, 'z-10 inline-flex items-center justify-center rounded-md border-2 border-card bg-muted text-xs font-medium text-foreground ring-1 ring-border')}
          >
            +{extra}
          </button>
        )}
      </div>

      {!onOpen && (
        <Dialog open={openIndex !== null} onOpenChange={(o) => !o && setOpenIndex(null)}>
          <DialogContent className="max-w-3xl overflow-hidden p-0">
            <DialogTitle className="sr-only">Galeria de fotos</DialogTitle>
            <div className="grid gap-2 bg-muted p-2 sm:grid-cols-2">
              {allUrls.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src + i} src={src} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-md object-cover" />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
