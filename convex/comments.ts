import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireUserByWallet } from './utils'

export const add = mutation({
  args: { postId: v.id('posts'), content: v.string(), address: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUserByWallet(ctx, args.address)

    const commentId = await ctx.db.insert('comments', {
      postId: args.postId,
      content: args.content,
      authorId: user._id
    })

    return commentId
  }
})

export const list = query({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_postId', q => q.eq('postId', args.postId))
      .collect()

    const commentsWithAuthors = await Promise.all(
      comments.map(async comment => {
        const author = await ctx.db.get(comment.authorId)
        if (!author) {
          throw new Error('Author not found')
        }
        return {
          ...comment,
          author
        }
      })
    )

    return commentsWithAuthors
  }
})

export const remove = mutation({
  args: { id: v.id('comments'), address: v.string() },
  handler: async (ctx, { id, address }) => {
    const user = await requireUserByWallet(ctx, address)
    const comment = await ctx.db.get(id)
    if (!comment) {
      return
    }
    if (comment.authorId !== user._id) {
      throw new Error('Only the author can remove this comment.')
    }
    await ctx.db.delete(id)
  }
})
