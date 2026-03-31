#!/usr/bin/env node

import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth';
import { registerCoursesCommands } from './commands/courses';
import { registerUsersCommands } from './commands/users';
import { registerEnrollmentsCommands } from './commands/enrollments';
import { registerOrdersCommands } from './commands/orders';
import { registerProductsCommands } from './commands/products';
import { registerBundlesCommands } from './commands/bundles';
import { registerGroupsCommands } from './commands/groups';
import { registerPromotionsCommands } from './commands/promotions';
import { registerCouponsCommands } from './commands/coupons';
import { registerCategoriesCommands } from './commands/categories';
import { registerInstructorsCommands } from './commands/instructors';
import { registerReviewsCommands } from './commands/reviews';
import { registerSiteCommands } from './commands/site';
import { registerPublishRequestsCommands } from './commands/publish-requests';
import { registerExternalOrdersCommands } from './commands/external-orders';
import { registerProfileFieldsCommands } from './commands/profile-fields';
import { registerPerformanceCommands } from './commands/performance';

const program = new Command();

program
  .name('thinkific')
  .description('CLI for the Thinkific API')
  .version('1.0.0');

registerAuthCommands(program);
registerCoursesCommands(program);
registerUsersCommands(program);
registerEnrollmentsCommands(program);
registerOrdersCommands(program);
registerProductsCommands(program);
registerBundlesCommands(program);
registerGroupsCommands(program);
registerPromotionsCommands(program);
registerCouponsCommands(program);
registerCategoriesCommands(program);
registerInstructorsCommands(program);
registerReviewsCommands(program);
registerSiteCommands(program);
registerPublishRequestsCommands(program);
registerExternalOrdersCommands(program);
registerProfileFieldsCommands(program);
registerPerformanceCommands(program);

program.parse();
