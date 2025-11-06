import { useEffect, useMemo, useState } from 'react'

import type { SchemaDecodedItem } from '@somnia-chain/streams'

import { QUEST_PROGRESS_SCHEMA } from './schemas'
import { getSdk } from './client'

type QuestFeedEntry = {
  id: string
  timestamp: number
  questId: bigint
  status: string
  proofUri: string
  player: `0x${string}`
}

const POLL_INTERVAL_MS = 5_000

export function useQuestFeed(filterQuestId?: bigint) {
  const [entries, setEntries] = useState<QuestFeedEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const publisher = useMemo(
    () => process.env.NEXT_PUBLIC_SDS_PUBLISHER_ADDRESS as `0x${string}` | undefined,
    []
  )

  useEffect(() => {
    let mounted = true
    let timer: NodeJS.Timeout

    async function load() {
      if (!publisher) {
        setError('Missing NEXT_PUBLIC_SDS_PUBLISHER_ADDRESS')
        return
      }

      try {
        const sdk = getSdk(true)
        const schemaId = await sdk.streams.computeSchemaId(QUEST_PROGRESS_SCHEMA)
        const raw = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisher)
        if (!raw) return

        const parsed = (raw as SchemaDecodedItem[][])
          .map((row, index) => toEntry(row, index))
          .filter((entry): entry is QuestFeedEntry => Boolean(entry))
          .filter(entry => (filterQuestId ? entry.questId === filterQuestId : true))
          .sort((a, b) => a.timestamp - b.timestamp)

        if (mounted) {
          setEntries(parsed)
          setError(null)
        }
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to load quest feed')
      }
    }

    load()
    timer = setInterval(load, POLL_INTERVAL_MS)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [filterQuestId, publisher])

  return { entries, error }
}

function valueOf(field: SchemaDecodedItem | undefined) {
  if (!field) return undefined
  if (typeof field.value === 'object' && field.value !== null && 'value' in field.value) {
    return (field.value as { value: unknown }).value
  }
  return field.value
}

function toEntry(row: SchemaDecodedItem[], index: number): QuestFeedEntry | undefined {
  try {
    const timestampRaw = valueOf(row[0])
    const playerRaw = valueOf(row[1]) as `0x${string}`
    const questIdRaw = valueOf(row[2])
    const statusRaw = valueOf(row[3]) as string
    const proofUriRaw = valueOf(row[4]) as string

    const timestamp =
      typeof timestampRaw === 'bigint'
        ? Number(timestampRaw)
        : Number(typeof timestampRaw === 'string' ? parseInt(timestampRaw, 10) : 0)

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
