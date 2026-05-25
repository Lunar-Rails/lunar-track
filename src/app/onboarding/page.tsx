import { redirect } from 'next/navigation'
import { createClient, getOrProvisionProfile } from '@/lib/supabase/server'
import OnboardingForm from '@/components/onboarding/OnboardingForm'
import OnboardingFormDirect from '@/components/onboarding/OnboardingFormDirect'

export const dynamic = 'force-dynamic'

interface Manager {
  id: string
  email: string
  full_name: string | null
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const profile = await getOrProvisionProfile(supabase, user)
  if (!profile) redirect('/login')

  // Already onboarded — go to dashboard
  if (profile.is_onboarded) redirect('/dashboard')

  // Fetch managers via security-definer RPC (bypasses RLS for new users)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: managersRaw, error: managersError } = await (supabase as any).rpc('get_managers')
  let managers = (managersRaw ?? []) as Manager[]

  if (managersError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: managersDirectRaw } = await (supabase as any)
      .from('profiles')
      .select('id, email, full_name')
      .in('role', ['MANAGER', 'HR_ADMIN'])
      .eq('is_onboarded', true)
      .order('full_name', { ascending: true })
    managers = (managersDirectRaw ?? []) as Manager[]
  }

  const isDirectOnboarding = profile.role === 'MANAGER' || profile.role === 'HR_ADMIN'

  // MANAGER / HR_ADMIN — single-step, no approval needed
  if (isDirectOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lr-bg px-4">
        <div className="w-full max-w-md rounded-[var(--radius-lr-xl)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-8 shadow-[var(--shadow-lr-card)]">
          <div className="mb-8 text-center">
            <h1 className="text-hero-title mb-1">Welcome to CiaoBob</h1>
            <p className="text-body text-lr-muted">Let's get you set up.</p>
          </div>
          <div className="flex items-center gap-2 mb-8">
            <div className="flex-1 h-1 rounded-full bg-lr-accent" />
          </div>
          <div className="space-y-6">
            <div>
              <p className="text-kicker">Step 1 of 1</p>
              <h2 className="text-page-title mt-1">Tell us about yourself</h2>
              <p className="text-body text-lr-muted mt-2">
                Enter your name and select your manager.{profile.role === 'HR_ADMIN' ? ' Manager is optional if you report to no one.' : ''}
              </p>
            </div>
            <OnboardingFormDirect
              managers={managers}
              managerOptional={profile.role === 'HR_ADMIN'}
            />
          </div>
        </div>
      </div>
    )
  }

  // EMPLOYEE — two-step flow with manager approval
  const hasPendingRequest = !!profile.pending_manager_id

  return (
    <div className="min-h-screen flex items-center justify-center bg-lr-bg px-4">
      <div className="w-full max-w-md rounded-[var(--radius-lr-xl)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-8 shadow-[var(--shadow-lr-card)]">
        <div className="mb-8 text-center">
          <h1 className="text-hero-title mb-1">Welcome to CiaoBob</h1>
          <p className="text-body text-lr-muted">Let's get you set up.</p>
        </div>

        <div className="flex items-center gap-2 mb-8">
          <div className="flex-1 h-1 rounded-full bg-lr-accent" />
          <div className="flex-1 h-1 rounded-full bg-lr-accent" />
          <div className={`flex-1 h-1 rounded-full ${hasPendingRequest ? 'bg-lr-accent/40' : 'bg-lr-border'}`} />
        </div>

        {hasPendingRequest ? (
          <div className="space-y-6">
            <div>
              <p className="text-kicker">Step 3 of 3</p>
              <h2 className="text-page-title mt-1">Awaiting approval</h2>
              <p className="text-body text-lr-muted mt-2">
                Your manager will see your request the next time they log in. You'll get access as soon as they approve.
              </p>
            </div>
            <div className="rounded-[var(--radius-lr-lg)] border border-lr-gold/20 bg-lr-gold-dim px-5 py-4 space-y-1">
              <p className="text-xs font-semibold text-lr-gold">Request pending</p>
              <p className="text-caption text-lr-muted">
                Logged in as <strong className="text-lr-text">{profile.email}</strong>
              </p>
            </div>
            <p className="text-center text-xs text-lr-muted">
              Wrong manager?{' '}
              <a href="/onboarding/reset" className="text-lr-accent hover:underline">
                Change selection
              </a>
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-kicker">Steps 1–2 of 3</p>
              <h2 className="text-page-title mt-1">Tell us about yourself</h2>
              <p className="text-body text-lr-muted mt-2">
                Enter your name, select your manager, and set your first goals.
              </p>
            </div>
            {managers.length === 0 ? (
              <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-6 text-center">
                <p className="text-body text-lr-muted">
                  No managers are set up yet. Ask your HR Admin to configure your account directly.
                </p>
              </div>
            ) : (
              <OnboardingForm managers={managers} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
