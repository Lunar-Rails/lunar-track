'use client'

import { useMemo } from 'react'
import type { Profile, UserRole } from '@/lib/types/database'

interface OrgTreeProps {
  profiles: Profile[]
}

interface TreeNode {
  profile: Profile
  children: TreeNode[]
}

const ROLE_BADGE: Record<UserRole, string> = {
  HR_ADMIN: 'bg-lr-accent-dim text-lr-accent',
  MANAGER:  'bg-lr-gold-dim text-lr-gold',
  EMPLOYEE: 'bg-lr-cyan-dim text-lr-cyan',
}

const ROLE_LABEL: Record<UserRole, string> = {
  HR_ADMIN: 'HR Admin',
  MANAGER:  'Manager',
  EMPLOYEE: 'Employee',
}

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-cyan-500',
  'bg-teal-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-pink-500', 'bg-fuchsia-500', 'bg-orange-500', 'bg-sky-500',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initials(p: Profile): string {
  if (p.full_name) return p.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return p.email.slice(0, 2).toUpperCase()
}

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

function Card({ profile }: { profile: Profile }) {
  const color = avatarColor(profile.id)
  const name = profile.full_name ?? profile.email
  return (
    <div className="flex flex-col items-center w-36 shrink-0">
      {/* Avatar */}
      <div className={`w-11 h-11 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold shadow-md ring-2 ring-lr-border mb-2 overflow-hidden shrink-0`}>
        {profile.avatar_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
          : initials(profile)
        }
      </div>
      {/* Info card */}
      <div className="w-full rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface px-2 py-2 text-center shadow-[var(--shadow-lr-card)]">
        <p className="text-[11px] font-semibold text-lr-text leading-tight line-clamp-2">{name}</p>
        <span className={`inline-block mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_BADGE[profile.role]}`}>
          {ROLE_LABEL[profile.role]}
        </span>
      </div>
    </div>
  )
}

function OrgNode({ node }: { node: TreeNode }) {
  const { children } = node

  return (
    <div className="flex flex-col items-center">
      <Card profile={node.profile} />

      {children.length > 0 && (
        <>
          {/* Stem down from card */}
          <div className="w-px h-5 bg-lr-border shrink-0" />

          {children.length === 1 ? (
            // Single child — straight line, no horizontal bar needed
            <OrgNode node={children[0]} />
          ) : (
            // Multiple children — draw horizontal bar then drop lines
            <div className="flex flex-col items-center w-full">
              {/* Horizontal bar row */}
              <div className="flex w-full">
                {children.map((child, i) => (
                  <div
                    key={child.profile.id}
                    className="flex-1 flex flex-col items-center"
                  >
                    {/* Top half of vertical drop — forms the horizontal bar via border-top */}
                    <div
                      className={[
                        'w-full h-5 border-t border-lr-border',
                        // Left cap: only draw right half
                        i === 0 ? 'border-l-0 rounded-none' : '',
                        // Right cap: only draw left half
                        i === children.length - 1 ? 'border-r-0 rounded-none' : '',
                      ].join(' ')}
                      style={{
                        borderLeft:  i === 0                       ? 'none' : undefined,
                        borderRight: i === children.length - 1     ? 'none' : undefined,
                        // For all except first/last, the border-top shows as the horizontal bar
                        // The center of each cell aligns with card center below
                      }}
                    />
                    {/* Vertical drop to child */}
                    <div className="w-px h-4 bg-lr-border" />
                  </div>
                ))}
              </div>

              {/* Children row */}
              <div className="flex gap-6">
                {children.map(child => (
                  <OrgNode key={child.profile.id} node={child} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function OrgTree({ profiles }: OrgTreeProps) {
  const roots = useMemo(() => buildTree(profiles), [profiles])

  if (roots.length === 0) {
    return (
      <div className="py-12 text-center text-lr-muted text-sm">
        No users in the org chart yet.
      </div>
    )
  }

  return (
    <div className="overflow-auto p-6">
      <div className="flex gap-16 justify-center min-w-max">
        {roots.map(root => (
          <OrgNode key={root.profile.id} node={root} />
        ))}
      </div>
    </div>
  )
}
