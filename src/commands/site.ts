import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, printSuccess } from '../lib/output';

export function registerSiteCommands(program: Command): void {
  const site = program.command('site').description('Site information and scripts');

  site
    .command('info')
    .description('Get site information')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const siteConfig = requireAuth();
      const api = new ThinkificAPI(siteConfig.token, siteConfig.subdomain);
      const spinner = ora('Fetching site info...').start();
      try {
        const info = await api.get<Record<string, unknown>>('/site');
        spinner.stop();
        if (opts.json) {
          printJSON(info);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(info)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  const scripts = site.command('scripts').description('Manage site scripts');

  scripts
    .command('list')
    .description('List site scripts')
    .action(async () => {
      const siteConfig = requireAuth();
      const api = new ThinkificAPI(siteConfig.token, siteConfig.subdomain);
      const spinner = ora('Fetching scripts...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>('/site_scripts');
        spinner.stop();
        const items = res.items || [];
        printTable(
          ['ID', 'Src', 'Location'],
          items.map(s => [s.id as number, s.src as string, s.location as string ?? '']),
        );
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  scripts
    .command('create')
    .description('Create a site script')
    .requiredOption('--src <url>', 'Script URL')
    .option('--location <location>', 'header or footer', 'footer')
    .action(async (opts) => {
      const siteConfig = requireAuth();
      const api = new ThinkificAPI(siteConfig.token, siteConfig.subdomain);
      const spinner = ora('Creating script...').start();
      try {
        const script = await api.post<Record<string, unknown>>('/site_scripts', {
          src: opts.src,
          location: opts.location,
        });
        spinner.stop();
        printSuccess(`Script created with ID ${script.id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  scripts
    .command('get <id>')
    .description('Get script details')
    .action(async (id: string) => {
      const siteConfig = requireAuth();
      const api = new ThinkificAPI(siteConfig.token, siteConfig.subdomain);
      const spinner = ora('Fetching script...').start();
      try {
        const script = await api.get<Record<string, unknown>>(`/site_scripts/${id}`);
        spinner.stop();
        printTable(
          ['Field', 'Value'],
          Object.entries(script)
            .filter(([, v]) => typeof v !== 'object')
            .map(([k, v]) => [k, String(v ?? '')]),
        );
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  scripts
    .command('update <id>')
    .description('Update a site script')
    .option('--src <url>', 'Script URL')
    .action(async (id: string, opts) => {
      const siteConfig = requireAuth();
      const api = new ThinkificAPI(siteConfig.token, siteConfig.subdomain);
      const spinner = ora('Updating script...').start();
      try {
        const body: Record<string, string> = {};
        if (opts.src) body.src = opts.src;
        await api.put(`/site_scripts/${id}`, body);
        spinner.stop();
        printSuccess(`Script ${id} updated`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  scripts
    .command('delete <id>')
    .description('Delete a site script')
    .action(async (id: string) => {
      const siteConfig = requireAuth();
      const api = new ThinkificAPI(siteConfig.token, siteConfig.subdomain);
      const spinner = ora('Deleting script...').start();
      try {
        await api.delete(`/site_scripts/${id}`);
        spinner.stop();
        printSuccess(`Script ${id} deleted`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
