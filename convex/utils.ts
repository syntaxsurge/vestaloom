import { Doc } from './_generated/dataModel'
import { MutationCtx, QueryCtx } from './_generated/server'

export function normalizeAddress(address: string) {
  return address.toLowerCase()
}

type DbCtx = QueryCtx | MutationCtx

function isMutationContext(ctx: DbCtx): ctx is MutationCtx {
  return 'scheduler' in ctx
}

export async function getUserByWallet(ctx: DbCtx, address: string) {
  const normalized = normalizeAddress(address)
  return await ctx.db
    .query('users')
    .withIndex('by_wallet', q => q.eq('walletAddress', normalized))
    .unique()
}

export async function requireUserByWallet(
  ctx: DbCtx,
  address: string
): Promise<Doc<'users'>> {
  const existing = await getUserByWallet(ctx, address)
  if (existing) {
    return existing
  }

  if (!isMutationContext(ctx)) {
    throw new Error('User not found for wallet address')
  }

  const walletAddress = normalizeAddress(address)
  const userId = await ctx.db.insert('users', { walletAddress })
  const user = await ctx.db.get(userId)
  if (!user) {
    throw new Error('Failed to create user record')
  }
  return user
}
