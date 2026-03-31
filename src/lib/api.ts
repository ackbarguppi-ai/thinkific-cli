import https from 'https';
import http from 'http';
import { URL } from 'url';
import { RequestCoalescer } from './batch.js';

const BASE_URL = 'https://api.thinkific.com/api/public/v1';
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 30000;

/** Connection pool settings for optimal performance */
const HTTP_AGENT_OPTIONS = {
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: DEFAULT_TIMEOUT,
  scheduling: 'lifo' as const,
};

/** Global connection agent for reuse across all instances */
const httpsAgent = new https.Agent(HTTP_AGENT_OPTIONS);

// ---------------------------------------------------------------------------
// Simple cache implementation for GET requests
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL: number;

  constructor(defaultTTLMs: number = 5000) {
    this.defaultTTL = defaultTTLMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

// Clean up global cache every 60 seconds
const globalCache = new SimpleCache(5000);
setInterval(() => globalCache.cleanup(), 60000);

interface RequestOptions {
  method: string;
  path: string;
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  /** Cache TTL in milliseconds for GET requests (default: 5000ms) */
  cacheTTL?: number;
  /** Skip cache for this request */
  skipCache?: boolean;
}

interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: http.IncomingHttpHeaders;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    pagination: {
      current_page: number;
      next_page: number | null;
      prev_page: number | null;
      total_pages: number;
      total_items: number;
    };
  };
}

/** Performance metrics for monitoring */
export interface PerformanceMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  coalescedRequests: number;
  averageLatency: number;
  errors: number;
}

export class ThinkificAPI {
  private token: string;
  private subdomain: string;
  private cache: SimpleCache;
  private metrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    coalescedRequests: 0,
    totalLatency: 0,
    errors: 0,
  };
  private requestCoalescer: RequestCoalescer<string, unknown>;

  constructor(token: string, subdomain: string, cacheTTL = 5000) {
    this.token = token;
    this.subdomain = subdomain;
    this.cache = new SimpleCache(cacheTTL);
    this.requestCoalescer = new RequestCoalescer((key) => key);
  }

  /** Get current performance metrics */
  getMetrics(): PerformanceMetrics {
    const avgLatency = this.metrics.totalRequests > 0
      ? this.metrics.totalLatency / this.metrics.totalRequests
      : 0;
    return {
      totalRequests: this.metrics.totalRequests,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      coalescedRequests: this.metrics.coalescedRequests,
      averageLatency: Math.round(avgLatency),
      errors: this.metrics.errors,
    };
  }

  /** Clear the cache */
  clearCache(): void {
    this.cache.clear();
  }

  /** Get cache statistics */
  getCacheStats(): { size: number } {
    return { size: this.cache.size };
  }

  private getCacheKey(options: RequestOptions): string {
    const params = options.params ? new URLSearchParams(
      Object.entries(options.params).map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return `${options.method}:${options.path}:${params}`;
  }

  async request<T>(options: RequestOptions, retryCount = 0): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    const cacheKey = this.getCacheKey(options);

    // Check cache for GET requests
    if (options.method === 'GET' && !options.skipCache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) {
        this.metrics.cacheHits++;
        return cached;
      }
      this.metrics.cacheMisses++;
    }

    // Use request coalescing for GET requests
    if (options.method === 'GET') {
      return this.requestCoalescer.execute(cacheKey, async () => {
        this.metrics.coalescedRequests++;
        return this.executeRequest<T>(options, cacheKey, startTime, retryCount);
      }) as Promise<T>;
    }

    return this.executeRequest<T>(options, cacheKey, startTime, retryCount);
  }

  private async executeRequest<T>(
    options: RequestOptions,
    cacheKey: string,
    startTime: number,
    retryCount = 0
  ): Promise<T> {
    const url = new URL(BASE_URL + options.path);
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return new Promise<T>((resolve, reject) => {
      const reqOptions: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: options.method,
        agent: httpsAgent, // Connection pooling
        timeout: DEFAULT_TIMEOUT,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'ThinkificCLI/1.0 (Node.js)',
          'Accept-Encoding': 'gzip, deflate, br', // Enable compression
        },
      };

      const req = https.request(reqOptions, (res) => {
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk: Buffer) => { 
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          const latency = Date.now() - startTime;
          this.metrics.totalLatency += latency;
          
          const body = Buffer.concat(chunks);
          const status = res.statusCode || 0;

          if (status === 429 && retryCount < MAX_RETRIES) {
            const retryAfter = parseInt(res.headers['retry-after'] as string, 10) || (retryCount + 1) * 2;
            setTimeout(() => {
              this.executeRequest<T>(options, cacheKey, startTime, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, retryAfter * 1000);
            return;
          }

          // Handle compressed responses
          let data: unknown;
          try {
            const encoding = res.headers['content-encoding'];
            let decoded = body;
            
            if (encoding === 'gzip') {
              decoded = require('zlib').gunzipSync(body);
            } else if (encoding === 'deflate') {
              decoded = require('zlib').inflateSync(body);
            } else if (encoding === 'br') {
              decoded = require('zlib').brotliDecompressSync(body);
            }
            
            data = decoded.length > 0 ? JSON.parse(decoded.toString()) : {};
          } catch {
            if (status >= 200 && status < 300) {
              data = {};
            } else {
              this.metrics.errors++;
              reject(new Error(`HTTP ${status}: Invalid JSON response`));
              return;
            }
          }

          if (status >= 400) {
            this.metrics.errors++;
            const errData = data as Record<string, unknown>;
            const message = (errData.error as string)
              || (errData.message as string)
              || ((errData.errors as Record<string, string[]>)
                ? Object.entries(errData.errors as Record<string, string[]>)
                    .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
                    .join('; ')
                : null)
              || `HTTP ${status}`;
            reject(new Error(message));
            return;
          }

          // Cache successful GET responses
          if (options.method === 'GET' && !options.skipCache) {
            this.cache.set(cacheKey, data as T, options.cacheTTL);
          }

          resolve(data as T);
        });
      });

      req.on('error', (err) => {
        this.metrics.errors++;
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  }

  async get<T>(path: string, params?: Record<string, string | number | undefined>, options?: { cacheTTL?: number; skipCache?: boolean }): Promise<T> {
    return this.request<T>({ method: 'GET', path, params, ...options });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: 'POST', path, body });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: 'PUT', path, body });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: 'PATCH', path, body });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>({ method: 'DELETE', path });
  }

  /**
   * Fetch all paginated items efficiently using concurrent requests.
   * Uses batching to avoid overwhelming the API while maximizing throughput.
   */
  async getAll<T>(path: string, params?: Record<string, string | number | undefined>, options?: { batchSize?: number }): Promise<T[]> {
    const limit = 250;
    const batchSize = options?.batchSize ?? 5;
    
    // First request to get pagination info
    const firstPage = await this.get<PaginatedResponse<T>>(path, {
      ...params,
      page: 1,
      limit,
    });

    const allItems: T[] = [...(firstPage.items || [])];
    const totalPages = firstPage.meta?.pagination?.total_pages || 1;
    
    // Fetch remaining pages in batches
    if (totalPages > 1) {
      for (let batchStart = 2; batchStart <= totalPages; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, totalPages);
        const promises: Promise<PaginatedResponse<T>>[] = [];
        
        for (let page = batchStart; page <= batchEnd; page++) {
          promises.push(
            this.get<PaginatedResponse<T>>(path, {
              ...params,
              page,
              limit,
            })
          );
        }
        
        const results = await Promise.all(promises);
        for (const page of results) {
          if (page.items) {
            allItems.push(...page.items);
          }
        }
      }
    }

    return allItems;
  }
}

export function createAPI(token: string, subdomain: string, cacheTTL?: number): ThinkificAPI {
  return new ThinkificAPI(token, subdomain, cacheTTL);
}
