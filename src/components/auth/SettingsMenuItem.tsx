'use client'

import { useRouter } from 'next/navigation'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { UserCircle } from 'lucide-react'

export default function SettingsMenuItem() {
  const router = useRouter()
  return (
    <DropdownMenuItem
      onClick={() => router.push('/settings')}
      className="cursor-pointer flex items-center gap-2 text-sm"
    >
      <UserCircle className="h-4 w-4" />
      Settings
    </DropdownMenuItem>
  )
}
