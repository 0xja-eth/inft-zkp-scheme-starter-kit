import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

// 获取私钥，优先使用环境变量，否则使用默认测试私钥
const getPrivateKey = (envKey: string, defaultKey?: string): string => {
  const key = process.env[envKey];
  if (!key) {
    if (defaultKey) return defaultKey;
    throw new Error(`Missing environment variable: ${envKey}`);
  }
  return key;
};

// Hardhat 内置测试账户私钥 (仅用于本地开发)
const DEFAULT_DEV_PRIVATE_KEY = getPrivateKey("PRIVATE_KEY_DEV", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: [getPrivateKey("PRIVATE_KEY_DEV", DEFAULT_DEV_PRIVATE_KEY)],
    },
    // 0G Galileo Testnet
    "0g-testnet": {
      url: process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai/",
      accounts: [getPrivateKey("PRIVATE_KEY_TESTNET", DEFAULT_DEV_PRIVATE_KEY)],
      chainId: process.env.ZG_CHAIN_ID ? parseInt(process.env.ZG_CHAIN_ID) : 16601,
    },
  },
  // 0G 使用自己的区块浏览器，不需要 etherscan 配置
  // 区块浏览器: https://chainscan-galileo.0g.ai/
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

export default config;
