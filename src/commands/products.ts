import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, truncate } from '../lib/output';

export function registerProductsCommands(program: Command): void {
  const products = program.command('products').description('Manage products');

  products
    .command('list')
    .description('List all products')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching products...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>('/products', {
          limit: opts.limit,
          page: opts.page,
        });
        spinner.stop();
        const items = res.items || [];
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'Name', 'Slug', 'Status', 'Price'],
            items.map(p => [
              p.id as number,
              truncate(p.name as string, 50),
              p.slug as string ?? '',
              p.status as string ?? '',
              p.price as string ?? '',
            ]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  products
    .command('get <id>')
    .description('Get product details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching product...').start();
      try {
        const product = await api.get<Record<string, unknown>>(`/products/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(product);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(product)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  products
    .command('related <id>')
    .description('List related products')
    .action(async (id: string) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching related products...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>(`/products/${id}/related`);
        spinner.stop();
        const items = res.items || [];
        printTable(
          ['ID', 'Name', 'Slug'],
          items.map(p => [p.id as number, truncate(p.name as string, 50), p.slug as string ?? '']),
        );
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
