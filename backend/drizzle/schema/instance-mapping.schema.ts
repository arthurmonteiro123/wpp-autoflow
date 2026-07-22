import { pgTable, uuid, boolean, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const instanceRoleEnum = pgEnum('instance_role_enum', [
  'shelby',
  'moritz',
  'cobrador',
  'prospectador',
]);

// Each instance role declares which star ratings it handles (A, B, C — future: STAR_1, STAR_2, STAR_3)
export const instanceStarMappings = pgTable('instance_star_mapping', {
  id: uuid('id').defaultRandom().primaryKey(),
  instanceRole: instanceRoleEnum('instance_role').notNull().unique(),
  starRatings: text('star_ratings').array().notNull().default([]),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type InstanceStarMapping = typeof instanceStarMappings.$inferSelect;
export type NewInstanceStarMapping = typeof instanceStarMappings.$inferInsert;
