import { SDK } from '@somnia-chain/streams'
import { createPublicClient, createWalletClient, http, webSocket } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { somniaTestnet } from '@/lib/chains/somnia'

const SOMNIA_HTTP_RPC =
  process.env.NEXT_PUBLIC_SOMNIA_RPC_URL ?? 'https://dream-rpc.somnia.network'

const SOMNIA_WS_RPC =
  process.env.NEXT_PUBLIC_SOMNIA_WS_RPC_URL ??
  SOMNIA_HTTP_RPC.replace('https://', 'wss://').replace('http://', 'ws://')

function createWsClient() {
  try {
    return createPublicClient({
      chain: somniaTestnet,
      transport: webSocket(SOMNIA_WS_RPC)
    })
  } catch {
    return null
  }
}

export function getPublicHttpClient() {
  return createPublicClient({
    chain: somniaTestnet,
    transport: http(SOMNIA_HTTP_RPC)
  })
}

export function getPublicWsClient() {
  return createWsClient()
}

export function getWalletClient() {
  const key = process.env.SDS_SIGNER_PRIVATE_KEY
  if (!key) {
    throw new Error('SDS_SIGNER_PRIVATE_KEY is required for write operations')
  }

  return createWalletClient({
    chain: somniaTestnet,
    account: privateKeyToAccount(key as `0x${string}`),
    transport: http(SOMNIA_HTTP_RPC)
  })
}

export function getSdk(readOnly = true) {
  const publicClient = getPublicWsClient() ?? getPublicHttpClient()

  return new SDK({
    public: publicClient,
    wallet: readOnly ? undefined : getWalletClient()
  })
}
