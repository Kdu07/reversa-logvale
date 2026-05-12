'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import imageCompression from 'browser-image-compression'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WebcamCaptureProps {
  onCapture: (file: File) => void
  disabled?: boolean
}

export function WebcamCapture({ onCapture, disabled = false }: WebcamCaptureProps) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [ready, setReady]         = useState(false)

  useEffect(() => {
    async function startStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setError('Permissão de câmera negada. Autorize o acesso nas configurações do navegador.')
        } else {
          setError('Câmera não detectada ou não disponível.')
        }
      }
    }
    startStream()
    return () => streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || capturing || !ready) return
    setCapturing(true)
    try {
      const video  = videoRef.current
      const canvas = canvasRef.current
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0)

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas empty'))), 'image/jpeg', 0.92)
      )

      const raw        = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const compressed = await imageCompression(raw, {
        maxSizeMB:        0.5,
        maxWidthOrHeight: 1600,
        initialQuality:   0.85,
        useWebWorker:     true,
      })
      onCapture(new File([compressed], raw.name, { type: 'image/jpeg' }))
    } finally {
      setCapturing(false)
    }
  }, [onCapture, capturing, ready])

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onCanPlay={() => setReady(true)}
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
            Iniciando câmera...
          </div>
        )}
      </div>
      <Button
        type="button"
        onClick={capture}
        disabled={disabled || capturing || !ready}
        className={cn('w-full', 'bg-primary hover:bg-primary/90 text-primary-foreground')}
        size="lg"
      >
        {capturing ? 'Capturando...' : 'Capturar Foto'}
      </Button>
    </div>
  )
}
