import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, printSuccess, truncate } from '../lib/output';
import { confirm } from '../lib/prompts';

export function registerUsersCommands(program: Command): void {
  const users = program.command('users').description('Manage users');

  users
    .command('list')
    .description('List users')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--company <name>', 'Filter by company')
    .option('--json', 'Output as JSON')
    .option('--all', 'Fetch all pages')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching users...').start();
      try {
        const params: Record<string, string | number | undefined> = {
          limit: opts.limit,
          page: opts.page,
        };
        if (opts.company) params['query[company]'] = opts.company;

        let items: Record<string, unknown>[];
        if (opts.all) {
          items = await api.getAll('/users', params);
        } else {
          const res = await api.get<{ items: Record<string, unknown>[] }>('/users', params);
          items = res.items || [];
        }
        spinner.stop();
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'Name', 'Email', 'Company', 'Created'],
            items.map(u => [
              u.id as number,
              `${u.first_name || ''} ${u.last_name || ''}`.trim(),
              u.email as string,
              truncate((u.company as string) || '', 30),
              (u.created_at as string || '').substring(0, 10),
            ]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  users
    .command('get <id>')
    .description('Get user details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching user...').start();
      try {
        const user = await api.get<Record<string, unknown>>(`/users/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(user);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(user)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  users
    .command('create')
    .description('Create a new user')
    .requiredOption('--first-name <name>', 'First name')
    .requiredOption('--last-name <name>', 'Last name')
    .requiredOption('--email <email>', 'Email address')
    .option('--company <company>', 'Company name')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Creating user...').start();
      try {
        const body: Record<string, string> = {
          first_name: opts.firstName,
          last_name: opts.lastName,
          email: opts.email,
        };
        if (opts.company) body.company = opts.company;
        const user = await api.post<Record<string, unknown>>('/users', body);
        spinner.stop();
        printSuccess(`User created with ID ${user.id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  users
    .command('search <query>')
    .description('Search for users')
    .option('--limit <n>', 'Max results', '25')
    .action(async (query: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Searching users...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>('/users', {
          'query[email]': query,
          limit: opts.limit,
        });
        spinner.stop();
        const items = res.items || [];
        printTable(
          ['ID', 'Name', 'Email', 'Company'],
          items.map(u => [
            u.id as number,
            `${u.first_name || ''} ${u.last_name || ''}`.trim(),
            u.email as string,
            (u.company as string) || '',
          ]),
        );
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  users
    .command('update <id>')
    .description('Update a user')
    .option('--first-name <name>', 'First name')
    .option('--last-name <name>', 'Last name')
    .option('--company <company>', 'Company name')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Updating user...').start();
      try {
        const body: Record<string, string> = {};
        if (opts.firstName) body.first_name = opts.firstName;
        if (opts.lastName) body.last_name = opts.lastName;
        if (opts.company) body.company = opts.company;
        await api.put(`/users/${id}`, body);
        spinner.stop();
        printSuccess(`User ${id} updated`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  users
    .command('delete <id>')
    .description('Delete a user')
    .option('--force', 'Skip confirmation')
    .action(async (id: string, opts) => {
      if (!opts.force) {
        const yes = await confirm(`Delete user ${id}?`);
        if (!yes) return;
      }
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Deleting user...').start();
      try {
        await api.delete(`/users/${id}`);
        spinner.stop();
        printSuccess(`User ${id} deleted`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
