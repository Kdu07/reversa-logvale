'use client'

import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { DashboardStats } from '../actions'
import { ptBR } from '@/lib/i18n/pt-BR'

const STATUS_COLORS: Record<string, string> = {
  awaiting_decision: '#F59E0B',
  decided:           '#3B82F6',
  processed:         '#10B981',
}

const DECISION_COLORS: Record<string, string> = {
  return_to_stock:    '#10B981',
  store_for_handling: '#F59E0B',
  discard:            '#EF4444',
  repackage:          '#3B82F6',
}

interface Props {
  byStatus:   DashboardStats['byStatus']
  byDecision: DashboardStats['byDecision']
}

export function StatsCharts({ byStatus, byDecision }: Props) {
  const statusData = byStatus.map((s) => ({
    name:  ptBR.returnStatus[s.status],
    value: s.count,
    key:   s.status,
  }))

  const decisionData = byDecision.map((d) => ({
    name:  ptBR.decisions[d.decision],
    value: d.count,
    key:   d.decision,
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Pie: por status */}
      <div className="rounded-lg border bg-card p-5">
        <p className="text-sm font-semibold text-foreground mb-4">{ptBR.admin.dashboard.chartByStatus}</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {statusData.map((entry) => (
                <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? '#94A3B8'} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [v, '']} />
            <Legend
              formatter={(value) => <span className="text-xs">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Bar: por decisão */}
      <div className="rounded-lg border bg-card p-5">
        <p className="text-sm font-semibold text-foreground mb-4">{ptBR.admin.dashboard.chartByDecision}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={decisionData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {decisionData.map((entry) => (
                <Cell key={entry.key} fill={DECISION_COLORS[entry.key] ?? '#94A3B8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
