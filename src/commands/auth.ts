import { Command } from 'commander';
import { loadConfig, saveConfig, getCurrentSite } from '../lib/config';
import { printSuccess, printError, printInfo, printTable } from '../lib/output';

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Manage authentication');

  auth
    .command('login')
    .description('Authenticate with a Thinkific site')
    .requiredOption('--token <token>', 'API key')
    .requiredOption('--subdomain <subdomain>', 'Site subdomain')
    .action((opts: { token: string; subdomain: string }) => {
      const config = loadConfig();
      config.sites[opts.subdomain] = { token: opts.token, subdomain: opts.subdomain };
      config.current = opts.subdomain;
      saveConfig(config);
      printSuccess(`Authenticated as ${opts.subdomain}`);
    });

  auth
    .command('status')
    .description('Show current authentication status')
    .action(() => {
      const envToken = process.env.THINKIFIC_OAUTH_TOKEN;
      const envSub = process.env.THINKIFIC_SUBDOMAIN;
      if (envToken && envSub) {
        printInfo(`Using env vars: subdomain=${envSub}`);
        return;
      }

      const config = loadConfig();
      if (!config.current) {
        printError('Not authenticated. Run: thinkific auth login');
        return;
      }

      printInfo(`Current site: ${config.current}`);
      const subs = Object.keys(config.sites);
      if (subs.length > 1) {
        printTable(['Subdomain', 'Active'], subs.map(s => [s, s === config.current ? '✔' : '']));
      }
    });

  auth
    .command('logout')
    .description('Remove stored credentials')
    .option('--force', 'Skip confirmation')
    .action(async (opts: { force?: boolean }) => {
      if (!opts.force) {
        const { confirm } = await import('../lib/prompts');
        const yes = await confirm('Remove all stored credentials?');
        if (!yes) {
          printInfo('Cancelled');
          return;
        }
      }
      saveConfig({ current: '', sites: {} });
      printSuccess('Logged out');
    });

  auth
    .command('switch')
    .description('Switch active site')
    .requiredOption('--subdomain <subdomain>', 'Site subdomain to switch to')
    .action((opts: { subdomain: string }) => {
      const config = loadConfig();
      if (!config.sites[opts.subdomain]) {
        printError(`Site "${opts.subdomain}" not found. Login first.`);
        return;
      }
      config.current = opts.subdomain;
      saveConfig(config);
      printSuccess(`Switched to ${opts.subdomain}`);
    });
}
