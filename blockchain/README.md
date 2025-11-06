# Vestaloom Blockchain Workspace

This Hardhat project is dedicated to the Somnia-specific contracts that power Vestaloom’s hackathon flows. Only the contracts below are deployed during the Somnia + Kwala integration.

## Contracts

| Contract      | File                                        | Description                                                                 |
| ------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| `VestaQuest`  | `contracts/VestaQuest.sol`                  | Emits `QuestCompleted(address,uint256,string)` and blocks duplicate submissions per player/quest. |
| `VestaBadge`  | `contracts/VestaBadge.sol`                  | Soulbound ERC‑721 credential; `MINTER_ROLE` controls access and enforces one badge per quest. |

Legacy contracts such as `MembershipPass1155` remain in the workspace but are not required for Somnia deployments.

## Environment Variables

Create `blockchain/.env` with:

```env
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_PRIVATE_KEY=0x....
KWALA_MINTER_ADDRESS=0x.... # optional — auto-grants MINTER_ROLE on deploy
```

The private key should hold testnet STT for deployment. It is separate from the SDS signer used by the Next.js app.

## Commands

```bash
pnpm --dir blockchain install
pnpm contracts:compile
pnpm contracts:deploy
```

Deployment addresses are appended to `deployment.log` for later use in the frontend and Kwala workflow.

## ABIs

Running `pnpm hardhat compile` outputs ABIs under `artifacts/contracts/`. Synchronize them with the Next.js app using:

```bash
pnpm --filter ../ contracts:sync-abis
```

## Useful Links

- Somnia explorer (Shannon testnet): https://shannon-explorer.somnia.network
- Somnia RPC: https://dream-rpc.somnia.network
- Official docs: https://docs.somnia.network
