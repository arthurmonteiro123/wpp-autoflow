import { Injectable } from '@nestjs/common';
import { eq, and, isNull, notInArray } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  broadcastCampaigns,
  products,
  productPriceTable,
  contacts,
  systemParams,
} from '../../drizzle/schema';
import { CampaignCatalogProduct } from './campaign-catalog.util';

@Injectable()
export class RecurringCampaignRepository {
  constructor(private db: DatabaseService) {}

  findParamByChave(key: string) {
    return this.db.db
      .select()
      .from(systemParams)
      .where(eq(systemParams.key, key))
      .limit(1);
  }

  findCampanhaById(id: string) {
    return this.db.db
      .select()
      .from(broadcastCampaigns)
      .where(eq(broadcastCampaigns.id, id))
      .limit(1);
  }

  updateCampanha(id: string, data: Partial<typeof broadcastCampaigns.$inferInsert>) {
    return this.db.db
      .update(broadcastCampaigns)
      .set(data)
      .where(eq(broadcastCampaigns.id, id))
      .returning();
  }

  /**
   * Todos os produtos ativos com pelo menos 1 faixa de preço cadastrada (qualquer
   * tier) — sem depender de curadoria manual por campanha. O filtro pelo tier do
   * lead acontece depois, por contato, em buildCatalogMessage.
   */
  async findActiveProductsWithPrices(): Promise<CampaignCatalogProduct[]> {
    const prices = await this.db.db.select().from(productPriceTable);
    if (prices.length === 0) return [];

    const productIds = new Set(prices.map((p) => p.productId));

    const activeProducts = await this.db.db
      .select()
      .from(products)
      .where(and(eq(products.status, 'ATIVO'), isNull(products.deletedAt)));

    return activeProducts
      .filter((product) => productIds.has(product.id))
      .map((product) => ({
        product,
        priceEntries: prices.filter((p) => p.productId === product.id),
      }));
  }

  /**
   * Segmento avaliado ao vivo a cada ciclo. Exclui sempre RESPONDEU/ATIVO/BLOQUEADO
   * (pausa por resposta — seção 3.2 do slice), não é uma opção configurável.
   */
  findContatosFiltrados(targetStarRating?: string | null) {
    const conditions = [
      isNull(contacts.deletedAt),
      notInArray(contacts.engagementStatus, ['RESPONDEU', 'ATIVO', 'BLOQUEADO']),
    ];

    if (targetStarRating) {
      conditions.push(eq(contacts.starLevel, parseInt(targetStarRating, 10)));
    }

    return this.db.db
      .select()
      .from(contacts)
      .where(and(...conditions));
  }
}
