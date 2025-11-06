'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'

interface ConvexClientProviderProps {
  children: React.ReactNode
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!

const convex = new ConvexReactClient(convexUrl)

export const ConvexClientProvider = ({
  children
}: ConvexClientProviderProps) => {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
