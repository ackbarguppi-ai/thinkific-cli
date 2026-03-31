import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, printSuccess, truncate } from '../lib/output';
import { confirm } from '../lib/prompts';

export function registerPromotionsCommands(program: Command): void {
  const promotions = program.command('promotions').description('Manage promotions');

  promotions
    .command('list')
    .description('List all promotions')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching promotions...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>('/promotions', {
          limit: opts.limit,
          page: opts.page,
        });
        spinner.stop();
        const items = res.items || [];
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'Name', 'Discount Type', 'Amount', 'Expires'],
            items.map(p => [
              p.id as number,
              truncate(p.name as string, 40),
              p.discount_type as string,
              p.amount as number,
              (p.expires_at as string) || 'Never',
            ]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  promotions
    .command('get <id>')
    .description('Get promotion details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching promotion...').start();
      try {
        const promo = await api.get<Record<string, unknown>>(`/promotions/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(promo);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(promo)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  promotions
    .command('create')
    .description('Create a promotion')
    .requiredOption('--name <name>', 'Promotion name')
    .requiredOption('--discount-type <type>', 'Discount type (percentage or fixed)')
    .requiredOption('--amount <n>', 'Discount amount')
    .option('--product-ids <ids>', 'Comma-separated product IDs')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Creating promotion...').start();
      try {
        const body: Record<string, unknown> = {
          name: opts.name,
          discount_type: opts.discountType,
          amount: parseFloat(opts.amount),
        };
        if (opts.productIds) {
          body.product_ids = opts.productIds.split(',').map((id: string) => parseInt(id.trim(), 10));
        }
        const promo = await api.post<Record<string, unknown>>('/promotions', body);
        spinner.stop();
        printSuccess(`Promotion created with ID ${promo.id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  promotions
    .command('update <id>')
    .description('Update a promotion')
    .option('--name <name>', 'Promotion name')
    .option('--amount <n>', 'Discount amount')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Updating promotion...').start();
      try {
        const body: Record<string, unknown> = {};
        if (opts.name) body.name = opts.name;
        if (opts.amount) body.amount = parseFloat(opts.amount);
        await api.put(`/promotions/${id}`, body);
        spinner.stop();
        printSuccess(`Promotion ${id} updated`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  promotions
    .command('delete <id>')
    .description('Delete a promotion')
    .option('--force', 'Skip confirmation')
    .action(async (id: string, opts) => {
      if (!opts.force) {
        const yes = await confirm(`Delete promotion ${id}?`);
        if (!yes) return;
      }
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Deleting promotion...').start();
      try {
        await api.delete(`/promotions/${id}`);
        spinner.stop();
        printSuccess(`Promotion ${id} deleted`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  promotions
    .command('find-by-coupon')
    .description('Find promotion by coupon code')
    .requiredOption('--code <code>', 'Coupon code')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Searching...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>('/promotions', {
          'query[coupon]': opts.code,
        });
        spinner.stop();
        const items = res.items || [];
        if (items.length === 0) {
          printError('No promotion found for that coupon code');
        } else {
          printTable(
            ['ID', 'Name', 'Discount Type', 'Amount'],
            items.map(p => [p.id as number, p.name as string, p.discount_type as string, p.amount as number]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
