import { describe, it, expect } from 'vitest'
import {
  operatorHomeRanges, myReturnsHref, tratativasHref, isItemConditionFilter, parseDepositorParam,
} from '@/lib/operator-home'
import { dayBoundaryIso } from '@/lib/reports/period'
import { isReturnDecision } from '@/lib/decisions'

describe('operatorHomeRanges', () => {
  it('usa o dia civil de São Paulo', () => {
    // 02:00 UTC de 01/12 ainda é 30/11 em São Paulo.
    expect(operatorHomeRanges(new Date('2026-12-01T02:00:00Z'))).toEqual({
      today: '2026-11-30', monthStart: '2026-11-01',
    })
  })

  it('o mês começa no dia 1', () => {
    expect(operatorHomeRanges(new Date('2026-03-03T15:00:00Z'))).toEqual({
      today: '2026-03-03', monthStart: '2026-03-01',
    })
  })
})

describe('dayBoundaryIso', () => {
  it('converte início e fim do dia de São Paulo para UTC', () => {
    expect(dayBoundaryIso('2026-07-01', 'start')).toBe('2026-07-01T03:00:00.000Z')
    expect(dayBoundaryIso('2026-07-31', 'end')).toBe('2026-08-01T02:59:59.999Z')
  })

  it('devolve null para data fora do formato', () => {
    expect(dayBoundaryIso('31/07/2026', 'start')).toBeNull()
    expect(dayBoundaryIso('', 'end')).toBeNull()
  })
})

describe('myReturnsHref', () => {
  it('sem parâmetros aponta para a página limpa', () => {
    expect(myReturnsHref()).toBe('/operador/minhas-devolucoes')
  })

  it('monta período, estado e escopo', () => {
    expect(myReturnsHref({ from: '2026-11-01', to: '2026-11-15', condition: 'damaged' }))
      .toBe('/operador/minhas-devolucoes?from=2026-11-01&to=2026-11-15&condition=damaged')
    expect(myReturnsHref({ scope: 'pending', withoutKey: true }))
      .toBe('/operador/minhas-devolucoes?scope=pending&nokey=1')
  })

  it('omite o escopo padrão (mine)', () => {
    expect(myReturnsHref({ scope: 'mine' })).toBe('/operador/minhas-devolucoes')
  })
})

describe('tratativasHref', () => {
  it('monta decisão, RV e devolução a abrir', () => {
    expect(tratativasHref()).toBe('/operador/tratativas')
    expect(tratativasHref({ decision: 'reship' })).toBe('/operador/tratativas?decision=reship')
    expect(tratativasHref({ decision: 'discard', depositor: 'd-1' }))
      .toBe('/operador/tratativas?decision=discard&depositor=d-1')
    expect(tratativasHref({ rv: 'RV 1/2', open: 'abc' })).toBe('/operador/tratativas?rv=RV+1%2F2&open=abc')
  })
})

describe('validação de parâmetros da URL', () => {
  it('aceita só estados e decisões conhecidos', () => {
    expect(isItemConditionFilter('empty')).toBe(true)
    expect(isItemConditionFilter('quebrado')).toBe(false)
    expect(isItemConditionFilter(undefined)).toBe(false)
    expect(isReturnDecision('store_for_handling')).toBe(true)
    expect(isReturnDecision('return')).toBe(false)
  })

  it('depositante só passa se for UUID', () => {
    const id = '0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e'
    expect(parseDepositorParam(id)).toBe(id)
    expect(parseDepositorParam('abc or 1=1')).toBeUndefined()
    expect(parseDepositorParam('')).toBeUndefined()
    expect(parseDepositorParam(undefined)).toBeUndefined()
  })
})
