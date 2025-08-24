import { ethers } from 'ethers';
import { IStorageService } from '../services/storage/StorageService';
import { MetadataManager } from './MetadataManager';
import { ProofData } from '../types';
import * as crypto from 'crypto';
import { CryptoService } from '../services/crypto/ICryptoService';

export interface TransferResult {
  proofs: string[];
  newRootHashes: string[];
  sealedKeys: string[];
}

export interface CloneResult {
  proofs: string[];
  newRootHashes: string[];
  sealedKeys: string[];
  newTokenData: any;
}

export class TransferManager {
  private storage: IStorageService;
  private crypto: CryptoService;

  private metadataManager: MetadataManager;

  constructor(
    storageService: IStorageService,
    cryptoService: CryptoService,
    metadataManager: MetadataManager
  ) {
    this.storage = storageService;
    this.crypto = cryptoService;

    this.metadataManager = metadataManager;
  }

  /**
   * Prepare transfer proofs for AgentNFT contract
   * Generates the proofs needed for the transfer() function
   */
  async prepareTransfer(
    tokenId: number,
    currentOwnerPrivateKey: string,
    recipientAddress: string,
    currentRootHashes: string[],
    currentDataHashes: string[]
  ): Promise<TransferResult> {
    try {
      const recipientPublicKey = this.getPublicKeyFromAddress(recipientAddress);
      const proofs: string[] = [];
      const newRootHashes: string[] = [];
      const sealedKeys: string[] = [];

      // Process each encrypted data item
      for (let i = 0; i < currentRootHashes.length; i++) {
        const currentRootHash = currentRootHashes[i];
        const currentDataHash = currentDataHashes[i];

        // Get encryption key from sealed key (simulate)
        const currentEncryptionKey = await this.getCurrentEncryptionKey(
          currentOwnerPrivateKey,
          tokenId,
          i
        );

        // Re-encrypt metadata for new recipient
        const reencryptResult = await this.metadataManager.reencryptForTransfer(
          currentRootHash,
          currentEncryptionKey,
          recipientPublicKey
        );

        // Generate transfer proof
        const proof = await this.generateTransferProof(
          currentDataHash,
          reencryptResult.rootHash,
          recipientPublicKey,
          reencryptResult.sealedKey
        );

        proofs.push(proof);
        newRootHashes.push(reencryptResult.rootHash);
        sealedKeys.push(reencryptResult.sealedKey);
      }

      return {
        proofs,
        newRootHashes,
        sealedKeys,
      };
    } catch (error: any) {
      throw new Error(`Transfer preparation failed: ${error.message}`);
    }
  }

  /**
   * Prepare clone proofs for AgentNFT contract
   * Generates the proofs needed for the clone() function
   */
  async prepareClone(
    tokenId: number,
    currentOwnerPrivateKey: string,
    recipientAddress: string,
    currentRootHashes: string[],
    currentDataHashes: string[],
    modifications?: any
  ): Promise<CloneResult> {
    try {
      const recipientPublicKey = this.getPublicKeyFromAddress(recipientAddress);
      const proofs: string[] = [];
      const newRootHashes: string[] = [];
      const sealedKeys: string[] = [];

      // Process each encrypted data item for cloning
      for (let i = 0; i < currentRootHashes.length; i++) {
        const currentRootHash = currentRootHashes[i];
        const currentDataHash = currentDataHashes[i];

        // Get current encryption key
        const currentEncryptionKey = await this.getCurrentEncryptionKey(
          currentOwnerPrivateKey,
          tokenId,
          i
        );

        // Clone metadata for new recipient
        const cloneResult = await this.metadataManager.cloneAIAgent(
          currentRootHash,
          currentEncryptionKey,
          recipientPublicKey,
          modifications
        );

        // Generate transfer proof (same format as transfer)
        const proof = await this.generateTransferProof(
          currentDataHash,
          cloneResult.rootHash,
          recipientPublicKey,
          cloneResult.sealedKey
        );

        proofs.push(proof);
        newRootHashes.push(cloneResult.rootHash);
        sealedKeys.push(cloneResult.sealedKey);
      }

      return {
        proofs,
        newRootHashes,
        sealedKeys,
        newTokenData: {
          rootHashes: newRootHashes,
          sealedKeys,
        },
      };
    } catch (error: any) {
      throw new Error(`Clone preparation failed: ${error.message}`);
    }
  }

  /**
   * Generate transfer validity proof
   * Format: oldDataHash + newDataHash + pubKey + sealedKey (144 bytes total)
   */
  private async generateTransferProof(
    oldDataHash: string,
    newDataHash: string,
    recipientPublicKey: string,
    sealedKey: string
  ): Promise<string> {
    try {
      // Convert hashes to 32-byte buffers
      const oldHashBuffer = Buffer.from(oldDataHash.replace('0x', ''), 'hex');
      const newHashBuffer = Buffer.from(newDataHash.replace('0x', ''), 'hex');

      // Convert public key to 64-byte buffer
      const pubKeyBuffer = Buffer.from(recipientPublicKey.replace('0x', ''), 'hex');

      // Convert sealed key to 16-byte buffer
      const sealedKeyBuffer = Buffer.from(sealedKey.slice(0, 32), 'hex');

      // Combine all parts (144 bytes total)
      const proof = Buffer.concat([
        oldHashBuffer, // 32 bytes
        newHashBuffer, // 32 bytes
        pubKeyBuffer, // 64 bytes
        sealedKeyBuffer, // 16 bytes
      ]);

      return '0x' + proof.toString('hex');
    } catch (error: any) {
      throw new Error(`Proof generation failed: ${error.message}`);
    }
  }

  /**
   * Get current encryption key for a token's data item
   * In production, this would involve unsealing with owner's private key
   */
  private async getCurrentEncryptionKey(
    ownerPrivateKey: string,
    tokenId: number,
    dataIndex: number
  ): Promise<Buffer> {
    try {
      // In production, you would:
      // 1. Query the contract for the token's sealed keys
      // 2. Unseal the key using the owner's private key

      // For now, generate a deterministic key for testing
      const keyMaterial = `${ownerPrivateKey}-${tokenId}-${dataIndex}`;
      const keyHash = crypto.createHash('sha256').update(keyMaterial).digest();

      return keyHash;
    } catch (error: any) {
      throw new Error(`Failed to get encryption key: ${error.message}`);
    }
  }

  /**
   * Get public key from Ethereum address
   * This is a simplified version - in production, you need the actual public key
   */
  private getPublicKeyFromAddress(address: string): string {
    // In production, you would need to obtain the recipient's actual public key
    // This is a placeholder that generates a deterministic "public key" from address
    const addressHash = crypto.createHash('sha256').update(address.toLowerCase()).digest();
    const publicKey = Buffer.concat([addressHash, addressHash]); // 64 bytes
    return '0x' + publicKey.toString('hex');
  }

  /**
   * Validate transfer proof format
   */
  validateProof(proof: string): boolean {
    try {
      const proofBuffer = Buffer.from(proof.replace('0x', ''), 'hex');
      return proofBuffer.length === 144; // 32 + 32 + 64 + 16 = 144 bytes
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract proof components
   */
  extractProofComponents(proof: string): ProofData {
    try {
      const proofBuffer = Buffer.from(proof.replace('0x', ''), 'hex');

      if (proofBuffer.length !== 144) {
        throw new Error('Invalid proof length');
      }

      return {
        oldDataHash: '0x' + proofBuffer.subarray(0, 32).toString('hex'),
        newDataHash: '0x' + proofBuffer.subarray(32, 64).toString('hex'),
        pubKey: '0x' + proofBuffer.subarray(64, 128).toString('hex'),
        sealedKey: '0x' + proofBuffer.subarray(128, 144).toString('hex'),
      };
    } catch (error: any) {
      throw new Error(`Failed to extract proof components: ${error.message}`);
    }
  }

  /**
   * Sign transfer confirmation (recipient signature)
   */
  async signTransferConfirmation(
    oldDataHashes: string[],
    newDataHashes: string[],
    recipientPrivateKey: string
  ): Promise<string> {
    try {
      const wallet = new ethers.Wallet(recipientPrivateKey);

      // Create message to sign
      const message = ethers.solidityPackedKeccak256(
        ['bytes32[]', 'bytes32[]'],
        [oldDataHashes, newDataHashes]
      );

      return await wallet.signMessage(ethers.getBytes(message));
    } catch (error: any) {
      throw new Error(`Transfer confirmation signing failed: ${error.message}`);
    }
  }
}
