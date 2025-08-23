import { ethers } from 'ethers';
import { poseidonAsync, initPoseidon } from './services/crypto/Poseidon';
import { MetadataManager } from './managers/MetadataManager';
import { TransferManager } from './managers/TransferManager';
import { EncryptedMetadataResult, Metadata, StorageConfig} from './types';
import {ZGStorageService} from "./services/storage/ZGStorageService";
import {LocalStorageService} from "./services/storage/LocalStorageService";
import {ZKCryptoService} from "./services/crypto/CryptoServices";
import {FileEncryptionProofGenerator} from "./services/crypto/zkp/FileEncryptionProofGenerator";
import {IStorageService} from "./services/storage/StorageService";
import {CryptoService} from "./services/crypto/ICryptoService";

export class AgentNFTClient {
  private wallet: ethers.Wallet;
  private agentNFT: ethers.Contract;

  private metadataManager: MetadataManager;
  private transferManager: TransferManager;

  private storageService: IStorageService;
  private cryptoService: CryptoService;

  private provider: ethers.Provider;

  constructor(
    contractAddress: string,
    privateKey: string,
    provider: ethers.Provider,
    storageConfig: StorageConfig
  ) {
    this.provider = provider;
    this.wallet = new ethers.Wallet(privateKey, provider);
    
    // Load contract ABI from Hardhat artifacts
    const AgentNFTArtifact = require('../../artifacts/contracts/AgentNFT.sol/AgentNFT.json');
    this.agentNFT = new ethers.Contract(contractAddress, AgentNFTArtifact.abi, this.wallet);

    // Initialize services with fallback support
    this.storageService = new ZGStorageService(this.wallet, storageConfig, {
      fallbackServices: [new LocalStorageService()]
    });
    this.cryptoService = new ZKCryptoService();

    this.metadataManager = new MetadataManager(this.storageService, this.cryptoService);
    this.transferManager = new TransferManager(this.storageService, this.cryptoService, this.metadataManager);
  }

  async upload(metadata: Metadata): Promise<EncryptedMetadataResult> {

    const recipientPublicKey = this.getPublicKeyFromPrivateKey(this.wallet.privateKey);

    // 1. Create and encrypt AI agent metadata
    console.log('Uploading encrypted AI agent metadata...');
    return await this.metadataManager.uploadAIAgent(
        metadata,
        recipientPublicKey
    );
  }

  /**
   * Mint a new AgentNFT with AI agent data
   */
  async mint(metadata: Metadata, recipientAddress?: string, encryptedResult?: EncryptedMetadataResult): Promise<{
    tokenId: number;
    txHash: string;
    rootHash: string;
    sealedKey: string;
  }> {
    try {
      const to = recipientAddress || this.wallet.address;

      // 1. Create and encrypt AI agent metadata
      encryptedResult ||= await this.upload(metadata);

      // 2. Generate preimage proof for the encrypted data
      // This proof verifies that we know the preimage of the dataHash
      console.log('Generating preimage proof...');
      const proof = await this.generatePreimageProof(metadata, encryptedResult);

      // 3. Prepare data descriptions
      const dataDescriptions = [
        `AI Agent: ${metadata.model} - ${metadata.description || 'AI Agent Model'}`
      ];

      // 4. Call mint function on contract
      console.log('Minting AgentNFT...');
      const tx = await this.agentNFT.mint(
        [proof],                // proofs for data correctness verification
        dataDescriptions,       // human-readable data descriptions
        to                      // recipient address
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
      const tokenId = Number(parsedEvent?.args.tokenId);

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
    try {
      console.log(`Transferring token ${tokenId} to ${toAddress}...`);

      // 1. Get current token data
      const tokenData = await this.getTokenData(tokenId);
      
      // 2. Prepare transfer proofs
      const transferResult = await this.transferManager.prepareTransfer(
        tokenId,
        this.wallet.privateKey,
        toAddress,
        [tokenData.rootHash], // Assuming single data item for simplicity
        tokenData.dataHashes
      );

      // 3. Execute transfer
      const tx = await this.agentNFT.transfer(
        toAddress,
        tokenId,
        transferResult.proofs
      );

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
  async clone(tokenId: number, toAddress: string, modifications?: any): Promise<{
    newTokenId: number;
    txHash: string;
  }> {
    try {
      console.log(`Cloning token ${tokenId} for ${toAddress}...`);

      // 1. Get current token data
      const tokenData = await this.getTokenData(tokenId);

      // 2. Prepare clone proofs
      const cloneResult = await this.transferManager.prepareClone(
        tokenId,
        this.wallet.privateKey,
        toAddress,
        [tokenData.rootHash], // Assuming single data item for simplicity
        tokenData.dataHashes,
        modifications
      );

      // 3. Execute clone
      const tx = await this.agentNFT.clone(
        toAddress,
        tokenId,
        cloneResult.proofs
      );

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
    try {
      console.log(`Updating token ${tokenId}...`);

      // 1. Get current token data and decrypt it
      const currentTokenData = await this.getTokenData(tokenId);
      const currentEncryptionKey = await this.getCurrentEncryptionKey(tokenId);
      
      // 2. Update the metadata
      const updatedResult = await this.metadataManager.updateAIAgent(
        currentTokenData.rootHash,
        currentEncryptionKey,
        updatedModelData,
        this.getPublicKeyFromPrivateKey(this.wallet.privateKey)
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

  /**
   * Get token information
   */
  async getTokenInfo(tokenId: number): Promise<any> {
    try {
      const [owner, dataHashes, dataDescriptions, authorizedUsers] = await Promise.all([
        this.agentNFT.ownerOf(tokenId),
        this.agentNFT.dataHashesOf(tokenId),
        this.agentNFT.dataDescriptionsOf(tokenId),
        this.agentNFT.authorizedUsersOf(tokenId),
      ]);

      return {
        tokenId,
        owner,
        dataHashes,
        dataDescriptions,
        authorizedUsers,
      };
    } catch (error: any) {
      throw new Error(`Failed to get token info: ${error.message}`);
    }
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
  private async generatePreimageProof(metadata: Metadata, encryptedResult: EncryptedMetadataResult): Promise<string> {
    try {
      const privateKey = this.wallet.privateKey;
      const sealedKey = encryptedResult.sealedKey;
      const key = await this.cryptoService.unsealKey(sealedKey, privateKey)

      const proofGenerator = new FileEncryptionProofGenerator();

      const { proof, publicSignals } = await proofGenerator.generateProof(
          JSON.stringify(metadata), key, encryptedResult.encryptedData
      )
      const dataHash = encryptedResult.rootHash;

      // Create proof buffer compatible with Solidity verifyPreimage function
      // Format: dataHash(32) + sealedKey(16) + nonce(32) + mac(32) + groth16Proof(256) = 368 bytes
      
      const proofData = this.createPreimageProofBuffer(
        dataHash,
        sealedKey, 
        publicSignals,
        proof
      );
      
      return proofData;
    } catch (error: any) {
      throw new Error(`Failed to generate preimage proof: ${error.message}`);
    }
  }

  /**
   * Create proof buffer compatible with Solidity verifyPreimage function
   * Format: dataHash(32) + sealedKey(16) + nonce(32) + mac(32) + groth16Proof(256) = 368 bytes
   */
  private createPreimageProofBuffer(
    dataHash: string,
    sealedKey: string,
    publicSignals: string[],
    proof: any
  ): string {
    // Convert inputs to proper formats
    const dataHashBytes = ethers.getBytes(dataHash); // 32 bytes
    const sealedKeyBytes = ethers.getBytes(sealedKey).slice(0, 16); // 16 bytes (truncate if longer)
    
    // Extract nonce and mac from publicSignals 
    // publicSignals format: [nonce, mac] (2 elements for StreamEncVerify circuit)
    if (publicSignals.length !== 2) {
      throw new Error(`Expected 2 public signals, got ${publicSignals.length}`);
    }
    
    const nonce = BigInt(publicSignals[0]);
    const mac = BigInt(publicSignals[1]);
    
    // Convert to 32-byte buffers (big-endian)
    const nonceBytes = new Uint8Array(32);
    const macBytes = new Uint8Array(32);
    
    // Convert BigInt to bytes (big-endian)
    this.bigIntToBytes(nonce, nonceBytes);
    this.bigIntToBytes(mac, macBytes);
    
    // Extract Groth16 proof components (a, b, c)
    const proofBytes = this.encodeGroth16Proof(proof);
    
    // Concatenate all components
    const totalLength = 32 + 16 + 32 + 32 + 256; // 368 bytes
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    
    // dataHash (32 bytes)
    buffer.set(dataHashBytes, offset);
    offset += 32;
    
    // sealedKey (16 bytes)
    buffer.set(sealedKeyBytes, offset);
    offset += 16;
    
    // nonce (32 bytes)
    buffer.set(nonceBytes, offset);
    offset += 32;
    
    // mac (32 bytes)
    buffer.set(macBytes, offset);
    offset += 32;
    
    // groth16Proof (256 bytes)
    buffer.set(proofBytes, offset);
    
    return ethers.hexlify(buffer);
  }

  /**
   * Convert BigInt to 32-byte array (big-endian)
   */
  private bigIntToBytes(value: bigint, buffer: Uint8Array): void {
    if (buffer.length !== 32) {
      throw new Error("Buffer must be 32 bytes");
    }
    
    // Convert to big-endian bytes
    for (let i = 31; i >= 0; i--) {
      buffer[i] = Number(value & 0xFFn);
      value = value >> 8n;
    }
  }

  /**
   * Encode Groth16 proof (a, b, c) to 256 bytes
   * Format: a(64) + b(128) + c(64) = 256 bytes
   */
  private encodeGroth16Proof(proof: any): Uint8Array {
    const proofBytes = new Uint8Array(256);
    let offset = 0;
    
    // a: [2 elements] = 64 bytes
    for (let i = 0; i < 2; i++) {
      const value = BigInt(proof.pi_a[i]);
      const bytes = new Uint8Array(32);
      this.bigIntToBytes(value, bytes);
      proofBytes.set(bytes, offset);
      offset += 32;
    }
    
    // b: [2][2 elements] = 128 bytes
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const value = BigInt(proof.pi_b[i][j]);
        const bytes = new Uint8Array(32);
        this.bigIntToBytes(value, bytes);
        proofBytes.set(bytes, offset);
        offset += 32;
      }
    }
    
    // c: [2 elements] = 64 bytes
    for (let i = 0; i < 2; i++) {
      const value = BigInt(proof.pi_c[i]);
      const bytes = new Uint8Array(32);
      this.bigIntToBytes(value, bytes);
      proofBytes.set(bytes, offset);
      offset += 32;
    }
    
    return proofBytes;
  }

  /**
   * Get current encryption key for a token (simplified for demo)
   */
  private async getCurrentEncryptionKey(tokenId: number): Promise<Buffer> {
    // In production, this would:
    // 1. Get the sealed key from contract events or storage
    // 2. Unseal it using the owner's private key
    
    // For demo, generate a deterministic key
    const keyMaterial = `${this.wallet.privateKey}-${tokenId}`;
    return Buffer.from(ethers.keccak256(ethers.toUtf8Bytes(keyMaterial)).slice(2), 'hex');
  }

  /**
   * Get token data including rootHash (simplified)
   */
  private async getTokenData(tokenId: number): Promise<{ rootHash: string; dataHashes: string[] }> {
    const dataHashes = await this.agentNFT.dataHashesOf(tokenId);
    
    // In production, you would map dataHashes back to rootHashes
    // For demo, assume first dataHash corresponds to rootHash
    const rootHash = dataHashes[0] || ethers.ZeroHash;
    
    return {
      rootHash,
      dataHashes,
    };
  }

  /**
   * Get public key from private key
   */
  private getPublicKeyFromPrivateKey(privateKey: string): string {
    const signingKey = new ethers.SigningKey(privateKey);
    return signingKey.publicKey;
  }
}