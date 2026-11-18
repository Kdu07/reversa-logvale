import { describe, it, expect } from 'vitest'
import {
  adminReturnsHref, deadlineOrExpression, extraFilterChips, parseAdminReturnsParams,
} from '@/lib/admin-returns-filters'

const DEP = '11111111-1111-4111-8111-111111111111'

describe('parseAdminReturnsParams', () => {
  it('lê e valida todos os filtros', () => {
    expect(parseAdminReturnsParams({
      rv: ' RV-1 ', status: 'decided', page: '3', depositor: DEP, from: '2026-11-01', to: '2026-11-17',
      decision: 'discard', condition: 'damaged', nokey: '1', deadline: 'urgent',
    })).toEqual({
      rv: 'RV-1', status: 'decided', page: 3, depositorId: DEP, from: '2026-11-01', to: '2026-11-17',
      decision: 'discard', condition: 'damaged', noKey: true, deadline: 'urgent',
    })
  })

  it('ignora valores inválidos', () => {
    expect(parseAdminReturnsParams({
      status: 'x', page: '-2', depositor: 'abc', from: '01/11/2026', decision: 'x', condition: 'x', nokey: 'true', deadline: 'x',
    })).toEqual({
      rv: '', status: null, page: 1, depositorId: null, from: null, to: null,
      decision: null, condition: null, noKey: false, deadline: null,
    })
  })
})

describe('adminReturnsHref', () => {
  it('serializa só o que está preenchido', () => {
    expect(adminReturnsHref({})).toBe('/admin/devolucoes')
    expect(adminReturnsHref({ status: 'awaiting_decision', deadline: 'soon', page: 2 }))
      .toBe('/admin/devolucoes?status=awaiting_decision&deadline=soon&page=2')
  })

  it('ida e volta com o parser', () => {
    const f = parseAdminReturnsParams({ depositor: DEP, from: '2026-11-01', to: '2026-11-17', condition: 'empty', nokey: '1' })
    const qs = new URLSearchParams(adminReturnsHref(f).split('?')[1])
    expect(parseAdminReturnsParams(Object.fromEntries(qs))).toEqual(f)
  })
})

describe('extraFilterChips', () => {
  it('um chip por filtro extra, cada um removendo só a si mesmo', () => {
    const f = parseAdminReturnsParams({ rv: 'RV', depositor: DEP, from: '2026-11-01', to: '2026-11-17', decision: 'reship', condition: 'good', nokey: '1', deadline: 'overdue', page: '4' })
    const chips = extraFilterChips(f, 'Blackskull')

    expect(chips.map((c) => c.label)).toEqual([
      'Blackskull', 'Recebidas de 01/11/2026 a 17/11/2026', 'Reenvio', 'Bom', 'Sem chave de acesso', 'Prazo vencido',
    ])
    const period = chips.find((c) => c.key === 'period')!
    expect(period.href).not.toContain('from=')
    expect(period.href).toContain('rv=RV')
    expect(period.href).not.toContain('page=') // volta para a página 1
  })

  it('período de um dia ou aberto', () => {
    expect(extraFilterChips(parseAdminReturnsParams({ from: '2026-11-17', to: '2026-11-17' }), null)[0].label).toBe('Recebidas em 17/11/2026')
    expect(extraFilterChips(parseAdminReturnsParams({ from: '2026-11-01' }), null)[0].label).toBe('Recebidas desde 01/11/2026')
    expect(extraFilterChips(parseAdminReturnsParams({ to: '2026-11-01' }), null)[0].label).toBe('Recebidas até 01/11/2026')
    expect(extraFilterChips(parseAdminReturnsParams({ depositor: DEP }), null)[0].label).toBe('Depositante')
    expect(extraFilterChips(parseAdminReturnsParams({}), null)).toEqual([])
  })
})

describe('deadlineOrExpression', () => {
  const now = new Date('2026-11-17T18:00:00.000Z')
  const h72 = '"2026-11-14T18:00:00.000Z"'
  const h48 = '"2026-11-15T18:00:00.000Z"'

  it('vencidas: base do prazo há mais de 72h', () => {
    expect(deadlineOrExpression('overdue', now, [])).toBe(
      `and(or(and(decision_deadline_from.is.null,received_at.lt.${h72}),decision_deadline_from.lt.${h72}))`,
    )
  })

  it('a vencer: entre 48h e 72h', () => {
    expect(deadlineOrExpression('soon', now, [])).toBe(
      `and(or(and(decision_deadline_from.is.null,received_at.lt.${h48}),decision_deadline_from.lt.${h48}),` +
      `or(and(decision_deadline_from.is.null,received_at.gte.${h72}),decision_deadline_from.gte.${h72}))`,
    )
  })

  it('exclui depositantes sem prazo (sem depositante conta como com prazo)', () => {
    expect(deadlineOrExpression('urgent', now, ['a', 'b'])).toBe(
      `and(or(and(decision_deadline_from.is.null,received_at.lt.${h48}),decision_deadline_from.lt.${h48}),` +
      'or(depositor_id.is.null,depositor_id.not.in.(a,b)))',
    )
  })
})
