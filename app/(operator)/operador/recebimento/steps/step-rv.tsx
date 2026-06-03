'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import jsQR from 'jsqr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAudioFeedback } from '@/hooks/use-audio-feedback'

interface StepRvProps {
  rv:         string
  onComplete: (rv: string) => void
  onBack:     () => void
}

export function StepRv({ rv: initialRv, onComplete, onBack }: StepRvProps) {
  const [mode, setMode]               = useState<'qr' | 'manual'>('qr')
  const [value, setValue]             = useState(initialRv)
  const [flash, setFlash]             = useState<'success' | 'error' | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  const inputRef   = useRef<HTMLInputElement>(null)
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const animRef    = useRef<number>(0)
  const scannedRef = useRef(false)

  const { beep } = useAudioFeedback()

  useEffect(() => {
    if (mode === 'manual') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [mode])

  useEffect(() => {
    if (mode !== 'qr') return

    scannedRef.current = false
    setCameraError(null)
    setCameraReady(false)

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Permissão de câmera negada. Use a digitação manual abaixo.'
            : 'Câmera não disponível. Use a digitação manual abaixo.'
        setCameraError(msg)
      }
    }

    startCamera()

    return () => {
      cancelAnimationFrame(animRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [mode])

  function handleScan(scanned: string) {
    if (!scanned.trim()) return
    setValue(scanned)
    setFlash('success')
    beep('success')
    setTimeout(() => {
      setFlash(null)
      onComplete(scanned)
    }, 300)
  }

  const startScanLoop = useCallback(() => {
    function scan() {
      if (scannedRef.current) return
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, canvas.width, canvas.height)
        if (code?.data) {
          scannedRef.current = true
          handleScan(code.data)
          return
        }
      }
      animRef.current = requestAnimationFrame(scan)
    }
    animRef.current = requestAnimationFrame(scan)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit() {
    const v = value.trim()
    if (!v) return
    setFlash('success')
    beep('success')
    setTimeout(() => { setFlash(null); onComplete(v) }, 300)
  }

  return (
    <div className={cn(
      'space-y-6 rounded-xl p-1 transition-colors duration-500',
      flash === 'success' && 'bg-green-50',
      flash === 'error'   && 'bg-red-50',
    )}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary">Etapa 2 — RV</h2>
        <p className="text-sm text-muted-foreground">
          {mode === 'qr'
            ? 'Aponte a câmera para o QR code do RV colado na caixa.'
            : 'Digite o código RV manualmente.'}
        </p>
      </div>

      {mode === 'qr' && (
        <div className="space-y-3">
          {cameraError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              {cameraError}
            </div>
          ) : (
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onCanPlay={() => { setCameraReady(true); startScanLoop() }}
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
                  Iniciando câmera...
                </div>
              )}
              {cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-white/70 rounded-lg" />
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-center text-muted-foreground">
            Centralize o QR code no quadro
          </p>
        </div>
      )}

      {mode === 'manual' && (
        <div className="space-y-2">
          <Label htmlFor="rv">Código RV</Label>
          <Input
            id="rv"
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="RV-00000"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>
      )}

      <div className="border-t pt-3">
        {mode === 'qr' ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setMode('manual')}
          >
            Digitar manualmente
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground gap-2"
            onClick={() => setMode('qr')}
          >
            <Camera className="h-4 w-4" />
            Usar câmera QR
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        {mode === 'manual' && (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Próximo
          </Button>
        )}
      </div>
    </div>
  )
}
