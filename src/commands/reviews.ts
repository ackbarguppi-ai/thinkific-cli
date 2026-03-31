import { Command } from 'commander';
import ora from 'ora';
import { requireAuth } from '../lib/config';
import { ThinkificAPI } from '../lib/api';
import { printTable, printJSON, printError, printSuccess, truncate } from '../lib/output';

export function registerReviewsCommands(program: Command): void {
  const reviews = program.command('reviews').description('Manage course reviews');

  reviews
    .command('list')
    .description('List reviews')
    .option('--course-id <id>', 'Filter by course ID')
    .option('--limit <n>', 'Items per page', '25')
    .option('--page <n>', 'Page number', '1')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching reviews...').start();
      try {
        const params: Record<string, string | number | undefined> = {
          limit: opts.limit,
          page: opts.page,
        };
        if (opts.courseId) params['query[course_id]'] = opts.courseId;
        const res = await api.get<{ items: Record<string, unknown>[] }>('/course_reviews', params);
        spinner.stop();
        const items = res.items || [];
        if (opts.json) {
          printJSON(items);
        } else {
          printTable(
            ['ID', 'User', 'Course', 'Rating', 'Title'],
            items.map(r => [
              r.id as number,
              r.user_id as number,
              r.course_id as number,
              r.rating as number,
              truncate((r.title as string) || '', 40),
            ]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  reviews
    .command('get <id>')
    .description('Get review details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const spinner = ora('Fetching review...').start();
      try {
        const review = await api.get<Record<string, unknown>>(`/course_reviews/${id}`);
        spinner.stop();
        if (opts.json) {
          printJSON(review);
        } else {
          printTable(
            ['Field', 'Value'],
            Object.entries(review)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => [k, String(v ?? '')]),
          );
        }
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });

  reviews
    .command('create')
    .description('Create a course review')
    .requiredOption('--course-id <id>', 'Course ID')
    .requiredOption('--user-id <id>', 'User ID')
    .requiredOption('--title <title>', 'Review title')
    .requiredOption('--review-body <body>', 'Review body text')
    .requiredOption('--rating <n>', 'Rating (1-5)')
    .action(async (opts) => {
      const site = requireAuth();
      const api = new ThinkificAPI(site.token, site.subdomain);
      const rating = parseInt(opts.rating, 10);
      if (rating < 1 || rating > 5) {
        printError('Rating must be between 1 and 5');
        return;
      }
      const spinner = ora('Creating review...').start();
      try {
        const review = await api.post<Record<string, unknown>>('/course_reviews', {
          course_id: parseInt(opts.courseId, 10),
          user_id: parseInt(opts.userId, 10),
          title: opts.title,
          review_body: opts.reviewBody,
          rating,
        });
        spinner.stop();
        printSuccess(`Review created with ID ${review.id}`);
      } catch (err) {
        spinner.stop();
        printError((err as Error).message);
      }
    });
}
