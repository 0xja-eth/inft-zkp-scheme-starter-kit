import {StorageResult, StorageConfig, FallbackConfig} from '../types';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {Indexer, MemData} from "@0glabs/0g-ts-sdk";
import {Wallet} from "ethers";

export interface IZGStorage {
  store(data: Buffer): Promise<StorageResult>;
  retrieve(rootHash: string): Promise<Buffer>;
  // delete(uri: string): Promise<void>;
}

/**
 * Simple OG Storage implementation
 * This is a basic interface - implement with actual 0G Storage SDK
 */
export class ZGStorage implements IZGStorage {
  private config: StorageConfig;
  private indexer: Indexer
  private signer: Wallet

  private get fallbackConfig() {
    return {
      enableFallback: true,
      localStorageDir: path.join(process.cwd(), 'temp', 'local-storage'),
      retryAttempts: 1,
      retryDelay: 1000,
      preferLocal: false,
      ...this.config.fallback
    }
  }

  constructor(signer: Wallet, config: StorageConfig) {
    this.indexer = new Indexer(config.indexerUrl)
    this.signer = signer
    this.config = config;

    // Ensure local storage directory exists
    if (this.fallbackConfig.enableFallback) {
      this.ensureLocalStorageDir();
    }
    
    console.log(`🔧 0G Storage initialized with fallback:`, {
      fallbackEnabled: this.fallbackConfig.enableFallback,
      localDir: this.fallbackConfig.localStorageDir,
      retryAttempts: this.fallbackConfig.retryAttempts,
      preferLocal: this.fallbackConfig.preferLocal
    });
  }

  /**
   * Store data to 0G Storage with fallback support
   */
  async store(data: Buffer): Promise<StorageResult> {
    // If prefer local mode is enabled, go straight to local storage
    if (this.fallbackConfig.preferLocal) {
      console.log('📍 Prefer local mode enabled, storing locally');
      return await this.storeLocal(data);
    }

    let lastError: Error | null = null;
    let attempt = 0;

    // Try 0G Storage with retries
    while (attempt < this.fallbackConfig.retryAttempts) {
      try {
        console.log(`🚀 Attempting 0G Storage upload (attempt ${attempt + 1}/${this.fallbackConfig.retryAttempts})`);
        return await this.storeRemote(data);

      } catch (error: any) {
        lastError = error;
        attempt++;

        console.warn(`⚠️  0G Storage attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.fallbackConfig.retryAttempts) {
          console.log(`⏳ Retrying in ${this.fallbackConfig.retryDelay}ms...`);
          await this.delay(this.fallbackConfig.retryDelay);
        }
      }
    }

    // All 0G attempts failed, try fallback
    if (this.fallbackConfig.enableFallback) {
      console.log(`🔄 All 0G Storage attempts failed, falling back to local storage`);
      console.log(`📝 Remote error: ${lastError?.message}`);

      try {
        return await this.storeLocal(data, {
          fallbackReason: '0G Storage unavailable',
          remoteError: lastError?.message
        });

      } catch (fallbackError: any) {
        throw new Error(`Both 0G Storage and local fallback failed. Remote: ${lastError?.message}, Local: ${fallbackError.message}`);
      }
    } else {
      throw new Error(`0G Storage failed after ${this.fallbackConfig.retryAttempts} attempts: ${lastError?.message}`);
    }
  }

  /**
   * Retrieve data with fallback support
   */
  async retrieve(rootHash: string): Promise<Buffer> {
    // First, check if it exists locally
    const existsLocally = await this.existsLocal(rootHash);

    if (existsLocally) {
      console.log(`📖 Found file locally: ${rootHash}`);
      try {
        return await this.retrieveLocal(rootHash);
      } catch (localError: any) {
        console.warn(`⚠️  Local retrieval failed: ${localError.message}, trying 0G Storage`);
      }
    }

    // Try 0G Storage
    try {
      console.log(`🌐 Retrieving from 0G Storage: ${rootHash}`);
      const data = await this.retrieveRemote(rootHash);

      // Optionally cache successful 0G retrievals locally
      if (this.fallbackConfig.enableFallback) {
        try {
          await this.storeLocal(data, {
            source: 'cached-from-remote',
            cachedAt: new Date().toISOString(),
            originalRootHash: rootHash
          });
          console.log(`💾 Cached file locally for future use: ${rootHash}`);
        } catch (cacheError) {
          console.warn(`⚠️  Failed to cache file locally: ${cacheError}`);
        }
      }

      return data;

    } catch (remoteError: any) {
      // If we haven't tried local yet and it exists, try it now
      if (!existsLocally) {
        throw new Error(`File not found in 0G Storage or locally: ${rootHash}. Remote error: ${remoteError.message}`);
      }

      console.warn(`⚠️  0G Storage retrieval failed: ${remoteError.message}, falling back to local`);
      return await this.retrieveLocal(rootHash);
    }
  }

  // Private helper methods

  /**
   * Store data to remote 0G Storage
   */
  private async storeRemote(data: Buffer): Promise<StorageResult> {
    const file = new MemData(data)
    const [tree, treeErr] = await file.merkleTree();

    if (treeErr !== null) {
      throw new Error(`[OGStorage] Error generating Merkle tree: ${treeErr}`);
    }

    const rootHash = tree?.rootHash() ?? "";

    // Upload file with new API syntax
    console.log(`[OGStorage] Storing data of size ${data.length} bytes, rootHash: ${rootHash}`);
    const [txHash, uploadErr] = await this.indexer.upload(file, this.config.rpcUrl, this.signer);

    if (uploadErr !== null) {
      throw new Error(`[OGStorage] Upload error: ${uploadErr}`);
    }

    console.log(`✅ 0G Storage upload successful: ${txHash}`);

    return {
      txHash, rootHash, size: data.length
    };
  }

  /**
   * Retrieve data from remote 0G Storage
   */
  private async retrieveRemote(rootHash: string): Promise<Buffer> {
    console.log(`API Download by root hash: ${rootHash} from ${this.config.indexerUrl}`);

    if (!rootHash) {
      throw new Error('Root hash is required')
    }

    // Construct API URL
    const apiUrl = `${this.config.indexerUrl}/file?root=${rootHash}`;
    console.log(`Downloading from API URL: ${apiUrl}`);

    // Fetch the file
    const response = await fetch(apiUrl);

    // Check if the response content type is JSON before proceeding
    const contentType = response.headers.get('content-type');
    const isJsonResponse = contentType && contentType.includes('application/json');

    // Handle JSON responses separately
    if (isJsonResponse) {
      const jsonData = await response.json();

      // If it's an error response
      if (!response.ok || jsonData.code) {
        // Handle specific error codes
        if (jsonData.code === 101) {
          const truncatedHash = rootHash.length > 20
              ? `${rootHash.substring(0, 10)}...${rootHash.substring(rootHash.length - 10)}`
              : rootHash;
          throw new Error(`File not found: The file with root hash "${truncatedHash}" does not exist in storage`)
        }
        throw new Error(`Download failed: ${jsonData.message || 'Unknown error'}`)
      }
    }

    // Handle non-JSON responses
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Download failed with status ${response.status}: ${errorText}`);
    }

    // Get file data as ArrayBuffer
    const fileData = await response.arrayBuffer();

    if (!fileData || fileData.byteLength === 0) {
      throw new Error('[OGStorage] Downloaded file is empty');
    }

    console.log(`✅ 0G Download successful, received ${fileData.byteLength} bytes`);
    return Buffer.from(fileData);
  }

  /**
   * Store data locally
   */
  private async storeLocal(data: Buffer, metadata: any = {}): Promise<StorageResult> {
    const rootHash = this.generateContentHash(data);
    const filePath = this.getLocalFilePath(rootHash);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`📄 File already exists locally: ${rootHash}`);
      return {
        txHash: `local-${rootHash}`,
        rootHash,
        size: data.length
      };
    }

    // Write file to disk
    fs.writeFileSync(filePath, data);

    // Update metadata
    const allMetadata = this.loadLocalMetadata();
    allMetadata[rootHash] = {
      ...metadata,
      timestamp: new Date().toISOString(),
      size: data.length,
      filePath: path.relative(this.fallbackConfig.localStorageDir, filePath),
      contentType: 'application/octet-stream'
    };
    this.saveLocalMetadata(allMetadata);

    console.log(`💾 Stored ${data.length} bytes locally: ${rootHash}`);

    return {
      txHash: `local-${rootHash}`,
      rootHash,
      size: data.length
    };
  }

  /**
   * Retrieve data from local storage
   */
  private async retrieveLocal(rootHash: string): Promise<Buffer> {
    const filePath = this.getLocalFilePath(rootHash);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found locally: ${rootHash}`);
    }

    const data = fs.readFileSync(filePath);
    console.log(`📖 Retrieved ${data.length} bytes from local storage: ${rootHash}`);

    return data;
  }

  /**
   * Check if file exists locally
   */
  private async existsLocal(rootHash: string): Promise<boolean> {
    const filePath = this.getLocalFilePath(rootHash);
    return fs.existsSync(filePath);
  }

  /**
   * Ensure local storage directory exists
   */
  private ensureLocalStorageDir(): void {
    if (!fs.existsSync(this.fallbackConfig.localStorageDir)) {
      fs.mkdirSync(this.fallbackConfig.localStorageDir, { recursive: true });
      console.log(`📁 Created local storage directory: ${this.fallbackConfig.localStorageDir}`);
    }
  }

  /**
   * Generate content hash for data
   */
  private generateContentHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get file path for a given root hash
   */
  private getLocalFilePath(rootHash: string): string {
    // Use first 2 chars as subdirectory for better organization
    const subDir = rootHash.substring(0, 2);
    const dirPath = path.join(this.fallbackConfig.localStorageDir, 'files', subDir);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    return path.join(dirPath, `${rootHash}.bin`);
  }

  /**
   * Load metadata from file
   */
  private loadLocalMetadata(): Record<string, any> {
    try {
      const metadataFile = path.join(this.fallbackConfig.localStorageDir, 'metadata.json');
      if (fs.existsSync(metadataFile)) {
        const content = fs.readFileSync(metadataFile, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('⚠️  Failed to load local metadata file, starting fresh');
    }
    return {};
  }

  /**
   * Save metadata to file
   */
  private saveLocalMetadata(metadata: Record<string, any>): void {
    try {
      const metadataFile = path.join(this.fallbackConfig.localStorageDir, 'metadata.json');
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('❌ Failed to save local metadata:', error);
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public utility methods

  /**
   * Set fallback configuration
   */
  setFallbackConfig(config: Partial<FallbackConfig>): void {
    this.config.fallback = { ...this.config.fallback, ...config };
    console.log(`🔧 Fallback config updated:`, this.fallbackConfig);
  }

  /**
   * Get current fallback configuration
   */
  getFallbackConfig(): FallbackConfig {
    return { ...this.fallbackConfig };
  }

  /**
   * Clean up old local files
   */
  async cleanupLocal(olderThanDays: number = 30): Promise<{ deletedFiles: number; freedSpace: number }> {
    if (!this.fallbackConfig.enableFallback) {
      return { deletedFiles: 0, freedSpace: 0 };
    }

    try {
      const metadata = this.loadLocalMetadata();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      let deletedFiles = 0;
      let freedSpace = 0;
      
      for (const [rootHash, meta] of Object.entries(metadata) as [string, any][]) {
        const fileDate = new Date(meta.timestamp);
        if (fileDate < cutoffDate) {
          try {
            const filePath = this.getLocalFilePath(rootHash);
            if (fs.existsSync(filePath)) {
              const size = meta.size || 0;
              fs.unlinkSync(filePath);
              deletedFiles++;
              freedSpace += size;
            }
            
            // Remove from metadata
            delete metadata[rootHash];
          } catch (error) {
            console.warn(`⚠️  Failed to delete old file: ${rootHash}`);
          }
        }
      }
      
      this.saveLocalMetadata(metadata);
      console.log(`🧹 Cleanup completed: deleted ${deletedFiles} files, freed ${freedSpace} bytes`);
      
      return { deletedFiles, freedSpace };
    } catch (error: any) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }
}