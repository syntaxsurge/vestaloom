import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { getUserByWallet, normalizeAddress, requireUserByWallet } from './utils'

export const store = mutation({
  args: {
    address: v.string(),
    displayName: v.optional(v.string()),
    handle: v.optional(v.string()),
    avatarUrl: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeAddress(args.address)
    const existing = await getUserByWallet(ctx, walletAddress)

    const payload = {
      walletAddress,
      displayName: args.displayName ?? existing?.displayName,
      handle: args.handle ?? existing?.handle,
      avatarUrl: args.avatarUrl ?? existing?.avatarUrl
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    const userId = await ctx.db.insert('users', payload)
    return userId
  }
})

export const currentUser = query({
  args: {
    address: v.optional(v.string())
  },
  handler: async (ctx, { address }) => {
    if (!address) {
      return null
    }
    return await getUserByWallet(ctx, address)
  }
})

export const addToGroup = mutation({
  args: {
    ownerAddress: v.string(),
    memberAddress: v.string(),
    groupId: v.id('groups')
  },
  handler: async (ctx, { ownerAddress, memberAddress, groupId }) => {
    const owner = await requireUserByWallet(ctx, ownerAddress)
    const group = await ctx.db.get(groupId)

    if (!group) {
      throw new Error('Group not found!')
    }

    if (owner._id !== group.ownerId) {
      throw new Error('Only the group owner can add members.')
    }

    const member = await requireUserByWallet(ctx, memberAddress)

    const existingMembership = await ctx.db
      .query('userGroups')
      .withIndex('by_userId', q => q.eq('userId', member._id))
      .filter(q => q.eq(q.field('groupId'), groupId))
      .first()

    if (existingMembership) {
      return
    }

    await ctx.db.insert('userGroups', {
      userId: member._id,
      groupId
    })

    await ctx.db.patch(groupId, {
      memberNumber: (group.memberNumber ?? 0) + 1
    })
  }
})
