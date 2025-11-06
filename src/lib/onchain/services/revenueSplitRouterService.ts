import type { Account, Address } from 'viem'

import { revenueSplitRouterAbi } from '@/lib/onchain/abi'

import { OnchainService, ServiceConfig } from './base'

export class RevenueSplitRouterService extends OnchainService {
  readonly address: Address

  constructor(config: ServiceConfig & { address: Address }) {
    super(config)
    this.address = config.address
  }

  async splitTransfer(
    token: Address,
    recipients: readonly Address[],
    sharesBps: readonly number[],
    amount: bigint,
    opts?: { account?: Account | Address }
  ) {
    const wallet = this.requireWalletClient()
    const account = this.resolveAccount(opts?.account)

    return wallet.writeContract({
      abi: revenueSplitRouterAbi,
      address: this.address,
      functionName: 'splitTransfer',
      args: [token, recipients, sharesBps, amount],
      account
    })
  }
}
