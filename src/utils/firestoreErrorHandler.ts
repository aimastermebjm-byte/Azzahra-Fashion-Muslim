// 🔥 FIRESTORE CONNECTION ERROR HANDLER
// Handle QUIC protocol errors dan connection issues

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2
};

export class FirestoreErrorHandler {
  private retryCount = 0;
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  // Detect if error is connection-related
  isConnectionError(error: any): boolean {
    const errorMessage = error?.message || '';
    const errorString = error?.toString() || '';

    return (
      errorMessage.includes('QUIC_PROTOCOL_ERROR') ||
      errorMessage.includes('QUIC_PUBLIC_RESET') ||
      errorMessage.includes('WebChannelConnection') ||
      errorMessage.includes('transport errored') ||
      errorString.includes('ERR_QUIC_PROTOCOL_ERROR') ||
      errorString.includes('ERR_NETWORK') ||
      errorMessage.includes('connection closed') ||
      errorMessage.includes('deadline exceeded')
    );
  }

  // Calculate retry delay with exponential backoff
  getRetryDelay(): number {
    const delay = this.config.baseDelay * Math.pow(this.config.backoffFactor, this.retryCount);
    return Math.min(delay, this.config.maxDelay);
  }

  // Execute operation with retry logic
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    customErrorHandler?: (error: any) => boolean
  ): Promise<T> {
    try {
      const result = await operation();
      this.resetRetry(); // Reset on success
      return result;
    } catch (error) {
      console.error('🔥 Firestore operation failed:', error);

      // Check if error should be retried
      const shouldRetry = customErrorHandler
        ? customErrorHandler(error)
        : this.isConnectionError(error);

      if (!shouldRetry || this.retryCount >= this.config.maxRetries) {
        console.error('❌ Max retries reached or non-retryable error:', error);
        throw error;
      }

      this.retryCount++;
      const delay = this.getRetryDelay();

      console.log(`🔄 Retrying operation in ${delay}ms (attempt ${this.retryCount}/${this.config.maxRetries})`);

      await this.sleep(delay);
      return this.executeWithRetry(operation, customErrorHandler);
    }
  }

  // Reset retry counter
  resetRetry(): void {
    this.retryCount = 0;
  }

  // Helper: sleep function
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Create robust onSnapshot wrapper
  createRobustSnapshot(
    query: any,
    onNext: (snapshot: any) => void,
    onError?: (error: any) => void
  ): () => void {
    let unsubscribe: (() => void) | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const handleSnapshot = () => {
      try {
        unsubscribe = onSnapshot(
          query,
          (snapshot) => {
            console.log('✅ Snapshot received successfully');
            onNext(snapshot);
            this.resetRetry(); // Reset on success
          },
          (error) => {
            console.error('🔥 Snapshot error:', error);

            if (this.isConnectionError(error) && this.retryCount < this.config.maxRetries) {
              this.retryCount++;
              const delay = this.getRetryDelay();

              console.log(`🔄 Reconnecting snapshot in ${delay}ms (attempt ${this.retryCount})`);

              retryTimeout = setTimeout(() => {
                handleSnapshot();
              }, delay);
            } else {
              console.error('❌ Snapshot connection failed permanently:', error);
              onError?.(error);
            }
          }
        );
      } catch (error) {
        console.error('🔥 Failed to create snapshot:', error);
        onError?.(error);
      }
    };

    handleSnapshot();

    // Return cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }
}

// Global instance for app-wide usage
export const firestoreErrorHandler = new FirestoreErrorHandler();

// Export convenience functions
export const executeWithRetry = <T>(operation: () => Promise<T>) =>
  firestoreErrorHandler.executeWithRetry(operation);

export const createRobustSnapshot = (
  query: any,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
) => firestoreErrorHandler.createRobustSnapshot(query, onNext, onError);