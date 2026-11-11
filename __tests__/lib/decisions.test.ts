import { describe, it, expect } from 'vitest'
import { DECISION_LABELS, DECISION_BADGE, DECISION_META, isReshipDepositor } from '@/lib/decisions'
import type { ReturnDecision } from '@/types'

const ALL_DECISIONS: ReturnDecision[] = [
  'return_to_stock',
  'store_for_handling',
  'discard',
  'repackage',
  'reship',
]

describe('DECISION_LABELS', () => {
  it('cobre exatamente as 5 decisões válidas', () => {
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
  it('cobre exatamente as 5 decisões válidas', () => {
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

describe('isReshipDepositor', () => {
  const ALLOWED = ['11222333000181']

  it('libera o depositante listado, aceitando CNPJ formatado', () => {
    expect(isReshipDepositor('11222333000181', ALLOWED)).toBe(true)
    expect(isReshipDepositor('11.222.333/0001-81', ALLOWED)).toBe(true)
  })

  it('bloqueia depositante fora da lista, CNPJ ausente ou lista vazia', () => {
    expect(isReshipDepositor('99888777000166', ALLOWED)).toBe(false)
    expect(isReshipDepositor(null, ALLOWED)).toBe(false)
    expect(isReshipDepositor(undefined, ALLOWED)).toBe(false)
    expect(isReshipDepositor('11222333000181', [])).toBe(false)
  })
})
