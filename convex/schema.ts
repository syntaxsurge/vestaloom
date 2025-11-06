import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
  handle: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    about: v.optional(v.string())
  }).index('by_wallet', ['walletAddress']),
  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    aboutUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    galleryUrls: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    visibility: v.optional(
      v.union(v.literal('public'), v.literal('private'))
    ),
    billingCadence: v.optional(
      v.union(v.literal('free'), v.literal('monthly'))
    ),
    ownerId: v.id('users'),
    price: v.number(),
    memberNumber: v.number(),
    endsOn: v.optional(v.number()),
    subscriptionId: v.optional(v.string()),
    lastSubscriptionPaidAt: v.optional(v.number()),
    lastSubscriptionTxHash: v.optional(v.string())
  })
    .index('by_name', ['name'])
    .index('by_ownerId', ['ownerId'])
    .index('by_subscriptionId', ['subscriptionId']),
  groupAdministrators: defineTable({
    groupId: v.id('groups'),
    adminId: v.id('users'),
    shareBps: v.number()
  })
    .index('by_groupId', ['groupId'])
    .index('by_adminId', ['adminId']),
  userGroups: defineTable({
    userId: v.id('users'),
    groupId: v.id('groups'),
    status: v.optional(v.union(v.literal('active'), v.literal('left'))),
    joinedAt: v.optional(v.number()),
    leftAt: v.optional(v.number()),
    passExpiresAt: v.optional(v.number())
  })
    .index('by_userId', ['userId'])
    .index('by_groupId', ['groupId']),
  posts: defineTable({
    title: v.string(),
    content: v.optional(v.string()),
    authorId: v.id('users'),
    groupId: v.id('groups'),
    lessonId: v.optional(v.id('lessons'))
  })
    .index('by_title', ['title'])
    .index('by_groupId', ['groupId'])
    .index('by_lessonId', ['lessonId']),
  comments: defineTable({
    postId: v.id('posts'),
    content: v.string(),
    authorId: v.id('users')
  }).index('by_postId', ['postId']),
  likes: defineTable({
    postId: v.id('posts'),
    userId: v.id('users')
  })
    .index('by_postId', ['postId'])
    .index('by_postId_userId', ['postId', 'userId']),
  courses: defineTable({
    title: v.string(),
    description: v.string(),
    groupId: v.id('groups'),
    thumbnailUrl: v.optional(v.string())
  }).index('by_groupId', ['groupId']),
  modules: defineTable({
    title: v.string(),
    courseId: v.id('courses')
  }).index('by_courseId', ['courseId']),
  lessons: defineTable({
    title: v.string(),
    description: v.string(),
    moduleId: v.id('modules'),
    youtubeUrl: v.string()
  }).index('by_moduleId', ['moduleId'])
})
