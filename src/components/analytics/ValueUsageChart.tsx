'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface Props {
  data: { name: string; count: number }[]
}

export default function ValueUsageChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#1e1b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          formatter={(v) => [`${v} time${v !== 1 ? 's' : ''}`, 'Used']}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => {
            const ratio = d.count / max
            const color = ratio === 1 ? '#7c3aed' : ratio >= 0.6 ? '#6d28d9' : ratio >= 0.3 ? '#4c1d95' : '#374151'
            return <Cell key={i} fill={color} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
