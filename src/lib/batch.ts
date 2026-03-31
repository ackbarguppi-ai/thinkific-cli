/**
 * Request batching and debouncing utilities for CLI performance optimization.
 *
 * @module batch
 */

/**
 * Request coalescing - deduplicates in-flight identical requests.
 * If the same request is made multiple times while one is in flight,
 * all callers receive the same result.
 */
export class RequestCoalescer<T, R> {
  private inFlight = new Map<string, Promise<R>>();

  constructor(private keyFn: (params: T) => string) {}

  async execute(params: T, fn: (params: T) => Promise<R>): Promise<R> {
    const key = this.keyFn(params);

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = fn(params).finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.inFlight.clear();
  }
}

/**
 * Debounced function wrapper - delays execution until after wait period
 * of no new calls. Useful for rapid successive API calls.
 */
export function debounce<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  waitMs: number,
): (...args: Parameters<T>) => Promise<unknown> {
  let timeout: NodeJS.Timeout | null = null;
  let pendingResolve: ((value: unknown) => void) | null = null;
  let pendingReject: ((reason: unknown) => void) | null = null;
  let pendingArgs: Parameters<T> | null = null;

  return function debounced(...args: Parameters<T>): Promise<unknown> {
    pendingArgs = args;

    return new Promise((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;

      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(async () => {
        const argsToUse = pendingArgs;
        const resolveToUse = pendingResolve;
        const rejectToUse = pendingReject;

        pendingArgs = null;
        pendingResolve = null;
        pendingReject = null;
        timeout = null;

        try {
          const result = await fn(...argsToUse!);
          resolveToUse!(result);
        } catch (err) {
          rejectToUse!(err);
        }
      }, waitMs);
    });
  };
}

/**
 * Throttled function wrapper - limits execution to once per period.
 * Returns the last result if called within the throttle window.
 */
export function throttle<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  limitMs: number,
): (...args: Parameters<T>) => Promise<unknown> {
  let lastCall = 0;
  let pendingPromise: Promise<unknown> | null = null;

  return async function throttled(...args: Parameters<T>): Promise<unknown> {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= limitMs) {
      lastCall = now;
      pendingPromise = fn(...args);
      return pendingPromise;
    }

    // Return the pending promise if we're within the throttle window
    return pendingPromise ?? fn(...args);
  };
}

/**
 * Memoize function results with TTL.
 */
export function memoizeWithTTL<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ttlMs: number,
  keyFn?: (...args: Parameters<T>) => string,
): T {
  const cache = new Map<string, { value: unknown; expiresAt: number }>();

  return ((...args: unknown[]) => {
    const key = keyFn ? keyFn(...(args as Parameters<T>)) : JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    const result = fn(...args);
    cache.set(key, { value: result, expiresAt: Date.now() + ttlMs });

    // Clean up expired entries periodically
    if (cache.size > 100) {
      const now = Date.now();
      for (const [k, v] of cache.entries()) {
        if (now > v.expiresAt) {
          cache.delete(k);
        }
      }
    }

    return result;
  }) as T;
}
