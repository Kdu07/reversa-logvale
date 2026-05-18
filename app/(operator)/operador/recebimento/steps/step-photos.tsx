'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { WebcamCapture } from '@/components/shared/webcam-capture'

interface StepPhotosProps {
  photoType:  'box' | 'item'
  stepNumber: number
  label:      string
  minPhotos:  number
  maxPhotos:  number
  photos:     File[]
  onAdd:      (file: File) => void
  onRemove:   (index: number) => void
  onNext:     () => void
  onBack:     () => void
}

export function StepPhotos({
  photoType,
  stepNumber,
  label,
  minPhotos,
  maxPhotos,
  photos,
  onAdd,
  onRemove,
  onNext,
  onBack,
}: StepPhotosProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f))
    setPreviewUrls(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [photos])

  const atMax  = photos.length >= maxPhotos
  const canNext = photos.length >= minPhotos

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary">Etapa {stepNumber} — {label}</h2>
        <p className="text-sm text-muted-foreground">
          Capture entre {minPhotos} e {maxPhotos} fotos.{' '}
          <span className="font-medium">{photos.length} de {maxPhotos} capturadas.</span>
        </p>
      </div>

      {!atMax && (
        <WebcamCapture onCapture={onAdd} disabled={atMax} />
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((_, i) => {
            const url = previewUrls[i] ?? ''
            return (
              <div key={i} className="relative group aspect-video rounded-lg overflow-hidden bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${photoType} photo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {atMax && (
        <p className="text-sm text-muted-foreground text-center">
          Máximo de {maxPhotos} fotos atingido. Remova uma para adicionar outra.
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Próximo {!canNext && `(mín. ${minPhotos})`}
        </Button>
      </div>
    </div>
  )
}
