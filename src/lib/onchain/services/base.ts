import type {
  Account,
  Address,
  Chain,
  PublicClient,
  Transport,
  WalletClient
} from 'viem'

export type AnyWalletClient = WalletClient<Transport, Chain, Account>

export type ServiceConfig = {
  publicClient: PublicClient
  walletClient?: AnyWalletClient
  account?: Account | Address
}

export abstract class OnchainService {
  protected readonly publicClient: PublicClient
  protected readonly walletClient?: AnyWalletClient
  protected readonly account?: Account | Address

  protected constructor(config: ServiceConfig) {
    this.publicClient = config.publicClient
    this.walletClient = config.walletClient
    this.account = config.account
  }

  protected requireWalletClient(): AnyWalletClient {
    if (!this.walletClient) {
      throw new Error('Wallet client required for this operation')
    }
    return this.walletClient
  }

  protected resolveAccount(account?: Account | Address): Account | Address {
    const resolved = account ?? this.account
    if (!resolved) {
      throw new Error('Account required for this operation')
    }
    return resolved
  }
}
