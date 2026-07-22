import { pgTable, uuid, varchar, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { adminUsers } from './auth.schema';
import { contacts } from './contacts.schema';
import { products } from './products.schema';

export const campaignTypeEnum = pgEnum('tipo_campanha_enum', ['IMEDIATO', 'AGENDADO', 'RECORRENTE']);
export const campaignStatusEnum = pgEnum('status_campanha_enum', [
  'RASCUNHO',
  'AGENDADO',
  'EM_ANDAMENTO',
  'CONCLUIDO',
  'CANCELADO',
]);
export const deliveryStatusEnum = pgEnum('status_entrega_enum', ['PENDENTE', 'ENVIADO', 'ERRO']);
export const campaignMediaTypeEnum = pgEnum('tipo_midia_campanha_enum', ['IMAGEM', 'VIDEO', 'AUDIO', 'DOCUMENTO']);

export const broadcastCampaigns = pgTable('campanha_broadcast', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('nome', { length: 255 }).notNull(),
  type: campaignTypeEnum('tipo').notNull(),
  message: text('mensagem').notNull(),
  mediaUrl: text('midia_url'),
  mediaType: campaignMediaTypeEnum('midia_tipo'),
  targetStarRating: varchar('tipo_cliente_alvo', { length: 1 }),
  targetStatus: varchar('status_alvo', { length: 50 }),
  scheduledFor: timestamp('agendado_para'),
  bullJobId: varchar('bull_job_id', { length: 255 }),
  campaignStatus: campaignStatusEnum('status_campanha').notNull().default('RASCUNHO'),
  totalContacts: integer('total_contatos'),
  totalSent: integer('total_enviados').notNull().default(0),
  totalErrors: integer('total_erros').notNull().default(0),
  startAt: timestamp('inicio_em'),
  endAt: timestamp('termino_em'),
  repeatIntervalMinutes: integer('intervalo_repeticao_minutos'),
  totalCycles: integer('total_ciclos').notNull().default(0),
  lastCycleAt: timestamp('ultimo_ciclo_em'),
  createdBy: uuid('criado_por').references(() => adminUsers.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const campaignProducts = pgTable('campanha_produto', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campanha_id').notNull().references(() => broadcastCampaigns.id, { onDelete: 'cascade' }),
  productId: uuid('produto_id').notNull().references(() => products.id),
  order: integer('ordem').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const campaignDeliveries = pgTable('campanha_entrega', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campanha_id').notNull().references(() => broadcastCampaigns.id, { onDelete: 'cascade' }),
  contactId: uuid('contato_id').notNull().references(() => contacts.id),
  status: deliveryStatusEnum('status').notNull().default('PENDENTE'),
  errorDetails: text('erro_detalhes'),
  sentAt: timestamp('enviado_em'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type BroadcastCampaign = typeof broadcastCampaigns.$inferSelect;
export type NewBroadcastCampaign = typeof broadcastCampaigns.$inferInsert;
export type CampaignDelivery = typeof campaignDeliveries.$inferSelect;
export type CampaignProduct = typeof campaignProducts.$inferSelect;
export type NewCampaignProduct = typeof campaignProducts.$inferInsert;
