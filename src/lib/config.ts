import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SiteConfig {
  token: string;
  subdomain: string;
}

export interface Config {
  current: string;
  sites: Record<string, SiteConfig>;
}

const CONFIG_DIR = path.join(os.homedir(), '.thinkific');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadConfig(): Config {
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data) as Config;
  } catch {
    return { current: '', sites: {} };
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function getCurrentSite(): SiteConfig | null {
  const envToken = process.env.THINKIFIC_OAUTH_TOKEN;
  const envSubdomain = process.env.THINKIFIC_SUBDOMAIN;

  if (envToken && envSubdomain) {
    return { token: envToken, subdomain: envSubdomain };
  }

  const config = loadConfig();
  if (!config.current || !config.sites[config.current]) {
    return null;
  }
  return config.sites[config.current];
}

export function requireAuth(): SiteConfig {
  const site = getCurrentSite();
  if (!site) {
    console.error('Not authenticated. Run: thinkific auth login --token <token> --subdomain <subdomain>');
    process.exit(1);
  }
  return site;
}
