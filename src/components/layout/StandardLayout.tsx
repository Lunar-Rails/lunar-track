import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import type { Profile } from '@/lib/types/database'

interface StandardLayoutProps {
  profile: Profile
  inboxCount?: number
  children: React.ReactNode
}

export default function StandardLayout({ profile, inboxCount = 0, children }: StandardLayoutProps) {
  return (
    <div className="min-h-screen bg-lr-bg">
      <Header profile={profile} inboxCount={inboxCount} />
      <div className="flex pt-14">
        <Sidebar role={profile.role} />
        <main className="flex-1 ml-56 px-6 pb-6 overflow-y-auto h-[calc(100vh-56px)]">
          <div className="mx-auto max-w-[var(--max-width-lr-app)] pt-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
