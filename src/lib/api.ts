import https from 'https';
import http from 'http';
import { URL } from 'url';

const BASE_URL = 'https://api.thinkific.com/api/public/v1';
const MAX_RETRIES = 3;

interface RequestOptions {
  method: string;
  path: string;
  body?: unknown;
  params?: Record<string, string | number | undefined>;
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

export class ThinkificAPI {
  private token: string;
  private subdomain: string;

  constructor(token: string, subdomain: string) {
    this.token = token;
    this.subdomain = subdomain;
  }

  private async request<T>(options: RequestOptions, retryCount = 0): Promise<T> {
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
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'ThinkificCLI/1.0 (Node.js)',
        },
      };

      const req = https.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => {
          const status = res.statusCode || 0;

          if (status === 429 && retryCount < MAX_RETRIES) {
            const retryAfter = parseInt(res.headers['retry-after'] as string, 10) || (retryCount + 1) * 2;
            setTimeout(() => {
              this.request<T>(options, retryCount + 1).then(resolve).catch(reject);
            }, retryAfter * 1000);
            return;
          }

          let data: unknown;
          try {
            data = body ? JSON.parse(body) : {};
          } catch {
            if (status >= 200 && status < 300) {
              data = {};
            } else {
              reject(new Error(`HTTP ${status}: Invalid JSON response`));
              return;
            }
          }

          if (status >= 400) {
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

          resolve(data as T);
        });
      });

      req.on('error', (err) => reject(err));

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  }

  async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>({ method: 'GET', path, params });
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

  async getAll<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T[]> {
    const allItems: T[] = [];
    let page = 1;
    const limit = 250;

    while (true) {
      const response = await this.get<PaginatedResponse<T>>(path, {
        ...params,
        page,
        limit,
      });

      if (response.items) {
        allItems.push(...response.items);
      }

      if (!response.meta?.pagination?.next_page) {
        break;
      }
      page = response.meta.pagination.next_page;
    }

    return allItems;
  }
}

export function createAPI(token: string, subdomain: string): ThinkificAPI {
  return new ThinkificAPI(token, subdomain);
}
