'use client'

import { useEffect, useRef } from 'react'

const SCANNER_MAX_DELTA_MS = 30  // consecutive keystrokes < 30ms = USB scanner
const HUMAN_PAUSE_MS = 150       // gap > 150ms = human typing / new input

interface UseBarcodeScanner {
  onScan: (value: string) => void
  minLength?: number
  enabled?: boolean
}

export function useBarcodeScanner({ onScan, minLength = 1, enabled = true }: UseBarcodeScanner) {
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const scannerModeRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        if (scannerModeRef.current && bufferRef.current.length >= minLength) {
          onScan(bufferRef.current)
        }
        bufferRef.current = ''
        lastKeyTimeRef.current = 0
        scannerModeRef.current = false
        return
      }

      if (e.key.length !== 1) return

      const now = Date.now()
      const delta = lastKeyTimeRef.current ? now - lastKeyTimeRef.current : Infinity

      if (delta > HUMAN_PAUSE_MS) {
        bufferRef.current = ''
        scannerModeRef.current = false
      }

      if (!scannerModeRef.current && bufferRef.current.length > 0 && delta < SCANNER_MAX_DELTA_MS) {
        scannerModeRef.current = true
      }

      bufferRef.current += e.key
      lastKeyTimeRef.current = now
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onScan, minLength, enabled])
}
