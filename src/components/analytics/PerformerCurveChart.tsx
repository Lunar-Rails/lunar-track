'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface Props {
  // Each point: a score bucket (1.0–5.0 in 0.5 steps) with employee count
  data: { score: string; count: number }[]
  avg: number
}

export default function PerformerCurveChart({ data, avg }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="perfGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
            <stop offset="50%" stopColor="#eab308" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.9} />
          </linearGradient>
          <linearGradient id="perfGradFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
            <stop offset="50%" stopColor="#eab308" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="score" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#1e1b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
          cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
          formatter={(v) => [`${v} employee${v !== 1 ? 's' : ''}`, 'Count']}
        />
        {avg > 0 && (
          <ReferenceLine x={avg.toFixed(1)} stroke="#a78bfa" strokeDasharray="4 3" label={{ value: `avg ${avg.toFixed(1)}`, fill: '#a78bfa', fontSize: 11, position: 'top' }} />
        )}
        <Area type="monotone" dataKey="count" stroke="url(#perfGrad)" strokeWidth={2} fill="url(#perfGradFill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
