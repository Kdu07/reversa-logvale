'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'

interface PhotoGalleryProps {
  urls:         string[]
  currentIndex: number
  onNavigate:   (index: number) => void
  onClose:      () => void
  /** Prefixo do nome do arquivo ao baixar (ex.: "RV123-caixa"); o índice é anexado. */
  downloadPrefix?: string
}

const MIN_SCALE  = 1
const MAX_SCALE  = 5
const SCALE_STEP = 0.5

export function PhotoGallery({ urls, currentIndex, onNavigate, onClose, downloadPrefix }: PhotoGalleryProps) {
  const [scale, setScale]             = useState(1)
  const [offset, setOffset]           = useState({ x: 0, y: 0 })
  const [dragging, setDragging]       = useState(false)
  const [downloading, setDownloading] = useState(false)
  const dragOrigin = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const resetZoom = useCallback(() => { setScale(1); setOffset({ x: 0, y: 0 }) }, [])

  // Zera o zoom/pan ao trocar de imagem
  useEffect(() => { resetZoom() }, [currentIndex, resetZoom])

  const zoomBy = useCallback((delta: number) => {
    setScale((s) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((s + delta) * 10) / 10))
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 })
      return next
    })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')                              onClose()
      if (e.key === 'ArrowLeft'  && currentIndex > 0)                onNavigate(currentIndex - 1)
      if (e.key === 'ArrowRight' && currentIndex < urls.length - 1)  onNavigate(currentIndex + 1)
      if (e.key === '+' || e.key === '=')                  zoomBy(SCALE_STEP)
      if (e.key === '-' || e.key === '_')                  zoomBy(-SCALE_STEP)
      if (e.key === '0')                                   resetZoom()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIndex, urls.length, onClose, onNavigate, zoomBy, resetZoom])

  async function handleDownload() {
    const url = urls[currentIndex]
    if (!url) return
    const filename = `${downloadPrefix || 'foto'}-${currentIndex + 1}.jpg`
    setDownloading(true)
    try {
      // A signed URL é cross-origin (*.supabase.co); buscar como blob torna-a
      // same-origin, então o atributo `download` aplica o nome amigável.
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch falhou')
      const blob   = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href     = objUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
    } catch {
      window.open(url, '_blank', 'noopener') // fallback se o fetch falhar (ex.: CORS)
    } finally {
      setDownloading(false)
    }
  }

  function startDrag(e: React.MouseEvent) {
    if (scale <= MIN_SCALE) return
    e.preventDefault()
    dragOrigin.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    setDragging(true)
  }
  function onDrag(e: React.MouseEvent) {
    if (!dragOrigin.current) return
    setOffset({
      x: dragOrigin.current.ox + (e.clientX - dragOrigin.current.x),
      y: dragOrigin.current.oy + (e.clientY - dragOrigin.current.y),
    })
  }
  function endDrag() {
    dragOrigin.current = null
    setDragging(false)
  }

  const iconBtn =
    'flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition disabled:opacity-40 disabled:hover:bg-white/10'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 overscroll-contain"
      onClick={onClose}
      onMouseMove={onDrag}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Diminuir zoom" onClick={() => zoomBy(-SCALE_STEP)} disabled={scale <= MIN_SCALE} className={iconBtn}>
          <ZoomOut className="h-5 w-5" />
        </button>
        <span className="min-w-[3rem] select-none text-center text-sm tabular-nums text-white/80">{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Aumentar zoom" onClick={() => zoomBy(SCALE_STEP)} disabled={scale >= MAX_SCALE} className={iconBtn}>
          <ZoomIn className="h-5 w-5" />
        </button>
        <button type="button" aria-label="Redefinir zoom" onClick={resetZoom} disabled={scale === MIN_SCALE && offset.x === 0 && offset.y === 0} className={iconBtn}>
          <RotateCcw className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Baixar imagem" onClick={handleDownload} disabled={downloading} className={iconBtn}>
          <Download className="h-5 w-5" />
        </button>
        <button type="button" aria-label="Fechar" onClick={onClose} className={iconBtn}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {currentIndex > 0 && (
        <button
          type="button"
          aria-label="Foto anterior"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1) }}
          className="absolute left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/90 transition hover:bg-white/20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[currentIndex]}
        alt={`foto ${currentIndex + 1} de ${urls.length}`}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP)}
        onMouseDown={startDrag}
        onDoubleClick={() => (scale > MIN_SCALE ? resetZoom() : setScale(2))}
        style={{
          transform:  `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor:     scale > MIN_SCALE ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
          transition: dragging ? 'none' : 'transform 120ms ease-out',
        }}
        className="max-h-[90vh] max-w-[90vw] select-none rounded-lg object-contain"
      />

      {currentIndex < urls.length - 1 && (
        <button
          type="button"
          aria-label="Próxima foto"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1) }}
          className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/90 transition hover:bg-white/20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 select-none text-sm text-white/60">
        {currentIndex + 1} / {urls.length}
      </div>
    </div>
  )
}
