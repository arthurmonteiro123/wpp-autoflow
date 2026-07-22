import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role_enum', ['ADMIN', 'VENDEDOR', 'OPERADOR']);
export const statusUsuarioEnum = pgEnum('status_usuario_enum', ['ATIVO', 'INATIVO']);

export const adminUsers = pgTable('usuario_admin', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('nome', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('senha_hash').notNull(),
  role: roleEnum('role').notNull().default('OPERADOR'),
  status: statusUsuarioEnum('status').notNull().default('ATIVO'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const usuariosAdmin = adminUsers;

export type UsuarioAdmin = typeof adminUsers.$inferSelect;
export type NewUsuarioAdmin = typeof adminUsers.$inferInsert;
