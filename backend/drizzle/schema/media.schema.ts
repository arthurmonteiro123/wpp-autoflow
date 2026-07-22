import { pgTable, uuid, varchar, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { contacts } from './contacts.schema';
import { adminUsers } from './auth.schema';

export const fileMediaTypeEnum = pgEnum('tipo_midia_arquivo_enum', [
  'IMAGEM',
  'VIDEO',
  'AUDIO',
  'DOCUMENTO',
]);
export const mediaDeliveryStatusEnum = pgEnum('status_entrega_midia_enum', [
  'PENDENTE',
  'ENVIADO',
  'ERRO',
  'CANCELADO',
]);

export const mediaFiles = pgTable('midia', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('nome', { length: 255 }).notNull(),
  type: fileMediaTypeEnum('tipo').notNull(),
  url: text('url').notNull(),
  sizeBytes: integer('tamanho_bytes').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  createdBy: uuid('criado_por').references(() => adminUsers.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const scheduledMediaDeliveries = pgTable('entrega_midia_agendada', {
  id: uuid('id').defaultRandom().primaryKey(),
  contactId: uuid('contato_id').notNull().references(() => contacts.id),
  mediaId: uuid('midia_id').notNull().references(() => mediaFiles.id),
  caption: text('caption'),
  scheduledFor: timestamp('agendado_para').notNull(),
  status: mediaDeliveryStatusEnum('status').notNull().default('PENDENTE'),
  sentAt: timestamp('enviado_em'),
  errorDetails: text('erro_detalhes'),
  createdBy: uuid('criado_por').references(() => adminUsers.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type MediaFile = typeof mediaFiles.$inferSelect;
export type NewMediaFile = typeof mediaFiles.$inferInsert;
export type ScheduledMediaDelivery = typeof scheduledMediaDeliveries.$inferSelect;
