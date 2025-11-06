declare module '@somnia-chain/streams' {
  export type SchemaDecodedItem = {
    name?: string
    value: unknown
  }

  export type StreamRecord = {
    id: `0x${string}`
    schemaId: `0x${string}`
    data: `0x${string}`
  }

  export type StreamEvent = {
    id: string
    argumentTopics?: (`0x${string}` | null | undefined)[]
    data?: `0x${string}` | null
  }

  export class SchemaEncoder {
    constructor(schema: string)
    encodeData(
      data: Array<{ name: string; value: unknown; type: string }>
    ): `0x${string}`
  }

  export const zeroBytes32: `0x${string}`

  type PublicClient = unknown
  type WalletClient = unknown

  export class SDK {
    constructor(options: { public: PublicClient; wallet?: WalletClient })
    streams: {
      computeSchemaId(schema: string): Promise<`0x${string}`>
      isDataSchemaRegistered(schemaId: `0x${string}`): Promise<boolean>
      registerDataSchemas(
        schemas: Array<{
          id: string
          schema: string
          parentSchemaId: `0x${string}`
        }>,
        ignoreIfExists?: boolean
      ): Promise<`0x${string}` | undefined>
      getEventSchemasById(ids: string[]): Promise<unknown[]>
      registerEventSchemas(
        ids: string[],
        schemas: Array<{
          eventTopic: `0x${string}`
          params: Array<{ name: string; paramType: string; isIndexed: boolean }>
        }>
      ): Promise<void>
      getAllPublisherDataForSchema(
        schemaId: `0x${string}`,
        publisher: `0x${string}`
      ): Promise<unknown>
      set(records: StreamRecord[]): Promise<`0x${string}` | undefined>
      setAndEmitEvents(
        records: StreamRecord[],
        events: StreamEvent[]
      ): Promise<`0x${string}` | undefined>
    }
  }
}
