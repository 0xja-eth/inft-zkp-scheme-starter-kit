export interface AgentCapability {
  name: string;
  description: string;
  input?: string;
  output?: string;
  preconditions?: string[];
  postconditions?: string[];
}

export interface Metadata {
  name: string;
  description: string;
  avatar?: string;
  externalUrl?: string;
  version?: string;
  model?: string;
  personality?: string;
  capabilities?: AgentCapability[];
  attributes?: Record<string, string | number>;
}

export interface EncryptedMetadataResult {
  encryptedData: Buffer;
  rootHash: string;
  sealedKey: string;
  // encryptionKey?: Buffer;
}

export interface StorageResult {
  txHash: string;
  rootHash: string;
  size: number;
}

export interface DecryptedMetadata {
  metadata: Metadata;
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