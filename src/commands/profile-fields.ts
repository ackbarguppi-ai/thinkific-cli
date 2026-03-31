import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printError } from '../lib/output';

export function registerProfileFieldsCommands(program: Command): void {
  const pf = program.command('profile-fields').description('Manage profile field definitions');

  pf
    .command('list')
    .description('List all profile field definitions')
    .action(async () => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching profile fields...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>('/custom_profile_field_definitions');
        spinner.stop();
        const items = res.items || [];
        printTable(
          ['ID', 'Label', 'Field Type', 'Required'],
          items.map(f => [
            f.id as number,
            f.label as string,
            f.field_type as string ?? '',
            f.required ? 'Yes' : 'No',
          ]),
        );
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
