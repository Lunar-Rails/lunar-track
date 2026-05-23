import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient, getOrProvisionProfile } from '@/lib/supabase/server'
import MagicLinkForm from '@/components/auth/MagicLinkForm'

export const dynamic = 'force-dynamic'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; sent?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, sent } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const profile = await getOrProvisionProfile(supabase, user)
    if (profile) {
      if (profile.role === 'EMPLOYEE' && !profile.is_onboarded) {
        redirect('/onboarding')
      }
      redirect('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-lr-bg px-4">
      <div className="w-full max-w-md rounded-[var(--radius-lr-xl)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-8 shadow-[var(--shadow-lr-card)]">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <Image src="/logo-full.svg" alt="CiaoBob" width={160} height={40} priority />
          </div>
          <p className="text-sm text-lr-muted">BCOMM Performance Management</p>
        </div>

        {error && (
          <div className="mb-6 rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error-dim px-4 py-3">
            <p className="text-sm text-lr-error">
              {error === 'domain'
                ? 'Sign-in is restricted to authorized company domains.'
                : 'Authentication failed. Please try again.'}
            </p>
          </div>
        )}

        {user && !error && !sent && (
          <div className="mb-6 rounded-[var(--radius-lr)] border border-lr-warning/20 bg-lr-warning-dim px-4 py-3">
            <p className="text-sm text-lr-warning">You are signed in, but your profile could not be provisioned yet.</p>
            <p className="text-xs text-lr-muted mt-1">Try reloading once. If it persists, the server-side Supabase RPC cache may still be warming up.</p>
          </div>
        )}

        {sent ? (
          <div className="text-center space-y-4">
            <div className="rounded-[var(--radius-lr-lg)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-6">
              <p className="text-sm text-lr-accent font-medium">Check your email</p>
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
