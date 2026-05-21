'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { LogOut } from 'lucide-react'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <DropdownMenuItem
      onClick={handleSignOut}
      className="cursor-pointer text-lr-muted hover:text-lr-text"
    >
      <LogOut className="mr-2 h-4 w-4" />
      Sign out
    </DropdownMenuItem>
  )
}
