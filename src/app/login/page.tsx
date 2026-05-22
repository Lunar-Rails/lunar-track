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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <Image src="/logo-full.svg" alt="CiaoBob" width={160} height={40} priority />
          </div>
          <p className="text-sm text-gray-500">BCOMM Performance Management</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">
              {error === 'domain'
                ? 'Sign-in is restricted to authorized company domains.'
                : 'Authentication failed. Please try again.'}
            </p>
          </div>
        )}

        {user && !error && !sent && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-700">You are signed in, but your profile could not be provisioned yet.</p>
            <p className="text-xs text-amber-600 mt-1">Try reloading once. If it persists, the server-side Supabase RPC cache may still be warming up.</p>
          </div>
        )}

        {sent ? (
          <div className="text-center space-y-4">
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-6">
              <p className="text-sm text-violet-700 font-medium">Check your email</p>
              <p className="text-xs text-gray-500 mt-2">
                We sent a magic link to <strong className="text-gray-800">{sent}</strong>.<br />
                Click the link to sign in — it expires in 1 hour.
              </p>
            </div>
            <a href="/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
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
