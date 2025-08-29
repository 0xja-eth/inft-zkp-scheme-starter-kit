/**
 * Re-export shared library components with simplified imports
 * This approach avoids complex path mapping issues
 */

// Re-export types
export type { 
  Metadata, 
  AgentCapability,
  EncryptedMetadataResult, 
  StorageResult,
  DecryptedMetadata,
  ProofData 
} from '@shared/lib/types';

// Re-export clients
export { AgentNFTClient } from '@shared/lib/clients/AgentNFTClient';
export { VerifierClient } from '@shared/lib/clients/VerifierClient';

// Re-export managers
export { MetadataManager } from '@shared/lib/managers/MetadataManager';
export { TransferManager } from '@shared/lib/managers/TransferManager';

// Re-export crypto services
export { 
  ZKCryptoService, 
  GeneralCryptoService 
} from '@shared/lib/services/crypto/CryptoServices';
export type { CryptoService } from '@shared/lib/services/crypto/ICryptoService';

// Re-export storage services
export { ZGStorageService } from '@shared/lib/services/storage/ZGStorageService';
export { LocalStorageService } from '@shared/lib/services/storage/LocalStorageService';
export type { IStorageService } from '@shared/lib/services/storage/StorageService';

// Re-export ZKP services
export { PreimageProofGenerator } from '@shared/lib/services/crypto/zkp/PreimageProofGenerator';