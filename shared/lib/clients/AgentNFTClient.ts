import {ethers, Wallet} from 'ethers';
import {poseidonAsync, initPoseidon, bigint2Buffer} from '../services/crypto/Poseidon';
import { MetadataManager } from '../managers/MetadataManager';
import { TransferManager } from '../managers/TransferManager';
import { EncryptedMetadataResult, Metadata } from '../types';
import { ZGStorageService } from '../services/storage/ZGStorageService';
import { LocalStorageService } from '../services/storage/LocalStorageService';
import { ZKCryptoService } from '../services/crypto/CryptoServices';
import {PreimageProofGenerator} from '../services/crypto/zkp/PreimageProofGenerator';
import { IStorageService } from '../services/storage/StorageService';
import { CryptoService } from '../services/crypto/ICryptoService';
import { VerifierClient } from './VerifierClient';
import * as sea from 'node:sea';
import {X25519XSalsa20Poly1305SealingService} from "../services/crypto/sealing/X25519XSalsa20Poly1305SealingService";
import {Groth16Proof} from "snarkjs/index";

export class AgentNFTClient {
  private wallet?: ethers.Wallet;
  private agentNFT: ethers.Contract;

  private metadataManager?: MetadataManager;
  private transferManager?: TransferManager;

  private storageService?: IStorageService;
  private cryptoService: CryptoService;

  private verifierClient?: VerifierClient;

  constructor(
    agentNFTAddress: string,
    verifierClient?: VerifierClient,
    wallet?: ethers.Wallet,
    storageService?: IStorageService,
    cryptoService: CryptoService = new ZKCryptoService()
  ) {
    this.wallet = wallet; // new ethers.Wallet(privateKey, provider);

    // Load contract ABI from Hardhat artifacts
    const AgentNFTArtifact = require('../../../artifacts/contracts/AgentNFT.sol/AgentNFT.json');
    this.agentNFT = new ethers.Contract(agentNFTAddress, AgentNFTArtifact.abi, this.wallet);

    // Initialize services with fallback support
    this.storageService = storageService;
    this.cryptoService = cryptoService;

    if (this.storageService) {
      this.metadataManager = new MetadataManager(this.storageService, this.cryptoService);
      this.transferManager = new TransferManager(
        this.storageService,
        this.cryptoService,
        this.metadataManager
      );
    }

    this.verifierClient = verifierClient;
  }

  async upload(metadata: Metadata): Promise<EncryptedMetadataResult> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    if (!this.metadataManager) throw new Error('Metadata manager not initialized');

    // 1. Create and encrypt AI agent metadata
    console.log('Uploading encrypted AI agent metadata...');
    return await this.metadataManager.uploadAIAgent(metadata, this.getPublicKey(this.wallet));
  }

  /**
   * Mint a new AgentNFT with AI agent data
   */
  async mint(
    metadata: Metadata,
    recipientAddress?: string,
    encryptedResult?: EncryptedMetadataResult
  ): Promise<{
    tokenId: number;
    txHash: string;
    rootHash: string;
    sealedKey: string;
  }> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    if (!this.verifierClient) throw new Error('Verify client not initialized');

    try {
      const to = recipientAddress || this.wallet.address;

      // 1. Create and encrypt AI agent metadata
      encryptedResult ||= await this.upload(metadata);

      // 2. Generate preimage proof for the encrypted data
      // This proof verifies that we know the preimage of the dataHash
      console.log('Generating preimage proof...');
      const proof = await this.generatePreimageProof(metadata, encryptedResult);

      const result = await this.verifierClient.testVerifyPreimage(proof)
      console.log("Test Result", result)

      // 3. Prepare data descriptions
      const dataDescriptions = [
        `AI Agent: ${metadata.model} - ${metadata.description || 'AI Agent Model'}`,
      ];

      // 4. Call mint function on contract
      console.log('Minting AgentNFT...');
      const tx = await this.agentNFT.mint(
        [proof], // proofs for data correctness verification
        dataDescriptions, // human-readable data descriptions
        to // recipient address
      );

      const receipt = await tx.wait();

      // Extract tokenId from Minted event
      const mintedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = this.agentNFT.interface.parseLog(log);
          return parsed?.name === 'Minted';
        } catch {
          return false;
        }
      });

      if (!mintedEvent) {
        throw new Error('Minted event not found');
      }

      const parsedEvent = this.agentNFT.interface.parseLog(mintedEvent);
      const tokenId = Number(parsedEvent?.args._tokenId);

      console.log(`AgentNFT minted successfully! Token ID: ${tokenId}`);

      return {
        tokenId,
        txHash: tx.hash,
        rootHash: encryptedResult.rootHash,
        sealedKey: encryptedResult.sealedKey,
      };
    } catch (error: any) {
      throw new Error(`Mint failed: ${error.message}`);
    }
  }

  /**
   * Transfer AgentNFT to another address
   */
  async transfer(tokenId: number, toAddress: string): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    if (!this.transferManager) throw new Error('Transfer manager not initialized');

    try {
      console.log(`Transferring token ${tokenId} to ${toAddress}...`);

      // 1. Get current token data and decrypt it
      const tokenInfo = await this.getTokenInfo(tokenId);
      const rootHash = tokenInfo.dataHashes[0];

      // 2. Prepare transfer proofs
      const transferResult = await this.transferManager.prepareTransfer(
        tokenId,
        this.wallet.privateKey,
        toAddress,
        [rootHash], // Assuming single data item for simplicity
        tokenInfo.dataHashes
      );

      // 3. Execute transfer
      const tx = await this.agentNFT.transfer(toAddress, tokenId, transferResult.proofs);

      await tx.wait();
      console.log(`Transfer completed! Transaction hash: ${tx.hash}`);

      return tx.hash;
    } catch (error: any) {
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }

  /**
   * Clone AgentNFT for another address
   */
  async clone(
    tokenId: number,
    toAddress: string,
    modifications?: any
  ): Promise<{
    newTokenId: number;
    txHash: string;
  }> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    if (!this.transferManager) throw new Error('Transfer manager not initialized');

    try {
      console.log(`Cloning token ${tokenId} for ${toAddress}...`);

      // 1. Get current token data and decrypt it
      const tokenInfo = await this.getTokenInfo(tokenId);
      const rootHash = tokenInfo.dataHashes[0];

      // 2. Prepare clone proofs
      const cloneResult = await this.transferManager.prepareClone(
        tokenId,
        this.wallet.privateKey,
        toAddress,
        [rootHash], // Assuming single data item for simplicity
        tokenInfo.dataHashes,
        modifications
      );

      // 3. Execute clone
      const tx = await this.agentNFT.clone(toAddress, tokenId, cloneResult.proofs);

      const receipt = await tx.wait();

      // Extract new tokenId from Cloned event
      const clonedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = this.agentNFT.interface.parseLog(log);
          return parsed?.name === 'Cloned';
        } catch {
          return false;
        }
      });

      if (!clonedEvent) {
        throw new Error('Cloned event not found');
      }

      const parsedEvent = this.agentNFT.interface.parseLog(clonedEvent);
      const newTokenId = Number(parsedEvent?.args.newTokenId);

      console.log(`Clone completed! New Token ID: ${newTokenId}`);

      return {
        newTokenId,
        txHash: tx.hash,
      };
    } catch (error: any) {
      throw new Error(`Clone failed: ${error.message}`);
    }
  }

  /**
   * Update AgentNFT data
   */
  async update(tokenId: number, updatedModelData: Partial<Metadata>): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    if (!this.metadataManager) throw new Error('Metadata manager not initialized');

    try {
      console.log(`Updating token ${tokenId}...`);

      // 1. Get current token data and decrypt it
      const tokenInfo = await this.getTokenInfo(tokenId);
      const rootHash = tokenInfo.dataHashes[0];
      const sealedKey = tokenInfo.sealedKeys[0];

      const privateKey = this.wallet.privateKey;
      const encryptionKey = await this.cryptoService.unsealKey(sealedKey, privateKey);

      // 2. Update the metadata
      const updatedResult = await this.metadataManager.updateAIAgent(
        rootHash,
        encryptionKey,
        updatedModelData,
        this.getPublicKey(this.wallet)
      );

      // 3. Generate proof for updated data
      const proof = await this.generatePreimageProof(updatedResult.newMetadata, updatedResult);

      // 4. Execute update
      const tx = await this.agentNFT.update(tokenId, [proof]);
      await tx.wait();

      console.log(`Update completed! Transaction hash: ${tx.hash}`);
      return tx.hash;
    } catch (error: any) {
      throw new Error(`Update failed: ${error.message}`);
    }
  }

  private getPublicKey(wallet: ethers.Wallet) {
    return X25519XSalsa20Poly1305SealingService.getMetaMaskPublicKey(wallet.privateKey);
  }

  /**
   * Get token information
   */
  async getTokenInfo(tokenId: number) {
    try {
      const [owner, dataHashes, sealedKeys, dataDescriptions, authorizedUsers] = await Promise.all([
        this.agentNFT.ownerOf(tokenId),
        this.agentNFT.dataHashesOf(tokenId),
        this.agentNFT.sealedKeysOf(tokenId),
        this.agentNFT.dataDescriptionsOf(tokenId),
        this.agentNFT.authorizedUsersOf(tokenId),
      ]);

      console.log('Get token info:', {
        tokenId,
        owner,
        dataHashes,
        sealedKeys,
        dataDescriptions,
        authorizedUsers,
      });

      return {
        tokenId,
        owner,
        dataHashes,
        sealedKeys,
        dataDescriptions,
        authorizedUsers,
      };
    } catch (error: any) {
      throw new Error(`Failed to get token info: ${error.message}`);
    }
  }

  /**
   * Get contract information
   */
  async getContractInfo(): Promise<{
    name: string;
    symbol: string;
    version: string;
    verifier: string;
    address: string;
  }> {
    try {
      const [name, symbol, version, verifier] = await Promise.all([
        this.agentNFT.name(),
        this.agentNFT.symbol(),
        this.agentNFT.VERSION(),
        this.agentNFT.verifier(),
      ]);

      return {
        name,
        symbol,
        version,
        verifier,
        address: await this.agentNFT.getAddress(),
      };
    } catch (error: any) {
      throw new Error(`Failed to get contract info: ${error.message}`);
    }
  }

  /**
   * Check if token exists
   */
  async tokenExists(tokenId: number): Promise<boolean> {
    try {
      await this.agentNFT.ownerOf(tokenId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all existing tokens (limited scan)
   */
  async getExistingTokens(maxTokenId: number = 100): Promise<number[]> {
    const tokens: number[] = [];

    for (let i = 1; i <= maxTokenId; i++) {
      try {
        await this.agentNFT.ownerOf(i);
        tokens.push(i);
      } catch (error) {
        // Token doesn't exist, continue scanning
      }
    }

    return tokens;
  }

  /**
   * Get tokens owned by specific address
   */
  async getOwnedTokens(ownerAddress: string, maxTokenId: number = 100): Promise<number[]> {
    const ownedTokens: number[] = [];

    for (let i = 1; i <= maxTokenId; i++) {
      try {
        const owner = await this.agentNFT.ownerOf(i);
        if (owner.toLowerCase() === ownerAddress.toLowerCase()) {
          ownedTokens.push(i);
        }
      } catch (error) {
        // Token doesn't exist
      }
    }

    return ownedTokens;
  }

  /**
   * Authorize usage for a user
   */
  async authorizeUsage(tokenId: number, userAddress: string): Promise<string> {
    try {
      const tx = await this.agentNFT.authorizeUsage(tokenId, userAddress);
      await tx.wait();
      return tx.hash;
    } catch (error: any) {
      throw new Error(`Authorization failed: ${error.message}`);
    }
  }

  // Private helper methods

  /**
   * Generate preimage proof for data correctness verification
   * This is a simplified implementation - in production, this would involve TEE/ZKP
   */
  private async generatePreimageProof(
    metadata: Metadata,
    encryptedResult: EncryptedMetadataResult
  ): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    if (!this.verifierClient) throw new Error('Verify client not initialized');

    try {
      const privateKey = this.wallet.privateKey;
      const sealedKey = encryptedResult.sealedKey;
      const key = await this.cryptoService.unsealKey(sealedKey, privateKey);

      await this.verifierClient.verifyAndSubmitRootHash(encryptedResult);

      const proofGenerator = new PreimageProofGenerator();

      const { proof, publicSignals } = await proofGenerator.generateProof(
        JSON.stringify(metadata),
        key,
        encryptedResult.encryptedData
      );
      const dataHash = encryptedResult.rootHash;

      // Create proof buffer compatible with Solidity verifyPreimage function
      // Format: dataHash(32) + sealedKey(16) + nonce(32) + mac(32) + groth16Proof(256) = 368 bytes

      const proofData = this.createPreimageProofBuffer(dataHash, sealedKey, publicSignals, proof);

      console.log(`Proof: ${proofData}`);

      return proofData;
    } catch (error: any) {
      throw new Error(`Failed to generate preimage proof: ${error.message}`);
    }
  }

  /**
   * Create proof buffer compatible with Solidity verifyPreimage function
   * Format:
   * dataHash(32) + sealedKey(104) + nonce(32) + mac(32) + groth16Proof(256) = 456 bytes
   */
  private createPreimageProofBuffer(
      dataHash: string,
      sealedKey: string,
      publicSignals: string[],
      proof: Groth16Proof
  ): string {
    // --- dataHash (32 bytes)
    const dataHashBytes = ethers.getBytes(dataHash);
    if (dataHashBytes.length !== 32) {
      throw new Error(`Expected dataHash to be 32 bytes, got ${dataHashBytes.length}`);
    }

    // --- sealedKey (104 bytes)
    const sealedKeyBytes = Buffer.from(sealedKey, "base64");
    if (sealedKeyBytes.length !== 104) {
      throw new Error(`Expected sealed key length to be 104 bytes, got ${sealedKeyBytes.length}`);
    }

    // --- public signals (nonce, mac)
    if (publicSignals.length !== 2) {
      throw new Error(`Expected 2 public signals, got ${publicSignals.length}`);
    }
    const nonceBytes = ethers.getBytes(
        ethers.zeroPadValue(ethers.toBeHex(BigInt(publicSignals[0])), 32)
    );
    const macBytes = ethers.getBytes(
        ethers.zeroPadValue(ethers.toBeHex(BigInt(publicSignals[1])), 32)
    );

    // --- groth16 proof (256 bytes)
    const proofBytes = this.encodeGroth16Proof(proof);

    // --- allocate buffer (456 bytes)
    const totalLength = 32 + 104 + 32 + 32 + 256;
    const buffer = new Uint8Array(totalLength);
    let offset = 0;

    buffer.set(dataHashBytes, offset); offset += 32;
    buffer.set(sealedKeyBytes, offset); offset += 104;
    buffer.set(nonceBytes, offset); offset += 32;
    buffer.set(macBytes, offset); offset += 32;
    buffer.set(proofBytes, offset);

    return ethers.hexlify(buffer);
  }

  /**
   * Encode Groth16 proof (a, b, c) to 256 bytes
   * Format: a(64) + b(128) + c(64)
   */
  private encodeGroth16Proof(proof: Groth16Proof): Uint8Array {
    const proofBytes = new Uint8Array(256);
    let offset = 0;

    // --- a: [2]
    for (let i = 0; i < 2; i++) {
      const value = BigInt(proof.pi_a[i]);
      const bytes = ethers.getBytes(
          ethers.zeroPadValue(ethers.toBeHex(value), 32)
      );
      proofBytes.set(bytes, offset);
      offset += 32;
    }

    // --- b: [2][2] (ignore the 3rd row if exists)
    for (let i = 0; i < 2; i++) {
      for (let j = 1; j >= 0; j--) { // Reverse order
        const value = BigInt(proof.pi_b[i][j]);
        const bytes = ethers.getBytes(
            ethers.zeroPadValue(ethers.toBeHex(value), 32)
        );
        proofBytes.set(bytes, offset);
        offset += 32;
      }
    }

    // --- c: [2]
    for (let i = 0; i < 2; i++) {
      const value = BigInt(proof.pi_c[i]);
      const bytes = ethers.getBytes(
          ethers.zeroPadValue(ethers.toBeHex(value), 32)
      );
      proofBytes.set(bytes, offset);
      offset += 32;
    }

    return proofBytes;
  }

  // /**
  //  * Create proof buffer compatible with Solidity verifyPreimage function
  //  * Format: dataHash(32) + sealedKey(16) + nonce(32) + mac(32) + groth16Proof(256) = 368 bytes
  //  */
  // private createPreimageProofBuffer(
  //   dataHash: string,
  //   sealedKey: string,
  //   publicSignals: string[],
  //   proof: {
  //     "pi_a": [
  //       "12374041035784657098724057874677394923018960810545464069008427886649170476624",
  //       "19325559959162900566803619118427790810097928486489900627096409441131809572867",
  //       "1"
  //     ],
  //     "pi_b": [
  //       [
  //         "4756454615533246956358020616302431442157269760629290082751195707647361244280",
  //         "11144573826152202102437997709655000266134781177772916706738262298112843811740"
  //       ],
  //       [
  //         "19753098329802689139859027059020717989349856210946704230725679257012579081563",
  //         "2234742065703125226406209393042127637335254150407126899237543912186505076067"
  //       ],
  //       [
  //         "1",
  //         "0"
  //       ]
  //     ],
  //     "pi_c": [
  //       "13542313289067810569455751128258056416510967671559837995927554871577867863877",
  //       "3319084298478008822747873779359459555142941620217680106975570165642496260600",
  //       "1"
  //     ],
  //     "protocol": "groth16",
  //     "curve": "bn128"
  //   }
  // ): string {
  //   // Convert inputs to proper formats
  //   const dataHashBytes = ethers.getBytes(dataHash); // 32 bytes
  //   const sealedKeyBytes = Buffer.from(sealedKey, "base64"); //.slice(0, 16); // 16 bytes (truncate if longer)
  //
  //   if (sealedKeyBytes.length != 104) // For 32 bytes key, the sealed key should be 104 bytes
  //     throw new Error(`Expected sealed key length to be 104 bytes, got ${sealedKeyBytes.length}`);
  //
  //   // Extract nonce and mac from publicSignals
  //   // publicSignals format: [nonce, mac] (2 elements for StreamEncVerify circuit)
  //   if (publicSignals.length !== 2) {
  //     throw new Error(`Expected 2 public signals, got ${publicSignals.length}`);
  //   }
  //
  //   const nonce = BigInt(publicSignals[0]);
  //   const mac = BigInt(publicSignals[1]);
  //
  //   // Convert to 32-byte buffers (big-endian)
  //   const nonceBytes = new Uint8Array(32);
  //   const macBytes = new Uint8Array(32);
  //
  //   // Convert BigInt to bytes (big-endian)
  //   this.bigIntToBytes(nonce, nonceBytes);
  //   this.bigIntToBytes(mac, macBytes);
  //
  //   // Extract Groth16 proof components (a, b, c)
  //   const proofBytes = this.encodeGroth16Proof(proof);
  //
  //   // Concatenate all components
  //   const totalLength = 32 + 104 + 32 + 32 + 256; // 456 bytes
  //   const buffer = new Uint8Array(totalLength);
  //   let offset = 0;
  //
  //   // dataHash (32 bytes)
  //   buffer.set(dataHashBytes, offset);
  //   offset += 32;
  //
  //   // sealedKey (104 bytes)
  //   buffer.set(sealedKeyBytes, offset);
  //   offset += 104;
  //
  //   // nonce (32 bytes)
  //   buffer.set(nonceBytes, offset);
  //   offset += 32;
  //
  //   // mac (32 bytes)
  //   buffer.set(macBytes, offset);
  //   offset += 32;
  //
  //   // groth16Proof (256 bytes)
  //   buffer.set(proofBytes, offset);
  //
  //   return ethers.hexlify(buffer);
  // }
  //
  // /**
  //  * Convert BigInt to 32-byte array (big-endian)
  //  */
  // private bigIntToBytes(value: bigint, buffer: Uint8Array): void {
  //   if (buffer.length !== 32) {
  //     throw new Error('Buffer must be 32 bytes');
  //   }
  //
  //   // Convert to big-endian bytes
  //   for (let i = 31; i >= 0; i--) {
  //     buffer[i] = Number(value & 0xffn);
  //     value = value >> 8n;
  //   }
  // }
  //
  // /**
  //  * Encode Groth16 proof (a, b, c) to 256 bytes
  //  * Format: a(64) + b(128) + c(64) = 256 bytes
  //  */
  // private encodeGroth16Proof(proof: any): Uint8Array {
  //   const proofBytes = new Uint8Array(256);
  //   let offset = 0;
  //
  //   // a: [2 elements] = 64 bytes
  //   for (let i = 0; i < 2; i++) {
  //     const value = BigInt(proof.pi_a[i]);
  //     const bytes = new Uint8Array(32);
  //     this.bigIntToBytes(value, bytes);
  //     proofBytes.set(bytes, offset);
  //     offset += 32;
  //   }
  //
  //   // b: [2][2 elements] = 128 bytes
  //   for (let i = 0; i < 2; i++) {
  //     for (let j = 0; j < 2; j++) {
  //       const value = BigInt(proof.pi_b[i][j]);
  //       const bytes = new Uint8Array(32);
  //       this.bigIntToBytes(value, bytes);
  //       proofBytes.set(bytes, offset);
  //       offset += 32;
  //     }
  //   }
  //
  //   // c: [2 elements] = 64 bytes
  //   for (let i = 0; i < 2; i++) {
  //     const value = BigInt(proof.pi_c[i]);
  //     const bytes = new Uint8Array(32);
  //     this.bigIntToBytes(value, bytes);
  //     proofBytes.set(bytes, offset);
  //     offset += 32;
  //   }
  //
  //   return proofBytes;
  // }
}
