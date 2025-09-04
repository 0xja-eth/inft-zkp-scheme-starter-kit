import {ethers, SigningKey, Wallet} from 'ethers';
import { MetadataManager } from '../managers/MetadataManager';
import { TransferManager } from '../managers/TransferManager';
import { EncryptedMetadataResult, Metadata } from '../types';
import { ZKCryptoService } from '../services/crypto/CryptoServices';
import {PreimageProofGenerator} from '../services/crypto/zkp/PreimageProofGenerator';
import { IStorageService } from '../services/storage/StorageService';
import { CryptoService } from '../services/crypto/ICryptoService';
import { VerifierClient } from './VerifierClient';
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
        this.cryptoService,
        this.metadataManager
      );
    }

    this.verifierClient = verifierClient;
  }

  getEncPublicKeyVerifyMessage(address: string, encPublicKey: string) {
    return `Encryption Public Key Declaration\naddress: ${address}\nencPubBase64: ${encPublicKey}`
  }

  private recoverPublicKey(message: string, signature: string) {
    const digest = ethers.hashMessage(message);
    return SigningKey.recoverPublicKey(digest, signature)
  }

  private verifySignature(address: string, encPublicKey: string, signature: string) {
    const message = this.getEncPublicKeyVerifyMessage(address, encPublicKey);
    const digest = ethers.hashMessage(message);
    const recoveredAddress = ethers.recoverAddress(digest, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase())
      throw new Error("Invalid signature")

    return this.recoverPublicKey(message, signature);
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
      const to = this.wallet.address;

      // 1. Create and encrypt AI agent metadata
      encryptedResult ||= await this.upload(metadata);

      // 2. Generate preimage proof for the encrypted data
      // This proof verifies that we know the preimage of the dataHash
      console.log('Generating preimage proof...');
      const proof = await this.generatePreimageProof(metadata, encryptedResult);

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
  async transfer(tokenId: number, toAddress: string, toEncPublicKey: string, signature: string): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    if (!this.transferManager) throw new Error('Transfer manager not initialized');

    try {
      console.log(`Transferring token ${tokenId} to ${toAddress}...`);

      const toPublicKey = this.verifySignature(toAddress, toEncPublicKey, signature);

      // 1. Get current token data and decrypt it
      const tokenInfo = await this.getTokenInfo(tokenId);

      // 2. Prepare transfer proofs
      const transferResult = await this.transferManager.prepareTransfer(
        this.wallet.privateKey, toPublicKey, toEncPublicKey, tokenInfo.dataHashes, tokenInfo.sealedKeys
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
    const sealedKeyBytes = ethers.getBytes(sealedKey);
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
    const buffer = Buffer.concat([
        dataHashBytes, // 32 bytes
        sealedKeyBytes, // 104 bytes
        nonceBytes, // 32 bytes
        macBytes, // 32 bytes
        proofBytes // 256 bytes
    ]);

    return ethers.hexlify(buffer);

    // const totalLength = 32 + 104 + 32 + 32 + 256;
    // const buffer = new Uint8Array(totalLength);
    // let offset = 0;
    //
    // buffer.set(dataHashBytes, offset); offset += 32;
    // buffer.set(sealedKeyBytes, offset); offset += 104;
    // buffer.set(nonceBytes, offset); offset += 32;
    // buffer.set(macBytes, offset); offset += 32;
    // buffer.set(proofBytes, offset);
    //
    // return ethers.hexlify(buffer);
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
}
