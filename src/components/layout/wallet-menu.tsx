'use client'

import { useMemo } from 'react'

import { Loader2 } from 'lucide-react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

import { Button } from '@/components/ui/button'
import { shortenAddress } from '@/lib/utils'

export function WalletMenu() {
  const { address, isConnecting } = useAccount()
  const { connect, connectors, isPending: connectingConnectorId } = useConnect()
  const { disconnect } = useDisconnect()

  const connector = useMemo(() => connectors[0], [connectors])

  if (!address) {
    return (
      <Button
        variant='secondary'
        onClick={() => connector && connect({ connector })}
        disabled={isConnecting || connectingConnectorId !== null || !connector}
      >
        {isConnecting || connectingConnectorId !== null ? (
          <>
            <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' />
            Connecting...
          </>
        ) : (
          'Connect wallet'
        )}
      </Button>
    )
  }

  return (
    <Button variant='secondary' onClick={() => disconnect()}>
      {shortenAddress(address)}
    </Button>
  )
}
