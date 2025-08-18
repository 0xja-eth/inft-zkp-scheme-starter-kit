export interface AIAgentMetadata {
  model: string;
  weights: string;
  config: Record<string, any>;
  capabilities: string[];
  version: string;
  createdAt: number;
  description?: string;
  tags?: string[];
}

export interface AIModelData {
  model: string;
  weights: string;
  config: Record<string, any>;
  capabilities: string[];
  description?: string;
  tags?: string[];
}

export interface EncryptedMetadataResult {
  rootHash: string;
  sealedKey: string;
  encryptionKey?: Buffer;
}

export interface StorageResult {
  txHash: string;
  rootHash: string;
  size: number;
}

export interface DecryptedMetadata {
  metadata: AIAgentMetadata;
  isValid: boolean;
}

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm';
  keyDerivation: 'pbkdf2';
  iterations: number;
  keyLength: number;
  ivLength: number;
  tagLength: number;
}

export interface FallbackConfig {
  enableFallback: boolean;
  localStorageDir: string;
  retryAttempts: number;
  retryDelay: number;
  preferLocal: boolean;
}

export interface StorageConfig {
  rpcUrl: string;
  indexerUrl: string;
  chainId: number;

  fallback?: Partial<FallbackConfig>;
}

export interface ProofData {
  oldDataHash: string;
  newDataHash: string;
  pubKey: string;
  sealedKey: string;
}