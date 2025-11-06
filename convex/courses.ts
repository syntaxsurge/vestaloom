import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireUserByWallet } from './utils'

export const list = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const courses = await ctx.db
      .query('courses')
      .withIndex('by_groupId', q => q.eq('groupId', args.groupId))
      .collect()

    const coursesWithModules = await Promise.all(
      courses.map(async course => {
        const modules = await ctx.db
          .query('modules')
          .withIndex('by_courseId', q => q.eq('courseId', course._id))
          .collect()
        return { ...course, modules }
      })
    )

    const coursesWithModulesAndLessons = await Promise.all(
      coursesWithModules.map(async course => {
        const modulesWithLessons = await Promise.all(
          course.modules.map(async module => {
            const lessons = await ctx.db
              .query('lessons')
              .withIndex('by_moduleId', q => q.eq('moduleId', module._id))
              .collect()
            return { ...module, lessons }
          })
        )
        return { ...course, modules: modulesWithLessons }
      })
    )

    return coursesWithModulesAndLessons
  }
})

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    groupId: v.id('groups'),
    address: v.string(),
    thumbnailUrl: v.optional(v.string())
  },
  handler: async (ctx, { title, description, groupId, address, thumbnailUrl }) => {
    const user = await requireUserByWallet(ctx, address)
    const group = await ctx.db.get(groupId)

    if (!group) {
      throw new Error('Group not found.')
    }

    if (group.ownerId !== user._id) {
      throw new Error('Only the group owner can create courses.')
    }

    const courseId = await ctx.db.insert('courses', {
      title,
      description,
      groupId,
      thumbnailUrl
    })

    return courseId
  }
})

export const get = query({
  args: { id: v.id('courses') },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.id)
    if (!course) return null
    const modules = await ctx.db
      .query('modules')
      .withIndex('by_courseId', q => q.eq('courseId', args.id))
      .collect()
    const modulesWithLessons = await Promise.all(
      modules.map(async module => {
        const lessons = await ctx.db
          .query('lessons')
          .withIndex('by_moduleId', q => q.eq('moduleId', module._id))
          .collect()
        return { ...module, lessons }
      })
    )
    return { ...course, modules: modulesWithLessons }
  }
})

export const updateTitle = mutation({
  args: {
    id: v.id('courses'),
    title: v.string(),
    address: v.string()
  },
  handler: async (ctx, { id, title, address }) => {
    const user = await requireUserByWallet(ctx, address)
    const course = await ctx.db.get(id)
    if (!course) {
      throw new Error('Course not found.')
    }
    const group = await ctx.db.get(course.groupId)
    if (!group || group.ownerId !== user._id) {
      throw new Error('Only the group owner can update courses.')
    }
    await ctx.db.patch(id, { title })
  }
})

export const updateDescription = mutation({
  args: {
    id: v.id('courses'),
    description: v.string(),
    address: v.string()
  },
  handler: async (ctx, { id, description, address }) => {
    const user = await requireUserByWallet(ctx, address)
    const course = await ctx.db.get(id)
    if (!course) {
      throw new Error('Course not found.')
    }
    const group = await ctx.db.get(course.groupId)
    if (!group || group.ownerId !== user._id) {
      throw new Error('Only the group owner can update courses.')
    }
    await ctx.db.patch(id, { description })
  }
})

export const updateThumbnail = mutation({
  args: {
    id: v.id('courses'),
    thumbnailUrl: v.optional(v.string()),
    address: v.string()
  },
  handler: async (ctx, { id, thumbnailUrl, address }) => {
    const user = await requireUserByWallet(ctx, address)
    const course = await ctx.db.get(id)
    if (!course) {
      throw new Error('Course not found.')
    }
    const group = await ctx.db.get(course.groupId)
    if (!group || group.ownerId !== user._id) {
      throw new Error('Only the group owner can update courses.')
    }
    await ctx.db.patch(id, { thumbnailUrl })
  }
})

export const remove = mutation({
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
      throw new Error('Only the group owner can delete courses.')
    }

    const modules = await ctx.db
      .query('modules')
      .withIndex('by_courseId', q => q.eq('courseId', courseId))
      .collect()

    for (const module of modules) {
      const lessons = await ctx.db
        .query('lessons')
        .withIndex('by_moduleId', q => q.eq('moduleId', module._id))
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

      await ctx.db.delete(module._id)
    }

    await ctx.db.delete(courseId)
  }
})
