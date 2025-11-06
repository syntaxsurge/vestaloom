import { v } from 'convex/values'

import { mutation } from './_generated/server'
import { requireUserByWallet } from './utils'

export const add = mutation({
  args: { postId: v.id('posts'), address: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUserByWallet(ctx, args.address)

    const liked = await ctx.db
      .query('likes')
      .withIndex('by_postId_userId', q =>
        q.eq('postId', args.postId).eq('userId', user._id)
      )
      .unique()

    if (liked) {
      await ctx.db.delete(liked._id)
    } else {
      await ctx.db.insert('likes', {
        postId: args.postId,
        userId: user._id
      })
    }
  }
})
