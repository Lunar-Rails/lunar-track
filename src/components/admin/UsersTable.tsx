'use client'

import { useState, useMemo, useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import RoleSelect from '@/components/admin/RoleSelect'
import ManagerSelect from '@/components/admin/ManagerSelect'
import { removeUser } from '@/lib/actions/admin-actions'
import { format } from 'date-fns'
import type { Profile, UserRole } from '@/lib/types/database'

interface UsersTableProps {
  users: Profile[]
  allUsers: Pick<Profile, 'id' | 'full_name' | 'email'>[]
}

function getInitials(name: string | null, email: string): string {
  if (name) return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

function getDomain(email: string): string {
  return email.split('@')[1] ?? ''
}

// Shared column template — header labels and data rows both use this
const COLS = '2fr 2fr 150px minmax(0,1.5fr) 100px 80px'

export default function UsersTable({ users, allUsers }: UsersTableProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL')
  const [domainFilter, setDomainFilter] = useState<string>('ALL')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const domains = useMemo(() => {
    const set = new Set(users.map((u) => getDomain(u.email)).filter(Boolean))
    return Array.from(set).sort()
  }, [users])

  const filteredData = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !globalFilter ||
        (u.full_name ?? '').toLowerCase().includes(globalFilter.toLowerCase()) ||
        u.email.toLowerCase().includes(globalFilter.toLowerCase())
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter
      const matchesDomain = domainFilter === 'ALL' || getDomain(u.email) === domainFilter
      return matchesSearch && matchesRole && matchesDomain
    })
  }, [users, globalFilter, roleFilter, domainFilter])

  const managerMap = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach((u) => map.set(u.id, u.full_name ?? u.email))
    return map
  }, [users])

  function handleRemove(userId: string, userName: string) {
    if (!confirm(`Remove ${userName}? This cannot be undone.`)) return
    setRemoveError(null)
    setRemovingId(userId)
    startTransition(async () => {
      const result = await removeUser(userId)
      setRemovingId(null)
      if ('error' in result) setRemoveError(result.error)
    })
  }

  return (
    <div>
      {/*
       * Single sticky block: filter bar + column headers together.
       * One element, one top value — no cascading measurements.
       */}
      <div
        className="sticky z-20 bg-white -mx-6 px-6"
        style={{ top: 'var(--admin-sticky-header-h, 0px)' }}
      >
        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap py-3">
          <Input
            placeholder="Search by name or email…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-xs h-9 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted text-sm"
          />
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole | 'ALL')}>
            <SelectTrigger className="w-36 h-9 bg-lr-surface border-lr-border text-sm text-lr-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-lr-surface border-lr-border">
              <SelectItem value="ALL">All roles</SelectItem>
              <SelectItem value="EMPLOYEE">Employee</SelectItem>
              <SelectItem value="MANAGER">Manager</SelectItem>
              <SelectItem value="HR_ADMIN">HR Admin</SelectItem>
            </SelectContent>
          </Select>
          {domains.length > 1 && (
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="w-44 h-9 bg-lr-surface border-lr-border text-sm text-lr-text">
                <SelectValue placeholder="All companies" />
              </SelectTrigger>
              <SelectContent className="bg-lr-surface border-lr-border">
                <SelectItem value="ALL">All companies</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d} value={d}>
                    @{d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="text-caption ml-auto">
            {filteredData.length} user{filteredData.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Column header row — same grid template as data rows */}
        <div
          className="grid text-section-label border-y border-lr-border shadow-[0_1px_0_0_rgba(0,0,0,0.06)]"
          style={{ gridTemplateColumns: COLS }}
        >
          <div className="py-3 px-4">Name</div>
          <div className="py-3 px-4">Email</div>
          <div className="py-3 px-4">Role</div>
          <div className="py-3 px-4">Manager</div>
          <div className="py-3 px-4">Joined</div>
          <div className="py-3 px-4" />
        </div>
      </div>

      {removeError && (
        <div className="mt-3 rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {removeError}
        </div>
      )}

      {/* Data rows — only these scroll */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border mt-4">
        {filteredData.length === 0 ? (
          <div className="text-center py-8 text-sm text-lr-muted">No users found.</div>
        ) : (
          filteredData.map((u) => {
            const isRemoving = removingId === u.id
            const currentManagerName = u.manager_id ? (managerMap.get(u.manager_id) ?? null) : null
            return (
              <div
                key={u.id}
                className="grid border-b border-lr-border last:border-0 hover:bg-lr-surface transition-colors"
                style={{ gridTemplateColumns: COLS }}
              >
                <div className="py-3 px-4 flex items-center gap-2 min-w-0">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={u.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-lr-accent text-white text-xs">
                      {getInitials(u.full_name, u.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-lr-text truncate">{u.full_name ?? u.email}</span>
                </div>
                <div className="py-3 px-4 flex items-center min-w-0">
                  <span className="text-sm text-lr-muted truncate">{u.email}</span>
                </div>
                <div className="py-3 px-4 flex items-center">
                  <RoleSelect userId={u.id} currentRole={u.role} />
                </div>
                <div className="py-3 px-4 flex flex-col justify-center min-w-0">
                  {currentManagerName && (
                    <p className="text-xs text-lr-muted mb-1 truncate">{currentManagerName}</p>
                  )}
                  <ManagerSelect
                    employeeId={u.id}
                    currentManagerId={u.manager_id}
                    allUsers={allUsers}
                  />
                </div>
                <div className="py-3 px-4 flex items-center">
                  <span className="text-xs text-lr-muted">
                    {format(new Date(u.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="py-3 px-4 flex items-center">
                  <button
                    type="button"
                    disabled={isPending || isRemoving}
                    onClick={() => handleRemove(u.id, u.full_name ?? u.email)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isRemoving ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
