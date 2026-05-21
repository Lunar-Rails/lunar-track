'use client'

import { useTransition, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateGuideSection } from '@/lib/actions/guide-actions'
import type { GuideSection } from '@/lib/types/database'

interface GuideSectionEditorProps {
  section: GuideSection
}

export default function GuideSectionEditor({ section }: GuideSectionEditorProps) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateGuideSection(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSaved(true)
        setEditing(false)
      }
    })
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-lr-accent hover:underline"
        title="Edit this section"
      >
        Edit
      </button>
    )
  }

  return (
    <form onSubmit={onSave} className="mt-4 space-y-4 rounded-[var(--radius-lr-lg)] border border-lr-accent/20 bg-lr-accent-dim p-4">
      <p className="text-xs text-lr-accent font-medium">Editing section (Markdown supported)</p>
      <input type="hidden" name="sectionId" value={section.id} />

      <div className="space-y-1">
        <Label htmlFor={`title-${section.id}`} className="text-caption">Title</Label>
        <Input
          id={`title-${section.id}`}
          name="title"
          defaultValue={section.title}
          disabled={isPending}
          className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`content-${section.id}`} className="text-caption">Content (Markdown)</Label>
        <Textarea
          id={`content-${section.id}`}
          name="content"
          defaultValue={section.content}
          disabled={isPending}
          rows={20}
          className="bg-lr-surface border-lr-border text-lr-text text-sm font-mono resize-y"
        />
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} className="bg-lr-accent hover:bg-lr-accent/90 text-white text-xs h-8">
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => setEditing(false)}
          className="border-lr-border text-lr-text text-xs h-8"
        >
          Cancel
        </Button>
        {saved && <span className="text-xs text-lr-cyan self-center">Saved</span>}
      </div>
    </form>
  )
}
