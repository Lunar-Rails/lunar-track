import Image from 'next/image'
import Link from 'next/link'
import { Inbox, Menu } from 'lucide-react'
import MobileNav from '@/components/layout/MobileNav'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import SignOutButton from '@/components/auth/SignOutButton'
import SettingsMenuItem from '@/components/auth/SettingsMenuItem'
import ThemeToggle from '@/components/theme/ThemeToggle'
import type { Profile } from '@/lib/types/database'

interface HeaderProps {
  profile: Profile
  inboxCount?: number
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export default function Header({ profile, inboxCount = 0 }: HeaderProps) {
  const initials = getInitials(profile.full_name, profile.email)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-lr-border bg-lr-bg/80 backdrop-blur-[24px]">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Hamburger (mobile) + Logo */}
        <div className="flex items-center gap-2">
          <MobileNav role={profile.role} />
          <Image src="/icon-circle.svg" alt="LunarTrack" width={28} height={28} />
          <span className="font-display font-bold text-lg text-lr-text tracking-tight">
            LunarTrack
          </span>
        </div>

        {/* Right: Theme toggle + Inbox + User pill */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
        {(profile.role === 'MANAGER' || profile.role === 'HR_ADMIN') && (
          <Link
            href="/inbox"
            className="relative flex items-center justify-center h-8 w-8 rounded-[var(--radius-lr)] text-lr-muted hover:text-lr-text hover:bg-lr-surface transition-colors"
            aria-label={inboxCount > 0 ? `Inbox · ${inboxCount} pending` : 'Inbox'}
          >
            <Inbox className="h-4 w-4" />
            {inboxCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-lr-gold text-[9px] font-bold text-black">
                {inboxCount > 9 ? '9+' : inboxCount}
              </span>
            )}
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-[var(--radius-lr)] px-3 py-1.5 text-sm hover:bg-lr-surface transition-colors outline-none">
            <Avatar className="h-7 w-7">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? profile.email} />
              <AvatarFallback className="bg-lr-accent text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-lr-text font-medium max-w-[150px] truncate">
              {profile.full_name ?? profile.email}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-lr-surface border-lr-border">
            <DropdownMenuItem disabled className="opacity-60 cursor-default">
              <span className="truncate text-xs text-lr-muted">{profile.email}</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="opacity-60 cursor-default">
              <span className="text-xs text-lr-muted">{profile.role}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-lr-border" />
            <SettingsMenuItem />
            <DropdownMenuSeparator className="bg-lr-border" />
            <SignOutButton />
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
