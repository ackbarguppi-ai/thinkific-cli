import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, printSuccess, truncate } from '../lib/output';

export function registerBundlesCommands(program: Command): void {
  const bundles = program.command('bundles').description('Manage bundles');

  bundles
    .command('list')
    .description('List all bundles')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching bundles...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>('/bundles', {
          limit: opts.limit,
          page: opts.page,
        });
        spinner.stop();
        const items = res.items || [];
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'Name', 'Slug'],
            items.map(b => [b.id as number, truncate(b.name as string, 50), b.slug as string ?? '']),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  bundles
    .command('get <id>')
    .description('Get bundle details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching bundle...').start();
      try {
        const bundle = await api.get<Record<string, unknown>>(`/bundles/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(bundle);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(bundle)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  bundles
    .command('courses <id>')
    .description('List courses in a bundle')
    .action(async (id: string) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching bundle courses...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>(`/bundles/${id}/courses`);
        spinner.stop();
        const items = res.items || [];
        printTable(
          ['ID', 'Name', 'Slug'],
          items.map(c => [c.id as number, truncate(c.name as string, 50), c.slug as string ?? '']),
        );
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  bundles
    .command('enrollments <id>')
    .description('List enrollments for a bundle')
    .option('--limit <n>', 'Items per page', '25')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching bundle enrollments...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>(`/bundles/${id}/enrollments`, {
          limit: opts.limit,
        });
        spinner.stop();
        const items = res.items || [];
        printTable(
          ['ID', 'User ID', 'Created'],
          items.map(e => [e.id as number, e.user_id as number, ((e.created_at as string) || '').substring(0, 10)]),
        );
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  bundles
    .command('enroll')
    .description('Enroll a user in a bundle')
    .requiredOption('--bundle-id <id>', 'Bundle ID')
    .requiredOption('--user-id <id>', 'User ID')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Enrolling user in bundle...').start();
      try {
        await api.post(`/bundles/${opts.bundleId}/enrollments`, {
          user_id: parseInt(opts.userId, 10),
        });
        spinner.stop();
        printSuccess(`User ${opts.userId} enrolled in bundle ${opts.bundleId}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
