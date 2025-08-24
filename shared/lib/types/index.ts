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

export interface ProofData {
  oldDataHash: string;
  newDataHash: string;
  pubKey: string;
  sealedKey: string;
}
