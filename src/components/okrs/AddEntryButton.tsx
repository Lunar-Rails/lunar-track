'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function AddEntryButton() {
  const router = useRouter()
  return (
    <Button
      className="bg-lr-accent hover:bg-lr-accent-hover text-white gap-2"
      onClick={() => router.push('/okrs/new')}
    >
      <Plus className="h-4 w-4" />
      Add Goal
    </Button>
  )
}
