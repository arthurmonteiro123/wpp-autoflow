import { Injectable } from '@nestjs/common';
import { eq, isNull, and } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  productCategories,
  products,
  productPriceTable,
  productMedia,
  mediaFiles,
} from '../../../drizzle/schema';

@Injectable()
export class ProductsRepository {
  constructor(private db: DatabaseService) {}

  // --- Categories ---

  createCategoria(data: typeof productCategories.$inferInsert) {
    return this.db.db.insert(productCategories).values(data).returning();
  }

  findAllCategorias() {
    return this.db.db
      .select()
      .from(productCategories)
      .where(isNull(productCategories.deletedAt));
  }

  findCategoriaById(id: string) {
    return this.db.db
      .select()
      .from(productCategories)
      .where(and(eq(productCategories.id, id), isNull(productCategories.deletedAt)))
      .limit(1);
  }

  updateCategoria(id: string, data: Partial<typeof productCategories.$inferInsert>) {
    return this.db.db
      .update(productCategories)
      .set(data)
      .where(eq(productCategories.id, id))
      .returning();
  }

  softDeleteCategoria(id: string) {
    return this.db.db
      .update(productCategories)
      .set({ deletedAt: new Date() })
      .where(eq(productCategories.id, id));
  }

  // --- Products ---

  createProduto(data: typeof products.$inferInsert) {
    return this.db.db.insert(products).values(data).returning();
  }

  async findAllProdutos(pagina: number, limite: number) {
    const offset = (pagina - 1) * limite;

    const [rows, total] = await Promise.all([
      this.db.db
        .select({
          id: products.id,
          name: products.name,
          categoryId: products.categoryId,
          categoryName: productCategories.name,
          description: products.description,
          unit: products.unit,
          status: products.status,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(isNull(products.deletedAt))
        .limit(limite)
        .offset(offset),
      this.db.db.select().from(products).where(isNull(products.deletedAt)),
    ]);

    return { rows, total: total.length };
  }

  findProdutoById(id: string) {
    return this.db.db
      .select({
        id: products.id,
        name: products.name,
        categoryId: products.categoryId,
        categoryName: productCategories.name,
        description: products.description,
        unit: products.unit,
        status: products.status,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .limit(1);
  }

  updateProduto(id: string, data: Partial<typeof products.$inferInsert>) {
    return this.db.db
      .update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();
  }

  softDeleteProduto(id: string) {
    return this.db.db
      .update(products)
      .set({ deletedAt: new Date() })
      .where(eq(products.id, id));
  }

  // --- Price Table ---

  insertPriceEntry(data: typeof productPriceTable.$inferInsert) {
    return this.db.db.insert(productPriceTable).values(data).returning();
  }

  findPricesByProduto(productId: string) {
    return this.db.db
      .select()
      .from(productPriceTable)
      .where(eq(productPriceTable.productId, productId));
  }

  findPriceEntryById(id: string) {
    return this.db.db
      .select()
      .from(productPriceTable)
      .where(eq(productPriceTable.id, id))
      .limit(1);
  }

  updatePriceEntry(id: string, data: Partial<typeof productPriceTable.$inferInsert>) {
    return this.db.db
      .update(productPriceTable)
      .set(data)
      .where(eq(productPriceTable.id, id))
      .returning();
  }

  deletePriceEntry(id: string) {
    return this.db.db
      .delete(productPriceTable)
      .where(eq(productPriceTable.id, id))
      .returning();
  }

  // --- Media ---

  findMediaFileById(id: string) {
    return this.db.db
      .select()
      .from(mediaFiles)
      .where(and(eq(mediaFiles.id, id), isNull(mediaFiles.deletedAt)))
      .limit(1);
  }

  insertProductMedia(data: typeof productMedia.$inferInsert) {
    return this.db.db.insert(productMedia).values(data).returning();
  }

  findProductMediaByProduto(productId: string) {
    return this.db.db
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, productId))
      .orderBy(productMedia.order);
  }

  findProductMediaById(id: string) {
    return this.db.db
      .select()
      .from(productMedia)
      .where(eq(productMedia.id, id))
      .limit(1);
  }

  deleteProductMedia(id: string) {
    return this.db.db
      .delete(productMedia)
      .where(eq(productMedia.id, id))
      .returning();
  }
}
