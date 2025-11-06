import { useEffect, useMemo, useState } from 'react'

import type { SchemaDecodedItem } from '@somnia-chain/streams'

import { getSdk } from './client'
import { QUEST_PROGRESS_SCHEMA } from './schemas'

export type QuestFeedRow = {
  id: string
  timestamp: number
  questId: bigint
  status: string
  proofUri: string
  player: `0x${string}`
}

const POLL_INTERVAL_MS = 6_000

export function useQuestFeed(
  publisher?: `0x${string}`,
  limit = 50,
  filterQuestId?: bigint
) {
  const [rows, setRows] = useState<QuestFeedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const resolvedPublisher = useMemo(
    () =>
      publisher ??
      (process.env.NEXT_PUBLIC_SDS_PUBLISHER_ADDRESS as
        | `0x${string}`
        | undefined),
    [publisher]
  )

  useEffect(() => {
    let mounted = true
    let timer: NodeJS.Timeout | undefined

    async function load() {
      if (!resolvedPublisher) {
        setError('Missing SDS publisher address')
        setLoading(false)
        return
      }

      try {
        const sdk = getSdk(true)
        const schemaId = await sdk.streams.computeSchemaId(
          QUEST_PROGRESS_SCHEMA
        )
        const raw = await sdk.streams.getAllPublisherDataForSchema(
          schemaId,
          resolvedPublisher
        )
        if (!raw || !mounted) return

        const parsed = (raw as SchemaDecodedItem[][])
          .map((row, index) => decodeRow(row, index))
          .filter((entry): entry is QuestFeedRow => Boolean(entry))
          .filter(entry =>
            filterQuestId ? entry.questId === filterQuestId : true
          )
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-limit)

        if (mounted) {
          setRows(parsed)
          setError(null)
        }
      } catch (err) {
        if (!mounted) return
        const message =
          err instanceof Error ? err.message : 'Failed to load quest feed'
        setError(message)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()
    timer = setInterval(load, POLL_INTERVAL_MS)

    return () => {
      mounted = false
      if (timer) clearInterval(timer)
    }
  }, [filterQuestId, limit, resolvedPublisher])

  return { rows, loading, error }
}

function valueOf(field: SchemaDecodedItem | undefined) {
  if (!field) return undefined
  if (
    typeof field.value === 'object' &&
    field.value !== null &&
    'value' in field.value
  ) {
    return (field.value as { value: unknown }).value
  }
  return field.value
}

function decodeRow(
  row: SchemaDecodedItem[],
  index: number
): QuestFeedRow | undefined {
  try {
    const timestampRaw = valueOf(row[0])
    const playerRaw = valueOf(row[1]) as `0x${string}`
    const questIdRaw = valueOf(row[2])
    const statusRaw = valueOf(row[3]) as string
    const proofUriRaw = valueOf(row[4]) as string

    const timestamp =
      typeof timestampRaw === 'bigint'
        ? Number(timestampRaw)
        : Number(
            typeof timestampRaw === 'string' ? parseInt(timestampRaw, 10) : 0
          )

    const questId =
      typeof questIdRaw === 'bigint'
        ? questIdRaw
        : BigInt(typeof questIdRaw === 'string' ? questIdRaw : 0)

    const proofUri = proofUriRaw ?? ''

    return {
      id: `${questId.toString()}-${index}`,
      timestamp,
      questId,
      status: statusRaw ?? '',
      proofUri,
      player: playerRaw
    }
  } catch {
    return undefined
  }
}
