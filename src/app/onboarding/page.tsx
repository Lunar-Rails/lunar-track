import Image from 'next/image'
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

function OnboardingShell({
  progressSegments,
  children,
}: {
  progressSegments: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-lr-bg px-4 py-12 overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <div
          className="absolute -top-32 -left-32 w-[560px] h-[560px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,63,255,0.22) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -right-24 w-[640px] h-[640px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(212,47,160,0.18) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/2 right-0 -translate-y-1/2 w-[320px] h-[320px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,107,0,0.10) 0%, transparent 70%)' }}
        />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md rounded-[var(--radius-lr-xl)] border border-lr-border overflow-hidden shadow-[var(--shadow-lr-card)] backdrop-blur-[12px]">
        {/* Hero header */}
        <div
          className="px-8 pt-8 pb-7 text-center"
          style={{
            background:
              'linear-gradient(135deg, rgba(139,63,255,0.13) 0%, rgba(212,47,160,0.09) 55%, rgba(255,107,0,0.07) 100%)',
          }}
        >
          <div className="flex justify-center mb-5">
            <div
              className="w-16 h-16 rounded-full shadow-lg ring-2 ring-white/10"
              style={{
                background: 'linear-gradient(135deg, #8B3FFF 0%, #D42FA0 55%, #FF6B00 100%)',
                padding: '2px',
              }}
            >
              <Image
                src="/icon-circle.svg"
                alt="CiaoBob"
                width={60}
                height={60}
                className="rounded-full"
                priority
              />
            </div>
          </div>
          <h1
            className="text-2xl font-extrabold tracking-tight mb-1"
            style={{
              background: 'linear-gradient(110deg, #8B3FFF 0%, #D42FA0 55%, #FF7A1A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Welcome to CiaoBob
          </h1>
          <p className="text-sm text-lr-muted">Let's get you set up in a few quick steps.</p>
        </div>

        {/* Progress + form */}
        <div className="bg-lr-glass px-8 pb-8">
          <div className="flex items-center gap-2 pt-6 mb-7">
            {progressSegments}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const profile = await getOrProvisionProfile(supabase, user)
  if (!profile) redirect('/login')

  if (profile.is_onboarded) redirect('/dashboard')

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

  // MANAGER / HR_ADMIN — two-step (name+manager → goals)
  if (isDirectOnboarding) {
    return (
      <OnboardingShell
        progressSegments={
          <>
            <div className="flex-1 h-1 rounded-full bg-lr-accent" />
            <div className="flex-1 h-1 rounded-full bg-lr-border" />
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <p className="text-kicker">Steps 1–2 of 2</p>
            <h2 className="text-page-title mt-1">Tell us about yourself</h2>
            <p className="text-body text-lr-muted mt-2">
              Enter your name, select your manager, and set your first goals.
              {profile.role === 'HR_ADMIN' ? ' Manager is optional if you report to no one.' : ''}
            </p>
          </div>
          <OnboardingFormDirect
            managers={managers}
            managerOptional={profile.role === 'HR_ADMIN'}
            defaultFullName={profile.full_name}
            defaultManagerId={profile.manager_id}
          />
        </div>
      </OnboardingShell>
    )
  }

  // EMPLOYEE — two-step flow with manager approval
  const hasPendingRequest = !!profile.pending_manager_id

  return (
    <OnboardingShell
      progressSegments={
        <>
          <div className="flex-1 h-1 rounded-full bg-lr-accent" />
          <div className="flex-1 h-1 rounded-full bg-lr-accent" />
          <div className={`flex-1 h-1 rounded-full ${hasPendingRequest ? 'bg-lr-accent/40' : 'bg-lr-border'}`} />
        </>
      }
    >
      {hasPendingRequest ? (
        <div className="space-y-6">
          <div>
            <p className="text-kicker">Step 3 of 3</p>
            <h2 className="text-page-title mt-1">Awaiting approval</h2>
            <p className="text-body text-lr-muted mt-2">
              Your manager will see your request the next time they log in. You&apos;ll get access as soon as they approve.
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
            <OnboardingForm
              managers={managers}
              defaultFullName={profile.full_name}
              defaultManagerId={profile.manager_id}
            />
          )}
        </div>
      )}
    </OnboardingShell>
  )
}
