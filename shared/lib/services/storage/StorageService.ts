import { StorageResult } from '../../types';

export interface IStorageService {
  store(data: Buffer): Promise<StorageResult>;
  retrieve(rootHash: string): Promise<Buffer>;
}

export interface StorageOptions {
  timeout?: number;
  fallbackServices?: IStorageService[];
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * 基础存储服务类，提供自动fallback和超时机制
 *
 * 功能特性:
 * 1. 自动超时处理 - 超过指定时间自动切换到fallback
 * 2. 多级fallback链 - 支持链式fallback，失败时依次尝试下一个服务
 * 3. 重试机制 - 每个服务都有独立的重试次数
 * 4. 错误聚合 - 收集所有尝试的错误信息，便于调试
 * 5. 统一接口 - 所有存储服务继承相同的接口和行为
 */
export abstract class StorageService implements IStorageService {
  protected options: Required<StorageOptions>;

  constructor(options: StorageOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000, // 30秒默认超时
      fallbackServices: options.fallbackServices ?? [],
      maxRetries: options.maxRetries ?? 1,
      retryDelay: options.retryDelay ?? 1000,
    };
  }

  /**
   * 存储数据，支持超时和fallback
   */
  async store(data: Buffer): Promise<StorageResult> {
    return this.executeWithFallback('store', [data]);
  }

  /**
   * 检索数据，支持超时和fallback
   */
  async retrieve(rootHash: string): Promise<Buffer> {
    return this.executeWithFallback('retrieve', [rootHash]);
  }

  /**
   * 子类必须实现的具体存储方法
   */
  protected abstract doStore(data: Buffer): Promise<StorageResult>;

  /**
   * 子类必须实现的具体检索方法
   */
  protected abstract doRetrieve(rootHash: string): Promise<Buffer>;

  /**
   * 获取存储服务名称，用于日志标识
   */
  protected abstract getServiceName(): string;

  /**
   * 执行操作，带有超时和fallback机制的核心逻辑
   */
  private async executeWithFallback<T>(operation: 'store' | 'retrieve', args: any[]): Promise<T> {
    const allServices = [this, ...this.options.fallbackServices];
    const errors: Array<{ service: string; error: Error }> = [];

    for (let serviceIndex = 0; serviceIndex < allServices.length; serviceIndex++) {
      const service = allServices[serviceIndex];
      const serviceName = this.getServiceNameForService(service, serviceIndex);

      console.log(`🔄 Trying ${serviceName} for ${operation}...`);

      // 对每个服务进行重试
      for (let retry = 0; retry < this.options.maxRetries; retry++) {
        try {
          const attempt = retry + 1;
          console.log(`⏳ ${serviceName} attempt ${attempt}/${this.options.maxRetries}`);

          const result = await this.executeWithTimeout<T>(
            service,
            operation,
            args,
            this.options.timeout
          );

          console.log(`✅ ${serviceName} ${operation} successful`);
          return result;
        } catch (error: any) {
          const errorMsg = error.message || 'Unknown error';
          console.warn(`❌ ${serviceName} attempt ${retry + 1} failed: ${errorMsg}`);

          errors.push({
            service: serviceName,
            error: error instanceof Error ? error : new Error(String(error)),
          });

          // 如果不是最后一次重试，等待一段时间
          if (retry < this.options.maxRetries - 1) {
            console.log(`⏳ Retrying ${serviceName} in ${this.options.retryDelay}ms...`);
            await this.delay(this.options.retryDelay);
          }
        }
      }

      console.log(`🔄 ${serviceName} exhausted all retries, trying next fallback...`);
    }

    // 所有服务和fallback都失败了
    const errorSummary = errors
      .map(({ service, error }) => `${service}: ${error.message}`)
      .join('; ');

    throw new Error(`All storage services failed for ${operation}. Errors: ${errorSummary}`);
  }

  /**
   * 执行操作并应用超时限制
   */
  private async executeWithTimeout<T>(
    service: IStorageService,
    operation: 'store' | 'retrieve',
    args: any[],
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      this.callServiceOperation<T>(service, operation, args),
      this.createTimeoutPromise<T>(timeoutMs, `${operation} operation`),
    ]);
  }

  /**
   * 调用具体的服务操作
   */
  private async callServiceOperation<T>(
    service: IStorageService,
    operation: 'store' | 'retrieve',
    args: any[]
  ): Promise<T> {
    if (service === this) {
      // 调用当前服务的实际实现方法
      if (operation === 'store') {
        return (this.doStore as any)(...args);
      } else {
        return (this.doRetrieve as any)(...args);
      }
    } else {
      // 调用fallback服务的方法
      // 重要：区分是否为StorageService实例，避免嵌套fallback
      if (service instanceof StorageService) {
        // 直接调用底层实现，绕过fallback机制，避免嵌套
        if (operation === 'store') {
          return (service.doStore as any)(...args);
        } else {
          return (service.doRetrieve as any)(...args);
        }
      } else {
        // 外部服务，正常调用
        if (operation === 'store') {
          return (service.store as any)(...args);
        } else {
          return (service.retrieve as any)(...args);
        }
      }
    }
  }

  /**
   * 创建超时Promise
   */
  private createTimeoutPromise<T>(timeoutMs: number, operation: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * 获取服务名称用于日志
   */
  private getServiceNameForService(service: IStorageService, index: number): string {
    if (service === this) {
      return this.getServiceName();
    } else if (service instanceof StorageService) {
      return service.getServiceName();
    } else {
      return `Fallback-${index}`;
    }
  }

  /**
   * 延时工具方法
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 添加fallback服务
   */
  addFallbackService(service: IStorageService): void {
    this.options.fallbackServices.push(service);
    console.log(
      `📎 Added fallback service: ${this.getServiceNameForService(service, this.options.fallbackServices.length)}`
    );
  }

  /**
   * 设置超时时间
   */
  setTimeout(timeoutMs: number): void {
    this.options.timeout = timeoutMs;
    console.log(`⏰ Timeout set to ${timeoutMs}ms`);
  }

  /**
   * 获取当前配置
   */
  getOptions(): StorageOptions {
    return {
      timeout: this.options.timeout,
      fallbackServices: [...this.options.fallbackServices],
      maxRetries: this.options.maxRetries,
      retryDelay: this.options.retryDelay,
    };
  }
}
