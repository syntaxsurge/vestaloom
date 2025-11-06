import { v } from 'convex/values'

import { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx
} from './_generated/server'
import { getUserByWallet, requireUserByWallet, normalizeAddress } from './utils'

function normalizeTimestamp(timestamp: number) {
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp
}

const DEFAULT_SUBSCRIPTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000
const MAX_TAGS = 8
const MAX_GALLERY_ITEMS = 10
const STORAGE_PREFIX = 'storage:'

type VisibilityOption = 'public' | 'private'
type BillingCadenceOption = 'free' | 'monthly'

type AdministratorInput = {
  walletAddress: string
  shareBps: number
}

type SanitizedAdministrator = {
  adminId: Id<'users'>
  shareBps: number
  walletAddress: string
}

async function sanitizeAdministrators(
  ctx: MutationCtx,
  owner: Doc<'users'>,
  administrators: AdministratorInput[] | undefined
) {
  if (!administrators) {
    return null
  }

  const ownerAddress = normalizeAddress(owner.walletAddress)
  const deduped = new Map<string, SanitizedAdministrator>()

  for (const entry of administrators) {
    const address = entry.walletAddress?.trim()
    if (!address) continue

    const normalized = normalizeAddress(address)
    if (!normalized || normalized === ownerAddress) {
      continue
    }

    const rawShare = Math.round(entry.shareBps)
    if (!Number.isFinite(rawShare) || rawShare <= 0) {
      continue
    }

    const shareBps = Math.min(10000, rawShare)
    const existing = deduped.get(normalized)

    if (existing) {
      const combinedShare = Math.min(10000, existing.shareBps + shareBps)
      deduped.set(normalized, {
        ...existing,
        shareBps: combinedShare
      })
      continue
    }

    const adminUser = await requireUserByWallet(ctx, normalized)
    deduped.set(normalized, {
      adminId: adminUser._id,
      shareBps,
      walletAddress: normalized
    })
  }

  const sanitized = Array.from(deduped.values())
  const totalShare = sanitized.reduce((total, admin) => total + admin.shareBps, 0)

  if (totalShare > 10000) {
    throw new Error('Administrator revenue shares cannot exceed 100%.')
  }

  return sanitized
}

function sanitizeMediaReference(value: string | undefined | null) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith(STORAGE_PREFIX)) {
    const reference = trimmed.slice(STORAGE_PREFIX.length).trim()
    return reference ? `${STORAGE_PREFIX}${reference}` : undefined
  }

  try {
    return new URL(trimmed).toString()
  } catch {
    return undefined
  }
}

function sanitizeText(value: string | undefined | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function sanitizeTags(tags: string[] | undefined) {
  if (!tags?.length) return []
  const unique = Array.from(
    new Set(
      tags
        .map(tag => tag.trim())
        .filter(Boolean)
        .map(tag => tag.toLowerCase())
    )
  )
  return unique.slice(0, MAX_TAGS)
}

function sanitizeGallery(urls: string[] | undefined) {
  if (!urls?.length) return []
  const sanitized = urls
    .map(url => sanitizeMediaReference(url))
    .filter((value): value is string => Boolean(value))
  return sanitized.slice(0, MAX_GALLERY_ITEMS)
}

function generateSubscriptionId() {
  const timestamp = Date.now().toString()
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')
  return `${timestamp}${random}`
}

type MediaReference =
  | {
      url: string
      storageId?: Id<'_storage'>
      source: string
    }
  | null

async function resolveMediaReference(
  ctx: QueryCtx | MutationCtx,
  value: string | undefined | null
): Promise<MediaReference> {
  if (!value) {
    return null
  }

  if (value.startsWith(STORAGE_PREFIX)) {
    const reference = value.slice(STORAGE_PREFIX.length).trim()
    if (!reference) return null

    const storageId = reference as Id<'_storage'>
    const url = await ctx.storage.getUrl(storageId)
    if (!url) return null

    return {
      url,
      storageId,
      source: `${STORAGE_PREFIX}${reference}`
    }
  }

  return {
    url: value,
    source: value
  }
}

async function resolveGallery(
  ctx: QueryCtx | MutationCtx,
  values: string[] | undefined | null
) {
  if (!values?.length) return []

  const resolved = await Promise.all(
    values.map(value => resolveMediaReference(ctx, value))
  )

  return resolved.filter(
    (entry): entry is NonNullable<MediaReference> => entry !== null
  )
}

function collectStorageReference(
  target: Set<Id<'_storage'>>,
  value: string | undefined | null
) {
  const trimmed = value?.trim()
  if (!trimmed || !trimmed.startsWith(STORAGE_PREFIX)) {
    return
  }

  const reference = trimmed.slice(STORAGE_PREFIX.length).trim()
  if (!reference) {
    return
  }

  target.add(reference as Id<'_storage'>)
}

function collectStorageReferencesFromValue(
  target: Set<Id<'_storage'>>,
  value: unknown
) {
  if (!value) {
    return
  }

  if (typeof value === 'string') {
    collectStorageReference(target, value)
    return
  }

  if (Array.isArray(value)) {
    value.forEach(entry => collectStorageReferencesFromValue(target, entry))
    return
  }

  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(entry =>
      collectStorageReferencesFromValue(target, entry)
    )
  }
}

function resolveVisibility(
  requested: VisibilityOption | undefined
): VisibilityOption {
  return requested === 'public' || requested === 'private'
    ? requested
    : 'private'
}

function resolveBillingCadence(
  requested: BillingCadenceOption | undefined,
  price: number
): BillingCadenceOption {
  if (requested === 'free' || requested === 'monthly') {
    if (requested === 'free' && price > 0) {
      return 'monthly'
    }
    if (requested === 'monthly' && price <= 0) {
      return 'free'
    }
    return requested
  }
  return price > 0 ? 'monthly' : 'free'
}

export const create = mutation({
  args: {
    ownerAddress: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    aboutUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    galleryUrls: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    visibility: v.optional(v.union(v.literal('public'), v.literal('private'))),
    billingCadence: v.optional(
      v.union(v.literal('free'), v.literal('monthly'))
    ),
    price: v.optional(v.number()),
    subscriptionId: v.optional(v.string()),
    administrators: v.optional(
      v.array(
        v.object({
          walletAddress: v.string(),
          shareBps: v.number()
        })
      )
    ),
    subscriptionPaymentTxHash: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const owner = await requireUserByWallet(ctx, args.ownerAddress)
    const now = Date.now()

    const price =
      typeof args.price === 'number' && args.price > 0 ? args.price : 0
    const visibility = resolveVisibility(
      args.visibility as VisibilityOption | undefined
    )
    const billingCadence = resolveBillingCadence(
      args.billingCadence as BillingCadenceOption | undefined,
      price
    )

    const subscriptionId = args.subscriptionId ?? generateSubscriptionId()

    const groupId = await ctx.db.insert('groups', {
      name: args.name,
      description: args.description,
      shortDescription: sanitizeText(args.shortDescription),
      aboutUrl: sanitizeMediaReference(args.aboutUrl),
      thumbnailUrl: sanitizeMediaReference(args.thumbnailUrl),
      galleryUrls: sanitizeGallery(args.galleryUrls),
      tags: sanitizeTags(args.tags),
      visibility,
      billingCadence,
      ownerId: owner._id,
      subscriptionId,
      endsOn: now + DEFAULT_SUBSCRIPTION_DURATION_MS,
      lastSubscriptionPaidAt: now,
      lastSubscriptionTxHash: args.subscriptionPaymentTxHash,
      price,
      memberNumber: 1
    })

    if (args.administrators) {
      const admins = await sanitizeAdministrators(ctx, owner, args.administrators)
      if (admins && admins.length > 0) {
        await Promise.all(
          admins.map(admin =>
            ctx.db.insert('groupAdministrators', {
              groupId,
              adminId: admin.adminId,
              shareBps: admin.shareBps
            })
          )
        )
      }
    }

    await ctx.db.insert('userGroups', {
      userId: owner._id,
      groupId
    })

    return groupId
  }
})

export const updateSettings = mutation({
  args: {
    id: v.id('groups'),
    ownerAddress: v.string(),
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
    price: v.optional(v.number()),
    administrators: v.optional(
      v.array(
        v.object({
          walletAddress: v.string(),
          shareBps: v.number()
        })
      )
    )
  },
  handler: async (ctx, args) => {
    const owner = await requireUserByWallet(ctx, args.ownerAddress)
    const group = await ctx.db.get(args.id)

    if (!group) {
      throw new Error('Group not found.')
    }

    if (group.ownerId !== owner._id) {
      throw new Error('Only the owner can update group settings.')
    }

    const patch: Partial<Doc<'groups'>> = {}

    if (!group.subscriptionId) {
      patch.subscriptionId = generateSubscriptionId()
    }

    if (args.shortDescription !== undefined) {
      patch.shortDescription = sanitizeText(args.shortDescription)
    }

    if (args.aboutUrl !== undefined) {
      patch.aboutUrl = sanitizeMediaReference(args.aboutUrl)
    }

    if (args.thumbnailUrl !== undefined) {
      patch.thumbnailUrl = sanitizeMediaReference(args.thumbnailUrl)
    }

    if (args.galleryUrls !== undefined) {
      patch.galleryUrls = sanitizeGallery(args.galleryUrls)
    }

    if (args.tags !== undefined) {
      patch.tags = sanitizeTags(args.tags)
    }

    const resolvedVisibility =
      args.visibility !== undefined
        ? resolveVisibility(args.visibility as VisibilityOption)
        : resolveVisibility(group.visibility as VisibilityOption | undefined)
    patch.visibility = resolvedVisibility

    const incomingPrice =
      typeof args.price === 'number' ? Math.max(0, args.price) : undefined
    const nextPrice = incomingPrice ?? group.price ?? 0

    if (incomingPrice !== undefined) {
      patch.price = incomingPrice
    }

    const requestedCadence = args.billingCadence as
      | BillingCadenceOption
      | undefined
    const resolvedCadence = resolveBillingCadence(requestedCadence, nextPrice)
    patch.billingCadence = resolvedCadence

    if (args.administrators !== undefined) {
      const admins =
        (await sanitizeAdministrators(ctx, owner, args.administrators)) ?? []

      const existingAdmins = await ctx.db
        .query('groupAdministrators')
        .withIndex('by_groupId', q => q.eq('groupId', args.id))
        .collect()

      const desired = new Map<Id<'users'>, SanitizedAdministrator>()
      admins.forEach(admin => desired.set(admin.adminId, admin))

      const existingByAdmin = new Map<Id<'users'>, typeof existingAdmins[number]>()
      existingAdmins.forEach(entry => existingByAdmin.set(entry.adminId, entry))

      await Promise.all(
        existingAdmins.map(async entry => {
          if (!desired.has(entry.adminId)) {
            await ctx.db.delete(entry._id)
          }
        })
      )

      await Promise.all(
        admins.map(async admin => {
          const existing = existingByAdmin.get(admin.adminId)
          if (!existing) {
            await ctx.db.insert('groupAdministrators', {
              groupId: args.id,
              adminId: admin.adminId,
              shareBps: admin.shareBps
            })
            return
          }

          if (existing.shareBps !== admin.shareBps) {
            await ctx.db.patch(existing._id, {
              shareBps: admin.shareBps
            })
          }
        })
      )
    }

    await ctx.db.patch(args.id, patch)
  }
})

export const resetSubscriptionId = mutation({
  args: {
    groupId: v.id('groups'),
    ownerAddress: v.string()
  },
  handler: async (ctx, { groupId, ownerAddress }) => {
    const owner = await requireUserByWallet(ctx, ownerAddress)
    const group = await ctx.db.get(groupId)

    if (!group) {
      throw new Error('Group not found.')
    }

    if (group.ownerId !== owner._id) {
      throw new Error('Only the group owner can reset the course ID.')
    }

    const subscriptionId = generateSubscriptionId()

    await ctx.db.patch(groupId, {
      subscriptionId
    })

    return { subscriptionId }
  }
})

export const renewSubscription = mutation({
  args: {
    groupId: v.id('groups'),
    ownerAddress: v.string(),
    paymentTxHash: v.optional(v.string())
  },
  handler: async (ctx, { groupId, ownerAddress, paymentTxHash }) => {
    const owner = await requireUserByWallet(ctx, ownerAddress)
    const group = await ctx.db.get(groupId)

    if (!group) {
      throw new Error('Group not found.')
    }

    if (group.ownerId !== owner._id) {
      throw new Error('Only the group owner can renew this subscription.')
    }

    const now = Date.now()
    const currentEndsOn = group.endsOn ?? 0
    const baseline = currentEndsOn > now ? currentEndsOn : now
    const nextEndsOn = baseline + DEFAULT_SUBSCRIPTION_DURATION_MS

    await ctx.db.patch(groupId, {
      endsOn: nextEndsOn,
      lastSubscriptionPaidAt: now,
      lastSubscriptionTxHash: paymentTxHash ?? group.lastSubscriptionTxHash
    })

    return { endsOn: nextEndsOn }
  }
})

export const get = query({
  args: { id: v.optional(v.id('groups')) },
  handler: async (ctx, { id }) => {
    if (!id) {
      return null
    }
    const group = await ctx.db.get(id)
    return group
  }
})

export const list = query({
  args: { address: v.optional(v.string()) },
  handler: async (ctx, { address }) => {
    if (!address) {
      return []
    }

    const user = await getUserByWallet(ctx, address)
    if (!user) {
      return []
    }

    const userGroups = await ctx.db
      .query('userGroups')
      .withIndex('by_userId', q => q.eq('userId', user._id))
      .collect()

    const activeMemberships = userGroups.filter(
      membership => (membership.status ?? 'active') === 'active'
    )

    const groups = activeMemberships.map(async userGroup => {
      const group = await ctx.db.get(userGroup.groupId)
      return group
    })

    const resolvedGroups = await Promise.all(groups)
    const filteredGroups = resolvedGroups.filter(
      group => group !== null
    ) as Doc<'groups'>[]

    const normalized = await Promise.all(
      filteredGroups.map(async group => {
        const [thumbnailMedia, galleryMedia] = await Promise.all([
          resolveMediaReference(ctx, group.thumbnailUrl),
          resolveGallery(ctx, group.galleryUrls)
        ])

        return {
          ...group,
          thumbnailUrl: thumbnailMedia?.url,
          galleryUrls: galleryMedia.map(entry => entry.url)
        } satisfies Doc<'groups'>
      })
    )

    return normalized
  }
})

export const viewer = query({
  args: {
    groupId: v.id('groups'),
    viewerId: v.optional(v.id('users'))
  },
  handler: async (ctx, { groupId, viewerId }) => {
    const group = await ctx.db.get(groupId)
    if (!group) {
      return null
    }

    const owner = await ctx.db.get(group.ownerId)

    const administratorsRaw = await ctx.db
      .query('groupAdministrators')
      .withIndex('by_groupId', q => q.eq('groupId', groupId))
      .collect()

    const administrators = await Promise.all(
      administratorsRaw.map(async admin => {
        const user = await ctx.db.get(admin.adminId)
        if (!user) {
          return null
        }
        return {
          user,
          shareBps: admin.shareBps
        }
      })
    )

    let isMember = false
    let membershipInfo:
      | {
          status: 'active' | 'left'
          passExpiresAt?: number
          leftAt?: number
          joinedAt?: number
        }
      | null = null
    if (viewerId) {
      const membership = await ctx.db
        .query('userGroups')
        .withIndex('by_userId', q => q.eq('userId', viewerId))
        .filter(q => q.eq(q.field('groupId'), groupId))
        .first()
      if (membership) {
        const status = membership.status ?? 'active'
        membershipInfo = {
          status,
          passExpiresAt: membership.passExpiresAt,
          leftAt: membership.leftAt,
          joinedAt: membership.joinedAt
        }
        isMember = status === 'active'
      }
    }

    const [thumbnailMedia, galleryMedia] = await Promise.all([
      resolveMediaReference(ctx, group.thumbnailUrl),
      resolveGallery(ctx, group.galleryUrls)
    ])

    const normalizedVisibility = resolveVisibility(
      group.visibility as VisibilityOption | undefined
    )

    const price = group.price ?? 0
    const normalizedBilling = resolveBillingCadence(
      group.billingCadence as BillingCadenceOption | undefined,
      price
    )

    const normalizedGroup: Doc<'groups'> = {
      ...group,
      thumbnailUrl: thumbnailMedia?.url,
      galleryUrls: galleryMedia.map(entry => entry.url),
      visibility: normalizedVisibility,
      billingCadence: normalizedBilling,
      tags: group.tags ?? [],
      aboutUrl: group.aboutUrl ?? undefined
    }

    const isOwner = viewerId ? group.ownerId === viewerId : false
    const canAccessProtected =
      normalizedVisibility === 'public' || isMember || isOwner

    return {
      group: normalizedGroup,
      owner: owner ?? null,
      media: {
        thumbnail: thumbnailMedia,
        gallery: galleryMedia
      },
      viewer: {
        isOwner,
        isMember,
        canAccess: {
          about: true,
          feed: canAccessProtected,
          classroom: canAccessProtected,
          members: canAccessProtected
        },
        membership: membershipInfo
      },
      memberCount:
        typeof group.memberNumber === 'number' ? group.memberNumber : 0,
      administrators: administrators.filter(
        (entry): entry is { user: Doc<'users'>; shareBps: number } =>
          entry !== null
      )
    }
  }
})

export const getMembers = query({
  args: {
    id: v.id('groups'),
    viewerId: v.optional(v.id('users'))
  },
  handler: async (ctx, { id, viewerId }) => {
    const group = await ctx.db.get(id)

    if (!group) {
      return []
    }

    const visibility = resolveVisibility(
      group.visibility as VisibilityOption | undefined
    )

    let isOwner = false
    let isMember = false

    if (viewerId) {
      isOwner = group.ownerId === viewerId
      if (!isOwner) {
        const membership = await ctx.db
          .query('userGroups')
          .withIndex('by_userId', q => q.eq('userId', viewerId))
          .filter(q => q.eq(q.field('groupId'), id))
          .first()
        isMember = Boolean(membership)
      }
    }

    const canAccess =
      visibility === 'public' || isOwner || isMember

    if (!canAccess) {
      return []
    }

    const members = await ctx.db
      .query('userGroups')
      .withIndex('by_groupId', q => q.eq('groupId', id))
      .collect()

    const activeMembers = members.filter(
      member => (member.status ?? 'active') === 'active'
    )

    const resolvedMembers = await Promise.all(
      activeMembers.map(async member => {
        const user = await ctx.db.get(member.userId)
        return user
      })
    )

    const filteredMembers = resolvedMembers.filter(
      member => member !== null
    ) as Doc<'users'>[]

    return filteredMembers
  }
})

export const listAll = query({
  args: {},
  handler: async ctx => {
    const groups = await ctx.db.query('groups').collect()
    const normalized = await Promise.all(
      groups.map(async group => {
        const [thumbnailMedia, galleryMedia] = await Promise.all([
          resolveMediaReference(ctx, group.thumbnailUrl),
          resolveGallery(ctx, group.galleryUrls)
        ])

        return {
          ...group,
          thumbnailUrl: thumbnailMedia?.url,
          galleryUrls: galleryMedia.map(entry => entry.url)
        } satisfies Doc<'groups'>
      })
    )
    return normalized
  }
})

export const directory = query({
  args: {},
  handler: async ctx => {
    const groups = await ctx.db.query('groups').collect()

    const results = await Promise.all(
      groups.map(async group => {
        const owner = await ctx.db.get(group.ownerId)
        const [thumbnailMedia, galleryMedia] = await Promise.all([
          resolveMediaReference(ctx, group.thumbnailUrl),
          resolveGallery(ctx, group.galleryUrls)
        ])
        return {
          group: {
            ...group,
            thumbnailUrl: thumbnailMedia?.url,
            galleryUrls: galleryMedia.map(entry => entry.url),
            tags: group.tags ?? [],
            visibility: resolveVisibility(
              group.visibility as VisibilityOption | undefined
            ),
            billingCadence: resolveBillingCadence(
              group.billingCadence as BillingCadenceOption | undefined,
              group.price ?? 0
            )
          } satisfies Doc<'groups'>,
          owner: owner ?? null,
          memberCount:
            typeof group.memberNumber === 'number' ? group.memberNumber : 0
        }
      })
    )

    return results
  }
})

export const updateName = mutation({
  args: { id: v.id('groups'), name: v.string(), ownerAddress: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireUserByWallet(ctx, args.ownerAddress)
    const group = await ctx.db.get(args.id)

    if (!group) {
      throw new Error('Group not found.')
    }

    if (group.ownerId !== owner._id) {
      throw new Error('Only the owner can update the group name.')
    }

    const name = args.name.trim()

    if (!name) {
      throw new Error('name is required')
    }

    if (name.length > 60) {
      throw new Error('name cannot be longer than 60 characters')
    }

    await ctx.db.patch(args.id, {
      name: args.name
    })
  }
})

export const updateDescription = mutation({
  args: {
    id: v.id('groups'),
    description: v.string(),
    ownerAddress: v.string()
  },
  handler: async (ctx, args) => {
    const owner = await requireUserByWallet(ctx, args.ownerAddress)
    const group = await ctx.db.get(args.id)

    if (!group) {
      throw new Error('Group not found.')
    }

    if (group.ownerId !== owner._id) {
      throw new Error('Only the owner can update the description.')
    }

    const description = args.description.trim()

    if (!description) {
      throw new Error('Description is required')
    }

    if (description.length > 40000) {
      throw new Error('Description is too long.')
    }

    await ctx.db.patch(args.id, {
      description: args.description
    })
  }
})

export const remove = mutation({
  args: {
    groupId: v.id('groups'),
    ownerAddress: v.string()
  },
  handler: async (ctx, { groupId, ownerAddress }) => {
    const owner = await requireUserByWallet(ctx, ownerAddress)
    const group = await ctx.db.get(groupId)

    if (!group) {
      throw new Error('Group not found.')
    }

    if (group.ownerId !== owner._id) {
      throw new Error('Only the owner can delete this group.')
    }

    const storageIds = new Set<Id<'_storage'>>()
    collectStorageReferencesFromValue(storageIds, group)

    const administrators = await ctx.db
      .query('groupAdministrators')
      .withIndex('by_groupId', q => q.eq('groupId', groupId))
      .collect()

    collectStorageReferencesFromValue(storageIds, administrators)

    await Promise.all(
      administrators.map(entry => ctx.db.delete(entry._id))
    )

    const memberships = await ctx.db
      .query('userGroups')
      .withIndex('by_groupId', q => q.eq('groupId', groupId))
      .collect()

    collectStorageReferencesFromValue(storageIds, memberships)

    await Promise.all(memberships.map(entry => ctx.db.delete(entry._id)))

    const courses = await ctx.db
      .query('courses')
      .withIndex('by_groupId', q => q.eq('groupId', groupId))
      .collect()

    collectStorageReferencesFromValue(storageIds, courses)

    for (const course of courses) {
      collectStorageReferencesFromValue(storageIds, course)

      const modules = await ctx.db
        .query('modules')
        .withIndex('by_courseId', q => q.eq('courseId', course._id))
        .collect()

      collectStorageReferencesFromValue(storageIds, modules)

      for (const module of modules) {
        const lessons = await ctx.db
          .query('lessons')
          .withIndex('by_moduleId', q => q.eq('moduleId', module._id))
          .collect()

        collectStorageReferencesFromValue(storageIds, lessons)

        await Promise.all(
          lessons.map(lesson => ctx.db.delete(lesson._id))
        )

        await ctx.db.delete(module._id)
      }

      await ctx.db.delete(course._id)
    }

    const posts = await ctx.db
      .query('posts')
      .withIndex('by_groupId', q => q.eq('groupId', groupId))
      .collect()

    collectStorageReferencesFromValue(storageIds, posts)

    for (const post of posts) {
      const comments = await ctx.db
        .query('comments')
        .withIndex('by_postId', q => q.eq('postId', post._id))
        .collect()

      collectStorageReferencesFromValue(storageIds, comments)
      await Promise.all(comments.map(comment => ctx.db.delete(comment._id)))

      const likes = await ctx.db
        .query('likes')
        .withIndex('by_postId', q => q.eq('postId', post._id))
        .collect()

      collectStorageReferencesFromValue(storageIds, likes)
      await Promise.all(likes.map(like => ctx.db.delete(like._id)))

      await ctx.db.delete(post._id)
    }

    await ctx.db.delete(groupId)

    if (storageIds.size > 0) {
      await Promise.all(
        Array.from(storageIds).map(storageId =>
          ctx.storage.delete(storageId).catch(() => undefined)
        )
      )
    }

    return { status: 'deleted' as const }
  }
})

export const join = mutation({
  args: {
    groupId: v.id('groups'),
    memberAddress: v.string(),
    txHash: v.optional(v.string()),
    hasActivePass: v.optional(v.boolean()),
    passExpiresAt: v.optional(v.number())
  },
  handler: async (ctx, { groupId, memberAddress, txHash, hasActivePass, passExpiresAt }) => {
    const member = await requireUserByWallet(ctx, memberAddress)
    const group = await ctx.db.get(groupId)

    if (!group) {
      throw new Error('Group not found.')
    }

    if (group.ownerId === member._id) {
      return { status: 'owner' as const }
    }

    const existing = await ctx.db
      .query('userGroups')
      .withIndex('by_userId', q => q.eq('userId', member._id))
      .filter(q => q.eq(q.field('groupId'), groupId))
      .first()

    const requiresPayment = (group.price ?? 0) > 0

    if (existing) {
      const status = existing.status ?? 'active'
      if (status !== 'left') {
        return { status: 'already_member' as const }
      }

      if (requiresPayment && !txHash && !hasActivePass) {
        throw new Error('Payment is required before rejoining this group.')
      }

      await ctx.db.patch(existing._id, {
        status: 'active',
        joinedAt: Date.now(),
        leftAt: undefined,
        passExpiresAt: passExpiresAt ?? existing.passExpiresAt
      })

      await ctx.db.patch(groupId, {
        memberNumber: (group.memberNumber ?? 0) + 1
      })

      return { status: 'joined' as const }
    }

    if (requiresPayment && !txHash && !hasActivePass) {
      throw new Error('Payment is required before joining this group.')
    }

    await ctx.db.insert('userGroups', {
      userId: member._id,
      groupId,
      status: 'active',
      joinedAt: Date.now(),
      passExpiresAt
    })

    await ctx.db.patch(groupId, {
      memberNumber: (group.memberNumber ?? 0) + 1
    })

    return { status: 'joined' as const }
  }
})

export const leave = mutation({
  args: {
    groupId: v.id('groups'),
    memberAddress: v.string(),
    passExpiresAt: v.optional(v.number())
  },
  handler: async (ctx, { groupId, memberAddress, passExpiresAt }) => {
    const member = await requireUserByWallet(ctx, memberAddress)
    const group = await ctx.db.get(groupId)

    if (!group) {
      throw new Error('Group not found.')
    }

    if (group.ownerId === member._id) {
      throw new Error('Owners cannot leave their group.')
    }

    const existing = await ctx.db
      .query('userGroups')
      .withIndex('by_userId', q => q.eq('userId', member._id))
      .filter(q => q.eq(q.field('groupId'), groupId))
      .first()

    if (!existing || (existing.status ?? 'active') === 'left') {
      return { status: 'not_member' as const }
    }

    await ctx.db.patch(existing._id, {
      status: 'left',
      leftAt: Date.now(),
      passExpiresAt: passExpiresAt ?? existing.passExpiresAt
    })

    const currentCount = group.memberNumber ?? 0
    await ctx.db.patch(groupId, {
      memberNumber: currentCount > 0 ? currentCount - 1 : 0
    })

    return { status: 'left' as const }
  }
})

export const updateSubscription = internalMutation({
  args: {
    subscriptionId: v.string(),
    groupId: v.id('groups'),
    endsOn: v.number()
  },
  handler: async (ctx, { subscriptionId, groupId, endsOn }) => {
    await ctx.db.patch(groupId, {
      subscriptionId,
      endsOn: normalizeTimestamp(endsOn)
    })
  }
})

export const updateSubscriptionById = internalMutation({
  args: { subscriptionId: v.string(), endsOn: v.number() },
  handler: async (ctx, { subscriptionId, endsOn }) => {
    const user = await ctx.db
      .query('groups')
      .withIndex('by_subscriptionId', q =>
        q.eq('subscriptionId', subscriptionId)
      )
      .unique()

    if (!user) {
      throw new Error('User not found!')
    }

    await ctx.db.patch(user._id, {
      endsOn: normalizeTimestamp(endsOn)
    })
  }
})
