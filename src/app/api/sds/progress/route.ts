import { NextResponse } from 'next/server'

import { toHex } from 'viem'
import { waitForTransactionReceipt } from 'viem/actions'

import { getPublicHttpClient, getSdk } from '@/lib/streams/client'
import {
  buildQuestEventPayload,
  encodeQuestProgress,
  ensureQuestSchemas
} from '@/lib/streams/register'
import { QUEST_PROGRESS_EVENT_ID } from '@/lib/streams/schemas'

type ProgressPayload = {
  player: `0x${string}`
  questId: number | string
  proofUri?: string
  status?: string
  timestamp?: number
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = (await request.json()) as ProgressPayload
  if (!body?.player || typeof body.player !== 'string') {
    return NextResponse.json({ error: 'player is required' }, { status: 400 })
  }

  const questIdInput =
    typeof body.questId === 'string' ? body.questId.trim() : body.questId
  if (
    questIdInput === undefined ||
    questIdInput === null ||
    questIdInput === ''
  ) {
    return NextResponse.json({ error: 'questId is required' }, { status: 400 })
  }

  let questId: bigint
  try {
    questId = BigInt(questIdInput)
  } catch {
    return NextResponse.json(
      { error: 'questId must be castable to uint256' },
      { status: 400 }
    )
  }

  const proofUri = body.proofUri?.trim() ?? ''
  const status = body.status?.trim() || 'completed'
  const timestampSource =
    typeof body.timestamp === 'number' ? body.timestamp : Date.now()
  const timestampSeconds = Math.floor(timestampSource / 1000)

  const { questSchemaId } = await ensureQuestSchemas()
  const sdk = getSdk(false)

  const encodedData = encodeQuestProgress({
    player: body.player,
    questId,
    status,
    proofUri,
    timestamp: timestampSeconds
  })

  const { tag, topics, eventData } = buildQuestEventPayload(
    body.player,
    questId
  )
  const argumentTopics = topics
    .slice(1)
    .map(topic => (Array.isArray(topic) ? (topic[0] ?? null) : topic)) as (
    | `0x${string}`
    | null
    | undefined
  )[]

  const recordId = toHex(
    `${body.player}-${questId.toString()}-${timestampSeconds}`,
    { size: 32 }
  )

  const tx = await sdk.streams.setAndEmitEvents(
    [{ id: recordId, schemaId: questSchemaId, data: encodedData }],
    [{ id: QUEST_PROGRESS_EVENT_ID, argumentTopics, data: eventData }]
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
