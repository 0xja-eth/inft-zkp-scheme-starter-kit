import { ethers } from 'ethers';
import { EncryptedMetadataResult } from '../types';
import { StreamCipherEncryptionService } from '../services/crypto/encryption/StreamCipherEncryptionService';
import { MemData } from '@0glabs/0g-ts-sdk';

/**
 * VerifyManager handles ZK proof verification and rootHash submission to ZKPVerifier contract
 * It calculates Merkle tree rootHash from encrypted data and submits it after verification
 */
export class VerifierClient {
  private zkpVerifier: ethers.Contract;

  constructor(zkpVerifierAddress: string, wallet: ethers.Wallet) {
    // Load ZKPVerifier contract
    const ZKPVerifierArtifact = require('../../../artifacts/contracts/verifiers/ZKPVerifier.sol/ZKPVerifier.json');
    this.zkpVerifier = new ethers.Contract(zkpVerifierAddress, ZKPVerifierArtifact.abi, wallet);
  }

  async testVerifyPreimage(proof: string) {
    return await this.zkpVerifier.verifyPreimage([proof]);
  }

  /**
   * Verify and submit RootHash to ZKPVerifier contract
   * @param tokenId - The NFT token ID
   * @param encryptedResult - The encrypted metadata result containing the data
   * @param commitment - The commitment value to associate with rootHash
   * @returns Transaction hash of the submission
   */
  async verifyAndSubmitRootHash(encryptedResult: EncryptedMetadataResult): Promise<string> {
    try {
      // 1. Get commitment (MAC) from encrypted data
      const { mac: commitment } = await StreamCipherEncryptionService.parseEncryptedData(
        encryptedResult.encryptedData
      );
      console.log('[Verify] encryptedData', encryptedResult.encryptedData.toString("hex"));

      // 2. Calculate rootHash from encrypted data
      const rootHash = await this.calculateRootHash(encryptedResult.encryptedData);

      // 3. Verify the calculated rootHash matches the stored one
      this.validateRootHash(rootHash, encryptedResult.rootHash);

      // 4. Submit rootHash to ZKPVerifier contract
      console.log(`Submitting rootHash for mac ${commitment}...`);
      const tx = await this.zkpVerifier.setRootHash(commitment, rootHash);

      await tx.wait();
      console.log(`RootHash submitted successfully! Transaction: ${tx.hash}`);

      return tx.hash;
    } catch (error: any) {
      throw new Error(`Failed to verify and submit rootHash: ${error.message}`);
    }
  }

  /**
   * Calculate Merkle tree rootHash from encrypted data using 0G storage method
   * @param encryptedData - The encrypted data buffer
   * @returns The calculated rootHash as bytes32 string
   */
  private async calculateRootHash(encryptedData: Buffer): Promise<string> {
    try {
      // Convert Buffer to Uint8Array for MemData
      const data = new Uint8Array(encryptedData);

      // Create memory file object
      const file = new MemData(data);

      // Generate Merkle tree
      const [tree, treeErr] = await file.merkleTree();
      if (treeErr !== null) {
        throw new Error(`Merkle tree generation failed: ${treeErr}`);
      }

      // Get the root hash
      return tree?.rootHash() ?? '';
    } catch (error: any) {
      throw new Error(`RootHash calculation failed: ${error.message}`);
    }
  }

  /**
   * Validate that calculated rootHash matches the expected one
   * @param calculatedRootHash - The calculated rootHash
   * @param expectedRootHash - The expected rootHash from encryptedResult
   */
  private validateRootHash(calculatedRootHash: string, expectedRootHash: string): void {
    if (calculatedRootHash.toLowerCase() !== expectedRootHash.toLowerCase()) {
      throw new Error(
        `RootHash mismatch: calculated ${calculatedRootHash} != expected ${expectedRootHash}`
      );
    }
    console.log(`✅ RootHash validation passed: ${calculatedRootHash}`);
  }
}
