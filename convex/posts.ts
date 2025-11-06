import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireUserByWallet } from './utils'

export const list = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, { groupId }) => {
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_groupId', q => q.eq('groupId', groupId))
      .collect()

    const postsWithAuthors = await Promise.all(
      posts.map(async post => {
        const author = await ctx.db.get(post.authorId)
        if (!author) {
          throw new Error('Author not found')
        }
        return {
          ...post,
          author
        }
      })
    )

    const postsWithAuthorsAndComments = await Promise.all(
      postsWithAuthors.map(async post => {
        const comments = await ctx.db
          .query('comments')
          .withIndex('by_postId', q => q.eq('postId', post._id))
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

        return {
          ...post,
          comments: commentsWithAuthors
        }
      })
    )

    const postsWithAuthorsAndCommentsAndLikes = await Promise.all(
      postsWithAuthorsAndComments.map(async post => {
        const likes = await ctx.db
          .query('likes')
          .withIndex('by_postId', q => q.eq('postId', post._id))
          .collect()

        return {
          ...post,
          likes
        }
      })
    )
    return postsWithAuthorsAndCommentsAndLikes
  }
})

export const create = mutation({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
    groupId: v.id('groups'),
    address: v.string()
  },
  handler: async (ctx, { title, content, groupId, address }) => {
    const user = await requireUserByWallet(ctx, address)

    const trimmedTitle = title.trim()
    const trimmedContent = content?.trim() ?? ''

    if (!trimmedTitle) {
      throw new Error('Title is required.')
    }

    if (trimmedContent.length > 40000) {
      throw new Error('Content is too long!')
    }

    const postId = await ctx.db.insert('posts', {
      title: trimmedTitle,
      authorId: user._id,
      groupId,
      ...(trimmedContent ? { content: trimmedContent } : {})
    })

    return postId
  }
})

export const remove = mutation({
  args: { id: v.id('posts'), address: v.string() },
  handler: async (ctx, { id, address }) => {
    const user = await requireUserByWallet(ctx, address)
    const post = await ctx.db.get(id)

    if (!post) {
      throw new Error('Post not found.')
    }

    if (post.authorId !== user._id) {
      throw new Error('Only the author can remove this post.')
    }

    // delete all comments
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_postId', q => q.eq('postId', id))
      .collect()

    await Promise.all(
      comments.map(async comment => {
        await ctx.db.delete(comment._id)
      })
    )

    // delete all likes
    const likes = await ctx.db
      .query('likes')
      .withIndex('by_postId', q => q.eq('postId', id))
      .collect()

    await Promise.all(
      likes.map(async like => {
        await ctx.db.delete(like._id)
      })
    )

    // delete the post
    await ctx.db.delete(id)
  }
})

export const updateContent = mutation({
  args: {
    id: v.id('posts'),
    title: v.string(),
    content: v.optional(v.string()),
    address: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUserByWallet(ctx, args.address)
    const post = await ctx.db.get(args.id)

    if (!post) {
      throw new Error('Post not found.')
    }

    if (post.authorId !== user._id) {
      throw new Error('Only the author can update this post.')
    }

    const title = args.title.trim()
    const trimmedContent = typeof args.content === 'string' ? args.content.trim() : undefined

    if (!title) {
      throw new Error('Title is required')
    }

    if ((trimmedContent?.length ?? 0) > 40000) {
      throw new Error('Content is too long!')
    }

    const patch: Partial<Doc<'posts'>> = { title }

    if (typeof args.content === 'string') {
      patch.content =
        trimmedContent && trimmedContent.length > 0 ? trimmedContent : undefined
    }

    await ctx.db.patch(args.id, patch)
  }
})
