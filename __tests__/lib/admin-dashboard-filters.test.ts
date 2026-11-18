import { describe, it, expect } from 'vitest'
import { customRangeError, dashboardHref, resolveDashboardFilters } from '@/lib/admin-dashboard/filters'

// 17/11/2026 15:00 em São Paulo
const NOW = new Date('2026-11-17T18:00:00Z')
const UUID = '0b6a3c3e-2f7e-4c1a-9a51-2f1f6f1d9a10'

describe('resolveDashboardFilters', () => {
  it('padrão é "Este mês" (dia 1 até hoje) com o mesmo número de dias antes', () => {
    const f = resolveDashboardFilters({}, NOW)
    expect(f).toMatchObject({
      period: 'month', from: '2026-11-01', to: '2026-11-17',
      previousFrom: '2026-10-15', previousTo: '2026-10-31', periodError: null,
    })
  })

  it('período em andamento corta o anterior no mesmo tempo decorrido', () => {
    // 01/11 00h → 17/11 15h = 16d 15h; 15/10 00h + 16d 15h = 31/10 15h
    expect(resolveDashboardFilters({}, NOW).previousCutAt).toBe('2026-10-31T18:00:00.000Z')
    // "Hoje" às 15h → ontem até as 15h
    expect(resolveDashboardFilters({ period: 'today' }, NOW).previousCutAt).toBe('2026-11-16T18:00:00.000Z')
    // personalizado que vai além de hoje também está em andamento
    expect(resolveDashboardFilters({ period: 'custom', from: '2026-11-10', to: '2026-11-20' }, NOW).previousCutAt)
      .toBe('2026-11-06T18:00:00.000Z')
  })

  it('período fechado não corta o anterior', () => {
    expect(resolveDashboardFilters({ period: 'custom', from: '2026-10-01', to: '2026-10-10' }, NOW).previousCutAt).toBeNull()
  })

  it('meia-noite em ponto ainda dá um intervalo não vazio (1 min)', () => {
    const midnight = new Date('2026-11-17T03:00:00Z') // 00h em São Paulo
    expect(resolveDashboardFilters({ period: 'today' }, midnight).previousCutAt).toBe('2026-11-16T03:01:00.000Z')
  })

  it('presets terminam hoje', () => {
    expect(resolveDashboardFilters({ period: 'today' }, NOW)).toMatchObject({ from: '2026-11-17', to: '2026-11-17', previousFrom: '2026-11-16' })
    expect(resolveDashboardFilters({ period: '7d' }, NOW)).toMatchObject({ from: '2026-11-11', to: '2026-11-17' })
    expect(resolveDashboardFilters({ period: '30d' }, NOW)).toMatchObject({ from: '2026-10-19', to: '2026-11-17' })
  })

  it('personalizado válido', () => {
    const f = resolveDashboardFilters({ period: 'custom', from: '2026-10-01', to: '2026-10-10' }, NOW)
    expect(f).toMatchObject({ period: 'custom', from: '2026-10-01', to: '2026-10-10', previousFrom: '2026-09-21', previousTo: '2026-09-30' })
  })

  it('personalizado inválido cai em "Este mês" com aviso', () => {
    const f = resolveDashboardFilters({ period: 'custom', from: '2026-10-10', to: '2026-10-01' }, NOW)
    expect(f.period).toBe('month')
    expect(f.periodError).toMatch(/posterior/)
    expect(resolveDashboardFilters({ period: 'custom', from: '2026-02-30', to: '2026-03-01' }, NOW).periodError).toBeTruthy()
  })

  it('depositantes só aceitam UUID', () => {
    expect(resolveDashboardFilters({ dep: 'x; drop', udep: UUID }, NOW)).toMatchObject({ depositorId: null, urgentDepositorId: UUID })
  })
})

describe('customRangeError', () => {
  it('limita a 366 dias', () => {
    expect(customRangeError('2025-01-01', '2026-01-02')).toMatch(/366/)
    expect(customRangeError('2025-01-01', '2025-12-31')).toBeNull()
  })
})

describe('dashboardHref', () => {
  it('omite o padrão e mantém os dois depositantes', () => {
    expect(dashboardHref({ period: 'month', from: 'x', to: 'y', depositorId: null, urgentDepositorId: null })).toBe('/admin')
    expect(dashboardHref({ period: 'custom', from: '2026-10-01', to: '2026-10-10', depositorId: 'a', urgentDepositorId: 'b' }))
      .toBe('/admin?period=custom&from=2026-10-01&to=2026-10-10&dep=a&udep=b')
  })
})
