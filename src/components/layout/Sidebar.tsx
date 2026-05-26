'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Network,
  ClipboardList,
  CalendarCheck,
  BarChart2,
  Settings2,
} from 'lucide-react'
import type { UserRole } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import GiveKudosNavButton from '@/components/kudos/GiveKudosNavButton'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface SidebarProps {
  role: UserRole
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()

  const mainNav: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]

  const myWorkNav: NavItem[] = [
    { href: '/checkins', label: 'Monthly Check-ins', icon: ClipboardList },
    { href: '/quarterly-checkins', label: 'Quarterly Reviews', icon: CalendarCheck },
  ]

  const teamNav: NavItem[] = [
    ...((role === 'MANAGER' || role === 'HR_ADMIN') ? [{ href: '/team', label: 'My Team', icon: Users }] : []),
    { href: '/org', label: 'Org Chart', icon: Network },
  ]

  const adminNav: NavItem[] = role === 'HR_ADMIN' ? [
    { href: '/analytics', label: 'Analytics', icon: BarChart2 },
    { href: '/admin/settings', label: 'Org Settings', icon: Settings2 },
  ] : []

  return (
    <aside className="hidden md:flex fixed left-0 top-14 bottom-0 w-56 flex-col border-r border-lr-border bg-lr-bg/50 backdrop-blur-[8px] p-4 overflow-y-auto">
      <nav className="space-y-1">
        {mainNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="mt-4 mb-2">
        <span className="text-section-label">My Work</span>
      </div>
      <nav className="space-y-1">
        {myWorkNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      {teamNav.length > 0 && (
        <>
          <div className="mt-6 mb-2">
            <span className="text-section-label">My Team</span>
          </div>
          <nav className="space-y-1">
            {teamNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
            {(role === 'MANAGER' || role === 'HR_ADMIN') && (
              <GiveKudosNavButton />
            )}
          </nav>
        </>
      )}

      {adminNav.length > 0 && (
        <>
          <div className="mt-6 mb-2">
            <span className="text-section-label">Administration</span>
          </div>
          <nav className="space-y-1">
            {adminNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>
        </>
      )}
    </aside>
  )
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius-lr)] px-3 py-2 text-sm font-medium transition-colors duration-150',
        isActive
          ? 'bg-lr-accent-dim text-lr-accent'
          : 'text-lr-muted hover:text-lr-text hover:bg-lr-surface'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  )
}
