'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, ChevronDown } from 'lucide-react'

const ENTRY_TYPES = [
  { label: 'Goal', description: 'Objective with Key Results & Initiatives' },
  { label: 'Deliverable', description: 'Concrete output or project commitment' },
  { label: 'Goal', description: 'Personal or professional development goal' },
] as const

export default function AddEntryButton() {
  const router = useRouter()

  function handleSelect(type: string) {
    router.push(`/okrs/new?type=${encodeURIComponent(type)}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-lr-accent hover:bg-lr-accent-hover text-white gap-2">
          <Plus className="h-4 w-4" />
          Add Goal / Deliverable
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 bg-lr-surface border-lr-border shadow-[var(--shadow-lr-card)] p-1.5"
      >
        {ENTRY_TYPES.map(({ label, description }) => (
          <DropdownMenuItem
            key={label}
            className="flex flex-col items-start gap-0.5 cursor-pointer py-3 px-3 rounded-[var(--radius-lr)] focus:bg-lr-accent-dim focus:text-lr-accent"
            onClick={() => handleSelect(label)}
          >
            <span className="font-semibold text-sm text-lr-text">+ {label}</span>
            <span className="text-xs text-lr-muted">{description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
