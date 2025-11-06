import { v } from 'convex/values'

import { mutation } from './_generated/server'
import { requireUserByWallet } from './utils'

export const add = mutation({
  args: {
    courseId: v.id('courses'),
    address: v.string()
  },
  handler: async (ctx, { courseId, address }) => {
    const user = await requireUserByWallet(ctx, address)
    const course = await ctx.db.get(courseId)
    if (!course) {
      throw new Error('Course not found.')
    }
    const group = await ctx.db.get(course.groupId)
    if (!group || group.ownerId !== user._id) {
      throw new Error('Only the group owner can modify modules.')
    }

    const lessonId = await ctx.db.insert('modules', {
      courseId,
      title: 'New Module'
    })
    return lessonId
  }
})

export const remove = mutation({
  args: {
    moduleId: v.id('modules'),
    address: v.string()
  },
  handler: async (ctx, { moduleId, address }) => {
    const user = await requireUserByWallet(ctx, address)
    const module = await ctx.db.get(moduleId)
    if (!module) {
      throw new Error('Module not found.')
    }
    const course = await ctx.db.get(module.courseId)
    if (!course) {
      throw new Error('Course not found.')
    }
    const group = await ctx.db.get(course.groupId)
    if (!group || group.ownerId !== user._id) {
      throw new Error('Only the group owner can remove modules.')
    }

    const lessons = await ctx.db
      .query('lessons')
      .withIndex('by_moduleId', q => q.eq('moduleId', moduleId))
      .collect()

    for (const lesson of lessons) {
      const posts = await ctx.db
        .query('posts')
        .withIndex('by_lessonId', q => q.eq('lessonId', lesson._id))
        .collect()

      for (const post of posts) {
        await ctx.db.delete(post._id)
      }

      await ctx.db.delete(lesson._id)
    }

    await ctx.db.delete(moduleId)
  }
})

export const updateTitle = mutation({
  args: {
    id: v.id('modules'),
    title: v.string(),
    address: v.string()
  },
  handler: async (ctx, { id, title, address }) => {
    const user = await requireUserByWallet(ctx, address)
    const module = await ctx.db.get(id)
    if (!module) {
      throw new Error('Module not found.')
    }
    const course = await ctx.db.get(module.courseId)
    if (!course) {
      throw new Error('Course not found.')
    }
    const group = await ctx.db.get(course.groupId)
    if (!group || group.ownerId !== user._id) {
      throw new Error('Only the group owner can update modules.')
    }

    await ctx.db.patch(id, { title })
  }
})
