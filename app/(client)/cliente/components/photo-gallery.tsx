'use client'

import { useEffect } from 'react'

interface PhotoGalleryProps {
  urls:         string[]
  currentIndex: number
  onNavigate:   (index: number) => void
  onClose:      () => void
}

export function PhotoGallery({ urls, currentIndex, onNavigate, onClose }: PhotoGalleryProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')    onClose()
      if (e.key === 'ArrowLeft'  && currentIndex > 0)              onNavigate(currentIndex - 1)
      if (e.key === 'ArrowRight' && currentIndex < urls.length - 1) onNavigate(currentIndex + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIndex, urls.length, onClose, onNavigate])

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none"
      >
        ✕
      </button>

      {currentIndex > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1) }}
          className="absolute left-4 text-white/80 hover:text-white text-4xl leading-none select-none"
        >
          ‹
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[currentIndex]}
        alt={`foto ${currentIndex + 1} de ${urls.length}`}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {currentIndex < urls.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1) }}
          className="absolute right-4 text-white/80 hover:text-white text-4xl leading-none select-none"
        >
          ›
        </button>
      )}

      <div className="absolute bottom-4 text-white/60 text-sm">
        {currentIndex + 1} / {urls.length}
      </div>
    </div>
  )
}
