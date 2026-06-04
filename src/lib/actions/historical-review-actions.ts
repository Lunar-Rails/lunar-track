'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface HistoricalReview {
  id: string
  employee_id: string
  manager_id: string
  created_at: string
  updated_at: string
  period_label: string
  source: 'notion' | 'hibob' | 'fathom' | 'manual' | 'other' | null
  professional_mastery: number | null
  okrs_stretch_goals: number | null
  behaviours_values: number | null
  summary: string | null
  raw_import: string | null
}

export interface ExtractedReview {
  period_label: string
  source: string
  professional_mastery: number | null
  okrs_stretch_goals: number | null
  behaviours_values: number | null
  summary: string
}

export async function extractReviewWithLLM(rawText: string): Promise<{ data: ExtractedReview | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Not authenticated' }

  const key = process.env.OPENAI_API_KEY
  if (!key) return { data: null, error: 'OPENAI_API_KEY not configured' }

  const client = new OpenAI({ apiKey: key })

  const prompt = `You are a performance management assistant. A manager has pasted raw notes from a past employee performance review. Extract structured data from these notes and return ONLY a valid JSON object (no markdown, no explanation).

Notes:
---
${rawText.slice(0, 8000)}
---

Return this exact JSON shape (use null for fields you cannot determine):
{
  "period_label": "<quarter/half/year label, e.g. 'Q2 2024' or 'H1 2023'>",
  "source": "<one of: notion, hibob, fathom, manual, other>",
  "professional_mastery": <null or number 1.0–5.0>,
  "okrs_stretch_goals": <null or number 1.0–5.0>,
  "behaviours_values": <null or number 1.0–5.0>,
  "summary": "<2–4 sentence neutral summary of the review content>"
}

For scores: only extract a numeric score if the notes clearly state one on a 1–5 scale or can be confidently mapped to 1–5. Otherwise use null.`

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = completion.choices[0]?.message?.content?.trim() ?? ''
    const extracted = JSON.parse(text) as ExtractedReview
    return { data: extracted, error: null }
  } catch (err) {
    console.error('[extractReviewWithLLM]', err)
    return { data: null, error: 'Failed to extract review — check your input or try again.' }
  }
}

export async function saveHistoricalReview(params: {
  employeeId: string
  periodLabel: string
  source: string
  professionalMastery: number | null
  okrsStretchGoals: number | null
  behavioursValues: number | null
  summary: string
  rawImport: string
}): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('historical_reviews').insert({
    employee_id: params.employeeId,
    manager_id: user.id,
    period_label: params.periodLabel,
    source: params.source || null,
    professional_mastery: params.professionalMastery,
    okrs_stretch_goals: params.okrsStretchGoals,
    behaviours_values: params.behavioursValues,
    summary: params.summary || null,
    raw_import: params.rawImport || null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/team/${params.employeeId}`)
  return { error: null }
}

export async function deleteHistoricalReview(id: string, employeeId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('historical_reviews').delete().eq('id', id).eq('manager_id', user.id)

  if (error) return { error: error.message }
  revalidatePath(`/team/${employeeId}`)
  return { error: null }
}
