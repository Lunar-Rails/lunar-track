'use client'

import { useMemo, useState } from 'react'
import { Search, Users, GitBranch, X } from 'lucide-react'
import type { Profile, UserRole } from '@/lib/types/database'

// ─── Domain → Company label ──────────────────────────────────────────────────

const DOMAIN_COMPANY: Record<string, string> = {
  'lunarrails.io':  'Lunar Rails',
  'clovrlabs.com':  'ClovrLabs',
  'chainlabs.ai':   'Chainlabs',
  'podproza.cz':    'Podproza',
  '40acres.pro':    '40 Acres',
  'elenpay.tech':   'ElenPay',
  'overe.io':       'Overe',
  'vroeff.nl':      'Vroeff',
}

function domainOf(email: string) {
  return email.split('@')[1]?.toLowerCase() ?? ''
}

function companyOf(email: string) {
  return DOMAIN_COMPANY[domainOf(email)] ?? domainOf(email)
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const ROLE_BADGE: Record<UserRole, string> = {
  HR_ADMIN: 'bg-lr-accent-dim text-lr-accent border-lr-accent/20',
  MANAGER:  'bg-lr-gold-dim text-lr-gold border-lr-gold/20',
  EMPLOYEE: 'bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20',
}
const ROLE_LABEL: Record<UserRole, string> = {
  HR_ADMIN: 'HR Admin',
  MANAGER:  'Manager',
  EMPLOYEE: 'Employee',
}

const AVATAR_COLORS = [
  'bg-violet-500','bg-indigo-500','bg-blue-500','bg-cyan-500',
  'bg-teal-500','bg-emerald-500','bg-amber-500','bg-rose-500',
  'bg-pink-500','bg-fuchsia-500','bg-orange-500','bg-sky-500',
]
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(p: Profile) {
  if (p.full_name) return p.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return p.email.slice(0, 2).toUpperCase()
}

function Avatar({ profile, size = 'md' }: { profile: Profile; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-base' : 'w-10 h-10 text-sm'
  return (
    <div className={`${dim} rounded-full ${avatarColor(profile.id)} flex items-center justify-center text-white font-bold ring-2 ring-lr-border shrink-0 overflow-hidden`}>
      {profile.avatar_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        : initials(profile)
      }
    </div>
  )
}

// ─── Inner circle calculation ─────────────────────────────────────────────────

function getInnerCircleIds(profiles: Profile[], currentUserId: string): Set<string> {
  const me = profiles.find(p => p.id === currentUserId)
  if (!me) return new Set([currentUserId])

  const ids = new Set<string>([currentUserId])

  // My manager + my peers (others reporting to same manager)
  if (me.manager_id) {
    ids.add(me.manager_id)
    for (const p of profiles) {
      if (p.manager_id === me.manager_id && p.id !== currentUserId) ids.add(p.id)
    }
  }

  // My direct reports + their direct reports (1 layer below)
  for (const p of profiles) {
    if (p.manager_id === currentUserId) {
      ids.add(p.id)
      for (const pp of profiles) {
        if (pp.manager_id === p.id) ids.add(pp.id)
      }
    }
  }

  return ids
}

function getExpandedByDefaultIds(profiles: Profile[], currentUserId: string): Set<string> {
  const me = profiles.find(p => p.id === currentUserId)
  if (!me) return new Set<string>()

  const ids = new Set<string>()

  // Walk up from me to root — each ancestor node should be expanded so I'm visible
  let current: Profile | undefined = me
  while (current) {
    ids.add(current.id)
    current = current.manager_id ? profiles.find(p => p.id === current!.manager_id) : undefined
  }

  // My peers — expand them so their direct reports are visible
  if (me.manager_id) {
    for (const p of profiles) {
      if (p.manager_id === me.manager_id && p.id !== currentUserId) ids.add(p.id)
    }
  }

  return ids
}

// ─── Grid card ────────────────────────────────────────────────────────────────

function PersonCard({ profile, profileMap, currentUserId, highlight }: {
  profile: Profile
  profileMap: Map<string, Profile>
  currentUserId: string
  highlight?: boolean
}) {
  const manager = profile.manager_id ? profileMap.get(profile.manager_id) : null
  const isMe = profile.id === currentUserId
  const company = companyOf(profile.email)

  return (
    <div className={[
      'rounded-[var(--radius-lr-lg)] border bg-lr-glass backdrop-blur-[8px] p-4 flex flex-col gap-3 transition-colors',
      highlight ? 'border-lr-accent/40 bg-lr-accent/5' : 'border-lr-border hover:bg-lr-surface',
    ].join(' ')}>
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar profile={profile} size="lg" />
          {isMe && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-lr-accent border-2 border-lr-surface" title="You" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-lr-text leading-snug truncate">
            {profile.full_name ?? profile.email}
            {isMe && <span className="ml-1.5 text-[10px] text-lr-accent font-normal">(you)</span>}
          </p>
          <p className="text-xs text-lr-muted truncate mt-0.5">{profile.email}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${ROLE_BADGE[profile.role]}`}>
          {profile.job_title ?? ROLE_LABEL[profile.role]}
        </span>
        <span className="inline-flex items-center rounded-full border border-lr-border bg-lr-surface px-2 py-0.5 text-[10px] text-lr-muted leading-none">
          {company}
        </span>
      </div>

      {manager && (
        <div className="flex items-center gap-2 pt-1 border-t border-lr-border/50">
          <Avatar profile={manager} size="sm" />
          <div className="min-w-0">
            <p className="text-[10px] text-lr-muted leading-none mb-0.5">Reports to</p>
            <p className="text-xs text-lr-text truncate">{manager.full_name ?? manager.email}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tree view ────────────────────────────────────────────────────────────────

interface TreeNode { profile: Profile; children: TreeNode[] }

function buildTree(profiles: Profile[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  profiles.forEach(p => map.set(p.id, { profile: p, children: [] }))
  const roots: TreeNode[] = []
  profiles.forEach(p => {
    const node = map.get(p.id)!
    if (p.manager_id && map.has(p.manager_id)) {
      map.get(p.manager_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  function sort(nodes: TreeNode[]) {
    nodes.sort((a, b) => (a.profile.full_name ?? a.profile.email).localeCompare(b.profile.full_name ?? b.profile.email))
    nodes.forEach(n => sort(n.children))
  }
  sort(roots)
  return roots
}

function TreeCard({ profile, profileMap, currentUserId }: { profile: Profile; profileMap: Map<string, Profile>; currentUserId: string }) {
  const isMe = profile.id === currentUserId
  const name = profile.full_name ?? profile.email
  return (
    <div className="flex flex-col items-center w-36 shrink-0">
      <div className="relative">
        <Avatar profile={profile} />
        {isMe && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-lr-accent border-2 border-lr-surface" />}
      </div>
      <div className={[
        'mt-2 w-full rounded-[var(--radius-lr)] border px-2 py-1.5 text-center shadow-[var(--shadow-lr-card)]',
        isMe ? 'border-lr-accent/40 bg-lr-accent/5' : 'border-lr-border bg-lr-surface',
      ].join(' ')}>
        <p className="text-[11px] font-semibold text-lr-text leading-tight line-clamp-2">{name}</p>
        <p className="text-[9px] text-lr-muted mt-0.5 truncate">{profile.email}</p>
        <span className={`inline-block mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${ROLE_BADGE[profile.role]}`}>
          {profile.job_title ?? ROLE_LABEL[profile.role]}
        </span>
      </div>
    </div>
  )
}

function OrgNode({ node, profileMap, currentUserId, expandedByDefaultIds }: {
  node: TreeNode
  profileMap: Map<string, Profile>
  currentUserId: string
  expandedByDefaultIds: Set<string>
}) {
  const [collapsed, setCollapsed] = useState(!expandedByDefaultIds.has(node.profile.id))
  const { children } = node
  const hasChildren = children.length > 0

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <TreeCard profile={node.profile} profileMap={profileMap} currentUserId={currentUserId} />
        {hasChildren && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10 w-5 h-5 rounded-full border border-lr-border bg-lr-surface text-lr-muted hover:text-lr-accent hover:border-lr-accent/40 text-[10px] font-bold flex items-center justify-center shadow transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? `+${children.length}` : '−'}
          </button>
        )}
      </div>

      {hasChildren && !collapsed && (
        <>
          <div className="w-px h-6 bg-lr-border shrink-0 mt-2" />
          {children.length === 1 ? (
            <OrgNode node={children[0]} profileMap={profileMap} currentUserId={currentUserId} expandedByDefaultIds={expandedByDefaultIds} />
          ) : (
            <div className="flex flex-col items-center w-full">
              <div className="flex w-full">
                {children.map((child, i) => (
                  <div key={child.profile.id} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full h-5 border-t border-lr-border"
                      style={{
                        borderLeft: i === 0 ? 'none' : undefined,
                        borderRight: i === children.length - 1 ? 'none' : undefined,
                      }}
                    />
                    <div className="w-px h-3 bg-lr-border" />
                  </div>
                ))}
              </div>
              <div className="flex gap-5">
                {children.map(child => (
                  <OrgNode key={child.profile.id} node={child} profileMap={profileMap} currentUserId={currentUserId} expandedByDefaultIds={expandedByDefaultIds} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface OrgChartProps {
  profiles: Profile[]
  currentUserId: string
}

type ViewMode = 'grid' | 'tree'

export default function OrgChart({ profiles, currentUserId }: OrgChartProps) {
  const [view, setView] = useState<ViewMode>('tree')
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string | null>(null)
  const [innerCircle, setInnerCircle] = useState(true)

  const expandedByDefaultIds = useMemo(
    () => getExpandedByDefaultIds(profiles, currentUserId),
    [profiles, currentUserId]
  )

  // Derive unique companies from profiles
  const companies = useMemo(() => {
    const seen = new Map<string, string>() // domain → label
    for (const p of profiles) {
      const domain = domainOf(p.email)
      if (domain && !seen.has(domain)) seen.set(domain, DOMAIN_COMPANY[domain] ?? domain)
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [profiles])

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])
  const innerCircleIds = useMemo(() => getInnerCircleIds(profiles, currentUserId), [profiles, currentUserId])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return profiles.filter(p => {
      if (innerCircle && !innerCircleIds.has(p.id)) return false
      if (companyFilter && domainOf(p.email) !== companyFilter) return false
      if (q && !(p.full_name ?? '').toLowerCase().includes(q) && !p.email.toLowerCase().includes(q) && !(p.job_title ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [profiles, search, companyFilter, innerCircle, innerCircleIds])

  const treeRoots = useMemo(() => buildTree(filtered), [filtered])

  const activeFilters = (innerCircle ? 1 : 0) + (companyFilter ? 1 : 0) + (search ? 1 : 0)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-lr-muted pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface text-sm text-lr-text placeholder:text-lr-muted outline-none focus:border-lr-accent/50 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-lr-muted hover:text-lr-text">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Inner circle toggle */}
          <button
            onClick={() => setInnerCircle(v => !v)}
            className={[
              'flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-lr)] border text-sm font-medium transition-colors',
              innerCircle
                ? 'border-lr-accent bg-lr-accent/10 text-lr-accent'
                : 'border-lr-border bg-lr-surface text-lr-muted hover:text-lr-text hover:border-lr-accent/40',
            ].join(' ')}
          >
            <Users className="h-3.5 w-3.5" />
            My circle
          </button>

          {/* View toggle */}
          <div className="flex rounded-[var(--radius-lr)] border border-lr-border overflow-hidden shrink-0">
            <button
              onClick={() => setView('grid')}
              className={`flex items-center gap-1.5 px-3 h-9 text-sm transition-colors ${view === 'grid' ? 'bg-lr-accent text-white' : 'bg-lr-surface text-lr-muted hover:text-lr-text'}`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
                <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
              </svg>
              Grid
            </button>
            <button
              onClick={() => setView('tree')}
              className={`flex items-center gap-1.5 px-3 h-9 text-sm border-l border-lr-border transition-colors ${view === 'tree' ? 'bg-lr-accent text-white' : 'bg-lr-surface text-lr-muted hover:text-lr-text'}`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Tree
            </button>
          </div>
        </div>

        {/* Company pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCompanyFilter(null)}
            className={[
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              companyFilter === null
                ? 'border-lr-accent bg-lr-accent/10 text-lr-accent'
                : 'border-lr-border bg-lr-surface text-lr-muted hover:text-lr-text hover:border-lr-accent/30',
            ].join(' ')}
          >
            All companies
          </button>
          {companies.map(([domain, label]) => (
            <button
              key={domain}
              onClick={() => setCompanyFilter(companyFilter === domain ? null : domain)}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                companyFilter === domain
                  ? 'border-lr-accent bg-lr-accent/10 text-lr-accent'
                  : 'border-lr-border bg-lr-surface text-lr-muted hover:text-lr-text hover:border-lr-accent/30',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Active filter summary */}
        {activeFilters > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-lr-muted">
              Showing {filtered.length} of {profiles.length} people
            </span>
            <button
              onClick={() => { setSearch(''); setCompanyFilter(null); setInnerCircle(false) }}
              className="text-xs text-lr-accent hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-lr-muted text-sm">
          No people match your filters.
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(p => (
            <PersonCard
              key={p.id}
              profile={p}
              profileMap={profileMap}
              currentUserId={currentUserId}
              highlight={innerCircle && p.id !== currentUserId}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-auto rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6">
          {treeRoots.length === 0 ? (
            <p className="text-center text-lr-muted text-sm py-8">No hierarchy to display with current filters.</p>
          ) : (
            <div className="flex gap-12 justify-start min-w-max">
              {treeRoots.map(root => (
                <OrgNode key={root.profile.id} node={root} profileMap={profileMap} currentUserId={currentUserId} expandedByDefaultIds={expandedByDefaultIds} />
              ))}
            </div>
          )}
          <p className="text-xs text-lr-muted mt-4">Click the +/− buttons on each node to expand or collapse their reports.</p>
        </div>
      )}
    </div>
  )
}
