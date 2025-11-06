# Vestaloom — Somnia Data Streams + Kwala Automation

Vestaloom turns skill quests into verifiable, on-chain credentials. The project
runs fully on the **Somnia Shannon testnet** and couples **Somnia Data Streams
(SDS)** with **Kwala** YAML automations so a single codebase qualifies for:

- [Somnia Data Streams Mini Hackathon](https://dorahacks.io/hackathon/somnia-datastreams/detail)
- [Build with Kwala Hacker House](https://dorahacks.io/hackathon/buildwithkwala/detail)

## Live Endpoints

| Surface              | URL / Entry Point                                          |
| -------------------- | ---------------------------------------------------------- |
| Next.js dApp         | `npm run dev` → http://localhost:3000                      |
| SDS schema bootstrap | `pnpm run scripts/sds-bootstrap.ts` (see below)            |
| Kwala workflow YAML  | [`kwala/vestaloom-quest.yaml`](kwala/vestaloom-quest.yaml) |
| Smart contracts      | `blockchain/` Hardhat workspace                            |

## Product Overview

1. **Creator launches a quest** in the dApp.
2. **Learner completes the quest** and submits proof. The UI writes structured
   quest data to SDS via `POST /api/sds/progress`.
3. **Kwala monitors** the `VestaQuest` smart contract and, when the
   `QuestCompleted` event fires, automatically:
   - Persists the same payload to SDS for verifiability.
   - Mints a non-transferable credential via `VestaBadge`.
   - (Optional) Triggers downstream automations (cross-chain mirror,
     notifications).
4. **Any wallet** can subscribe to SDS and receive real-time quest progress
   updates without deploying custom infrastructure.

All actions are provably linked to user-signed intents and verifiable on-chain.

## Repository Layout

```
.
├─ README.md                       # you are here
├─ kwala/                          # YAML automations for Kwala
├─ blockchain/                     # Hardhat contracts deployed to Somnia
├─ scripts/                        # Next.js + SDS utilities
├─ src/                            # Next.js app (UI + SDS integration)
└─ docs/                           # Additional reference material
```

## Somnia Deployment

The Hardhat workspace in `blockchain/` now targets Somnia (Shannon):

```bash
cd blockchain
cp .env.example .env
echo "SOMNIA_RPC_URL=https://dream-rpc.somnia.network" >> .env
echo "SOMNIA_PRIVATE_KEY=<your testnet key>" >> .env
echo "KWALA_MINTER_ADDRESS=<kwala signer>" >> .env # optional

pnpm install
pnpm hardhat run scripts/deploy.ts --network somnia
pnpm hardhat verify --network somnia <VestaBadgeAddress>
pnpm hardhat verify --network somnia <VestaQuestAddress>
```

Deployment output is appended to `blockchain/deployment.log`. The Next.js app
consumes these addresses through the `.env.local` variables listed below.

### Contracts

| Contract     | Source                                | Responsibility                                                            |
| ------------ | ------------------------------------- | ------------------------------------------------------------------------- |
| `VestaQuest` | `blockchain/contracts/VestaQuest.sol` | Emits `QuestCompleted` and blocks duplicate submissions per quest         |
| `VestaBadge` | `blockchain/contracts/VestaBadge.sol` | Soulbound ERC-721 that mints once per (player, quest) when Kwala triggers |

Legacy marketplace contracts remain untouched for reference; Vestaloom relies on
the new minimal pair above for hackathon flows.

## Somnia Data Streams Integration

- SDS client utilities live under `src/lib/streams/`.
- Schemas:
  - `quest_progress`:
    `uint64 timestamp, address player, uint256 questId, string status, string proofUri`
  - `badge_mint`:
    `uint64 timestamp, address player, uint256 tokenId, uint256 questId`
- `src/app/api/sds/progress/route.ts` writes quest progress to SDS via
  `setAndEmitEvents`.
- `src/lib/streams/useQuestFeed.ts` subscribes to SDS and powers the live “Quest
  Feed” widget at `/somnia`.
- `scripts/sds-bootstrap.ts` guarantees schemas and event topics are registered
  exactly once.

Run the bootstrap after deployment:

```bash
pnpm tsx scripts/sds-bootstrap.ts
```

This registers the SDS schemas, event IDs, and logs the resulting identifiers.

## Kwala Workflow

- YAML file: [`kwala/vestaloom-quest.yaml`](kwala/vestaloom-quest.yaml)
- Trigger:
  `VestaQuest.QuestCompleted(address player, uint256 questId, string proofUri)`
  on Somnia (chain ID 50312).
- Actions:
  1. `write-sds-progress` — calls the Next.js API to persist the signed payload
     to SDS.
  2. `mint-badge` — invokes `VestaBadge.mintBadge(player, questId)` directly on
     Somnia so duplicates are rejected on-chain.
  3. The template includes a commented “mirror-credential” action for future
     cross-chain adapters.
- Provide the following Kwala environment variables when importing the workflow:
  - `VESTA_QUEST_ADDRESS`
  - `VESTA_BADGE_ADDRESS`
  - `SDS_PROGRESS_ENDPOINT` (e.g.
    `https://vestaloom.vercel.app/api/sds/progress`)

Import the YAML in your Kwala workspace, supply the contract addresses, and
monitor execution from the Kwala dashboard. Because Kwala nodes use KMS-backed
signing and verifiable logging, the automation satisfies the “backendless +
traceable” criteria from the Build with Kwala track.

## Environment Variables

Create `.env.local` (or `.env`) in the project root. The table below explains
every required value and where to fetch it.

### Frontend (`.env.local`)

| Key                                                | Where to get it                                                                         | Purpose                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SOMNIA_CHAIN_ID`                      | Always `50312` for Shannon testnet.                                                     | Informs wagmi/viem which chain to target.                                                        |
| `NEXT_PUBLIC_RPC_URL`                              | https://dream-rpc.somnia.network (public) or your private endpoint.                     | Preferred RPC used by the client to read chain data. Falls back to `NEXT_PUBLIC_SOMNIA_RPC_URL`. |
| `NEXT_PUBLIC_SOMNIA_RPC_URL`                       | Legacy variable; kept for compatibility.                                                | Automatically falls back to this when `NEXT_PUBLIC_RPC_URL` is omitted.                          |
| `NEXT_PUBLIC_SOMNIA_EXPLORER_URL`                  | https://shannon-explorer.somnia.network                                                 | Used for outbound explorer links.                                                                |
| `NEXT_PUBLIC_SOMNIA_WS_RPC_URL` _(optional)_       | WebSocket URL if you run a node with WS enabled, e.g. `wss://dream-rpc.somnia.network`. | Enables live SDS subscriptions; leave unset to fall back to polling.                             |
| `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS`                | Somnia USDC address from docs or deployment.                                            | Required if you use USDC-based pricing.                                                          |
| `NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS`            | Wallet that should receive marketplace fees.                                            | Used in UI copy and join flows.                                                                  |
| `NEXT_PUBLIC_MEMBERSHIP_CONTRACT_ADDRESS`          | Address logged by Hardhat when deploying legacy membership contracts (optional).        | Supports legacy pages if you keep them.                                                          |
| `NEXT_PUBLIC_REGISTRAR_CONTRACT_ADDRESS`           | Same as above (optional).                                                               | Legacy registrar references.                                                                     |
| `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS`         | Same as above (optional).                                                               | Legacy marketplace references.                                                                   |
| `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS`               | Legacy badge contract (optional).                                                       | Only needed if you surface historical badges.                                                    |
| `NEXT_PUBLIC_REVENUE_SPLIT_ROUTER_ADDRESS`         | Legacy revenue split router (optional).                                                 | Required only for the old marketplace flows.                                                     |
| `NEXT_PUBLIC_VESTA_QUEST_ADDRESS`                  | Address emitted by `pnpm hardhat run scripts/deploy.ts --network somnia`.               | Used by `/somnia` and Kwala workflow.                                                            |
| `NEXT_PUBLIC_VESTA_BADGE_ADDRESS`                  | Same as above.                                                                          | Lets the UI read badge totals.                                                                   |
| `NEXT_PUBLIC_SDS_PUBLISHER_ADDRESS`                | `0x…` address of the wallet that writes to SDS (the SDS signer).                        | Allows the feed hook to filter records.                                                          |
| `NEXT_PUBLIC_SUBSCRIPTION_PRICE_USDC`              | Any USD price (string).                                                                 | Controls legacy pricing labels.                                                                  |
| `NEXT_PUBLIC_MEMBERSHIP_DURATION_SECONDS`          | Seconds (default `2592000`).                                                            | Legacy membership duration.                                                                      |
| `NEXT_PUBLIC_MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS` | Seconds (default `86400`).                                                              | Legacy cooldown display.                                                                         |
| `NEXT_PUBLIC_CONVEX_URL`                           | From `npx convex dev` output or Convex dashboard.                                       | Required for Convex queries/mutations.                                                           |

### Server-side secrets (`.env.local`)

| Key                                 | Where to get it                                                                     | Purpose                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `RPC_URL`                           | https://dream-rpc.somnia.network or your hosted endpoint.                           | Used by server utilities (SDS writes, bootstrap scripts, Kwala callbacks). |
| `PRIVATE_KEY`                       | Export from a dedicated Somnia wallet that will publish SDS data. Fund it with STT. | Signs SDS writes and schema registrations. Keep it strictly server-side.   |
| `SENTRY_DSN` _(optional)_           | Project DSN from Sentry if you enable monitoring.                                   | Allows the app to report server exceptions.                                |
| `SDS_SIGNER_PRIVATE_KEY` _(legacy)_ | Previous env name; still supported for backwards compatibility.                     | Prefer `PRIVATE_KEY` moving forward.                                       |

### Hardhat (`blockchain/.env`)

| Key                                                                                               | Where to get it                                                                   | Purpose                                                                                |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `SOMNIA_RPC_URL`                                                                                  | https://dream-rpc.somnia.network or your own endpoint.                            | RPC used for deployments.                                                              |
| `SOMNIA_PRIVATE_KEY`                                                                              | Export from a funded Somnia testnet wallet (Metamask → Account details → Export). | Deployment signer for Vesta contracts.                                                 |
| `KWALA_MINTER_ADDRESS` _(optional)_                                                               | EVM address that Kwala uses to sign transactions.                                 | When provided, `scripts/deploy.ts` automatically grants `MINTER_ROLE` on `VestaBadge`. |
| `USDC_ADDRESS`                                                                                    | Somnia USDC token address.                                                        | Required if you interact with USDC-based contracts.                                    |
| `MEMBERSHIP_CONTRACT_ADDRESS`, `BADGE_CONTRACT_ADDRESS`, `REGISTRAR_ADDRESS`                      | Optional legacy contract addresses if you keep the original suite.                | Allows Hardhat scripts to attach instead of redeploying.                               |
| `MARKETPLACE_TREASURY_ADDRESS`, `MARKETPLACE_FEE_BPS`, `MARKETPLACE_MAX_LISTING_DURATION_SECONDS` | Treasury wallet and fee configuration.                                            | Only relevant for legacy marketplace flow.                                             |
| `MEMBERSHIP_METADATA_URI`, `BADGE_METADATA_URI`                                                   | IPFS or HTTPS URIs.                                                               | Metadata configuration for legacy contracts.                                           |
| `MEMBERSHIP_DURATION_SECONDS`, `MEMBERSHIP_TRANSFER_COOLDOWN_SECONDS`                             | Seconds.                                                                          | Default duration/cooldown for legacy memberships.                                      |

> **Tip:** you can generate new Somnia wallets in Metamask by switching the
> network to Shannon, then exporting the private key from Account Details. Fund
> it via the Somnia faucet or team-provided STT allocations.

Need STT or official addresses? Reference:

- Faucet/Test tokens:
  https://docs.somnia.network/developer/how-to-guides/basics/get-testnet-tokens
- Official contract registry: https://explorer.somnia.network (search “USDC” or
  relevant tokens)
- Convex deployment URL: run `npx convex dev` and copy the printed deployment
  URL.

## Running the App

```bash
pnpm install
pnpm run dev
# visit http://localhost:3000
```

- `/somnia` demonstrates Somnia-only flows: connect wallet, complete a quest,
  watch the live feed update via SDS.
- Legacy marketplace routes still operate for regression coverage but are no
  longer shown in navigation.

## Testing & Quality Gates

- `pnpm --filter blockchain test` — Hardhat test suite.
- `pnpm run lint` / `pnpm run typecheck` — Next.js linting and TypeScript
  safety.
- `pnpm run contracts:sync-abis` — refreshes generated ABIs for the UI after
  redeployment.

## Hackathon Submission Notes

| Requirement                        | Covered By                                          |
| ---------------------------------- | --------------------------------------------------- |
| Somnia Data Streams usage          | `src/lib/streams/` + `/somnia` quest feed           |
| Somnia Testnet deployment          | `blockchain/` Hardhat config + `deployment.log`     |
| Kwala automation with YAML         | `kwala/vestaloom-quest.yaml`                        |
| Demo video checklist               | `docs/demo-script.md` (generated alongside changes) |
| Public repo + README documentation | This file                                           |

## Resources

- Somnia docs: https://docs.somnia.network
- Somnia Data Streams SDK: https://docs.somnia.network/somnia-data-streams
- Kwala overview: https://docs.kwala.network
- DoraHacks Somnia event:
  https://dorahacks.io/hackathon/somnia-datastreams/detail
- DoraHacks Kwala event: https://dorahacks.io/hackathon/buildwithkwala/detail

Happy building!
