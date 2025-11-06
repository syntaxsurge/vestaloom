import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

export const generateUploadUrl = mutation({
  args: {},
  handler: async ctx => {
    const url = await ctx.storage.generateUploadUrl()
    return { uploadUrl: url }
  }
})

export const getUrl = query({
  args: {
    storageId: v.id('_storage')
  },
  handler: async (ctx, { storageId }) => {
    const url = await ctx.storage.getUrl(storageId)
    return { url }
  }
})
