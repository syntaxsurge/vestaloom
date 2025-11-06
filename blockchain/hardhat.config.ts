import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

/* -------------------------------------------------------------------------- */
/*                               E N V  V A R S                               */
/* -------------------------------------------------------------------------- */

const SOMNIA_RPC_URL = process.env.SOMNIA_RPC_URL ?? "https://dream-rpc.somnia.network";
const SOMNIA_PRIVATE_KEY = process.env.SOMNIA_PRIVATE_KEY ?? "";

/* -------------------------------------------------------------------------- */
/*                               H A R D H A T                                */
/* -------------------------------------------------------------------------- */

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "london",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    somnia: {
      url: SOMNIA_RPC_URL,
      chainId: 50312,
      accounts: SOMNIA_PRIVATE_KEY ? [SOMNIA_PRIVATE_KEY] : [],
    },
  },
  sourcify: { enabled: false },
  etherscan: {
    apiKey: { somnia: "empty" },
    customChains: [
      {
        network: "somnia",
        chainId: 50312,
        urls: {
          apiURL: "https://shannon-explorer.somnia.network/api",
          browserURL: "https://shannon-explorer.somnia.network",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: { outDir: "typechain-types", target: "ethers-v6" },
};

export default config;
