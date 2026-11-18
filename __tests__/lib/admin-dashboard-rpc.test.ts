import { describe, it, expect } from 'vitest'
import { mapAdminDashboard, seriesLabel, type AdminDashboardRpc } from '@/lib/admin-dashboard/rpc'
import { dashboardRpcArgs, periodLabels, resolveDashboardFilters, seriesUnit } from '@/lib/admin-dashboard/filters'

const NOW = new Date('2026-11-17T18:00:00Z') // 15h em São Paulo
const DEP = '11111111-1111-4111-8111-111111111111'

function raw(overrides: Partial<AdminDashboardRpc> = {}): AdminDashboardRpc {
  return {
    attention: {
      awaiting:         { total: 6, onTime: 2, dueSoon: 1, overdue: 2, noDeadline: 1 },
      decidedBacklog:   { total: 2, oldestHours: 28, byDecision: [{ decision: 'discard', count: 1 }, { decision: 'bogus', count: 9 }] },
      withoutKey:       { awaiting: 2, decided: 0 },
      warnings24h:      1,
      urgent:           [{ id: 'u1', rv: 'RV-1', depositorId: null, depositorName: null, hoursLeft: -8 }],
      urgentDepositors: [{ id: DEP, name: 'Forever Liss', count: '2' }],
    },
    volume: {
      current:    { received: '8', decidedByClient: 2, decidedAuto: 1, processed: 1, medianDecisionHours: '10.0', medianProcessHours: null },
      previous:   { received: 1 },
      series:     [{ start: '2026-11-16T00:00', received: 1 }, { start: '2026-11-17T00:00', received: '3' }],
      byDecision: [{ decision: 'reship', count: 1 }],
    },
    quality: {
      conditions: {
        good: { returns: 4, items: 7 }, damaged: { returns: 2, items: 3 },
        empty: { returns: 1, items: 0 }, mismatched: { returns: 1, items: 1 },
        notEvaluated: 0, totalItems: 14,
      },
      identification: [{ type: 'access_key', count: 6 }],
    },
    depositors: [{ id: DEP, name: 'Forever Liss', noDeadline: false, received: 6, awaiting: 4, autoRate: '50.0', medianDecisionHours: 10, damagedRate: null }],
    team:             [{ id: 'o1', name: 'Ana', received: 5, processed: 0, edits: '1' }],
    depositorOptions: [{ id: DEP, name: 'Forever Liss' }],
    ...overrides,
  }
}

describe('mapAdminDashboard', () => {
  it('converte números (inclusive bigint/numeric em string) e mantém nulos', () => {
    const f = resolveDashboardFilters({ period: '7d' }, NOW)
    const d = mapAdminDashboard(raw(), f)

    expect(d.period).toMatchObject({ key: '7d', from: '2026-11-11', to: '2026-11-17', label: '11/11/2026 a 17/11/2026', previousLabel: 'vs. 04/11 a 10/11 até 15h00', depositorName: null })
    expect(d.attention.awaiting).toEqual({ total: 6, onTime: 2, dueSoon: 1, overdue: 2, noDeadline: 1 })
    expect(d.attention.decidedBacklog.byDecision).toEqual([{ decision: 'discard', count: 1 }]) // decisão desconhecida é descartada
    expect(d.attention.urgentDepositors[0].count).toBe(2)
    expect(d.volume.received).toEqual({ value: 8, previous: 1 })
    expect(d.volume.decidedByClient).toEqual({ value: 2, previous: 0 }) // ausente no anterior = 0
    expect(d.volume.medianDecisionHours).toEqual({ value: 10, previous: null })
    expect(d.volume.medianProcessHours).toEqual({ value: null, previous: null })
    expect(d.volume.seriesUnit).toBe('day')
    expect(d.volume.series).toEqual([{ label: '16/11', received: 1 }, { label: '17/11', received: 3 }])
    expect(d.quality.conditions.map((c) => c.condition)).toEqual(['good', 'damaged', 'empty', 'mismatched'])
    expect(d.quality.totalItems).toBe(14)
    expect(d.depositors[0]).toMatchObject({ autoRate: 50, damagedRate: null, noDeadline: false })
    expect(d.team[0].edits).toBe(1)
  })

  it('nomeia o depositante filtrado pelas opções', () => {
    const d = mapAdminDashboard(raw(), resolveDashboardFilters({ dep: DEP, udep: DEP }, NOW))
    expect(d.period.depositorName).toBe('Forever Liss')
    expect(d.attention.urgentDepositorId).toBe(DEP)
  })

  it('aguenta listas ausentes e período anterior vazio', () => {
    const r = raw()
    const d = mapAdminDashboard({
      ...r,
      volume: { ...r.volume, previous: undefined as never, series: undefined as never, byDecision: undefined as never },
      depositors: undefined as never,
      team: undefined as never,
      depositorOptions: undefined as never,
    }, resolveDashboardFilters({ dep: '22222222-2222-4222-8222-222222222222' }, NOW))
    expect(d.volume.received.previous).toBe(0)
    expect(d.volume.series).toEqual([])
    expect(d.depositors).toEqual([])
    expect(d.team).toEqual([])
    expect(d.period.depositorName).toBe('Depositante selecionado')
  })
})

describe('seriesLabel / seriesUnit', () => {
  it('formata por hora, dia e semana', () => {
    expect(seriesLabel('2026-11-17T14:00', 'hour')).toBe('14h')
    expect(seriesLabel('2026-11-17T00:00', 'day')).toBe('17/11')
    expect(seriesLabel('2026-11-03T00:00', 'week')).toBe('sem. 03/11')
  })

  it('escolhe o agrupamento pelo tamanho do período', () => {
    expect(seriesUnit({ period: 'today', from: '2026-11-17', to: '2026-11-17' })).toBe('hour')
    expect(seriesUnit({ period: 'custom', from: '2026-10-01', to: '2026-12-01' })).toBe('day')  // 62 dias
    expect(seriesUnit({ period: 'custom', from: '2026-10-01', to: '2026-12-02' })).toBe('week') // 63 dias
  })
})

describe('dashboardRpcArgs / periodLabels', () => {
  it('fecha o intervalo em São Paulo, [from, to+1)', () => {
    const f = resolveDashboardFilters({ period: 'custom', from: '2026-10-01', to: '2026-10-31', dep: DEP }, NOW)
    expect(dashboardRpcArgs(f)).toEqual({
      p_from:      '2026-10-01T00:00:00-03:00',
      p_to:        '2026-11-01T00:00:00-03:00',
      p_prev_from: '2026-08-31T00:00:00-03:00',
      p_prev_to:   '2026-10-01T00:00:00-03:00',
      p_depositor: DEP,
      p_urgent_depositor: null,
      p_bucket: 'day',
    })
  })

  it('rótulo de um dia só (em andamento → anterior até a mesma hora)', () => {
    const f = resolveDashboardFilters({ period: 'today' }, NOW)
    expect(periodLabels(f)).toEqual({ label: '17/11/2026', previousLabel: 'vs. 16/11 até 15h00' })
  })

  it('período em andamento manda o anterior cortado para a RPC', () => {
    const args = dashboardRpcArgs(resolveDashboardFilters({ period: '7d' }, NOW))
    expect(args.p_prev_from).toBe('2026-11-04T00:00:00-03:00')
    expect(args.p_prev_to).toBe('2026-11-10T18:00:00.000Z')
  })

  it('rótulo do anterior acompanha o corte quando o período passa de hoje', () => {
    const f = resolveDashboardFilters({ period: 'custom', from: '2026-11-10', to: '2026-11-20' }, NOW)
    expect(periodLabels(f).previousLabel).toBe('vs. 30/10 a 06/11 até 15h00')
  })
})
