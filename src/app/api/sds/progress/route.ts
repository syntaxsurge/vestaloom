'use server'

import { NextResponse } from 'next/server'
import { waitForTransactionReceipt } from 'viem/actions'
import { toHex } from 'viem'

import { QUEST_PROGRESS_EVENT_ID } from '@/lib/streams/schemas'
import { buildQuestEventPayload, encodeQuestProgress, ensureQuestSchemas } from '@/lib/streams/register'
import { getPublicHttpClient, getSdk } from '@/lib/streams/client'

type ProgressPayload = {
  player: `0x${string}`
  questId: number
  proofUri: string
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = (await request.json()) as ProgressPayload
  if (!body?.player || typeof body.player !== 'string') {
    return NextResponse.json({ error: 'player is required' }, { status: 400 })
  }

  if (typeof body.questId !== 'number' || body.questId < 0) {
    return NextResponse.json({ error: 'questId must be a positive integer' }, { status: 400 })
  }

  const proofUri = body.proofUri?.trim() ?? ''
  const questId = BigInt(body.questId)
  const timestamp = Date.now()

  const { questSchemaId } = await ensureQuestSchemas()
  const sdk = getSdk(false)

  const encodedData = encodeQuestProgress({
    player: body.player,
    questId,
    status: 'completed',
    proofUri,
    timestamp
  })

  const { tag, topics, eventData } = buildQuestEventPayload(body.player, questId)

  const recordId = toHex(`${body.player}-${questId}-${timestamp}`, { size: 32 })

  const tx = await sdk.streams.setAndEmitEvents(
    [{ id: recordId, schemaId: questSchemaId, data: encodedData }],
    [{ id: QUEST_PROGRESS_EVENT_ID, argumentTopics: topics.slice(1), data: eventData }]
  )

  if (tx) {
    await waitForTransactionReceipt(getPublicHttpClient(), { hash: tx })
  }

  return NextResponse.json({
    ok: true,
    data: {
      recordId,
      questId: questId.toString(),
      proofUri,
      tag
    }
  })
}
