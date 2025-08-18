import * as dotenv from 'dotenv';
import { getDeployedAddresses } from './get-contract-addresses';
import {StorageConfig} from "../../lib/types";

dotenv.config();

/**
 * 共享配置管理器 - 所有脚本通用的环境变量和配置
 */
export interface NetworkConfig {
  rpcUrl: string;
  indexerUrl: string;
  chainId: number;
  explorerUrl?: string;
}

export interface ContractConfig {
  agentNFTAddress: string;
  verifierAddress?: string;
}

export interface WalletConfig {
  privateKey: string;
  address?: string;
}

export interface ScriptConfig {
  network: NetworkConfig;
  contracts: ContractConfig;
  wallet: WalletConfig;
  ogStorage: StorageConfig;
}

/**
 * 获取网络配置
 */
export function getNetworkConfig(): NetworkConfig {
  const chainId = parseInt(process.env.ZG_CHAIN_ID || '16601');
  const rpcUrl = process.env.RPC_URL || process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai/';
  const indexerUrl = process.env.ZG_INDEXER_URL || 'https://indexer-storage-testnet-turbo.0g.ai/';
  const explorerUrl = process.env.ZG_EXPLORER_URL || 'https://chainscan-galileo.0g.ai/tx/';

  return {
    rpcUrl,
    indexerUrl,
    chainId,
    explorerUrl
  };
}

/**
 * 获取合约配置
 */
export function getContractConfig(chainId?: string | number): ContractConfig {
  let agentNFTAddress = process.env.AGENT_NFT_ADDRESS || '';
  let verifierAddress = process.env.VERIFIER_ADDRESS || '';
  
  // 如果没有设置合约地址，自动从 Ignition 部署信息获取
  if (!agentNFTAddress || !verifierAddress) {
    try {
      const addresses = getDeployedAddresses(chainId?.toString() || process.env.ZG_CHAIN_ID || '16601');

      agentNFTAddress ||= addresses.agentNFT;
      verifierAddress ||= addresses.teeVerifier;

      console.log(`🔍 Auto-detected AgentNFT address: ${agentNFTAddress}`);
    } catch (error) {
      console.warn('⚠️  Could not auto-detect contract address from Ignition deployment');
    }
  }

  return {
    agentNFTAddress,
    verifierAddress
  };
}

/**
 * 获取钱包配置
 */
export function getWalletConfig(): WalletConfig {
  const privateKey = process.env.PRIVATE_KEY || '';
  
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not set in .env file');
  }

  return {
    privateKey
  };
}

/**
 * 获取 0G 存储配置
 */
export function getOGStorageConfig(): StorageConfig {
  const network = getNetworkConfig();
  
  return {
    rpcUrl: network.rpcUrl,
    indexerUrl: network.indexerUrl,
    chainId: network.chainId
  };
}

/**
 * 获取完整的脚本配置
 */
export function getScriptConfig(options: { requireWallet?: boolean; requireContract?: boolean } = {}): ScriptConfig {
  const { requireWallet = true, requireContract = true } = options;
  
  const network = getNetworkConfig();
  const contracts = getContractConfig(network.chainId);
  const ogStorage = getOGStorageConfig();
  
  // 验证必需的配置
  if (requireContract && !contracts.agentNFTAddress) {
    throw new Error('Contract not deployed. Please deploy first or set AGENT_NFT_ADDRESS in .env file');
  }
  
  let wallet: WalletConfig;
  if (requireWallet) {
    wallet = getWalletConfig();
  } else {
    wallet = { privateKey: '' };
  }

  return {
    network,
    contracts,
    wallet,
    ogStorage
  };
}

/**
 * 获取脚本参数（从命令行或环境变量）
 */
export interface ScriptParams {
  tokenId?: number;
  recipientAddress?: string;
  amount?: string;
  description?: string;
}

export function getScriptParams(args: string[] = process.argv.slice(2)): ScriptParams {
  return {
    tokenId: parseInt(args[0] || process.env.TOKEN_ID || '1'),
    recipientAddress: args[1] || process.env.RECIPIENT_ADDRESS || '',
    amount: args[2] || process.env.AMOUNT || '',
    description: args[3] || process.env.DESCRIPTION || ''
  };
}

/**
 * 打印配置信息（用于调试）
 */
export function printConfig(config: ScriptConfig, hidePrivateKey: boolean = true): void {
  console.log('📋 Configuration:');
  console.log('=' .repeat(50));
  console.log(`Network: ${config.network.rpcUrl}`);
  console.log(`Chain ID: ${config.network.chainId}`);
  console.log(`Indexer: ${config.network.indexerUrl}`);
  console.log(`AgentNFT: ${config.contracts.agentNFTAddress}`);
  
  if (config.wallet.privateKey && !hidePrivateKey) {
    console.log(`Private Key: ${config.wallet.privateKey}`);
  } else if (config.wallet.privateKey) {
    console.log(`Private Key: ${config.wallet.privateKey.substring(0, 10)}...`);
  }
  
  console.log('=' .repeat(50));
}