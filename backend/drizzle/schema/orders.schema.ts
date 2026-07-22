import { pgTable, uuid, decimal, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { contacts } from './contacts.schema';

export const orderStatusEnum = pgEnum('status_pedido_enum', ['ABERTO', 'FECHADO', 'CANCELADO']);

export const orders = pgTable('pedido', {
  id: uuid('id').defaultRandom().primaryKey(),
  contactId: uuid('contato_id').notNull().references(() => contacts.id),
  status: orderStatusEnum('status').notNull().default('ABERTO'),
  items: jsonb('itens').notNull().default([]),
  estimatedTotal: decimal('total_estimado', { precision: 12, scale: 2 }),
  notes: text('observacoes'),
  closedAt: timestamp('fechado_em'),
  notifiedAt: timestamp('notificado_em'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
};
