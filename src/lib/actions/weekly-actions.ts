'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { mondayOf } from '@/lib/week'

type ActionResult = { success: true; id?: string } | { error: string }

// Coerce any value to a length-bounded string; never throws.
const boundedText = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' ? v : v == null ? '' : String(v)), z.string())
   .transform((s) => s.slice(0, max))

const planTaskSchema = z.object({
  title: boundedText(300),
  mit_id: z.string().nullable().catch(null),
  mit_label: z.string().nullable().catch(null),
})

export async function upsertWeeklyCheckin(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const schema = z.object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    progress: z.string().max(4000).optional(),
    problems: z.string().max(4000).optional(),
    last_minute_requests: z.string().max(4000).optional(),
    plan_tasks: z.string().default('[]'),
  })
  const parsed = schema.safeParse({
    weekStart: formData.get('weekStart'),
    progress: formData.get('progress') || undefined,
    problems: formData.get('problems') || undefined,
    last_minute_requests: formData.get('last_minute_requests') || undefined,
    plan_tasks: formData.get('plan_tasks') || '[]',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const weekStart = mondayOf(parsed.data.weekStart)
  let planTasks
  try {
    planTasks = z.array(planTaskSchema).parse(JSON.parse(parsed.data.plan_tasks))
      .filter((t) => t.title.trim())
      .slice(0, 2)
  } catch {
    return { error: 'Invalid plan format' }
  }

  const payload = {
    employee_id: user.id,
    week_start: weekStart,
    progress: parsed.data.progress ?? null,
    plan_tasks: planTasks,
    problems: parsed.data.problems ?? null,
    last_minute_requests: parsed.data.last_minute_requests ?? null,
    updated_at: new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('weekly_checkins')
    .upsert(payload, { onConflict: 'employee_id,week_start' })
    .select('id')
    .single()
  if (error) return { error: 'Failed to save weekly check-in: ' + error.message }

  revalidatePath('/checkins')
  revalidatePath('/weekly-checkins')
  revalidatePath('/dashboard')
  return { success: true, id: (data as { id: string }).id }
}
