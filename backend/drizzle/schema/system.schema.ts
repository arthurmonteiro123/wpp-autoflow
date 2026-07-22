import { pgTable, uuid, varchar, text, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { adminUsers } from './auth.schema';

export const auditActionEnum = pgEnum('acao_auditoria_enum', [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'DISPATCH',
]);

export const systemParams = pgTable('parametro_sistema', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('chave', { length: 100 }).notNull().unique(),
  value: text('valor').notNull(),
  description: text('descricao'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const auditLog = pgTable('auditoria_sistema', {
  id: uuid('id').defaultRandom().primaryKey(),
  entity: varchar('entidade', { length: 100 }).notNull(),
  entityId: varchar('entidade_id', { length: 255 }).notNull(),
  action: auditActionEnum('acao').notNull(),
  previousData: jsonb('dados_anteriores'),
  newData: jsonb('dados_novos'),
  userId: uuid('usuario_id').references(() => adminUsers.id),
  sourceIp: varchar('ip_origem', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type SystemParam = typeof systemParams.$inferSelect;
export type NewSystemParam = typeof systemParams.$inferInsert;
export type AuditLog = typeof auditLog.$inferSelect;
