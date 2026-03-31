import chalk from 'chalk';
import Table from 'cli-table3';

export function printTable(headers: string[], rows: (string | number | null | undefined)[][]): void {
  const table = new Table({
    head: headers.map(h => chalk.cyan(h)),
    style: { head: [], border: [] },
  });

  for (const row of rows) {
    table.push(row.map(cell => cell == null ? '' : String(cell)));
  }

  console.log(table.toString());
}

export function printJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printSuccess(msg: string): void {
  console.log(chalk.green('✔') + ' ' + msg);
}

export function printError(msg: string): void {
  console.error(chalk.red('✘') + ' ' + msg);
}

export function printWarning(msg: string): void {
  console.log(chalk.yellow('⚠') + ' ' + msg);
}

export function printInfo(msg: string): void {
  console.log(chalk.cyan('ℹ') + ' ' + msg);
}

export function truncate(str: string, maxLen = 40): string {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str;
}
