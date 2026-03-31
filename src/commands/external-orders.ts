import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printError, printSuccess } from '../lib/output';

export function registerExternalOrdersCommands(program: Command): void {
  const ext = program.command('external-orders').description('Manage external orders');

  ext
    .command('create')
    .description('Create an external order')
    .requiredOption('--user-id <id>', 'User ID')
    .requiredOption('--product-id <id>', 'Product ID')
    .requiredOption('--price <amount>', 'Price amount')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Creating external order...').start();
      try {
        const order = await api.post<Record<string, unknown>>('/external_orders', {
          user_id: parseInt(opts.userId, 10),
          product_id: parseInt(opts.productId, 10),
          price: parseFloat(opts.price),
        });
        spinner.stop();
        printSuccess(`External order created with ID ${order.id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  ext
    .command('refund <id>')
    .description('Refund an external order')
    .action(async (id: string) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Refunding external order...').start();
      try {
        await api.post(`/external_orders/${id}/refund`);
        spinner.stop();
        printSuccess(`External order ${id} refunded`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  ext
    .command('purchase <id>')
    .description('Complete purchase of an external order')
    .action(async (id: string) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Completing purchase...').start();
      try {
        await api.post(`/external_orders/${id}/purchase`);
        spinner.stop();
        printSuccess(`External order ${id} purchase completed`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
