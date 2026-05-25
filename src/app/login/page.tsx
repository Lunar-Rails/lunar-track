import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient, getOrProvisionProfile } from '@/lib/supabase/server'
import MagicLinkForm from '@/components/auth/MagicLinkForm'
import EmailPasswordForm from '@/components/auth/EmailPasswordForm'
import ResendMagicLinkButton from '@/components/auth/ResendMagicLinkButton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata: Metadata = { title: 'Sign in · LunarTrack' }
export const dynamic = 'force-dynamic'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; sent?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, sent } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const profile = await getOrProvisionProfile(supabase, user)
    if (profile) {
      if (profile.role === 'EMPLOYEE' && !profile.is_onboarded) {
        redirect('/onboarding')
      }
      redirect('/dashboard')
    }
    // Profile provisioning failed — fall through and render the warning state.
    // Do NOT redirect to /dashboard: protected routes redirect back here when
    // profile is null, creating an infinite loop with no visible recovery path.
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-lr-bg px-4">
      {/* Ambient accent glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[480px] w-[720px] rounded-full bg-[radial-gradient(circle_at_top,var(--lr-accent-glow),transparent_60%)] opacity-70" />
      </div>

      <div
        role="main"
        aria-labelledby="login-heading"
        className="relative w-full max-w-md rounded-[var(--radius-lr-xl)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-8 sm:p-10 shadow-[var(--shadow-lr-card)]"
      >
        {/* Header */}
        <div className="mb-7 text-center">
          <div className="flex justify-center mb-4">
            <Image src="/logo-full.svg" alt="LunarTrack" width={160} height={40} priority />
          </div>
          <h1
            id="login-heading"
            className="font-display text-2xl font-semibold text-lr-text tracking-tight"
          >
            Sign in to LunarTrack
          </h1>
          <p className="text-sm text-lr-muted mt-1.5">BCOMM Performance Management</p>
        </div>

        {/* Error alert */}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-5 rounded-[var(--radius-lr)] border border-lr-error/30 bg-lr-error-dim px-4 py-3"
          >
            <p className="text-sm text-lr-error">
              {error === 'domain'
                ? 'Sign-in is restricted to authorized company domains.'
                : 'Authentication failed. Please try again.'}
            </p>
          </div>
        )}

        {/* Warning: signed in but profile not provisioned */}
        {user && !error && !sent && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-5 rounded-[var(--radius-lr)] border border-lr-warning/30 bg-lr-warning-dim px-4 py-3"
          >
            <p className="text-sm text-lr-warning">You are signed in, but your profile could not be provisioned yet.</p>
            <p className="text-xs text-lr-muted mt-1">Try reloading once. If it persists, the server-side Supabase RPC cache may still be warming up.</p>
          </div>
        )}

        {sent ? (
          /* Magic link success state */
          <div className="text-center space-y-4">
            <div
              className="h-12 w-12 rounded-full bg-lr-accent-dim border border-lr-accent/30 text-lr-accent flex items-center justify-center mx-auto"
              aria-hidden="true"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m2 7 10 7 10-7" />
              </svg>
            </div>
            <h2 className="font-display text-lg font-semibold text-lr-text">Check your inbox</h2>
            <p className="text-sm text-lr-muted">
              We sent a magic link to{' '}
              <strong className="text-lr-text font-medium">{sent}</strong>. Click the link to sign
              in — it expires in 1 hour.
            </p>
            <p className="text-xs text-lr-muted">
              Tip: check your spam folder if it does not arrive within a minute.
            </p>
            <ResendMagicLinkButton email={sent} />
            <a
              href="/login"
              className="inline-flex items-center text-xs text-lr-muted hover:text-lr-text transition-colors mt-4"
            >
              Use a different email
            </a>
          </div>
        ) : (
          /* Auth tabs */
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="w-full grid grid-cols-2 mb-6 bg-lr-surface border border-lr-border rounded-[var(--radius-lr)]">
              <TabsTrigger
                value="email"
                className="text-xs rounded-[var(--radius-lr)] data-[state=active]:bg-lr-accent data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                Email &amp; password
              </TabsTrigger>
              <TabsTrigger
                value="magic"
                className="text-xs rounded-[var(--radius-lr)] data-[state=active]:bg-lr-accent data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                Magic link
              </TabsTrigger>
            </TabsList>
            <TabsContent value="email">
              <EmailPasswordForm />
            </TabsContent>
            <TabsContent value="magic">
              <MagicLinkForm />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
