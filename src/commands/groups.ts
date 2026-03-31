import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, printSuccess } from '../lib/output';
import { confirm } from '../lib/prompts';

export function registerGroupsCommands(program: Command): void {
  const groups = program.command('groups').description('Manage groups');

  groups
    .command('list')
    .description('List all groups')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching groups...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>('/groups', {
          limit: opts.limit,
          page: opts.page,
        });
        spinner.stop();
        const items = res.items || [];
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'Name', 'Created'],
            items.map(g => [g.id as number, g.name as string, ((g.created_at as string) || '').substring(0, 10)]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  groups
    .command('get <id>')
    .description('Get group details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching group...').start();
      try {
        const group = await api.get<Record<string, unknown>>(`/groups/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(group);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(group)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  groups
    .command('create')
    .description('Create a group')
    .requiredOption('--name <name>', 'Group name')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Creating group...').start();
      try {
        const group = await api.post<Record<string, unknown>>('/groups', { name: opts.name });
        spinner.stop();
        printSuccess(`Group created with ID ${group.id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  groups
    .command('delete <id>')
    .description('Delete a group')
    .option('--force', 'Skip confirmation')
    .action(async (id: string, opts) => {
      if (!opts.force) {
        const yes = await confirm(`Delete group ${id}?`);
        if (!yes) return;
      }
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Deleting group...').start();
      try {
        await api.delete(`/groups/${id}`);
        spinner.stop();
        printSuccess(`Group ${id} deleted`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  groups
    .command('add-user')
    .description('Add a user to a group')
    .requiredOption('--group-id <id>', 'Group ID')
    .requiredOption('--user-id <id>', 'User ID')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Adding user to group...').start();
      try {
        await api.post(`/groups/${opts.groupId}/users`, { user_id: parseInt(opts.userId, 10) });
        spinner.stop();
        printSuccess(`User ${opts.userId} added to group ${opts.groupId}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  groups
    .command('add-analyst')
    .description('Add a group analyst')
    .requiredOption('--group-id <id>', 'Group ID')
    .requiredOption('--user-id <id>', 'User ID')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Adding analyst...').start();
      try {
        await api.post(`/groups/${opts.groupId}/analysts`, { user_id: parseInt(opts.userId, 10) });
        spinner.stop();
        printSuccess(`Analyst added to group ${opts.groupId}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  groups
    .command('remove-analyst')
    .description('Remove a group analyst')
    .requiredOption('--group-id <id>', 'Group ID')
    .requiredOption('--user-id <id>', 'User ID')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Removing analyst...').start();
      try {
        await api.delete(`/groups/${opts.groupId}/analysts/${opts.userId}`);
        spinner.stop();
        printSuccess(`Analyst removed from group ${opts.groupId}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  groups
    .command('analysts <group-id>')
    .description('List group analysts')
    .action(async (groupId: string) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching analysts...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>(`/groups/${groupId}/analysts`);
        spinner.stop();
        const items = res.items || [];
        printTable(
          ['ID', 'Name', 'Email'],
          items.map(a => [
            a.id as number,
            `${a.first_name || ''} ${a.last_name || ''}`.trim(),
            a.email as string,
          ]),
        );
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
