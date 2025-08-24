import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { getDeployedAddresses } from './get-contract-addresses';
import { ZGStorageConfig } from '../../shared/lib/services/storage/ZGStorageService';
import { LocalStorageConfig } from '../../shared/lib/services/storage/LocalStorageService';

// Enhanced environment loading with support for multiple environments
function loadEnvironment() {
  // Check for environment parameter in command line args
  const args = process.argv.slice(2);
  let envArg = args.find(arg => arg.startsWith('--env='))?.split('=')[1];
  if (!envArg) {
    const envIndex = args.indexOf('--env');
    if (envIndex !== -1 && args[envIndex + 1]) {
      envArg = args[envIndex + 1];
    }
  }

  // Check for config file parameter
  let configArg = args.find(arg => arg.startsWith('--config='))?.split('=')[1];
  if (!configArg) {
    const configIndex = args.indexOf('--config');
    if (configIndex !== -1 && args[configIndex + 1]) {
      configArg = args[configIndex + 1];
    }
  }

  // Determine environment file to load
  let envFile = '.env'; // default

  if (configArg) {
    // Direct config file specification
    envFile = configArg;
  } else if (envArg) {
    // Environment name specification
    envFile = `.env.${envArg}`;
  } else if (process.env.NODE_ENV) {
    // Environment variable specification
    const testFile = `.env.${process.env.NODE_ENV}`;
    if (fs.existsSync(testFile)) {
      envFile = testFile;
    }
  }

  // Load base .env file first (as fallback)
  const baseEnvPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(baseEnvPath)) {
    dotenv.config({ path: baseEnvPath });
  }

  // Load specific environment file to override base settings
  if (envFile !== '.env') {
    const envPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      console.log(`🌍 Loading environment: ${envFile} (inheriting from .env)`);

      // Load again with override to apply specific env values
      dotenv.config({ path: envPath, override: true });
    } else {
      console.warn(`⚠️  Environment file not found: ${envFile}, using .env only`);
    }
  } else {
    console.log(`🌍 Loading environment from: .env`);
  }
}

// Load environment on import
loadEnvironment();

/**
 * 共享配置管理器 - 所有脚本通用的环境变量和配置
 */
export interface NetworkConfig {
  rpcUrl: string;
  chainId: number;
  explorerUrl?: string;
}

export interface ContractConfig {
  agentNFTAddress: string;
  verifierAddress: string;
}

export interface WalletConfig {
  privateKey: string;
  address?: string;
}

export interface StorageConfig {
  zg?: ZGStorageConfig;
  local: LocalStorageConfig;
}

export interface ScriptConfig {
  network: NetworkConfig;
  contracts: ContractConfig;
  wallet: WalletConfig;
  storage: StorageConfig;
}

/**
 * 获取网络配置
 */
export function getNetworkConfig(): NetworkConfig {
  const chainId = parseInt(process.env.CHAIN_ID || '16601');
  const rpcUrl = process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai/';
  const explorerUrl = process.env.EXPLORER_URL || 'https://chainscan-galileo.0g.ai/tx/';

  return {
    rpcUrl,
    chainId,
    explorerUrl,
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
      const addresses = getDeployedAddresses(
        chainId?.toString() || process.env.ZG_CHAIN_ID || '16601'
      );

      agentNFTAddress ||= addresses.agentNFT;
      verifierAddress ||= addresses.teeVerifier || addresses.zkpVerifier;

      console.log(`🔍 Auto-detected AgentNFT address: ${agentNFTAddress}`);
    } catch (error) {
      console.warn('⚠️  Could not auto-detect contract address from Ignition deployment');
    }
  }

  return {
    agentNFTAddress,
    verifierAddress,
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
    privateKey,
  };
}

/**
 * 获取 0G 存储配置
 */
export function getStorageConfig(): StorageConfig {
  const network = getNetworkConfig();

  const disableZG = process.env.ZG_DISABLE?.toLowerCase() === 'true';

  const storageDir = process.env.LOCAL_STORAGE_DIR ?? './temp/local-storage';
  const enableMetadata = process.env.LOCAL_STORAGE_ENABLE_METADATA?.toLowerCase() === 'true';
  const enableSubdirectories =
    process.env.LOCAL_STORAGE_ENABLE_SUBDIRECTORIES?.toLowerCase() === 'true';

  if (disableZG)
    return {
      local: { storageDir, enableMetadata, enableSubdirectories },
    };

  const rpcUrl = process.env.ZG_RPC_URL || network.rpcUrl;
  const indexerUrl = process.env.ZG_INDEXER_URL || 'https://indexer-storage-testnet-turbo.0g.ai/';

  return {
    zg: { rpcUrl, indexerUrl },
    local: { storageDir, enableMetadata, enableSubdirectories },
  };
}

/**
 * 获取完整的脚本配置
 */
export function getScriptConfig(
  options: { requireWallet?: boolean; requireContract?: boolean } = {}
): ScriptConfig {
  const { requireWallet = true, requireContract = true } = options;

  const network = getNetworkConfig();
  const contracts = getContractConfig(network.chainId);
  const storage = getStorageConfig();

  // 验证必需的配置
  if (requireContract && !contracts.agentNFTAddress) {
    throw new Error(
      'Contract not deployed. Please deploy first or set AGENT_NFT_ADDRESS in .env file'
    );
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
    storage,
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
    description: args[3] || process.env.DESCRIPTION || '',
  };
}

/**
 * 打印配置信息（用于调试）
 */
export function printConfig(config: ScriptConfig, hidePrivateKey: boolean = true): void {
  console.log('📋 Configuration:');
  console.log('='.repeat(50));
  console.log(`Network: ${config.network.rpcUrl}`);
  console.log(`Chain ID: ${config.network.chainId}`);
  console.log(`ZG Storage RPC Url: ${config.storage.zg?.rpcUrl}`);
  console.log(`ZG Storage Index Url: ${config.storage.zg?.indexerUrl}`);
  console.log(`Local Storage Dir: ${config.storage.local.storageDir}`);

  console.log(`AgentNFT: ${config.contracts.agentNFTAddress}`);
  console.log(`Verifier: ${config.contracts.verifierAddress}`);

  if (config.wallet.privateKey && !hidePrivateKey) {
    console.log(`Private Key: ${config.wallet.privateKey}`);
  } else if (config.wallet.privateKey) {
    console.log(`Private Key: ${config.wallet.privateKey.substring(0, 10)}...`);
  }

  console.log('='.repeat(50));
}
