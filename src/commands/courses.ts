import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, truncate } from '../lib/output';

export function registerCoursesCommands(program: Command): void {
  const courses = program.command('courses').description('Manage courses');

  courses
    .command('list')
    .description('List all courses')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--json', 'Output as JSON')
    .option('--all', 'Fetch all pages')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching courses...').start();
      try {
        let items: Record<string, unknown>[];
        if (opts.all) {
          items = await api.getAll('/courses');
        } else {
          const res = await api.get<{ items: Record<string, unknown>[] }>('/courses', {
            limit: opts.limit,
            page: opts.page,
          });
          items = res.items || [];
        }
        spinner.stop();
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'Name', 'Slug', 'Status', 'Price'],
            items.map(c => [
              c.id as number,
              truncate(c.name as string, 50),
              c.slug as string,
              c.status as string,
              c.price as string ?? '',
            ]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  courses
    .command('get <id>')
    .description('Get course details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching course...').start();
      try {
        const course = await api.get<Record<string, unknown>>(`/courses/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(course);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(course)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v)]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  courses
    .command('chapters <id>')
    .description('List chapters for a course')
    .option('--limit <n>', 'Items per page', '25')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching chapters...').start();
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>(`/courses/${id}/chapters`, {
          limit: opts.limit,
        });
        spinner.stop();
        const items = res.items || [];
        printTable(
          ['ID', 'Name', 'Position', 'Content Count'],
          items.map(ch => [
            ch.id as number,
            truncate(ch.name as string, 50),
            ch.position as number,
            (ch.content_ids as unknown[])?.length ?? 0,
          ]),
        );
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
