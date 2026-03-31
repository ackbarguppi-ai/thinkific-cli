import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printError, printSuccess } from '../lib/output';

export function registerPublishRequestsCommands(program: Command): void {
  const pr = program.command('publish-requests').description('Manage publish requests');

  pr
    .command('list')
    .description('List publish requests')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching publish requests...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>('/publish_requests', {
          limit: opts.limit,
          page: opts.page,
        });
        spinner.stop();
        const items = res.items || [];
        printTable(
          ['ID', 'User ID', 'Status', 'Created'],
          items.map(r => [
            r.id as number,
            r.user_id as number,
            r.status as string,
            ((r.created_at as string) || '').substring(0, 10),
          ]),
        );
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  pr
    .command('get <id>')
    .description('Get publish request details')
    .action(async (id: string) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching publish request...').start();
      try {
        const request = await api.get<Record<string, unknown>>(`/publish_requests/${id}`);
        spinner.stop();
        printTable(
          ['Field', 'Value'],
          Object.entries(request)
            .filter(([, v]) => typeof v !== 'object')
            .map(([k, v]) => [k, String(v ?? '')]),
        );
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  pr
    .command('approve <id>')
    .description('Approve a publish request')
    .action(async (id: string) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Approving...').start();
      try {
        await api.post(`/publish_requests/${id}/approve`);
        spinner.stop();
        printSuccess(`Publish request ${id} approved`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  pr
    .command('deny <id>')
    .description('Deny a publish request')
    .action(async (id: string) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Denying...').start();
      try {
        await api.post(`/publish_requests/${id}/deny`);
        spinner.stop();
        printSuccess(`Publish request ${id} denied`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
