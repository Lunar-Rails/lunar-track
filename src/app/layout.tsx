import type { Metadata } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import ThemeProvider from '@/components/theme/ThemeProvider'
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
  title: 'CiaoBob',
  description: 'BCOMM Performance Management',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} bg-lr-bg text-lr-text antialiased font-sans`}
      >
        <ThemeProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  )
}
