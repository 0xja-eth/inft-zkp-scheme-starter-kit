import { StorageService, StorageOptions } from './StorageService';
import { StorageResult } from '../../types';
import { Indexer, MemData } from "@0glabs/0g-ts-sdk";
import { Wallet } from "ethers";

export interface ZGStorageConfig {
  rpcUrl: string;
  indexerUrl: string;
}

/**
 * 0G分布式存储服务实现
 * 基于0G Labs的去中心化存储网络
 * 
 * 技术特性:
 * 1. 去中心化存储 - 数据分布存储在0G网络节点上
 * 2. Merkle树验证 - 使用Merkle树确保数据完整性
 * 3. 链上索引 - 通过区块链索引管理文件元数据
 * 4. 高可用性 - 网络冗余确保数据持久性
 * 5. 自动fallback - 继承基类的fallback和超时机制
 */
export class ZGStorageService extends StorageService {
  private wallet: Wallet;
  private indexer: Indexer;
  private config: ZGStorageConfig

  constructor(wallet: Wallet, config: ZGStorageConfig, options: StorageOptions = {}) {
    super(options);
    
    this.indexer = new Indexer(config.indexerUrl);
    this.wallet = wallet;
    this.config = config;

    console.log(`🌐 0G Storage Service initialized`);
    console.log(`   Indexer URL: ${config.indexerUrl}`);
    console.log(`   RPC URL: ${config.rpcUrl}`);
    console.log(`   Timeout: ${this.options.timeout}ms`);
  }

  protected getServiceName(): string {
    return '0G-Storage';
  }

  /**
   * 存储数据到0G网络
   */
  protected async doStore(data: Buffer): Promise<StorageResult> {
    console.log(`[0G-Storage] Storing ${data.length} bytes...`);

    // 创建内存文件对象
    const file = new MemData(data);
    
    // 生成Merkle树
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr !== null) {
      throw new Error(`Merkle tree generation failed: ${treeErr}`);
    }

    const rootHash = tree?.rootHash() ?? "";
    if (!rootHash) {
      throw new Error('Failed to generate root hash');
    }

    console.log(`[0G-Storage] Generated root hash: ${rootHash}`);

    // 上传到0G网络
    const [txHash, uploadErr] = await this.indexer.upload(
      file, 
      this.config.rpcUrl, 
      this.wallet
    );

    if (uploadErr !== null) {
      throw new Error(`0G network upload failed: ${uploadErr}`);
    }

    console.log(`[0G-Storage] Upload successful, tx hash: ${txHash}`);

    return {
      txHash: txHash!,
      rootHash,
      size: data.length
    };
  }

  /**
   * 从0G网络检索数据
   */
  protected async doRetrieve(rootHash: string): Promise<Buffer> {
    console.log(`[0G-Storage] Retrieving file: ${rootHash}`);

    if (!rootHash) {
      throw new Error('Root hash is required for retrieval');
    }

    // 构建API URL
    const apiUrl = `${this.config.indexerUrl}/file?root=${rootHash}`;
    console.log(`[0G-Storage] Fetching from: ${apiUrl}`);

    // 从0G网络获取文件
    const response = await fetch(apiUrl);
    
    // 检查响应类型
    const contentType = response.headers.get('content-type');
    const isJsonResponse = contentType?.includes('application/json');

    // 处理JSON错误响应
    if (isJsonResponse) {
      const jsonData = await response.json();
      
      if (!response.ok || jsonData.code) {
        if (jsonData.code === 101) {
          throw new Error(`File not found in 0G network: ${rootHash}`);
        }
        throw new Error(`0G network error: ${jsonData.message || 'Unknown error'}`);
      }
    }

    // 处理HTTP错误
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // 获取文件数据
    const fileData = await response.arrayBuffer();
    
    if (!fileData || fileData.byteLength === 0) {
      throw new Error('Retrieved file is empty');
    }

    const buffer = Buffer.from(fileData);
    console.log(`[0G-Storage] Retrieved ${buffer.length} bytes successfully`);
    
    return buffer;
  }
}