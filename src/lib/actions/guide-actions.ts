'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile } from '@/lib/types/database'

type ActionResult = { success: true } | { error: string }

export async function updateGuideSection(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
  const profile = profileRaw as Pick<Profile, 'role'> | null
  if (!profile || profile.role !== 'HR_ADMIN') return { error: 'HR Admin only' }

  const schema = z.object({
    sectionId: z.string().uuid(),
    content: z.string().min(1).max(50000),
    title: z.string().min(1).max(200),
  })

  const parsed = schema.safeParse({
    sectionId: formData.get('sectionId'),
    content: formData.get('content'),
    title: formData.get('title'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('guide_sections')
    .update({
      title: parsed.data.title,
      content: parsed.data.content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.sectionId)

  if (error) return { error: 'Failed to update: ' + error.message }

  revalidatePath('/guide')
  return { success: true }
}
