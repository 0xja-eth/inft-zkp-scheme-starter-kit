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
 * Base storage service class providing automatic fallback and timeout mechanisms
 *
 * Features:
 * 1. Automatic timeout handling - automatically switches to fallback after specified time
 * 2. Multi-level fallback chain - supports chained fallbacks, tries next service on failure
 * 3. Retry mechanism - each service has independent retry counts
 * 4. Error aggregation - collects all attempt error information for debugging
 * 5. Unified interface - all storage services inherit the same interface and behavior
 */
export abstract class StorageService implements IStorageService {
  protected options: Required<StorageOptions>;

  constructor(options: StorageOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000, // 30 seconds default timeout
      fallbackServices: options.fallbackServices ?? [],
      maxRetries: options.maxRetries ?? 1,
      retryDelay: options.retryDelay ?? 1000,
    };
  }

  /**
   * Store data with timeout and fallback support
   */
  async store(data: Buffer): Promise<StorageResult> {
    return this.executeWithFallback('store', [data]);
  }

  /**
   * Retrieve data with timeout and fallback support
   */
  async retrieve(rootHash: string): Promise<Buffer> {
    return this.executeWithFallback('retrieve', [rootHash]);
  }

  /**
   * Concrete storage method that subclasses must implement
   */
  protected abstract doStore(data: Buffer): Promise<StorageResult>;

  /**
   * Concrete retrieval method that subclasses must implement
   */
  protected abstract doRetrieve(rootHash: string): Promise<Buffer>;

  /**
   * Get storage service name for logging identification
   */
  protected abstract getServiceName(): string;

  /**
   * Execute operation with timeout and fallback mechanism core logic
   */
  private async executeWithFallback<T>(operation: 'store' | 'retrieve', args: any[]): Promise<T> {
    const allServices = [this, ...this.options.fallbackServices];
    const errors: Array<{ service: string; error: Error }> = [];

    for (let serviceIndex = 0; serviceIndex < allServices.length; serviceIndex++) {
      const service = allServices[serviceIndex];
      const serviceName = this.getServiceNameForService(service, serviceIndex);

      console.log(`🔄 Trying ${serviceName} for ${operation}...`);

      // Retry for each service
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

          // If not the last retry, wait for a period
          if (retry < this.options.maxRetries - 1) {
            console.log(`⏳ Retrying ${serviceName} in ${this.options.retryDelay}ms...`);
            await this.delay(this.options.retryDelay);
          }
        }
      }

      console.log(`🔄 ${serviceName} exhausted all retries, trying next fallback...`);
    }

    // All services and fallbacks failed
    const errorSummary = errors
      .map(({ service, error }) => `${service}: ${error.message}`)
      .join('; ');

    throw new Error(`All storage services failed for ${operation}. Errors: ${errorSummary}`);
  }

  /**
   * Execute operation and apply timeout limit
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
   * Call specific service operation
   */
  private async callServiceOperation<T>(
    service: IStorageService,
    operation: 'store' | 'retrieve',
    args: any[]
  ): Promise<T> {
    if (service === this) {
      // Call current service's actual implementation method
      if (operation === 'store') {
        return (this.doStore as any)(...args);
      } else {
        return (this.doRetrieve as any)(...args);
      }
    } else {
      // Call fallback service's method
      // Important: distinguish if it's a StorageService instance to avoid nested fallback
      if (service instanceof StorageService) {
        // Directly call underlying implementation, bypass fallback mechanism to avoid nesting
        if (operation === 'store') {
          return (service.doStore as any)(...args);
        } else {
          return (service.doRetrieve as any)(...args);
        }
      } else {
        // External service, normal call
        if (operation === 'store') {
          return (service.store as any)(...args);
        } else {
          return (service.retrieve as any)(...args);
        }
      }
    }
  }

  /**
   * Create timeout Promise
   */
  private createTimeoutPromise<T>(timeoutMs: number, operation: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Get service name for logging
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
   * Delay utility method
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add fallback service
   */
  addFallbackService(service: IStorageService): void {
    this.options.fallbackServices.push(service);
    console.log(
      `📎 Added fallback service: ${this.getServiceNameForService(service, this.options.fallbackServices.length)}`
    );
  }

  /**
   * Set timeout duration
   */
  setTimeout(timeoutMs: number): void {
    this.options.timeout = timeoutMs;
    console.log(`⏰ Timeout set to ${timeoutMs}ms`);
  }

  /**
   * Get current configuration
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
