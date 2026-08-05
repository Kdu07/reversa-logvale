import { describe, it, expect } from 'vitest'
import {
  MAX_PERIOD_DAYS,
  customPeriod,
  monthPeriod,
  presetPeriod,
  previousMonthValue,
  resolvePeriod,
  todayValue,
} from '@/lib/reports/period'

describe('monthPeriod', () => {
  it('fecha o mês no fuso de São Paulo, com o fim exclusivo', () => {
    const p = monthPeriod(2026, 7)

    expect(p.from).toBe('2026-07-01T00:00:00-03:00')
    expect(p.to).toBe('2026-08-01T00:00:00-03:00')
    expect(p.label).toBe('01/07/2026 a 31/07/2026')
    expect(p.slug).toBe('2026-07')
  })

  it('inclui o que entrou às 22h do último dia — o bug que o UTC causaria', () => {
    const p = monthPeriod(2026, 7)
    // 31/07 22:00 em São Paulo = 01/08 01:00 UTC
    const lateReceipt = new Date('2026-08-01T01:00:00Z')

    expect(lateReceipt >= new Date(p.from)).toBe(true)
    expect(lateReceipt < new Date(p.to)).toBe(true)
  })

  it('respeita a virada de ano', () => {
    const p = monthPeriod(2025, 12)

    expect(p.to).toBe('2026-01-01T00:00:00-03:00')
    expect(p.label).toBe('01/12/2025 a 31/12/2025')
  })

  it('trata fevereiro bissexto', () => {
    expect(monthPeriod(2028, 2).label).toBe('01/02/2028 a 29/02/2028')
    expect(monthPeriod(2027, 2).label).toBe('01/02/2027 a 28/02/2027')
  })

  it('rejeita mês e ano fora da faixa', () => {
    expect(() => monthPeriod(2026, 0)).toThrow('Mês do período inválido')
    expect(() => monthPeriod(2026, 13)).toThrow('Mês do período inválido')
    expect(() => monthPeriod(1999, 5)).toThrow('Ano do período inválido')
  })
})

describe('customPeriod', () => {
  it('inclui o dia final inteiro', () => {
    const p = customPeriod('2026-03-10', '2026-03-12')

    expect(p.from).toBe('2026-03-10T00:00:00-03:00')
    expect(p.to).toBe('2026-03-13T00:00:00-03:00')
    expect(p.slug).toBe('20260310-20260312')
  })

  it('aceita um único dia', () => {
    const p = customPeriod('2026-03-10', '2026-03-10')

    expect(p.to).toBe('2026-03-11T00:00:00-03:00')
    expect(p.label).toBe('10/03/2026 a 10/03/2026')
  })

  it('rejeita intervalo invertido, formato inválido e período longo demais', () => {
    expect(() => customPeriod('2026-03-12', '2026-03-10')).toThrow('não pode ser posterior')
    expect(() => customPeriod('10/03/2026', '2026-03-12')).toThrow('inválidas')
    expect(() => customPeriod('2024-01-01', '2026-01-01')).toThrow(String(MAX_PERIOD_DAYS))
  })
})

describe('presetPeriod', () => {
  // 04/08/2026 00:30 UTC = 03/08/2026 21:30 em São Paulo
  const lateNight = new Date('2026-08-04T00:30:00Z')

  it('usa a data civil de São Paulo, não a de UTC', () => {
    expect(presetPeriod('current_month', lateNight).slug).toBe('2026-08')
    expect(todayValue(lateNight)).toBe('2026-08-03')
  })

  it('mês anterior atravessa a virada de ano', () => {
    expect(presetPeriod('previous_month', new Date('2026-01-15T12:00:00Z')).slug).toBe('2025-12')
    expect(previousMonthValue(new Date('2026-08-15T12:00:00Z'))).toBe('2026-07')
  })

  it('últimos 90 dias termina hoje e cobre 90 dias corridos', () => {
    const p = presetPeriod('last_90d', new Date('2026-08-15T12:00:00Z'))

    expect(p.from).toBe('2026-05-18T00:00:00-03:00')
    expect(p.to).toBe('2026-08-16T00:00:00-03:00')
  })
})

describe('resolvePeriod', () => {
  it('encaminha cada tipo de entrada', () => {
    expect(resolvePeriod({ kind: 'month', year: 2026, month: 2 }).slug).toBe('2026-02')
    expect(resolvePeriod({ kind: 'custom', from: '2026-02-01', to: '2026-02-05' }).slug)
      .toBe('20260201-20260205')
    expect(resolvePeriod({ kind: 'preset', preset: 'current_month' }, new Date('2026-04-10T12:00:00Z')).slug)
      .toBe('2026-04')
  })
})
