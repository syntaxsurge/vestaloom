import { v } from 'convex/values'

import { mutation } from './_generated/server'
import { requireUserByWallet } from './utils'

export const add = mutation({
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
      throw new Error('Only the group owner can add lessons.')
    }
    const lessonId = await ctx.db.insert('lessons', {
      moduleId,
      title: 'New Lesson',
      description: 'New Lesson Description',
      youtubeUrl: ''
    })
    return lessonId
  }
})

export const remove = mutation({
  args: {
    lessonId: v.id('lessons'),
    address: v.string()
  },
  handler: async (ctx, { lessonId, address }) => {
    const user = await requireUserByWallet(ctx, address)
    const lesson = await ctx.db.get(lessonId)
    if (!lesson) {
      throw new Error('Lesson not found.')
    }
    const module = await ctx.db.get(lesson.moduleId)
    if (!module) {
      throw new Error('Module not found.')
    }
    const course = await ctx.db.get(module.courseId)
    if (!course) {
      throw new Error('Course not found.')
    }
    const group = await ctx.db.get(course.groupId)
    if (!group || group.ownerId !== user._id) {
      throw new Error('Only the group owner can remove lessons.')
    }

    const posts = await ctx.db
      .query('posts')
      .withIndex('by_lessonId', q => q.eq('lessonId', lessonId))
      .collect()

    for (const post of posts) {
      await ctx.db.delete(post._id)
    }

    await ctx.db.delete(lessonId)
  }
})

export const update = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    youtubeUrl: v.string(),
    lessonId: v.id('lessons'),
    address: v.string()
  },
  handler: async (
    ctx,
    { title, description, youtubeUrl, lessonId, address }
  ) => {
    const user = await requireUserByWallet(ctx, address)
    const lesson = await ctx.db.get(lessonId)
    if (!lesson) {
      throw new Error('Lesson not found.')
    }
    const module = await ctx.db.get(lesson.moduleId)
    if (!module) {
      throw new Error('Module not found.')
    }
    const course = await ctx.db.get(module.courseId)
    if (!course) {
      throw new Error('Course not found.')
    }
    const group = await ctx.db.get(course.groupId)
    if (!group || group.ownerId !== user._id) {
      throw new Error('Only the group owner can update lessons.')
    }
    await ctx.db.patch(lessonId, {
      title,
      description,
      youtubeUrl
    })
  }
})
