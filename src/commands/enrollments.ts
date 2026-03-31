import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, printSuccess, printInfo, truncate } from '../lib/output';

export function registerEnrollmentsCommands(program: Command): void {
  const enrollments = program.command('enrollments').description('Manage enrollments');

  enrollments
    .command('list')
    .description('List enrollments')
    .option('--user-id <id>', 'Filter by user ID')
    .option('--course-id <id>', 'Filter by course ID')
    .option('--email <email>', 'Filter by email')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--json', 'Output as JSON')
    .option('--all', 'Fetch all pages')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching enrollments...').start();
      try {
        const params: Record<string, string | number | undefined> = {
          limit: opts.limit,
          page: opts.page,
        };
        if (opts.userId) params['query[user_id]'] = opts.userId;
        if (opts.courseId) params['query[course_id]'] = opts.courseId;
        if (opts.email) params['query[email]'] = opts.email;

        let items: Record<string, unknown>[];
        if (opts.all) {
          items = await api.getAll('/enrollments', params);
        } else {
          const res = await api.get<{ items: Record<string, unknown>[] }>('/enrollments', params);
          items = res.items || [];
        }
        spinner.stop();
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'User ID', 'Course ID', 'Course Name', 'Completed', 'Expires'],
            items.map(e => [
              e.id as number,
              e.user_id as number,
              e.course_id as number,
              truncate((e.course_name as string) || '', 40),
              e.completed ? 'Yes' : 'No',
              (e.expiry_date as string) || 'Never',
            ]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  enrollments
    .command('get <id>')
    .description('Get enrollment details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching enrollment...').start();
      try {
        const enrollment = await api.get<Record<string, unknown>>(`/enrollments/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(enrollment);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(enrollment)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  enrollments
    .command('create')
    .description('Create an enrollment')
    .requiredOption('--course-id <id>', 'Course ID')
    .requiredOption('--user-id <id>', 'User ID')
    .option('--activated-at <date>', 'Activation date (ISO 8601)')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Creating enrollment...').start();
      try {
        const body: Record<string, unknown> = {
          course_id: parseInt(opts.courseId, 10),
          user_id: parseInt(opts.userId, 10),
        };
        if (opts.activatedAt) body.activated_at = opts.activatedAt;
        const enrollment = await api.post<Record<string, unknown>>('/enrollments', body);
        spinner.stop();
        printSuccess(`Enrollment created with ID ${enrollment.id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  enrollments
    .command('update <id>')
    .description('Update an enrollment')
    .option('--completed', 'Mark as completed')
    .option('--expiry-date <date>', 'Set expiry date (ISO 8601)')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Updating enrollment...').start();
      try {
        const body: Record<string, unknown> = {};
        if (opts.completed) body.completed = true;
        if (opts.expiryDate) body.expiry_date = opts.expiryDate;
        await api.put(`/enrollments/${id}`, body);
        spinner.stop();
        printSuccess(`Enrollment ${id} updated`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  enrollments
    .command('bulk')
    .description('Bulk enroll all users from a company into a course')
    .requiredOption('--course-id <id>', 'Course ID')
    .requiredOption('--company <name>', 'Company name')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora(`Fetching users from company "${opts.company}"...`).start();
      try {
        const users = await api.getAll<Record<string, unknown>>('/users', {
          'query[company]': opts.company,
        });
        spinner.text = `Enrolling ${users.length} users...`;

        let enrolled = 0;
        let failed = 0;
        for (const user of users) {
          try {
            await api.post('/enrollments', {
              course_id: parseInt(opts.courseId, 10),
              user_id: user.id,
            });
            enrolled++;
          } catch {
            failed++;
          }
        }
        spinner.stop();
        printSuccess(`Enrolled ${enrolled} users (${failed} failed)`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
