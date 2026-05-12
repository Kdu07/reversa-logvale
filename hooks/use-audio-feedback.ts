'use client'

import { useCallback, useRef } from 'react'

export function useAudioFeedback() {
  const ctxRef = useRef<AudioContext | null>(null)

  function getCtx(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext()
    }
    return ctxRef.current
  }

  function playTone(frequency: number, duration: number) {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  }

  const beep = useCallback((type: 'success' | 'error') => {
    try {
      if (type === 'success') {
        playTone(880, 0.15)
      } else {
        playTone(440, 0.12)
        setTimeout(() => playTone(440, 0.12), 180)
      }
    } catch {
      // AudioContext not available (test environment, etc.)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { beep }
}
