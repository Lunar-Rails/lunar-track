'use client'

import { useTransition, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateUserRole } from '@/lib/actions/user-actions'
import type { UserRole } from '@/lib/types/database'

const ROLE_COLORS: Record<UserRole, string> = {
  HR_ADMIN: 'text-lr-accent',
  MANAGER: 'text-lr-gold',
  EMPLOYEE: 'text-lr-cyan',
}

interface RoleSelectProps {
  userId: string
  currentRole: UserRole
}

export default function RoleSelect({ userId, currentRole }: RoleSelectProps) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState<UserRole>(currentRole)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleChange = (newRole: string) => {
    setFeedback(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('userId', userId)
      formData.set('newRole', newRole)
      const result = await updateUserRole(formData)
      if ('error' in result) {
        setFeedback({ type: 'error', message: result.error })
      } else {
        setValue(newRole as UserRole)
        setFeedback({ type: 'success', message: 'Updated' })
        setTimeout(() => setFeedback(null), 2000)
      }
    })
  }

  return (
    <div className="space-y-1">
      <Select value={value} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className={`w-36 h-8 text-xs border-lr-border bg-lr-surface ${ROLE_COLORS[currentRole]}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-lr-surface border-lr-border">
          {(['EMPLOYEE', 'MANAGER', 'HR_ADMIN'] as UserRole[]).map((role) => (
            <SelectItem key={role} value={role} className={`text-xs ${ROLE_COLORS[role]}`}>
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {feedback && (
        <p className={`text-xs ${feedback.type === 'error' ? 'text-lr-error' : 'text-lr-success'}`}>
          {feedback.message}
        </p>
      )}
    </div>
  )
}
