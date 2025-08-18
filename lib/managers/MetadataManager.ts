import { ethers } from 'ethers';
import { IZGStorage } from '../services/ZGStorage';
import { EncryptionService } from '../services/EncryptionService';
import { AIAgentMetadata, AIModelData, EncryptedMetadataResult, DecryptedMetadata } from '../types';
import * as crypto from 'crypto';

export class MetadataManager {
  private storage: IZGStorage;
  private encryption: EncryptionService;

  constructor(ogStorage: IZGStorage, encryptionService: EncryptionService) {
    this.storage = ogStorage;
    this.encryption = encryptionService;
  }

  /**
   * Create AI Agent metadata and store it encrypted
   */
  async createAIAgent(aiModelData: AIModelData, ownerPublicKey: string): Promise<EncryptedMetadataResult> {
    try {
      // Prepare AI agent metadata
      const metadata: AIAgentMetadata = {
        model: aiModelData.model,
        weights: aiModelData.weights,
        config: aiModelData.config,
        capabilities: aiModelData.capabilities,
        version: '1.0',
        createdAt: Date.now(),
        description: aiModelData.description,
        tags: aiModelData.tags,
      };

      // Generate encryption key
      const encryptionKey = this.encryption.generateKey();

      // Encrypt metadata
      const encryptedData = await this.encryption.encrypt(
        JSON.stringify(metadata),
        encryptionKey
      );

      // Store encrypted data on 0G Storage
      const storageResult = await this.storage.store(encryptedData);

      // Seal encryption key for owner
      const sealedKey = await this.encryption.sealKey(encryptionKey, ownerPublicKey);

      return {
        rootHash: storageResult.rootHash,
        sealedKey,
        encryptionKey, // Keep for internal use, don't expose in production
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
      const metadataString = await this.encryption.decrypt(encryptedData, encryptionKey);
      const metadata: AIAgentMetadata = JSON.parse(metadataString);

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
    updatedMetadata: Partial<AIAgentMetadata>,
    ownerPublicKey: string
  ): Promise<EncryptedMetadataResult> {
    try {
      // Retrieve current metadata
      const { metadata: currentMetadata } = await this.retrieveAIAgent(rootHash, currentEncryptionKey);

      // Merge with updates
      const newMetadata: AIAgentMetadata = {
        ...currentMetadata,
        ...updatedMetadata,
        version: this.incrementVersion(currentMetadata.version),
      };

      // Generate new encryption key
      const newEncryptionKey = this.encryption.generateKey();

      // Encrypt updated metadata
      const encryptedData = await this.encryption.encrypt(
        JSON.stringify(newMetadata),
        newEncryptionKey
      );

      // Store updated encrypted data
      const storageResult = await this.storage.store(encryptedData);

      // Seal new encryption key
      const sealedKey = await this.encryption.sealKey(newEncryptionKey, ownerPublicKey);

      return {
        rootHash: storageResult.rootHash,
        sealedKey,
        encryptionKey: newEncryptionKey,
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
      const newEncryptionKey = this.encryption.generateKey();

      // Encrypt with new key
      const encryptedData = await this.encryption.encrypt(
        JSON.stringify(metadata),
        newEncryptionKey
      );

      // Store re-encrypted data
      const storageResult = await this.storage.store(encryptedData);

      // Seal new key for new owner
      const sealedKey = await this.encryption.sealKey(newEncryptionKey, newOwnerPublicKey);

      return {
        rootHash: storageResult.rootHash,
        sealedKey,
        encryptionKey: newEncryptionKey,
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
    modifications?: Partial<AIAgentMetadata>
  ): Promise<EncryptedMetadataResult> {
    try {
      // Retrieve source metadata
      const { metadata: sourceMetadata } = await this.retrieveAIAgent(sourceRootHash, sourceEncryptionKey);

      // Create cloned metadata
      const clonedMetadata: AIAgentMetadata = {
        ...sourceMetadata,
        ...modifications,
        createdAt: Date.now(), // New creation time for clone
        version: '1.0', // Reset version for clone
      };

      // Generate new encryption key
      const newEncryptionKey = this.encryption.generateKey();

      // Encrypt cloned metadata
      const encryptedData = await this.encryption.encrypt(
        JSON.stringify(clonedMetadata),
        newEncryptionKey
      );

      // Store encrypted clone
      const storageResult = await this.storage.store(encryptedData);

      // Seal key for new owner
      const sealedKey = await this.encryption.sealKey(newEncryptionKey, newOwnerPublicKey);

      return {
        rootHash: storageResult.rootHash,
        sealedKey,
        encryptionKey: newEncryptionKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to clone AI agent: ${error.message}`);
    }
  }

  /**
   * Generate metadata hash
   */
  private generateMetadataHash(metadata: AIAgentMetadata): string {
    const metadataString = JSON.stringify(metadata, Object.keys(metadata).sort());
    return ethers.keccak256(ethers.toUtf8Bytes(metadataString));
  }

  /**
   * Validate metadata structure and integrity
   */
  private validateMetadata(metadata: AIAgentMetadata): boolean {
    try {
      return !!(
        metadata.model &&
        metadata.capabilities &&
        Array.isArray(metadata.capabilities) &&
        metadata.version &&
        metadata.createdAt &&
        typeof metadata.createdAt === 'number'
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Increment version string (e.g., "1.0" -> "1.1")
   */
  private incrementVersion(currentVersion: string): string {
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