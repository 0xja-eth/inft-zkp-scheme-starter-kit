import { ethers } from 'ethers';
import { 
  AgentNFTClient, 
  VerifierClient, 
  ZGStorageService, 
  LocalStorageService, 
  ZKCryptoService, 
  Metadata 
} from '@/lib/shared';
import config from '@/config';
import logger from '@/utils/logger';
import { 
  MintResponse, 
  TransferResponse, 
  CloneResponse, 
  UpdateResponse, 
  TokenInfo, 
  ContractInfo,
  WalletInfo 
} from '@/types';

export class AgentNFTService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private agentNFTClient: AgentNFTClient;
  private verifierClient: VerifierClient;

  constructor() {
    // Initialize provider and wallet
    this.provider = new ethers.JsonRpcProvider(config.network.rpcUrl);
    this.wallet = new ethers.Wallet(config.wallet.privateKey, this.provider);

    logger.info('Initializing AgentNFT Service', {
      network: config.network.name,
      chainId: config.network.chainId,
      walletAddress: this.wallet.address,
      agentNFTAddress: config.contracts.agentNFTAddress,
      verifierAddress: config.contracts.verifierAddress,
    });

    // Initialize storage service
    const storageService = config.storage.type === 'zg' && config.storage.zgIndexerUrl
      ? new ZGStorageService(this.wallet, { 
          rpcUrl: config.network.rpcUrl,
          indexerUrl: config.storage.zgIndexerUrl 
        }, {
          fallbackServices: [new LocalStorageService({ storageDir: config.storage.localPath! })],
        })
      : new LocalStorageService({ storageDir: config.storage.localPath! });

    // Initialize crypto service
    const cryptoService = new ZKCryptoService();

    // Initialize verifier client
    this.verifierClient = new VerifierClient(config.contracts.verifierAddress, this.wallet);

    // Initialize AgentNFT client
    this.agentNFTClient = new AgentNFTClient(
      config.contracts.agentNFTAddress,
      this.verifierClient,
      this.wallet,
      storageService,
      cryptoService
    );
  }

  /**
   * Mint a new AgentNFT
   */
  async mint(metadata: Metadata): Promise<MintResponse> {
    try {
      logger.info('Minting new AgentNFT', { 
        metadata: metadata.name, 
        model: metadata.model,
      });

      const result = await this.agentNFTClient.mint(metadata);

      logger.info('AgentNFT minted successfully', {
        tokenId: result.tokenId,
        txHash: result.txHash,
        rootHash: result.rootHash,
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to mint AgentNFT', { error: error.message, stack: error.stack });
      throw new Error(`Mint failed: ${error.message}`);
    }
  }

  /**
   * Transfer AgentNFT to another address
   */
  async transfer(
    tokenId: number, 
    recipientAddress: string, 
    recipientEncPublicKey: string, 
    signature: string
  ): Promise<TransferResponse> {
    try {
      logger.info('Transferring AgentNFT', {
        tokenId,
        from: this.wallet.address,
        to: recipientAddress,
      });

      const txHash = await this.agentNFTClient.transfer(
        tokenId,
        recipientAddress,
        recipientEncPublicKey,
        signature
      );

      logger.info('AgentNFT transferred successfully', { tokenId, txHash });

      return { txHash };
    } catch (error: any) {
      logger.error('Failed to transfer AgentNFT', { 
        tokenId, 
        error: error.message, 
        stack: error.stack 
      });
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }

  /**
   * Clone AgentNFT for another address
   */
  async clone(
    tokenId: number, 
    recipientAddress: string, 
    modifications?: Partial<Metadata>
  ): Promise<CloneResponse> {
    try {
      logger.info('Cloning AgentNFT', {
        sourceTokenId: tokenId,
        recipient: recipientAddress,
        hasModifications: !!modifications,
      });

      const result = await this.agentNFTClient.clone(tokenId, recipientAddress, modifications);

      logger.info('AgentNFT cloned successfully', {
        sourceTokenId: tokenId,
        newTokenId: result.newTokenId,
        txHash: result.txHash,
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to clone AgentNFT', { 
        tokenId, 
        error: error.message, 
        stack: error.stack 
      });
      throw new Error(`Clone failed: ${error.message}`);
    }
  }

  /**
   * Update AgentNFT metadata
   */
  async update(tokenId: number, updatedMetadata: Partial<Metadata>): Promise<UpdateResponse> {
    try {
      logger.info('Updating AgentNFT', { tokenId, updateKeys: Object.keys(updatedMetadata) });

      const txHash = await this.agentNFTClient.update(tokenId, updatedMetadata);

      logger.info('AgentNFT updated successfully', { tokenId, txHash });

      return { txHash };
    } catch (error: any) {
      logger.error('Failed to update AgentNFT', { 
        tokenId, 
        error: error.message, 
        stack: error.stack 
      });
      throw new Error(`Update failed: ${error.message}`);
    }
  }

  /**
   * Get token information
   */
  async getTokenInfo(tokenId: number): Promise<TokenInfo> {
    try {
      logger.debug('Getting token info', { tokenId });

      const tokenInfo = await this.agentNFTClient.getTokenInfo(tokenId);

      return {
        tokenId: tokenInfo.tokenId,
        owner: tokenInfo.owner,
        dataHashes: tokenInfo.dataHashes,
        sealedKeys: tokenInfo.sealedKeys,
        dataDescriptions: tokenInfo.dataDescriptions,
        authorizedUsers: tokenInfo.authorizedUsers,
      };
    } catch (error: any) {
      logger.error('Failed to get token info', { 
        tokenId, 
        error: error.message 
      });
      throw new Error(`Failed to get token info: ${error.message}`);
    }
  }

  /**
   * Get contract information
   */
  async getContractInfo(): Promise<ContractInfo> {
    try {
      logger.debug('Getting contract info');

      const contractInfo = await this.agentNFTClient.getContractInfo();

      return contractInfo;
    } catch (error: any) {
      logger.error('Failed to get contract info', { error: error.message });
      throw new Error(`Failed to get contract info: ${error.message}`);
    }
  }

  /**
   * Get wallet information
   */
  async getWalletInfo(): Promise<WalletInfo> {
    try {
      logger.debug('Getting wallet info');

      const balance = await this.provider.getBalance(this.wallet.address);
      const ownedTokens = await this.agentNFTClient.getOwnedTokens(this.wallet.address);

      return {
        address: this.wallet.address,
        balance: ethers.formatEther(balance),
        ownedTokens,
      };
    } catch (error: any) {
      logger.error('Failed to get wallet info', { error: error.message });
      throw new Error(`Failed to get wallet info: ${error.message}`);
    }
  }

  /**
   * Get all existing tokens
   */
  async getExistingTokens(maxTokenId: number = 100): Promise<number[]> {
    try {
      logger.debug('Getting existing tokens', { maxTokenId });

      const existingTokens = await this.agentNFTClient.getExistingTokens(maxTokenId);

      return existingTokens;
    } catch (error: any) {
      logger.error('Failed to get existing tokens', { error: error.message });
      throw new Error(`Failed to get existing tokens: ${error.message}`);
    }
  }

  /**
   * Get tokens owned by specific address
   */
  async getOwnedTokens(ownerAddress: string, maxTokenId: number = 100): Promise<number[]> {
    try {
      logger.debug('Getting owned tokens', { ownerAddress, maxTokenId });

      const ownedTokens = await this.agentNFTClient.getOwnedTokens(ownerAddress, maxTokenId);

      return ownedTokens;
    } catch (error: any) {
      logger.error('Failed to get owned tokens', { 
        ownerAddress, 
        error: error.message 
      });
      throw new Error(`Failed to get owned tokens: ${error.message}`);
    }
  }

  /**
   * Authorize usage for a user
   */
  async authorizeUsage(tokenId: number, userAddress: string): Promise<{ txHash: string }> {
    try {
      logger.info('Authorizing usage', { tokenId, userAddress });

      const txHash = await this.agentNFTClient.authorizeUsage(tokenId, userAddress);

      logger.info('Usage authorized successfully', { tokenId, userAddress, txHash });

      return { txHash };
    } catch (error: any) {
      logger.error('Failed to authorize usage', { 
        tokenId, 
        userAddress, 
        error: error.message 
      });
      throw new Error(`Authorization failed: ${error.message}`);
    }
  }

  /**
   * Check if token exists
   */
  async tokenExists(tokenId: number): Promise<boolean> {
    try {
      return await this.agentNFTClient.tokenExists(tokenId);
    } catch (error: any) {
      logger.error('Failed to check token existence', { 
        tokenId, 
        error: error.message 
      });
      return false;
    }
  }
}