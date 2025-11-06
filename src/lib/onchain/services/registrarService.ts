import type { Account, Address } from 'viem'

import { registrarAbi } from '@/lib/onchain/abi'

import { OnchainService, ServiceConfig } from './base'

export class RegistrarService extends OnchainService {
  readonly address: Address

  constructor(config: ServiceConfig & { address: Address }) {
    super(config)
    this.address = config.address
  }

  async registerCourse(
    courseId: bigint,
    priceUSDC: bigint,
    recipients: Address[],
    sharesBps: number[],
    durationSeconds: bigint,
    transferCooldownSeconds: bigint,
    opts?: { account?: Account | Address }
  ) {
    const wallet = this.requireWalletClient()
    const account = this.resolveAccount(opts?.account)
    return wallet.writeContract({
      abi: registrarAbi,
      address: this.address,
      functionName: 'registerCourse',
      args: [
        courseId,
        priceUSDC,
        recipients,
        sharesBps,
        durationSeconds,
        transferCooldownSeconds
      ],
      account
    })
  }
}
