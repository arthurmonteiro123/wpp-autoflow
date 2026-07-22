import { pgTable, uuid, text, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { contacts } from './contacts.schema';

export const messageDirectionEnum = pgEnum('direcao_mensagem_enum', ['ENVIADA', 'RECEBIDA']);
export const messageTypeEnum = pgEnum('tipo_mensagem_enum', [
  'TEXTO',
  'IMAGEM',
  'VIDEO',
  'AUDIO',
  'DOCUMENTO',
  'BOTAO',
]);
export const messageStatusEnum = pgEnum('status_mensagem_enum', [
  'PENDENTE',
  'ENTREGUE',
  'LIDO',
  'ERRO',
]);

export const messageLogs = pgTable('mensagem_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  contactId: uuid('contato_id').references(() => contacts.id),
  direction: messageDirectionEnum('direcao').notNull(),
  type: messageTypeEnum('tipo').notNull(),
  content: text('conteudo').notNull(),
  status: messageStatusEnum('status').notNull().default('PENDENTE'),
  evolutionId: text('evolution_id'),
  errorDetails: jsonb('erro_detalhes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type MessageLog = typeof messageLogs.$inferSelect;
export type NewMessageLog = typeof messageLogs.$inferInsert;
