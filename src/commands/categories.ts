import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, printSuccess, truncate } from '../lib/output';
import { confirm } from '../lib/prompts';

export function registerCategoriesCommands(program: Command): void {
  const categories = program.command('categories').description('Manage categories');

  categories
    .command('list')
    .description('List all categories')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching categories...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>('/collections', {
          limit: opts.limit,
          page: opts.page,
        });
        spinner.stop();
        const items = res.items || [];
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'Name', 'Slug', 'Created'],
            items.map(c => [
              c.id as number,
              truncate(c.name as string, 40),
              c.slug as string ?? '',
              ((c.created_at as string) || '').substring(0, 10),
            ]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  categories
    .command('get <id>')
    .description('Get category details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching category...').start();
      try {
        const cat = await api.get<Record<string, unknown>>(`/collections/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(cat);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(cat)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  categories
    .command('create')
    .description('Create a category')
    .requiredOption('--name <name>', 'Category name')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Creating category...').start();
      try {
        const cat = await api.post<Record<string, unknown>>('/collections', { name: opts.name });
        spinner.stop();
        printSuccess(`Category created with ID ${cat.id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  categories
    .command('update <id>')
    .description('Update a category')
    .requiredOption('--name <name>', 'Category name')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Updating category...').start();
      try {
        await api.put(`/collections/${id}`, { name: opts.name });
        spinner.stop();
        printSuccess(`Category ${id} updated`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  categories
    .command('delete <id>')
    .description('Delete a category')
    .option('--force', 'Skip confirmation')
    .action(async (id: string, opts) => {
      if (!opts.force) {
        const yes = await confirm(`Delete category ${id}?`);
        if (!yes) return;
      }
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Deleting category...').start();
      try {
        await api.delete(`/collections/${id}`);
        spinner.stop();
        printSuccess(`Category ${id} deleted`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  categories
    .command('products <id>')
    .description('List products in a category')
    .action(async (id: string) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching products...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>(`/collections/${id}/products`);
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

  categories
    .command('add-products <id>')
    .description('Add products to a category')
    .requiredOption('--product-ids <ids>', 'Comma-separated product IDs')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Adding products...').start();
      try {
        const productIds = opts.productIds.split(',').map((pid: string) => parseInt(pid.trim(), 10));
        await api.post(`/collections/${id}/products`, { product_ids: productIds });
        spinner.stop();
        printSuccess(`Products added to category ${id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  categories
    .command('remove-products <id>')
    .description('Remove products from a category')
    .requiredOption('--product-ids <ids>', 'Comma-separated product IDs')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Removing products...').start();
      try {
        const productIds = opts.productIds.split(',').map((pid: string) => parseInt(pid.trim(), 10));
        await api.put(`/collections/${id}/products`, { product_ids: productIds });
        spinner.stop();
        printSuccess(`Products removed from category ${id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
