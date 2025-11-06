import { Inter } from 'next/font/google'

import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import NextTopLoader from 'nextjs-toploader'

import { AppProviders } from '@/providers/app-providers'
import { AppNavbar } from '@/components/layout/app-navbar'

const inter = Inter({ subsets: ['latin'], preload: false })

export const metadata: Metadata = {
  title: 'Vestaloom',
  description:
    'Vestaloom pairs Somnia Data Streams with Kwala automation so creators can issue verifiable skill credentials in real time.',
  icons: {
    icon: '/favicon.ico'
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={inter.className}>
        <AppProviders>
          <NextTopLoader showSpinner={false} height={3} color='#4f46e5' crawl={false} />
          <div className='flex min-h-screen flex-col'>
            <AppNavbar />
            <main className='flex-1'>{children}</main>
          </div>
          <Toaster />
        </AppProviders>
      </body>
    </html>
  )
}
