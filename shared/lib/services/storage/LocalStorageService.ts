import { StorageService, StorageOptions } from './StorageService';
import { StorageResult } from '../../types';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface LocalStorageConfig {
  storageDir: string;
  enableMetadata?: boolean;
  enableSubdirectories?: boolean;
}

/**
 * 本地文件系统存储服务实现
 * 将数据存储在本地磁盘上，适合开发环境和fallback场景
 *
 * 技术特性:
 * 1. 本地文件存储 - 直接写入本地文件系统
 * 2. 内容寻址 - 使用SHA-256哈希作为文件标识
 * 3. 目录组织 - 支持按哈希前缀创建子目录，避免单目录文件过多
 * 4. 元数据管理 - 可选的JSON元数据存储，记录文件信息
 * 5. 自动清理 - 提供老文件清理功能
 * 6. 继承fallback - 支持链式fallback到其他存储服务
 */
export class LocalStorageService extends StorageService {
  private config: Required<LocalStorageConfig>;

  constructor(config: LocalStorageConfig, options: StorageOptions = {}) {
    super(options);

    this.config = {
      storageDir: config.storageDir,
      enableMetadata: config.enableMetadata ?? true,
      enableSubdirectories: config.enableSubdirectories ?? true,
    };

    this.ensureStorageDirectory();

    console.log(`📁 Local Storage Service initialized`);
    console.log(`   Storage directory: ${this.config.storageDir}`);
    console.log(`   Metadata enabled: ${this.config.enableMetadata}`);
    console.log(`   Subdirectories enabled: ${this.config.enableSubdirectories}`);
    console.log(`   Timeout: ${this.options.timeout}ms`);
  }

  protected getServiceName(): string {
    return 'Local-Storage';
  }

  /**
   * 存储数据到本地文件系统
   */
  protected async doStore(data: Buffer): Promise<StorageResult> {
    const rootHash = this.generateContentHash(data);
    const filePath = this.getFilePath(rootHash);

    console.log(`[Local-Storage] Storing ${data.length} bytes as ${rootHash}`);

    // 检查文件是否已存在
    if (fs.existsSync(filePath)) {
      console.log(`[Local-Storage] File already exists: ${rootHash}`);
      return {
        txHash: `local-${rootHash}`,
        rootHash,
        size: data.length,
      };
    }

    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(filePath, data);

    // 更新元数据
    if (this.config.enableMetadata) {
      await this.updateMetadata(rootHash, {
        timestamp: new Date().toISOString(),
        size: data.length,
        filePath: path.relative(this.config.storageDir, filePath),
        contentHash: rootHash,
      });
    }

    console.log(`[Local-Storage] Stored successfully: ${rootHash}`);

    return {
      txHash: `local-${rootHash}`,
      rootHash,
      size: data.length,
    };
  }

  /**
   * 从本地文件系统检索数据
   */
  protected async doRetrieve(rootHash: string): Promise<Buffer> {
    console.log(`[Local-Storage] Retrieving file: ${rootHash}`);

    const filePath = this.getFilePath(rootHash);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found in local storage: ${rootHash}`);
    }

    const data = fs.readFileSync(filePath);

    // 验证内容哈希
    const actualHash = this.generateContentHash(data);
    if (actualHash !== rootHash) {
      throw new Error(`Content hash mismatch. Expected: ${rootHash}, Actual: ${actualHash}`);
    }

    console.log(`[Local-Storage] Retrieved ${data.length} bytes successfully`);
    return data;
  }

  /**
   * 检查文件是否存在
   */
  async exists(rootHash: string): Promise<boolean> {
    const filePath = this.getFilePath(rootHash);
    return fs.existsSync(filePath);
  }

  /**
   * 删除文件
   */
  async delete(rootHash: string): Promise<void> {
    console.log(`[Local-Storage] Deleting file: ${rootHash}`);

    const filePath = this.getFilePath(rootHash);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 删除元数据记录
    if (this.config.enableMetadata) {
      const metadata = this.loadMetadata();
      delete metadata[rootHash];
      this.saveMetadata(metadata);
    }

    console.log(`[Local-Storage] Deleted successfully: ${rootHash}`);
  }

  /**
   * 清理老文件
   */
  async cleanup(olderThanDays: number = 30): Promise<{
    deletedFiles: number;
    freedSpace: number;
  }> {
    console.log(`[Local-Storage] Starting cleanup (older than ${olderThanDays} days)...`);

    if (!this.config.enableMetadata) {
      throw new Error('Cleanup requires metadata to be enabled');
    }

    const metadata = this.loadMetadata();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedFiles = 0;
    let freedSpace = 0;

    for (const [rootHash, meta] of Object.entries(metadata) as [string, any][]) {
      const fileDate = new Date(meta.timestamp);

      if (fileDate < cutoffDate) {
        try {
          const filePath = this.getFilePath(rootHash);

          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            fs.unlinkSync(filePath);

            deletedFiles++;
            freedSpace += stats.size;
          }

          delete metadata[rootHash];
        } catch (error: any) {
          console.warn(`[Local-Storage] Failed to delete old file ${rootHash}: ${error.message}`);
        }
      }
    }

    this.saveMetadata(metadata);

    console.log(
      `[Local-Storage] Cleanup completed: ${deletedFiles} files deleted, ${freedSpace} bytes freed`
    );

    return { deletedFiles, freedSpace };
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    storageDir: string;
  }> {
    if (!this.config.enableMetadata) {
      throw new Error('Stats require metadata to be enabled');
    }

    const metadata = this.loadMetadata();
    const files = Object.values(metadata) as any[];

    return {
      totalFiles: files.length,
      totalSize: files.reduce((sum, meta) => sum + (meta.size || 0), 0),
      storageDir: this.config.storageDir,
    };
  }

  /**
   * 列出所有存储的文件
   */
  async listFiles(limit: number = 100): Promise<
    Array<{
      rootHash: string;
      size: number;
      timestamp: string;
    }>
  > {
    if (!this.config.enableMetadata) {
      throw new Error('File listing requires metadata to be enabled');
    }

    const metadata = this.loadMetadata();
    const files = Object.entries(metadata)
      .map(([rootHash, meta]: [string, any]) => ({
        rootHash,
        size: meta.size || 0,
        timestamp: meta.timestamp || 'Unknown',
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return files;
  }

  // 私有辅助方法

  /**
   * 生成内容哈希
   */
  private generateContentHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * 获取文件路径
   */
  private getFilePath(rootHash: string): string {
    if (this.config.enableSubdirectories) {
      // 使用前2个字符作为子目录
      const subDir = rootHash.substring(0, 2);
      return path.join(this.config.storageDir, 'files', subDir, `${rootHash}.bin`);
    } else {
      return path.join(this.config.storageDir, `${rootHash}.bin`);
    }
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.config.storageDir)) {
      fs.mkdirSync(this.config.storageDir, { recursive: true });
      console.log(`[Local-Storage] Created storage directory: ${this.config.storageDir}`);
    }
  }

  /**
   * 加载元数据
   */
  private loadMetadata(): Record<string, any> {
    if (!this.config.enableMetadata) {
      return {};
    }

    try {
      const metadataFile = path.join(this.config.storageDir, 'metadata.json');

      if (fs.existsSync(metadataFile)) {
        const content = fs.readFileSync(metadataFile, 'utf8');
        return JSON.parse(content);
      }
    } catch (error: any) {
      console.warn(`[Local-Storage] Failed to load metadata: ${error.message}`);
    }

    return {};
  }

  /**
   * 保存元数据
   */
  private saveMetadata(metadata: Record<string, any>): void {
    if (!this.config.enableMetadata) {
      return;
    }

    try {
      const metadataFile = path.join(this.config.storageDir, 'metadata.json');
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error: any) {
      console.error(`[Local-Storage] Failed to save metadata: ${error.message}`);
    }
  }

  /**
   * 更新单个文件的元数据
   */
  private async updateMetadata(rootHash: string, meta: any): Promise<void> {
    if (!this.config.enableMetadata) {
      return;
    }

    const metadata = this.loadMetadata();
    metadata[rootHash] = meta;
    this.saveMetadata(metadata);
  }
}
