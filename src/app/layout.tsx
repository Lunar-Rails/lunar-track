import type { Metadata } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LunarTrack',
  description: 'BCOMM Performance Management',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} bg-lr-bg text-lr-text antialiased font-sans`}
      >
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  )
}
