import { Injectable } from '@nestjs/common';
import { eq, desc, or, inArray, and, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  systemParams,
  contacts,
  messageLogs,
  products,
  productPriceTable,
  productMedia,
} from '../../../drizzle/schema';

@Injectable()
export class AIRepository {
  constructor(private db: DatabaseService) {}

  async getParam(key: string): Promise<string | null> {
    const [row] = await this.db.db
      .select()
      .from(systemParams)
      .where(eq(systemParams.key, key))
      .limit(1);
    return row?.value ?? null;
  }

  findContactById(id: string) {
    return this.db.db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);
  }

  findRecentMessages(contactId: string, limit: number) {
    return this.db.db
      .select()
      .from(messageLogs)
      .where(eq(messageLogs.contactId, contactId))
      .orderBy(desc(messageLogs.createdAt))
      .limit(limit);
  }

  // Active products, for the AI prompt to pick from when the lead names a specific product
  findActiveProductsForPrompt() {
    return this.db.db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.status, 'ATIVO'), isNull(products.deletedAt)));
  }

  findActiveProductById(id: string) {
    return this.db.db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.status, 'ATIVO'), isNull(products.deletedAt)))
      .limit(1);
  }

  // Returns active products that have price entries for the given starRating OR for TODOS
  async findProductsWithPrices(starRating: string) {
    const prices = await this.db.db
      .select()
      .from(productPriceTable)
      .where(
        or(
          eq(productPriceTable.starRating, starRating as any),
          eq(productPriceTable.starRating, 'TODOS' as any),
        ),
      );

    if (prices.length === 0) return [];

    const productIds = [...new Set(prices.map((p) => p.productId))];

    const prods = await this.db.db
      .select()
      .from(products)
      .where(eq(products.status, 'ATIVO'));

    const eligible = prods.filter((p) => productIds.includes(p.id) && !p.deletedAt);

    return eligible.map((prod) => ({
      ...prod,
      prices: prices.filter((p) => p.productId === prod.id),
    }));
  }

  // Returns up to `limit` media items: those tagged for this specific starRating + those tagged TODOS
  findMediaByProduct(productId: string, starRating: string, limit = 4) {
    return this.db.db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.productId, productId),
          or(
            eq(productMedia.starRating, starRating as any),
            eq(productMedia.starRating, 'TODOS'),
          ),
        ),
      )
      .orderBy(productMedia.order)
      .limit(limit);
  }

  // Checks if a "Tabela de Preços" message was already sent to this contact in recent history
  async catalogAlreadySentRecently(contactId: string, withinMessages = 40): Promise<boolean> {
    const recent = await this.db.db
      .select()
      .from(messageLogs)
      .where(eq(messageLogs.contactId, contactId))
      .orderBy(desc(messageLogs.createdAt))
      .limit(withinMessages);

    return recent.some(
      (m) => m.direction === 'ENVIADA' && m.content?.includes('Tabela de Preços'),
    );
  }
}
