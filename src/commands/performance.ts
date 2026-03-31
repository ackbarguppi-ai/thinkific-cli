import { Command } from 'commander';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printSuccess, printInfo } from '../lib/output';

export function registerPerformanceCommands(program: Command): void {
  const perf = program.command('perf').description('Performance monitoring and cache management');

  perf
    .command('metrics')
    .description('Show API performance metrics')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      
      const metrics = api.getMetrics();
      const cacheStats = api.getCacheStats();
      
      if (opts.json) {
        printJSON({ ...metrics, cache: cacheStats });
      } else {
        printInfo('API Performance Metrics');
        printTable(
          ['Metric', 'Value'],
          [
            ['Total Requests', metrics.totalRequests.toString()],
            ['Cache Hits', metrics.cacheHits.toString()],
            ['Cache Misses', metrics.cacheMisses.toString()],
            ['Coalesced Requests', metrics.coalescedRequests.toString()],
            ['Average Latency', `${metrics.averageLatency}ms`],
            ['Errors', metrics.errors.toString()],
            ['Cache Size', cacheStats.size.toString()],
          ],
        );
        
        const hitRate = metrics.totalRequests > 0 
          ? ((metrics.cacheHits / metrics.totalRequests) * 100).toFixed(1)
          : '0.0';
        printInfo(`Cache Hit Rate: ${hitRate}%`);
      }
    });

  perf
    .command('cache-clear')
    .description('Clear the API response cache')
    .action(async () => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      api.clearCache();
      printSuccess('Cache cleared');
    });

  perf
    .command('benchmark')
    .description('Run a simple benchmark to test API performance')
    .option('--requests <n>', 'Number of requests', '10')
    .option('--endpoint <path>', 'Endpoint to test', '/courses')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const count = parseInt(opts.requests, 10);
      
      printInfo(`Running benchmark: ${count} requests to ${opts.endpoint}`);
      
      const latencies: number[] = [];
      const startTotal = Date.now();
      
      for (let i = 0; i < count; i++) {
        const start = Date.now();
        try {
          await api.get(opts.endpoint, { limit: 1 });
          latencies.push(Date.now() - start);
        } catch (err) {
          console.error(`Request ${i + 1} failed:`, (err as Error).message);
        }
      }
      
      const totalTime = Date.now() - startTotal;
      
      if (latencies.length === 0) {
        console.error('All requests failed');
        return;
      }
      
      latencies.sort((a, b) => a - b);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1];
      const min = latencies[0];
      const max = latencies[latencies.length - 1];
      
      printInfo('Benchmark Results');
      printTable(
        ['Metric', 'Value'],
        [
          ['Total Requests', latencies.length.toString()],
          ['Total Time', `${totalTime}ms`],
          ['Average', `${avg.toFixed(1)}ms`],
          ['P50 (Median)', `${p50}ms`],
          ['P95', `${p95}ms`],
          ['Min', `${min}ms`],
          ['Max', `${max}ms`],
          ['Req/sec', ((latencies.length / totalTime) * 1000).toFixed(1)],
        ],
      );
      
      // Show metrics after benchmark
      const metrics = api.getMetrics();
      printInfo(`Cache hit rate during benchmark: ${((metrics.cacheHits / Math.max(metrics.totalRequests, 1)) * 100).toFixed(1)}%`);
    });
}
