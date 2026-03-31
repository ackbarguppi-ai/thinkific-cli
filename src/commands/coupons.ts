import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, printSuccess } from '../lib/output';
import { confirm } from '../lib/prompts';

export function registerCouponsCommands(program: Command): void {
  const coupons = program.command('coupons').description('Manage coupons');

  coupons
    .command('list')
    .description('List coupons for a promotion')
    .requiredOption('--promotion-id <id>', 'Promotion ID')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching coupons...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>(`/promotions/${opts.promotionId}/coupons`, {
          limit: opts.limit,
          page: opts.page,
        });
        spinner.stop();
        const items = res.items || [];
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'Code', 'Quantity', 'Used', 'Note'],
            items.map(c => [
              c.id as number,
              c.code as string,
              c.quantity as number ?? 'Unlimited',
              c.number_of_uses as number ?? 0,
              (c.note as string) || '',
            ]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  coupons
    .command('get <id>')
    .description('Get coupon details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching coupon...').start();
      try {
        const coupon = await api.get<Record<string, unknown>>(`/coupons/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(coupon);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(coupon)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  coupons
    .command('create')
    .description('Create a coupon')
    .requiredOption('--promotion-id <id>', 'Promotion ID')
    .requiredOption('--code <code>', 'Coupon code')
    .option('--quantity <n>', 'Max uses')
    .option('--note <text>', 'Note')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Creating coupon...').start();
      try {
        const body: Record<string, unknown> = { code: opts.code };
        if (opts.quantity) body.quantity = parseInt(opts.quantity, 10);
        if (opts.note) body.note = opts.note;
        const coupon = await api.post<Record<string, unknown>>(`/promotions/${opts.promotionId}/coupons`, body);
        spinner.stop();
        printSuccess(`Coupon created with ID ${coupon.id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  coupons
    .command('update <id>')
    .description('Update a coupon')
    .option('--quantity <n>', 'Max uses')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Updating coupon...').start();
      try {
        const body: Record<string, unknown> = {};
        if (opts.quantity) body.quantity = parseInt(opts.quantity, 10);
        await api.put(`/coupons/${id}`, body);
        spinner.stop();
        printSuccess(`Coupon ${id} updated`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  coupons
    .command('delete <id>')
    .description('Delete a coupon')
    .option('--force', 'Skip confirmation')
    .action(async (id: string, opts) => {
      if (!opts.force) {
        const yes = await confirm(`Delete coupon ${id}?`);
        if (!yes) return;
      }
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Deleting coupon...').start();
      try {
        await api.delete(`/coupons/${id}`);
        spinner.stop();
        printSuccess(`Coupon ${id} deleted`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  coupons
    .command('bulk-create')
    .description('Bulk create coupons with a prefix')
    .requiredOption('--promotion-id <id>', 'Promotion ID')
    .requiredOption('--prefix <prefix>', 'Code prefix')
    .requiredOption('--count <n>', 'Number of coupons')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const count = parseInt(opts.count, 10);
      const spinner = ora(`Creating ${count} coupons...`).start();
      try {
        let created = 0;
        let failed = 0;
        for (let i = 1; i <= count; i++) {
          const code = `${opts.prefix}${String(i).padStart(4, '0')}`;
          try {
            await api.post(`/promotions/${opts.promotionId}/coupons`, { code });
            created++;
            spinner.text = `Creating coupons... ${created}/${count}`;
          } catch {
            failed++;
          }
        }
        spinner.stop();
        printSuccess(`Created ${created} coupons (${failed} failed)`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
