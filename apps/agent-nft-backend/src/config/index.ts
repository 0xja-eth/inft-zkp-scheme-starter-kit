import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export interface Config {
  server: {
    port: number;
    nodeEnv: string;
  };
  network: {
    rpcUrl: string;
    chainId: number;
    name: string;
  };
  contracts: {
    agentNFTAddress: string;
    verifierAddress: string;
  };
  wallet: {
    privateKey: string;
  };
  storage: {
    type: 'local' | 'zg';
    zgIndexerUrl?: string;
    localPath?: string;
  };
  api: {
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
    cors: {
      origin: string | boolean | string[];
    };
  };
  logging: {
    level: string;
  };
}

const requiredEnvVars = [
  'RPC_URL',
  'AGENT_NFT_ADDRESS',
  'VERIFIER_ADDRESS',
  'PRIVATE_KEY',
];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  network: {
    rpcUrl: process.env.RPC_URL!,
    chainId: parseInt(process.env.CHAIN_ID || '16600'),
    name: process.env.NETWORK_NAME || '0g-testnet',
  },
  contracts: {
    agentNFTAddress: process.env.AGENT_NFT_ADDRESS!,
    verifierAddress: process.env.VERIFIER_ADDRESS!,
  },
  wallet: {
    privateKey: process.env.PRIVATE_KEY!,
  },
  storage: {
    type: (process.env.STORAGE_TYPE as 'local' | 'zg') || 'local',
    zgIndexerUrl: process.env.ZG_INDEXER_URL,
    localPath: process.env.LOCAL_STORAGE_PATH || path.join(__dirname, '../../temp/local-storage'),
  },
  api: {
    rateLimit: {
      windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW || '15') * 60 * 1000, // Convert to milliseconds
      maxRequests: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS || '100'),
    },
    cors: {
      origin: process.env.CORS_ORIGIN === '*' 
        ? true  // Allow all origins
        : process.env.CORS_ORIGIN?.includes(',')
          ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) // Multiple origins
          : process.env.CORS_ORIGIN || 'http://localhost:3001', // Single origin
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;