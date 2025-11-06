import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'

import { somniaTestnet } from '@/lib/chains/somnia'
import { SOMNIA_RPC_URL } from '@/lib/config'

export function getWagmiConfig() {
  return createConfig({
    chains: [somniaTestnet],
    connectors: [
      injected({ target: 'metaMask' }),
      walletConnect({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'vestaloom',
        showQrModal: true
      })
    ],
    storage: createStorage({ storage: cookieStorage }),
    transports: {
      [somniaTestnet.id]: http(SOMNIA_RPC_URL)
    },
    ssr: true
  })
}

export const ACTIVE_CHAIN = somniaTestnet

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getWagmiConfig>
  }
}
