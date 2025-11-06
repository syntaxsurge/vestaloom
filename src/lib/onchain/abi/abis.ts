import type { Abi } from 'viem'

import Badge1155Artifact from './artifacts/Badge1155.json'
import MembershipMarketplaceArtifact from './artifacts/MembershipMarketplace.json'
import MembershipPass1155Artifact from './artifacts/MembershipPass1155.json'
import RegistrarArtifact from './artifacts/Registrar.json'
import RevenueSplitRouterArtifact from './artifacts/RevenueSplitRouter.json'
import SplitPayoutArtifact from './artifacts/SplitPayout.json'

type ContractAbi = Abi

export const badge1155Abi = Badge1155Artifact.abi as ContractAbi
export const membershipMarketplaceAbi = MembershipMarketplaceArtifact.abi as ContractAbi
export const membershipPass1155Abi = MembershipPass1155Artifact.abi as ContractAbi
export const registrarAbi = RegistrarArtifact.abi as ContractAbi
export const revenueSplitRouterAbi = RevenueSplitRouterArtifact.abi as ContractAbi
export const splitPayoutAbi = SplitPayoutArtifact.abi as ContractAbi
