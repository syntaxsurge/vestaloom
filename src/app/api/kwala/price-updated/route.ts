import { NextResponse } from 'next/server'

import { z } from 'zod'
import { toHex } from 'viem'
import { waitForTransactionReceipt } from 'viem/actions'

import {
  encodePriceUpdate,
  ensurePriceSchema
} from '@/lib/streams/register'
import { getPublicHttpClient, getSdk, getWalletClient } from '@/lib/streams/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  feed: z.string().min(1),
  current: z.union([z.string(), z.number(), z.bigint()]),
  roundId: z.union([z.string(), z.number(), z.bigint()]),
  updatedAt: z.union([z.string(), z.number(), z.bigint()]),
  chainId: z.union([z.string(), z.number()]).default(50312),
  token: z.string().optional()
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const body = BodySchema.parse(json)

    if (
      process.env.KWALA_ACTION_BODY_TOKEN &&
      body.token !== process.env.KWALA_ACTION_BODY_TOKEN
    ) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const writer = getWalletClient()
    const reporter = writer.account?.address
    if (!reporter) {
      throw new Error('SDS writer account is not configured')
    }

    const price = BigInt(body.current.toString())
    const roundId = BigInt(body.roundId.toString())
    const updatedAt = BigInt(body.updatedAt.toString())
    const chainId = Number(body.chainId)
    const timestamp = BigInt(Math.floor(Date.now() / 1000))

    const schemaId = await ensurePriceSchema()
    const sdk = getSdk(false)
    const encoded = encodePriceUpdate({
      timestamp,
      feed: body.feed,
      price,
      roundId,
      updatedAt,
      chainId,
      reporter
    })

    const dataId = toHex(`${body.feed}:${updatedAt.toString()}`, { size: 32 })
    const tx = await sdk.streams.set([
      { id: dataId, schemaId, data: encoded }
    ])

    if (tx) {
      await waitForTransactionReceipt(getPublicHttpClient(), { hash: tx })
    }

    return NextResponse.json({ ok: true, txHash: tx ?? null })
  } catch (error) {
    console.error('price-updated handler error:', error)
    const message = error instanceof Error ? error.message : 'failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
