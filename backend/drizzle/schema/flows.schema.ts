import { pgTable, uuid, varchar, text, integer, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { products } from './products.schema';

export const flowTypeEnum = pgEnum('tipo_fluxo_enum', ['1', '2', '3', 'INATIVO', 'BROADCAST']);
export const stepTypeEnum = pgEnum('tipo_etapa_enum', ['TEXTO', 'MIDIA', 'TABELA_PRECO', 'DELAY']);
export const stepMediaTypeEnum = pgEnum('tipo_midia_etapa_enum', ['IMAGEM', 'VIDEO', 'AUDIO']);

export const conversationFlows = pgTable('fluxo_conversa', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('nome', { length: 255 }).notNull(),
  starRating: flowTypeEnum('tipo_cliente').notNull(),
  active: boolean('ativo').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const flowSteps = pgTable('etapa_fluxo', {
  id: uuid('id').defaultRandom().primaryKey(),
  flowId: uuid('fluxo_id').notNull().references(() => conversationFlows.id, { onDelete: 'cascade' }),
  order: integer('ordem').notNull(),
  type: stepTypeEnum('tipo').notNull(),
  textContent: text('conteudo_texto'),
  mediaUrl: text('midia_url'),
  mediaType: stepMediaTypeEnum('midia_tipo'),
  caption: text('caption'),
  productId: uuid('produto_id').references(() => products.id),
  delaySeconds: integer('delay_segundos'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type ConversationFlow = typeof conversationFlows.$inferSelect;
export type NewConversationFlow = typeof conversationFlows.$inferInsert;
export type FlowStep = typeof flowSteps.$inferSelect;
export type NewFlowStep = typeof flowSteps.$inferInsert;
