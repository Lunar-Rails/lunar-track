'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface Props {
  data: { period: string; energy: number; productivity: number }[]
}

const ENERGY_LABEL: Record<string, number> = { terrible: 1, meh: 2, okay: 3, great: 4 }
const PROD_LABEL: Record<string, number> = { waste: 1, fine: 2, ludicrous: 3 }

export { ENERGY_LABEL, PROD_LABEL }

export default function MoodTrendOrgChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[1, 4]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals />
        <Tooltip
          contentStyle={{ background: '#1e1b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
          cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
          formatter={(v) => [typeof v === 'number' ? v.toFixed(2) : v, '']}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Line type="monotone" dataKey="energy" stroke="#7c3aed" strokeWidth={2} dot={false} name="Energy" />
        <Line type="monotone" dataKey="productivity" stroke="#06b6d4" strokeWidth={2} dot={false} name="Productivity" />
      </LineChart>
    </ResponsiveContainer>
  )
}
