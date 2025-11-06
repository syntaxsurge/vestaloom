# Vestaloom — Somnia Data Streams + Kwala Automation

Vestaloom turns skill quests into verifiable, on-chain credentials. The project runs fully on the **Somnia Shannon testnet** and couples **Somnia Data Streams (SDS)** with **Kwala** YAML automations so a single codebase qualifies for:

- [Somnia Data Streams Mini Hackathon](https://dorahacks.io/hackathon/somnia-datastreams/detail)
- [Build with Kwala Hacker House](https://dorahacks.io/hackathon/buildwithkwala/detail)

## Live Endpoints

| Surface                | URL / Entry Point                                      |
| ---------------------- | ------------------------------------------------------ |
| Next.js dApp           | `npm run dev` → http://localhost:3000                  |
| SDS schema bootstrap   | `pnpm run scripts/sds-bootstrap.ts` (see below)        |
| Kwala workflow YAML    | [`kwala/vestaloom-quest.yaml`](kwala/vestaloom-quest.yaml) |
| Smart contracts        | `blockchain/` Hardhat workspace                         |

## Product Overview

1. **Creator launches a quest** in the dApp.
2. **Learner completes the quest** and submits proof. The UI writes structured quest data to SDS via `POST /api/sds/progress`.
3. **Kwala monitors** the `VestaQuest` smart contract and, when the `QuestCompleted` event fires, automatically:
   - Persists the same payload to SDS for verifiability.
   - Mints a non-transferable credential via `VestaBadge`.
   - (Optional) Triggers downstream automations (cross-chain mirror, notifications).
4. **Any wallet** can subscribe to SDS and receive real-time quest progress updates without deploying custom infrastructure.

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

pnpm install
pnpm hardhat run scripts/deploy.ts --network somnia
pnpm hardhat verify --network somnia <VestaBadgeAddress>
pnpm hardhat verify --network somnia <VestaQuestAddress>
```

Deployment output is appended to `blockchain/deployment.log`. The Next.js app consumes these addresses through the `.env.local` variables listed below.

### Contracts

| Contract      | Source                               | Responsibility                                |
| ------------- | ------------------------------------ | --------------------------------------------- |
| `VestaQuest`  | `blockchain/contracts/VestaQuest.sol`| Emits `QuestCompleted` events for SDS/Kwala   |
| `VestaBadge`  | `blockchain/contracts/VestaBadge.sol`| Mints ERC-721 credentials when Kwala triggers |

Legacy marketplace contracts remain untouched for reference; Vestaloom relies on the new minimal pair above for hackathon flows.

## Somnia Data Streams Integration

- SDS client utilities live under `src/lib/streams/`.
- Schemas:
  - `quest_progress`: `uint64 timestamp, address player, uint256 questId, string status, string proofUri`
  - `badge_mint`: `uint64 timestamp, address player, uint256 tokenId, uint256 questId`
- `src/app/api/sds/progress/route.ts` writes quest progress to SDS via `setAndEmitEvents`.
- `src/lib/streams/useQuestFeed.ts` subscribes to SDS and powers the live “Quest Feed” widget at `/somnia`.
- `scripts/sds-bootstrap.ts` guarantees schemas and event topics are registered exactly once.

Run the bootstrap after deployment:

```bash
pnpm tsx scripts/sds-bootstrap.ts
```

This registers the SDS schemas, event IDs, and logs the resulting identifiers.

## Kwala Workflow

- YAML file: [`kwala/vestaloom-quest.yaml`](kwala/vestaloom-quest.yaml)
- Trigger: `VestaQuest.QuestCompleted(address player, uint256 questId, string proofUri)` on Somnia (chain ID 50312).
- Actions:
  1. `write-sds-progress` — calls the Next.js API to persist the signed payload to SDS.
  2. `mint-badge` — invokes `VestaBadge.mintBadge(player)` directly on Somnia.
  3. The template includes a commented “mirror-credential” action for future cross-chain adapters.
- Provide the following Kwala environment variables when importing the workflow:
  - `VESTA_QUEST_ADDRESS`
  - `VESTA_BADGE_ADDRESS`
  - `SDS_PROGRESS_ENDPOINT` (e.g. `https://vestaloom.vercel.app/api/sds/progress`)

Import the YAML in your Kwala workspace, supply the contract addresses, and monitor execution from the Kwala dashboard. Because Kwala nodes use KMS-backed signing and verifiable logging, the automation satisfies the “backendless + traceable” criteria from the Build with Kwala track.

## Environment Variables

Create `.env.local` in the project root with these keys:

```env
NEXT_PUBLIC_SOMNIA_CHAIN_ID=50312
NEXT_PUBLIC_SOMNIA_RPC_URL=https://dream-rpc.somnia.network
NEXT_PUBLIC_SOMNIA_EXPLORER_URL=https://shannon-explorer.somnia.network
# Optional WebSocket endpoint for SDS subscriptions
# NEXT_PUBLIC_SOMNIA_WS_RPC_URL=wss://dream-rpc.somnia.network

NEXT_PUBLIC_VESTA_QUEST_ADDRESS=<address from deployment.log>
NEXT_PUBLIC_VESTA_BADGE_ADDRESS=<address from deployment.log>
NEXT_PUBLIC_SDS_PUBLISHER_ADDRESS=<address that signs SDS writes>

SDS_SIGNER_PRIVATE_KEY=<test wallet used exclusively for SDS writes>
```

> The SDS signer is only required for server-side schema registration and data writes. It should **not** hold funds.

## Running the App

```bash
pnpm install
pnpm run dev
# visit http://localhost:3000
```

- `/somnia` demonstrates Somnia-only flows: connect wallet, complete a quest, watch the live feed update via SDS.
- Legacy marketplace routes still operate for regression coverage but are no longer shown in navigation.

## Testing & Quality Gates

- `pnpm --filter blockchain test` — Hardhat test suite.
- `pnpm run lint` / `pnpm run typecheck` — Next.js linting and TypeScript safety.
- `pnpm run contracts:sync-abis` — refreshes generated ABIs for the UI after redeployment.

## Hackathon Submission Notes

| Requirement                              | Covered By                                         |
| ---------------------------------------- | -------------------------------------------------- |
| Somnia Data Streams usage                | `src/lib/streams/` + `/somnia` quest feed          |
| Somnia Testnet deployment                | `blockchain/` Hardhat config + `deployment.log`    |
| Kwala automation with YAML               | `kwala/vestaloom-quest.yaml`                      |
| Demo video checklist                     | `docs/demo-script.md` (generated alongside changes)|
| Public repo + README documentation       | This file                                          |

## Resources

- Somnia docs: https://docs.somnia.network
- Somnia Data Streams SDK: https://docs.somnia.network/somnia-data-streams
- Kwala overview: https://docs.kwala.network
- DoraHacks Somnia event: https://dorahacks.io/hackathon/somnia-datastreams/detail
- DoraHacks Kwala event: https://dorahacks.io/hackathon/buildwithkwala/detail

Happy building!
