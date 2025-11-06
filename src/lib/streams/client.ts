import { SDK } from '@somnia-chain/streams'
import { createPublicClient, createWalletClient, http, webSocket } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { somniaTestnet } from '@/lib/chains/somnia'

const DEFAULT_HTTP_RPC = 'https://dream-rpc.somnia.network'

const SERVER_HTTP_RPC =
  process.env.RPC_URL ??
  process.env.SOMNIA_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.NEXT_PUBLIC_SOMNIA_RPC_URL ??
  DEFAULT_HTTP_RPC

const PUBLIC_HTTP_RPC =
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.NEXT_PUBLIC_SOMNIA_RPC_URL ??
  SERVER_HTTP_RPC

const PUBLIC_WS_RPC =
  process.env.NEXT_PUBLIC_WS_RPC_URL ??
  process.env.NEXT_PUBLIC_SOMNIA_WS_RPC_URL ??
  PUBLIC_HTTP_RPC.replace('https://', 'wss://').replace('http://', 'ws://')

function createWsClient() {
  try {
    return createPublicClient({
      chain: somniaTestnet,
      transport: webSocket(PUBLIC_WS_RPC)
    })
  } catch {
    return null
  }
}

export function getPublicHttpClient() {
  return createPublicClient({
    chain: somniaTestnet,
    transport: http(PUBLIC_HTTP_RPC)
  })
}

export function getPublicWsClient() {
  return createWsClient()
}

export function getWalletClient() {
  const key = (process.env.PRIVATE_KEY ??
    process.env.SDS_SIGNER_PRIVATE_KEY) as `0x${string}` | undefined
  if (!key) {
    throw new Error('PRIVATE_KEY is required for write operations')
  }

  return createWalletClient({
    chain: somniaTestnet,
    account: privateKeyToAccount(key),
    transport: http(SERVER_HTTP_RPC)
  })
}

export function getSdk(readOnly = true) {
  const publicClient = getPublicWsClient() ?? getPublicHttpClient()

  return new SDK({
    public: publicClient,
    wallet: readOnly ? undefined : getWalletClient()
  })
}
