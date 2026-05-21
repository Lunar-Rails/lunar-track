'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface Props {
  distribution: { score: string; count: number }[]
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#7c3aed']

export default function ScoreDistributionChart({ distribution }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={distribution} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="score" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#1e1b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          formatter={(v) => [`${v} employee${v !== 1 ? 's' : ''}`, 'Count']}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {distribution.map((_, i) => (
            <Cell key={i} fill={COLORS[i] ?? '#7c3aed'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
