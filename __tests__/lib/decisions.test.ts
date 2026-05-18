import { describe, it, expect } from 'vitest'
import { DECISION_LABELS, DECISION_BADGE, DECISION_META } from '@/lib/decisions'
import type { ReturnDecision } from '@/types'

const ALL_DECISIONS: ReturnDecision[] = [
  'return_to_stock',
  'store_for_handling',
  'discard',
  'repackage',
]

describe('DECISION_LABELS', () => {
  it('cobre exatamente as 4 decisões válidas', () => {
    expect(Object.keys(DECISION_LABELS).sort()).toEqual([...ALL_DECISIONS].sort())
  })

  it('todos os labels são strings não-vazias', () => {
    for (const d of ALL_DECISIONS) {
      expect(typeof DECISION_LABELS[d]).toBe('string')
      expect(DECISION_LABELS[d].length).toBeGreaterThan(0)
    }
  })
})

describe('DECISION_BADGE', () => {
  it('cobre exatamente as 4 decisões válidas', () => {
    expect(Object.keys(DECISION_BADGE).sort()).toEqual([...ALL_DECISIONS].sort())
  })

  it('todas as badges têm classes CSS não-vazias', () => {
    for (const d of ALL_DECISIONS) {
      expect(typeof DECISION_BADGE[d]).toBe('string')
      expect(DECISION_BADGE[d].length).toBeGreaterThan(0)
    }
  })
})

describe('DECISION_META', () => {
  it('label de DECISION_META bate com DECISION_LABELS', () => {
    for (const d of ALL_DECISIONS) {
      expect(DECISION_META[d].label).toBe(DECISION_LABELS[d])
    }
  })

  it('badge de DECISION_META bate com DECISION_BADGE', () => {
    for (const d of ALL_DECISIONS) {
      expect(DECISION_META[d].badge).toBe(DECISION_BADGE[d])
    }
  })
})
