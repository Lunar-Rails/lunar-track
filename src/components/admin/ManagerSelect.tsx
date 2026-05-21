'use client'

import { useTransition, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { assignManager } from '@/lib/actions/user-actions'
import type { Profile } from '@/lib/types/database'

interface ManagerSelectProps {
  employeeId: string
  currentManagerId: string | null
  allUsers: Pick<Profile, 'id' | 'full_name' | 'email'>[]
}

export default function ManagerSelect({ employeeId, currentManagerId, allUsers }: ManagerSelectProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const options = allUsers.filter((u) => u.id !== employeeId)

  const handleChange = (newManagerId: string) => {
    setFeedback(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('employeeId', employeeId)
      formData.set('newManagerId', newManagerId === 'none' ? '' : newManagerId)
      const result = await assignManager(formData)
      if ('error' in result) {
        setFeedback({ type: 'error', message: result.error })
      } else {
        setFeedback({ type: 'success', message: 'Updated' })
        setTimeout(() => setFeedback(null), 2000)
      }
    })
  }

  const [value, setValue] = useState(currentManagerId ?? 'none')

  const handleChangeFinal = (newManagerId: string) => {
    handleChange(newManagerId)
    setValue(newManagerId)
  }

  return (
    <div className="space-y-1">
      <Select value={value} onValueChange={handleChangeFinal} disabled={isPending}>
        <SelectTrigger className="w-48 h-8 text-xs border-lr-border bg-lr-surface text-lr-text">
          <SelectValue placeholder="No manager" />
        </SelectTrigger>
        <SelectContent className="bg-lr-surface border-lr-border max-h-48 overflow-y-auto">
          <SelectItem value="none" className="text-xs text-lr-muted">No manager</SelectItem>
          {options.map((user) => (
            <SelectItem key={user.id} value={user.id} className="text-xs text-lr-text">
              {user.full_name ?? user.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {feedback && (
        <p className={`text-xs ${feedback.type === 'error' ? 'text-lr-error' : 'text-lr-success'} max-w-48 break-words`}>
          {feedback.message}
        </p>
      )}
    </div>
  )
}
