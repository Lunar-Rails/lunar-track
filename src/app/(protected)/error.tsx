'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6 text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lr-error-dim">
        <AlertTriangle className="h-6 w-6 text-lr-error" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-lr-text">Something went wrong</h2>
        <p className="text-sm text-lr-muted max-w-sm">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>
      <Button
        onClick={reset}
        className="bg-lr-accent hover:bg-lr-accent/90 text-white"
      >
        Try again
      </Button>
    </div>
  )
}
