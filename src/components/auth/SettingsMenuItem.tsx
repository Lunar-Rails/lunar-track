'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { UserCircle } from 'lucide-react'

export default function SettingsMenuItem() {
  return (
    <DropdownMenuItem
      onSelect={() => { window.location.href = '/settings' }}
      className="cursor-pointer flex items-center gap-2 text-sm"
    >
      <UserCircle className="h-4 w-4" />
      Settings
    </DropdownMenuItem>
  )
}
