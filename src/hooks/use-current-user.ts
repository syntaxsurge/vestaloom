'use client'

import { useQuery } from 'convex/react'
import { useAccount } from 'wagmi'

import { api } from '@/convex/_generated/api'

export function useCurrentUser() {
  const { address } = useAccount()
  const currentUser = useQuery(
    api.users.currentUser,
    address ? { address } : { address: undefined }
  )

  return {
    address: address ?? null,
    currentUser
  }
}
