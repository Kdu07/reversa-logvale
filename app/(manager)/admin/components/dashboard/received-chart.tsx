'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface Props {
  data: { label: string; received: number }[]
  unit: 'hour' | 'day' | 'week'
}

/** Recebimentos por dia (ou por hora no "Hoje"). Uma série só → sem legenda; o título do painel a nomeia. */
export function ReceivedChart({ data, unit }: Props) {
  // Com 30 barras, rótulo em todo dia vira ruído: mostra ~1 a cada 5.
  const interval = data.length > 14 ? Math.ceil(data.length / 7) - 1 : 0

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap={data.length > 14 ? 2 : 8}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="0" />
        <XAxis
          dataKey="label"
          interval={interval}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-elev-md">
                <p className="text-muted-foreground">
                  {unit === 'hour' ? `Hoje, ${label}` : unit === 'week' ? `Semana de ${String(label).replace('sem. ', '')}` : label}
                </p>
                <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                  {Number(payload[0].value).toLocaleString('pt-BR')} recebidas
                </p>
              </div>
            )
          }}
        />
        <Bar dataKey="received" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
