## Platform Surface

- The Next.js App Router project (`src/app`) renders the marketing shell,
  authenticated group dashboards, and the Somnia operations page at `/somnia`.
  Shared providers (`AppProviders`) layer Theme, Wagmi, TanStack Query, and
  Convex contexts so wallet state, SDS subscriptions, and UI theming remain in
  sync.
- `/somnia` orchestrates the Somnia showcase: wallet owners submit quests via
  `VestaQuest.completeQuest`, the UI posts structured completions to Somnia Data
  Streams, and the live feed hydrates from the shared schema using
  `useQuestFeed`.

## Onchain Layer

- `VestaQuest` records quest completions with
  `QuestCompleted(address indexed player, uint256 indexed questId, string proofUri)`
  and rejects duplicates using an address → quest mapping.
- `VestaBadge` is a soulbound ERC-721. `MINTER_ROLE` governs issuance, badge IDs
  increment sequentially (`nextId`), and `(player, questId)` pairs can mint
  exactly once. Transfers revert through the `_update` guard.
- Hardhat targets Somnia Shannon (chain ID 50312) with 0.8.28 solidity,
  `sourcify` disabled, and explorer settings configured for contract
  verification.
- Deployments flow through `scripts/deploy.ts`; when `KWALA_MINTER_ADDRESS`
  exists the script grants `MINTER_ROLE` to that signer and logs deployed
  addresses for the frontend and automations.

## Data Streams Integration

- Schemas:
  - `quest_progress`:
    `uint64 timestamp, address player, uint256 questId, string status, string proofUri`
  - `badge_mint`:
    `uint64 timestamp, address player, uint256 tokenId, uint256 questId`
  - `vestaloom_price`:
    `uint64 timestamp, string feed, int256 price, uint256 roundId, uint256 updatedAt, uint32 chainId, address reporter`
- `scripts/sds-bootstrap.ts` idempotently registers data and event schemas using
  the Somnia Streams SDK (`getSdk(false)`), persisting identifiers after
  confirmations.
- `/api/sds/progress` validates payloads from Kwala or the UI, encodes quest
  progress with `SchemaEncoder`, and emits companion SDS events via
  `setAndEmitEvents`. IDs combine player, questId, and timestamp seconds for
  deterministic writes.
- `/api/kwala/price-updated` validates Kwala automation posts, enforces a
  shared-secret token, encodes the latest price sample with `encodePriceUpdate`,
  and writes to `vestaloom_price` while waiting for transaction confirmation.
- `useQuestFeed` polls SDS every six seconds with `getSdk(true)`, filters by
  publisher address (`NEXT_PUBLIC_SDS_PUBLISHER_ADDRESS`), and exposes
  normalized rows for UI consumption.

## Automation Workflow

- `kwala/vestaloom-quest.yaml` listens to `VestaQuest` on chain ID 50312. The
  trigger decodes `QuestCompleted`, Action 1 POSTs to `/api/sds/progress` with
  quest metadata, and Action 2 calls `VestaBadge.mintBadge(address,uint256)` so
  every completion mints a badge exactly once.
- `kwala/vestaloom-price-watch.yaml` monitors the Shannon ETH/USD proxy
  (`0xd9132c1d762D432672493F640a63B758891B449e`) and captures every
  `AnswerUpdated` emission (plus a five-minute recurring poll). Each event posts
  to `/api/kwala/price-updated` with the shared-secret token
  `kv_action_token_123`, which persists the stream data to SDS, and Kwala sends
  execution logs to `/api/kwala/action-status` using `kv_demo_key`.
- Workflow variables:
  - `VESTA_QUEST_ADDRESS` — deployed `VestaQuest` address.
  - `VESTA_BADGE_ADDRESS` — deployed `VestaBadge` address (must grant
    `MINTER_ROLE` to the workflow signer).
  - `SDS_PROGRESS_ENDPOINT` — HTTPS endpoint for `/api/sds/progress`.
  - ETH/USD price feed is hard-coded to `0xd9132c1d762D432672493F640a63B758891B449e`.
  - `KWALA_PRICE_ENDPOINT` — deployed `/api/kwala/price-updated` URL.
  - `KWALA_STATUS_ENDPOINT` — deployed `/api/kwala/action-status` URL.
  - `KWALA_ACTION_TOKEN` — `kv_action_token_123` (must match env var).

## Environment & Secrets

- Root `.env.local`:
  - `RPC_URL` — Somnia HTTP endpoint for server-side SDK calls.
  - `PRIVATE_KEY` — SDS publisher key; matches
    `NEXT_PUBLIC_SDS_PUBLISHER_ADDRESS`.
  - `NEXT_PUBLIC_RPC_URL` _(optional)_ — client-side RPC override; defaults to
    `RPC_URL`.
  - `NEXT_PUBLIC_VESTA_QUEST_ADDRESS`, `NEXT_PUBLIC_VESTA_BADGE_ADDRESS` —
    deployed contract addresses consumed by the UI.
  - `NEXT_PUBLIC_SDS_PUBLISHER_ADDRESS` — SDS publisher address displayed in the
    UI and used by `useQuestFeed`.
  - `SENTRY_DSN` _(optional)_ — monitoring endpoint.
  - `KWALA_ACTION_API_KEY` — authenticates `/api/kwala/action-status`.
  - `KWALA_ACTION_BODY_TOKEN` — authenticates `/api/kwala/price-updated`.
- `blockchain/.env`: `SOMNIA_RPC_URL`, `SOMNIA_PRIVATE_KEY`, and optional
  `KWALA_MINTER_ADDRESS` for automated role assignments.

## Quality Gates

- CI pipeline (`.github/workflows/ci.yml`) installs dependencies, compiles
  contracts, runs Hardhat tests when present, lints the Next.js workspace,
  type-checks, and builds the app.
- Local gates: `pnpm typecheck`, `pnpm lint`,
  `pnpm --dir blockchain exec hardhat compile`, `pnpm contracts:sync-abis`, and
  `pnpm tsx scripts/sds-bootstrap.ts` keep contracts, ABIs, and SDS schemas
  synchronized.
