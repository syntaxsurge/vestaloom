import { SchemaEncoder, zeroBytes32 } from '@somnia-chain/streams'
import {
  type AbiEvent,
  type AbiParameter,
  encodeAbiParameters,
  encodeEventTopics,
  parseAbiItem,
  toEventHash,
  toHex
} from 'viem'
import { waitForTransactionReceipt } from 'viem/actions'

import { getSdk, getPublicHttpClient } from './client'
import {
  BADGE_MINT_EVENT_ID,
  BADGE_MINT_SCHEMA,
  PRICE_STREAM_SCHEMA,
  QUEST_PROGRESS_EVENT_ID,
  QUEST_PROGRESS_SCHEMA
} from './schemas'

export async function ensureQuestSchemas() {
  const sdk = getSdk(false)

  const [questSchemaId, badgeSchemaId] = await Promise.all([
    sdk.streams.computeSchemaId(QUEST_PROGRESS_SCHEMA),
    sdk.streams.computeSchemaId(BADGE_MINT_SCHEMA)
  ])

  const [questRegistered, badgeRegistered] = await Promise.all([
    sdk.streams.isDataSchemaRegistered(questSchemaId),
    sdk.streams.isDataSchemaRegistered(badgeSchemaId)
  ])

  if (!questRegistered) {
    const tx = await sdk.streams.registerDataSchemas([
      {
        id: 'quest_progress',
        schema: QUEST_PROGRESS_SCHEMA,
        parentSchemaId: zeroBytes32
      }
    ])
    if (tx) await waitForTransactionReceipt(getPublicHttpClient(), { hash: tx })
  }

  if (!badgeRegistered) {
    const tx = await sdk.streams.registerDataSchemas([
      {
        id: 'badge_mint',
        schema: BADGE_MINT_SCHEMA,
        parentSchemaId: zeroBytes32
      }
    ])
    if (tx) await waitForTransactionReceipt(getPublicHttpClient(), { hash: tx })
  }

  await ensureEventSchema(sdk)

  return {
    questSchemaId,
    badgeSchemaId
  }
}

export async function ensurePriceSchema() {
  const sdk = getSdk(false)
  const schemaId = await sdk.streams.computeSchemaId(PRICE_STREAM_SCHEMA)
  const registered = await sdk.streams.isDataSchemaRegistered(schemaId)

  if (!registered) {
    const tx = await sdk.streams.registerDataSchemas(
      [
        {
          id: 'vestaloom_price',
          schema: PRICE_STREAM_SCHEMA,
          parentSchemaId: zeroBytes32
        }
      ],
      true
    )

    if (tx) {
      await waitForTransactionReceipt(getPublicHttpClient(), { hash: tx })
    }
  }

  return schemaId
}

async function ensureEventSchema(sdk: ReturnType<typeof getSdk>) {
  const questEvent = await sdk.streams.getEventSchemasById([
    QUEST_PROGRESS_EVENT_ID
  ])
  if (!questEvent || questEvent.length === 0) {
    const questAbi = parseAbiItem(
      'event QuestProgress(bytes32 indexed tag, address indexed player, uint256 questId)'
    ) as AbiEvent
    await sdk.streams.registerEventSchemas(
      [QUEST_PROGRESS_EVENT_ID],
      [
        {
          eventTopic: toEventHash(questAbi),
          params: questAbi.inputs.map(input => ({
            name: input.name ?? '',
            paramType: input.type,
            isIndexed: isIndexedParam(input)
          }))
        }
      ]
    )
  }

  const badgeEvent = await sdk.streams.getEventSchemasById([
    BADGE_MINT_EVENT_ID
  ])
  if (!badgeEvent || badgeEvent.length === 0) {
    const badgeAbi = parseAbiItem(
      'event BadgeMinted(address indexed player, uint256 indexed tokenId, uint256 questId)'
    ) as AbiEvent
    await sdk.streams.registerEventSchemas(
      [BADGE_MINT_EVENT_ID],
      [
        {
          eventTopic: toEventHash(badgeAbi),
          params: badgeAbi.inputs.map(input => ({
            name: input.name ?? '',
            paramType: input.type,
            isIndexed: isIndexedParam(input)
          }))
        }
      ]
    )
  }
}

export function buildQuestEventPayload(player: `0x${string}`, questId: bigint) {
  const abiItem = parseAbiItem(
    'event QuestProgress(bytes32 indexed tag, address indexed player, uint256 questId)'
  ) as AbiEvent
  const tag = toHex(`quest:${questId}`, { size: 32 })
  const topics = encodeEventTopics({
    abi: [abiItem],
    args: { tag, player, questId }
  })
  const eventData = encodeAbiParameters([], [])

  return { tag, topics, eventData }
}

export function encodeQuestProgress(data: {
  player: `0x${string}`
  questId: bigint
  proofUri: string
  status: string
  timestamp: number
}) {
  const encoder = new SchemaEncoder(QUEST_PROGRESS_SCHEMA)
  return encoder.encodeData([
    {
      name: 'timestamp',
      value: BigInt(data.timestamp).toString(),
      type: 'uint64'
    },
    { name: 'player', value: data.player, type: 'address' },
    { name: 'questId', value: data.questId, type: 'uint256' },
    { name: 'status', value: data.status, type: 'string' },
    { name: 'proofUri', value: data.proofUri, type: 'string' }
  ])
}

function isIndexedParam(param: AbiParameter) {
  return Boolean((param as { indexed?: boolean }).indexed)
}

export function encodePriceUpdate(data: {
  timestamp: bigint
  feed: string
  price: bigint
  roundId: bigint
  updatedAt: bigint
  chainId: number
  reporter: `0x${string}`
}) {
  const encoder = new SchemaEncoder(PRICE_STREAM_SCHEMA)
  return encoder.encodeData([
    { name: 'timestamp', value: data.timestamp.toString(), type: 'uint64' },
    { name: 'feed', value: data.feed, type: 'string' },
    { name: 'price', value: data.price.toString(), type: 'int256' },
    { name: 'roundId', value: data.roundId.toString(), type: 'uint256' },
    { name: 'updatedAt', value: data.updatedAt.toString(), type: 'uint256' },
    { name: 'chainId', value: BigInt(data.chainId).toString(), type: 'uint32' },
    { name: 'reporter', value: data.reporter, type: 'address' }
  ])
}
