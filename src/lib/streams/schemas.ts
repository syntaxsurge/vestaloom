export const QUEST_PROGRESS_SCHEMA =
  'uint64 timestamp, address player, uint256 questId, string status, string proofUri'

export const BADGE_MINT_SCHEMA =
  'uint64 timestamp, address player, uint256 tokenId, uint256 questId'

export const QUEST_PROGRESS_EVENT_ID = 'QuestProgress'
export const BADGE_MINT_EVENT_ID = 'BadgeMint'

export const PRICE_STREAM_SCHEMA =
  'uint64 timestamp, string feed, int256 price, uint256 roundId, uint256 updatedAt, uint32 chainId, address reporter'
