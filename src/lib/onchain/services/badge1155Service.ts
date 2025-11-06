import type { Account, Address } from 'viem'

import { badge1155Abi } from '@/lib/onchain/abi'

import { OnchainService, ServiceConfig } from './base'

export class Badge1155Service extends OnchainService {
  readonly address: Address

  constructor(config: ServiceConfig & { address: Address }) {
    super(config)
    this.address = config.address
  }

  async mintCompletion(
    to: Address,
    courseId: bigint,
    opts?: { account?: Account | Address }
  ) {
    const wallet = this.requireWalletClient()
    const account = this.resolveAccount(opts?.account)
    return wallet.writeContract({
      abi: badge1155Abi,
      address: this.address,
      functionName: 'mintCompletion',
      args: [to, courseId],
      account
    })
  }

  async mintBatch(
    recipients: Address[],
    courseId: bigint,
    opts?: { account?: Account | Address }
  ) {
    const wallet = this.requireWalletClient()
    const account = this.resolveAccount(opts?.account)
    return wallet.writeContract({
      abi: badge1155Abi,
      address: this.address,
      functionName: 'mintBatch',
      args: [recipients, courseId],
      account
    })
  }
}
