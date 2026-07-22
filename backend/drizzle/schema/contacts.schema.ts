import { pgTable, uuid, varchar, text, integer, decimal, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';

export const engagementStatusEnum = pgEnum('status_engajamento_enum', [
  'NOVO',
  'RESPONDEU',
  'INATIVO',
  'ATIVO',
  'BLOQUEADO',
]);

export const contacts = pgTable('contato', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('nome', { length: 255 }).notNull(),
  phoneNumber: varchar('numero_whatsapp', { length: 20 }).notNull().unique(),
  starLevel: integer('nivel_estrela').notNull().default(1),
  starLevelManual: boolean('nivel_estrela_manual').notNull().default(false),
  totalSpent: decimal('total_gasto', { precision: 12, scale: 2 }).notNull().default('0'),
  engagementStatus: engagementStatusEnum('status_engajamento').notNull().default('NOVO'),
  lastMessageAt: timestamp('ultima_mensagem_em'),
  lastOrderAt: timestamp('ultimo_pedido_em'),
  cooldownUntil: timestamp('cooldown_ate'),
  notes: text('observacoes'),
  address: text('endereco'),
  socialMedia: varchar('rede_social', { length: 255 }),
  owesDebt: boolean('deve').notNull().default(false),
  debtAmount: decimal('valor_devido', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
