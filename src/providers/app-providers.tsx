'use client'

import { ReactNode, useMemo } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { ThemeProvider as NextThemeProvider } from 'next-themes'

import { getWagmiConfig } from '@/lib/wagmi'
import { ConvexClientProvider } from '@/providers/convex-client-provider'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  const wagmiConfig = useMemo(() => getWagmiConfig(), [])
  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <NextThemeProvider
      attribute='class'
      defaultTheme='system'
      enableSystem
      disableTransitionOnChange
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </NextThemeProvider>
  )
}
