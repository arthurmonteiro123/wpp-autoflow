import { pgTable, uuid, varchar, text, decimal, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const productStatusEnum = pgEnum('status_produto_enum', ['ATIVO', 'INATIVO']);
export const mediaTypeEnum = pgEnum('tipo_midia_enum', ['IMAGEM', 'VIDEO', 'AUDIO', 'DOCUMENTO']);
export const productTierEnum = pgEnum('tipo_cliente_enum', ['A', 'B', 'C', 'TODOS']);
export const starRatingMediaEnum = pgEnum('tipo_cliente_midia_enum', ['A', 'B', 'C', 'TODOS']);

export const productCategories = pgTable('categoria_produto', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('nome', { length: 255 }).notNull(),
  status: productStatusEnum('status').notNull().default('ATIVO'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const products = pgTable('produto', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('nome', { length: 255 }).notNull(),
  categoryId: uuid('categoria_id').references(() => productCategories.id),
  description: text('descricao'),
  unit: varchar('unidade', { length: 50 }).notNull(),
  status: productStatusEnum('status').notNull().default('ATIVO'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const productPriceTable = pgTable('produto_tabela_preco', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('produto_id').notNull().references(() => products.id),
  starRating: productTierEnum('tipo_cliente').notNull(),
  minQuantity: decimal('quantidade_min', { precision: 12, scale: 3 }).notNull(),
  maxQuantity: decimal('quantidade_max', { precision: 12, scale: 3 }),
  unitPrice: decimal('preco_unitario', { precision: 12, scale: 2 }).notNull(),
  maxDiscountPct: decimal('desconto_maximo_pct', { precision: 5, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const productMedia = pgTable('produto_midia', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('produto_id').notNull().references(() => products.id),
  starRating: starRatingMediaEnum('tipo_cliente').notNull().default('TODOS'),
  mediaType: mediaTypeEnum('tipo_midia').notNull(),
  url: text('url').notNull(),
  caption: text('caption'),
  order: integer('ordem').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductCategory = typeof productCategories.$inferSelect;
export type ProductPriceTable = typeof productPriceTable.$inferSelect;
export type ProductMedia = typeof productMedia.$inferSelect;
