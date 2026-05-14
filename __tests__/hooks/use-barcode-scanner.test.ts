import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'

function fireKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('useBarcodeScanner', () => {
  let onScan: Mock

  beforeEach(() => {
    onScan = vi.fn()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dispara onScan para input rápido de scanner (<30ms entre teclas)', () => {
    renderHook(() => useBarcodeScanner({ onScan: onScan as (v: string) => void, minLength: 3 }))

    vi.setSystemTime(Date.now())
    fireKey('A')
    vi.advanceTimersByTime(10)
    fireKey('B')
    vi.advanceTimersByTime(10)
    fireKey('C')
    vi.advanceTimersByTime(10)
    fireKey('Enter')

    expect(onScan).toHaveBeenCalledWith('ABC')
  })

  it('não dispara onScan para digitação humana (>150ms entre teclas)', () => {
    renderHook(() => useBarcodeScanner({ onScan: onScan as (v: string) => void, minLength: 1 }))

    fireKey('A')
    vi.advanceTimersByTime(200)
    fireKey('B')
    vi.advanceTimersByTime(200)
    fireKey('C')
    vi.advanceTimersByTime(10)
    fireKey('Enter')

    expect(onScan).not.toHaveBeenCalled()
  })

  it('não dispara quando string está abaixo de minLength', () => {
    renderHook(() => useBarcodeScanner({ onScan: onScan as (v: string) => void, minLength: 5 }))

    fireKey('A')
    vi.advanceTimersByTime(10)
    fireKey('B')
    vi.advanceTimersByTime(10)
    fireKey('Enter')

    expect(onScan).not.toHaveBeenCalled()
  })

  it('não dispara quando enabled=false', () => {
    renderHook(() => useBarcodeScanner({ onScan: onScan as (v: string) => void, enabled: false }))

    fireKey('A')
    vi.advanceTimersByTime(5)
    fireKey('B')
    vi.advanceTimersByTime(5)
    fireKey('Enter')

    expect(onScan).not.toHaveBeenCalled()
  })

  it('remove event listener no unmount', () => {
    const spy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useBarcodeScanner({ onScan }))
    unmount()
    expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('reseta buffer após pausa humana e aceita novo scan de scanner', () => {
    renderHook(() => useBarcodeScanner({ onScan: onScan as (v: string) => void, minLength: 2 }))

    fireKey('X')
    vi.advanceTimersByTime(200)
    fireKey('Y')

    vi.advanceTimersByTime(200)
    fireKey('1')
    vi.advanceTimersByTime(5)
    fireKey('2')
    vi.advanceTimersByTime(5)
    fireKey('3')
    vi.advanceTimersByTime(5)
    fireKey('Enter')

    expect(onScan).toHaveBeenCalledWith('123')
    expect(onScan).toHaveBeenCalledTimes(1)
  })
})
