import { SchemaEncoder, zeroBytes32 } from '@somnia-chain/streams'
import { encodeAbiParameters, encodeEventTopics, parseAbiItem, toHex } from 'viem'

import { BADGE_MINT_EVENT_ID, BADGE_MINT_SCHEMA, QUEST_PROGRESS_EVENT_ID, QUEST_PROGRESS_SCHEMA } from './schemas'
import { getSdk, getPublicHttpClient } from './client'
import { waitForTransactionReceipt } from 'viem/actions'

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
      { id: 'quest_progress', schema: QUEST_PROGRESS_SCHEMA, parentSchemaId: zeroBytes32 }
    ])
    if (tx) await waitForTransactionReceipt(getPublicHttpClient(), { hash: tx })
  }

  if (!badgeRegistered) {
    const tx = await sdk.streams.registerDataSchemas([
      { id: 'badge_mint', schema: BADGE_MINT_SCHEMA, parentSchemaId: zeroBytes32 }
    ])
    if (tx) await waitForTransactionReceipt(getPublicHttpClient(), { hash: tx })
  }

  await ensureEventSchema(sdk)

  return {
    questSchemaId,
    badgeSchemaId
  }
}

async function ensureEventSchema(sdk: ReturnType<typeof getSdk>) {
  const questEvent = await sdk.streams.getEventSchemasById([QUEST_PROGRESS_EVENT_ID])
  if (!questEvent || questEvent.length === 0) {
    const questAbi = parseAbiItem('event QuestProgress(bytes32 indexed tag, address indexed player, uint256 questId)')
    await sdk.streams.registerEventSchemas(
      [QUEST_PROGRESS_EVENT_ID],
      [
        {
          eventTopic: questAbi.signature,
          params: questAbi.inputs.map(input => ({
            name: input.name ?? '',
            paramType: input.type,
            isIndexed: Boolean(input.indexed)
          }))
        }
      ]
    )
  }

  const badgeEvent = await sdk.streams.getEventSchemasById([BADGE_MINT_EVENT_ID])
  if (!badgeEvent || badgeEvent.length === 0) {
    const badgeAbi = parseAbiItem('event BadgeMinted(address indexed player, uint256 indexed tokenId, uint256 questId)')
    await sdk.streams.registerEventSchemas(
      [BADGE_MINT_EVENT_ID],
      [
        {
          eventTopic: badgeAbi.signature,
          params: badgeAbi.inputs.map(input => ({
            name: input.name ?? '',
            paramType: input.type,
            isIndexed: Boolean(input.indexed)
          }))
        }
      ]
    )
  }
}

export function buildQuestEventPayload(player: `0x${string}`, questId: bigint) {
  const abiItem = parseAbiItem('event QuestProgress(bytes32 indexed tag, address indexed player, uint256 questId)')
  const tag = toHex(`quest:${questId}`, { size: 32 })
  const topics = encodeEventTopics({ abi: [abiItem], args: { tag, player, questId } })
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
    { name: 'timestamp', value: BigInt(data.timestamp).toString(), type: 'uint64' },
    { name: 'player', value: data.player, type: 'address' },
    { name: 'questId', value: data.questId, type: 'uint256' },
    { name: 'status', value: data.status, type: 'string' },
    { name: 'proofUri', value: data.proofUri, type: 'string' }
  ])
}
