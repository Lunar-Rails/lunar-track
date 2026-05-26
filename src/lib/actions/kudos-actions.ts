'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Kudo {
  id: string
  sender_id: string
  recipient_id: string
  value_id: string | null
  value_name: string
  note: string
  created_at: string
  sender?: { full_name: string | null; email: string; avatar_url: string | null }
  recipient?: { full_name: string | null; email: string; avatar_url: string | null }
}

export async function sendKudos(params: {
  recipientId: string
  valueId: string | null
  valueName: string
  note: string
}): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (user.id === params.recipientId) return { error: 'You cannot send kudos to yourself' }
  if (!params.note.trim()) return { error: 'Note is required' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('kudos').insert({
    sender_id: user.id,
    recipient_id: params.recipientId,
    value_id: params.valueId,
    value_name: params.valueName,
    note: params.note.trim(),
  })
  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath(`/team/${params.recipientId}`)
  revalidatePath('/team')
  return { error: null }
}

export async function deleteKudo(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('kudos').delete().eq('id', id).eq('sender_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/team')
  return { error: null }
}
