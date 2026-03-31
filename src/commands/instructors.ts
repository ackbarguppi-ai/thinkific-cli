import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, printSuccess } from '../lib/output';
import { confirm } from '../lib/prompts';

export function registerInstructorsCommands(program: Command): void {
  const instructors = program.command('instructors').description('Manage instructors');

  instructors
    .command('list')
    .description('List all instructors')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching instructors...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>('/instructors', {
          limit: opts.limit,
          page: opts.page,
        });
        spinner.stop();
        const items = res.items || [];
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'Name', 'Email', 'Title'],
            items.map(i => [
              i.id as number,
              `${i.first_name || ''} ${i.last_name || ''}`.trim(),
              (i.email as string) || '',
              (i.title as string) || '',
            ]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  instructors
    .command('get <id>')
    .description('Get instructor details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching instructor...').start();
      try {
        const instructor = await api.get<Record<string, unknown>>(`/instructors/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(instructor);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(instructor)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  instructors
    .command('create')
    .description('Create an instructor')
    .requiredOption('--first-name <name>', 'First name')
    .requiredOption('--last-name <name>', 'Last name')
    .option('--email <email>', 'Email address')
    .option('--title <title>', 'Title/role')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Creating instructor...').start();
      try {
        const body: Record<string, string> = {
          first_name: opts.firstName,
          last_name: opts.lastName,
        };
        if (opts.email) body.email = opts.email;
        if (opts.title) body.title = opts.title;
        const instructor = await api.post<Record<string, unknown>>('/instructors', body);
        spinner.stop();
        printSuccess(`Instructor created with ID ${instructor.id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  instructors
    .command('update <id>')
    .description('Update an instructor')
    .option('--first-name <name>', 'First name')
    .option('--last-name <name>', 'Last name')
    .option('--title <title>', 'Title/role')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Updating instructor...').start();
      try {
        const body: Record<string, string> = {};
        if (opts.firstName) body.first_name = opts.firstName;
        if (opts.lastName) body.last_name = opts.lastName;
        if (opts.title) body.title = opts.title;
        await api.put(`/instructors/${id}`, body);
        spinner.stop();
        printSuccess(`Instructor ${id} updated`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  instructors
    .command('delete <id>')
    .description('Delete an instructor')
    .option('--force', 'Skip confirmation')
    .action(async (id: string, opts) => {
      if (!opts.force) {
        const yes = await confirm(`Delete instructor ${id}?`);
        if (!yes) return;
      }
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Deleting instructor...').start();
      try {
        await api.delete(`/instructors/${id}`);
        spinner.stop();
        printSuccess(`Instructor ${id} deleted`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
