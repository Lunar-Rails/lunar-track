import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MagicLinkForm from '@/components/auth/MagicLinkForm'

export const dynamic = 'force-dynamic'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; sent?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, sent } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen flex items-center justify-center bg-lr-bg px-4">
      <div className="w-full max-w-md rounded-[var(--radius-lr-xl)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-8 shadow-[var(--shadow-lr-card)]">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <Image src="/logo-full.svg" alt="CiaoBob" width={160} height={40} priority />
          </div>
          <p className="text-body text-lr-muted">BCOMM Performance Management</p>
        </div>

        {error && (
          <div className="mb-6 rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">Authentication failed. Please try again.</p>
          </div>
        )}

        {sent ? (
          <div className="text-center space-y-4">
            <div className="rounded-[var(--radius-lr-lg)] border border-lr-cyan/20 bg-lr-cyan-dim px-4 py-6">
              <p className="text-sm text-lr-cyan font-medium">Check your email</p>
              <p className="text-xs text-lr-muted mt-2">
                We sent a magic link to <strong className="text-lr-text">{sent}</strong>.<br />
                Click the link to sign in — it expires in 1 hour.
              </p>
            </div>
            <a href="/login" className="text-xs text-lr-muted hover:text-lr-text transition-colors">
              Use a different email
            </a>
          </div>
        ) : (
          <MagicLinkForm />
        )}
      </div>
    </div>
  )
}
