'use client'

import { useState, useMemo, useTransition, useEffect, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

export default function UsersTable({ users, allUsers }: UsersTableProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL')
  const [domainFilter, setDomainFilter] = useState<string>('ALL')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filterRef = useRef<HTMLDivElement>(null)
  const [filterH, setFilterH] = useState(56)

  useEffect(() => {
    const el = filterRef.current
    if (!el) return
    const update = () => setFilterH(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Derive unique domains from user list
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

  const columns: ColumnDef<Profile>[] = [
    {
      accessorKey: 'full_name',
      header: 'Name',
      cell: ({ row }) => {
        const u = row.original
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={u.avatar_url ?? undefined} />
              <AvatarFallback className="bg-lr-accent text-white text-xs">
                {getInitials(u.full_name, u.email)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-lr-text">{u.full_name ?? u.email}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => (
        <span className="text-sm text-lr-muted">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <RoleSelect userId={row.original.id} currentRole={row.original.role} />
      ),
    },
    {
      accessorKey: 'manager_id',
      header: 'Manager',
      cell: ({ row }) => {
        const u = row.original
        const currentManagerName = u.manager_id ? (managerMap.get(u.manager_id) ?? null) : null
        return (
          <div>
            {currentManagerName && (
              <p className="text-xs text-lr-muted mb-1">{currentManagerName}</p>
            )}
            <ManagerSelect
              employeeId={u.id}
              currentManagerId={u.manager_id}
              allUsers={allUsers}
            />
          </div>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Joined',
      cell: ({ getValue }) => (
        <span className="text-xs text-lr-muted">
          {format(new Date(getValue() as string), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const u = row.original
        const isRemoving = removingId === u.id
        return (
          <button
            type="button"
            disabled={isPending || isRemoving}
            onClick={() => handleRemove(u.id, u.full_name ?? u.email)}
            className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isRemoving ? 'Removing…' : 'Remove'}
          </button>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Filters — sticky just below the page header */}
      <div
        ref={filterRef}
        className="flex items-center gap-3 flex-wrap sticky z-20 bg-white py-3 -mx-6 px-6"
        style={{ top: 'var(--admin-sticky-header-h, 0px)' }}
      >
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
                <SelectItem key={d} value={d}>@{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="text-caption ml-auto">
          {filteredData.length} user{filteredData.length !== 1 ? 's' : ''}
        </span>
      </div>

      {removeError && (
        <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {removeError}
        </div>
      )}

      {/* Table — overflow-x-auto removed so sticky <th> uses main as scroll container */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border">
          <Table className="border-separate border-spacing-0">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="sticky z-20 text-section-label bg-white py-3 border-b border-lr-border shadow-[0_1px_0_0_rgba(0,0,0,0.06)]"
                      style={{ top: `calc(var(--admin-sticky-header-h, 0px) + ${filterH}px)` }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-lr-muted">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-b border-lr-border hover:bg-lr-surface transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </div>
    </div>
  )
}
