import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, truncate } from '../lib/output';

export function registerOrdersCommands(program: Command): void {
  const orders = program.command('orders').description('Manage orders');

  orders
    .command('list')
    .description('List orders')
    .option('--user-id <id>', 'Filter by user ID')
    .option('--email <email>', 'Filter by email')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching orders...').start();
      try {
        const params: Record<string, string | number | undefined> = {
          limit: opts.limit,
          page: opts.page,
        };
        if (opts.userId) params['query[user_id]'] = opts.userId;
        if (opts.email) params['query[email]'] = opts.email;
        const res = await api.get<{ items: Record<string, unknown>[] }>('/orders', params);
        spinner.stop();
        const items = res.items || [];
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'User ID', 'Product Name', 'Status', 'Amount', 'Created'],
            items.map(o => [
              o.id as number,
              o.user_id as number,
              truncate((o.product_name as string) || '', 40),
              o.status as string,
              o.amount_dollars as string ?? '',
              ((o.created_at as string) || '').substring(0, 10),
            ]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  orders
    .command('get <id>')
    .description('Get order details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching order...').start();
      try {
        const order = await api.get<Record<string, unknown>>(`/orders/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(order);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(order)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
