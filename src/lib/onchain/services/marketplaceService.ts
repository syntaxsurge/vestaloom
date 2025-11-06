import type { Account, Address } from 'viem'

import { membershipMarketplaceAbi } from '@/lib/onchain/abi'

import { OnchainService, ServiceConfig } from './base'

export type MarketplaceListing = {
  seller: Address
  priceUSDC: bigint
  listedAt: bigint
  expiresAt: bigint
  active: boolean
}

type ListingTuple = [Address, bigint, bigint, bigint, boolean]

export class MarketplaceService extends OnchainService {
  readonly address: Address

  constructor(config: ServiceConfig & { address: Address }) {
    super(config)
    this.address = config.address
  }

  async purchasePrimary(
    courseId: bigint,
    maxPrice: bigint,
    opts?: { account?: Account | Address }
  ) {
    const wallet = this.requireWalletClient()
    const account = this.resolveAccount(opts?.account)
    return wallet.writeContract({
      abi: membershipMarketplaceAbi,
      address: this.address,
      functionName: 'purchasePrimary',
      args: [courseId, maxPrice],
      account
    })
  }

  async createListing(
    courseId: bigint,
    priceUSDC: bigint,
    durationSeconds: bigint,
    opts?: { account?: Account | Address }
  ) {
    const wallet = this.requireWalletClient()
    const account = this.resolveAccount(opts?.account)
    return wallet.writeContract({
      abi: membershipMarketplaceAbi,
      address: this.address,
      functionName: 'createListing',
      args: [courseId, priceUSDC, durationSeconds],
      account
    })
  }

  async cancelListing(courseId: bigint, opts?: { account?: Account | Address }) {
    const wallet = this.requireWalletClient()
    const account = this.resolveAccount(opts?.account)
    return wallet.writeContract({
      abi: membershipMarketplaceAbi,
      address: this.address,
      functionName: 'cancelListing',
      args: [courseId],
      account
    })
  }

  async buyListing(
    courseId: bigint,
    seller: Address,
    maxPrice: bigint,
    opts?: { account?: Account | Address }
  ) {
    const wallet = this.requireWalletClient()
    const account = this.resolveAccount(opts?.account)
    return wallet.writeContract({
      abi: membershipMarketplaceAbi,
      address: this.address,
      functionName: 'buyListing',
      args: [courseId, seller, maxPrice],
      account
    })
  }

  async renew(courseId: bigint, maxPrice: bigint, opts?: { account?: Account | Address }) {
    const wallet = this.requireWalletClient()
    const account = this.resolveAccount(opts?.account)
    return wallet.writeContract({
      abi: membershipMarketplaceAbi,
      address: this.address,
      functionName: 'renew',
      args: [courseId, maxPrice],
      account
    })
  }

  async getListing(courseId: bigint, seller: Address) {
    const listing = (await this.publicClient.readContract({
      abi: membershipMarketplaceAbi,
      address: this.address,
      functionName: 'getListing',
      args: [courseId, seller]
    })) as unknown as ListingTuple

    return this.mapListing(listing)
  }

  async getActiveListings(courseId: bigint) {
    const listings = (await this.publicClient.readContract({
      abi: membershipMarketplaceAbi,
      address: this.address,
      functionName: 'getActiveListings',
      args: [courseId]
    })) as unknown as ListingTuple[]

    return listings.map(listing => this.mapListing(listing))
  }

  async platformFeeBps() {
    return this.publicClient.readContract({
      abi: membershipMarketplaceAbi,
      address: this.address,
      functionName: 'platformFeeBps'
    }) as Promise<bigint>
  }

  async treasury() {
    return this.publicClient.readContract({
      abi: membershipMarketplaceAbi,
      address: this.address,
      functionName: 'treasury'
    }) as Promise<Address>
  }

  async maxListingDuration() {
    return this.publicClient.readContract({
      abi: membershipMarketplaceAbi,
      address: this.address,
      functionName: 'maxListingDuration'
    }) as Promise<bigint>
  }

  private mapListing([seller, priceUSDC, listedAt, expiresAt, active]: ListingTuple) {
    return {
      seller,
      priceUSDC,
      listedAt,
      expiresAt,
      active
    } as MarketplaceListing
  }
}
