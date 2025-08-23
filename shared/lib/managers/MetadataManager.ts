import { ethers } from 'ethers';
import { IStorageService } from '../services/storage/StorageService';
import { Metadata, EncryptedMetadataResult, DecryptedMetadata } from '../types';
import {CryptoService} from "../services/crypto/ICryptoService";

export class MetadataManager {
  private storage: IStorageService;
  private crypto: CryptoService;

  constructor(storageService: IStorageService, cryptoService: CryptoService) {
    this.storage = storageService;
    this.crypto = cryptoService;
  }

  defaultMetadata(): Metadata {
    return {
      name: "",
      description: "",
      avatar: "",
      externalUrl: "",
      version: "",
      model: "",
      personality: "",
      capabilities: [],
      attributes: {}
    };
  }

  /**
   * Create AI Agent metadata and store it encrypted
   */
  async uploadAIAgent(metadata: Metadata, ownerPublicKey: string): Promise<EncryptedMetadataResult> {
    try {
      // Generate encryption key
      const encryptionKey = this.crypto.generateKey();

      // Encrypt metadata
      const encryptedData = await this.crypto.encrypt(
        JSON.stringify(metadata),
        encryptionKey
      );

      // Store encrypted data on 0G Storage
      const storageResult = await this.storage.store(encryptedData);

      // Seal encryption key for owner
      const sealedKey = await this.crypto.sealKey(encryptionKey, ownerPublicKey);

      return {
        encryptedData,
        rootHash: storageResult.rootHash,
        sealedKey,
        // encryptionKey, // Keep for internal use, don't expose in production
      };
    } catch (error: any) {
      throw new Error(`Failed to create AI agent: ${error.message}`);
    }
  }

  /**
   * Decrypt and retrieve AI agent metadata
   */
  async retrieveAIAgent(rootHash: string, encryptionKey: Buffer): Promise<DecryptedMetadata> {
    try {
      // Retrieve encrypted data from storage
      const encryptedData = await this.storage.retrieve(rootHash);

      // Decrypt metadata
      const metadataString = await this.crypto.decrypt(encryptedData, encryptionKey);
      const metadata: Metadata = JSON.parse(metadataString);

      // Validate metadata integrity
      const isValid = this.validateMetadata(metadata);

      return {
        metadata,
        isValid,
      };
    } catch (error: any) {
      throw new Error(`Failed to retrieve AI agent: ${error.message}`);
    }
  }

  /**
   * Update AI agent metadata
   */
  async updateAIAgent(
    rootHash: string,
    currentEncryptionKey: Buffer,
    updatedMetadata: Partial<Metadata>,
    ownerPublicKey: string
  ): Promise<EncryptedMetadataResult & { newMetadata: Metadata }> {
    try {
      // Retrieve current metadata
      const { metadata: currentMetadata } = await this.retrieveAIAgent(rootHash, currentEncryptionKey);

      // Merge with updates
      const newMetadata: Metadata = {
        ...currentMetadata,
        ...updatedMetadata,
        version: this.incrementVersion(currentMetadata.version),
      };

      // Generate new encryption key
      const newEncryptionKey = this.crypto.generateKey();

      // Encrypt updated metadata
      const encryptedData = await this.crypto.encrypt(
        JSON.stringify(newMetadata),
        newEncryptionKey
      );

      // Store updated encrypted data
      const storageResult = await this.storage.store(encryptedData);

      // Seal new encryption key
      const sealedKey = await this.crypto.sealKey(newEncryptionKey, ownerPublicKey);

      return {
        newMetadata,
        encryptedData,
        rootHash: storageResult.rootHash,
        sealedKey,
        // encryptionKey: newEncryptionKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to update AI agent: ${error.message}`);
    }
  }

  /**
   * Re-encrypt metadata for transfer to new owner
   */
  async reencryptForTransfer(
    rootHash: string,
    currentEncryptionKey: Buffer,
    newOwnerPublicKey: string
  ): Promise<EncryptedMetadataResult> {
    try {
      // Retrieve current metadata
      const { metadata } = await this.retrieveAIAgent(rootHash, currentEncryptionKey);

      // Generate new encryption key for new owner
      const newEncryptionKey = this.crypto.generateKey();

      // Encrypt with new key
      const encryptedData = await this.crypto.encrypt(
        JSON.stringify(metadata),
        newEncryptionKey
      );

      // Store re-encrypted data
      const storageResult = await this.storage.store(encryptedData);

      // Seal new key for new owner
      const sealedKey = await this.crypto.sealKey(newEncryptionKey, newOwnerPublicKey);

      return {
        encryptedData,
        rootHash: storageResult.rootHash,
        sealedKey,
        // encryptionKey: newEncryptionKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to re-encrypt for transfer: ${error.message}`);
    }
  }

  /**
   * Clone AI agent metadata for new owner
   */
  async cloneAIAgent(
    sourceRootHash: string,
    sourceEncryptionKey: Buffer,
    newOwnerPublicKey: string,
    modifications?: Partial<Metadata>
  ): Promise<EncryptedMetadataResult> {
    try {
      // Retrieve source metadata
      const { metadata: sourceMetadata } = await this.retrieveAIAgent(sourceRootHash, sourceEncryptionKey);

      // Create cloned metadata
      const clonedMetadata: Metadata = {
        ...sourceMetadata,
        ...modifications,
        version: '1.0', // Reset version for clone
      };

      // Generate new encryption key
      const newEncryptionKey = this.crypto.generateKey();

      // Encrypt cloned metadata
      const encryptedData = await this.crypto.encrypt(
        JSON.stringify(clonedMetadata),
        newEncryptionKey
      );

      // Store encrypted clone
      const storageResult = await this.storage.store(encryptedData);

      // Seal key for new owner
      const sealedKey = await this.crypto.sealKey(newEncryptionKey, newOwnerPublicKey);

      return {
        encryptedData,
        rootHash: storageResult.rootHash,
        sealedKey,
        // encryptionKey: newEncryptionKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to clone AI agent: ${error.message}`);
    }
  }

  /**
   * Generate metadata hash
   */
  private generateMetadataHash(metadata: Metadata): string {
    const metadataString = JSON.stringify(metadata, Object.keys(metadata).sort());
    return ethers.keccak256(ethers.toUtf8Bytes(metadataString));
  }

  /**
   * Validate metadata structure and integrity
   */
  private validateMetadata(metadata: Metadata): boolean {
    try {
      return !!(
        metadata.model &&
        metadata.capabilities &&
        Array.isArray(metadata.capabilities) &&
        metadata.version
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Increment version string (e.g., "1.0" -> "1.1")
   */
  private incrementVersion(currentVersion: string = '1.0'): string {
    try {
      const parts = currentVersion.split('.');
      const major = parseInt(parts[0]) || 1;
      const minor = parseInt(parts[1]) || 0;
      return `${major}.${minor + 1}`;
    } catch (error) {
      return '1.1';
    }
  }
}