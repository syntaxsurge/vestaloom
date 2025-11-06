'use client'

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { useRouter as useTopLoaderRouter } from 'nextjs-toploader/app'

/**
 * Provides the Next.js app router with NextTopLoader progress integration.
 */
export function useAppRouter(): AppRouterInstance {
  return useTopLoaderRouter()
}
