import { useCallback, useMemo, useState } from 'react'

import { erc20Abi } from 'viem'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'

import { api } from '@/convex/_generated/api'
import { useApiMutation } from '@/hooks/use-api-mutation'
import {
  PLATFORM_TREASURY_ADDRESS,
  USDC_CONTRACT_ADDRESS
} from '@/lib/config'
import { SUBSCRIPTION_PRICE_AMOUNT } from '@/lib/pricing'
import { ACTIVE_CHAIN } from '@/lib/wagmi'
import { useGroupContext } from '../context/group-context'

type RenewResult = {
  endsOn: number | null
  txHash: `0x${string}`
}

export function useRenewSubscription() {
  const { group } = useGroupContext()
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN.id })
  const { writeContractAsync } = useWriteContract()
  const { mutate, pending: isMutating } = useApiMutation(
    api.groups.renewSubscription
  )
  const [isTransacting, setIsTransacting] = useState(false)

  const treasuryAddress = useMemo(
    () => PLATFORM_TREASURY_ADDRESS as `0x${string}` | '',
    []
  )
  const usdcAddress = useMemo(
    () => USDC_CONTRACT_ADDRESS as `0x${string}` | '',
    []
  )

  const renew = useCallback(async (): Promise<RenewResult> => {
    if (!group?._id) {
      throw new Error('Group context is unavailable.')
    }
    if (!address) {
      throw new Error('Connect your wallet to renew the subscription.')
    }
    if (!publicClient) {
      throw new Error('Blockchain client unavailable. Please try again.')
    }
    if (!treasuryAddress) {
      throw new Error('Treasury address not configured.')
    }
    if (!usdcAddress) {
      throw new Error('USDC contract address not configured.')
    }

    setIsTransacting(true)
    try {
      const balance = (await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address]
      })) as bigint

      if (balance < SUBSCRIPTION_PRICE_AMOUNT) {
        throw new Error('Insufficient USDC balance to renew the subscription.')
      }

      const txHash = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [treasuryAddress, SUBSCRIPTION_PRICE_AMOUNT]
      })

      await publicClient.waitForTransactionReceipt({ hash: txHash })

      const result = (await mutate({
        groupId: group._id,
        ownerAddress: address,
        paymentTxHash: txHash
      })) as { endsOn: number } | undefined

      return {
        endsOn: result?.endsOn ?? null,
        txHash
      }
    } finally {
      setIsTransacting(false)
    }
  }, [
    address,
    group?._id,
    mutate,
    publicClient,
    treasuryAddress,
    usdcAddress,
    writeContractAsync
  ])

  return {
    renew,
    isRenewing: isTransacting || isMutating
  }
}
