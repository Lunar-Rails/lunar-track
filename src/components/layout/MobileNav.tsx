'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Network,
  ClipboardList,
  CalendarCheck,
  CalendarDays,
  BarChart2,
  Settings2,
  Menu,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import type { UserRole } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  beta?: boolean
}

interface MobileNavProps {
  role: UserRole
}

export default function MobileNav({ role }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const mainNav: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]

  const myWorkNav: NavItem[] = [
    { href: '/weekly-checkins', label: 'Weekly Check-ins', icon: CalendarDays, beta: true },
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="md:hidden flex items-center justify-center h-8 w-8 rounded-[var(--radius-lr)] text-lr-muted hover:text-lr-text hover:bg-lr-surface transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-lr-bg border-lr-border p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex items-center gap-2 h-14 px-4 border-b border-lr-border">
          <Image src="/icon-circle.svg" alt="CiaoBob" width={24} height={24} />
          <span className="font-display font-bold text-base text-lr-text tracking-tight">CiaoBob</span>
        </div>
        <nav className="p-4 space-y-1">
          {mainNav.map((item) => (
            <MobileNavLink key={item.href} item={item} pathname={pathname} onClose={() => setOpen(false)} />
          ))}
          <div className="pt-3 pb-1">
            <span className="text-section-label">My Work</span>
          </div>
          {myWorkNav.map((item) => (
            <MobileNavLink key={item.href} item={item} pathname={pathname} onClose={() => setOpen(false)} />
          ))}
          {teamNav.length > 0 && (
            <>
              <div className="pt-5 pb-1">
                <span className="text-section-label">My Team</span>
              </div>
              {teamNav.map((item) => (
                <MobileNavLink key={item.href} item={item} pathname={pathname} onClose={() => setOpen(false)} />
              ))}
            </>
          )}
          {adminNav.length > 0 && (
            <>
              <div className="pt-5 pb-1">
                <span className="text-section-label">Administration</span>
              </div>
              {adminNav.map((item) => (
                <MobileNavLink key={item.href} item={item} pathname={pathname} onClose={() => setOpen(false)} />
              ))}
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

function MobileNavLink({
  item,
  pathname,
  onClose,
}: {
  item: NavItem
  pathname: string
  onClose: () => void
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius-lr)] px-3 py-2 text-sm font-medium transition-colors duration-150',
        isActive
          ? 'bg-lr-accent-dim text-lr-accent'
          : 'text-lr-muted hover:text-lr-text hover:bg-lr-surface'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.beta && (
        <span className="ml-auto shrink-0 rounded-full bg-lr-accent-dim px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-lr-accent">
          Beta
        </span>
      )}
    </Link>
  )
}
