import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  broadcastCampaigns,
  campaignDeliveries,
  systemParams,
} from '../../../drizzle/schema';

@Injectable()
export class CampaignsRepository {
  constructor(private db: DatabaseService) {}

  insert(data: typeof broadcastCampaigns.$inferInsert) {
    return this.db.db.insert(broadcastCampaigns).values(data).returning();
  }

  async findAllPaginated(pagina: number, limite: number) {
    const offset = (pagina - 1) * limite;

    const [rows, total] = await Promise.all([
      this.db.db.select().from(broadcastCampaigns).limit(limite).offset(offset),
      this.db.db.select().from(broadcastCampaigns),
    ]);

    return { rows, total: total.length };
  }

  findById(id: string) {
    return this.db.db
      .select()
      .from(broadcastCampaigns)
      .where(eq(broadcastCampaigns.id, id))
      .limit(1);
  }

  update(id: string, data: Partial<typeof broadcastCampaigns.$inferInsert>) {
    return this.db.db
      .update(broadcastCampaigns)
      .set(data)
      .where(eq(broadcastCampaigns.id, id))
      .returning();
  }

  findAllParams() {
    return this.db.db.select().from(systemParams);
  }

  findParamByChave(key: string) {
    return this.db.db
      .select()
      .from(systemParams)
      .where(eq(systemParams.key, key))
      .limit(1);
  }

  updateParam(key: string, value: string) {
    return this.db.db
      .update(systemParams)
      .set({ value, updatedAt: new Date() })
      .where(eq(systemParams.key, key))
      .returning();
  }

  insertEntrega(data: typeof campaignDeliveries.$inferInsert) {
    return this.db.db.insert(campaignDeliveries).values(data);
  }

  // Hard delete — campanha_produto (legado) e campanha_entrega caem junto via FK cascade
  delete(id: string) {
    return this.db.db
      .delete(broadcastCampaigns)
      .where(eq(broadcastCampaigns.id, id));
  }

  async findEntregasByCampanha(
    campaignId: string,
    pagina: number,
    limite: number,
  ) {
    const offset = (pagina - 1) * limite;

    const [rows, total] = await Promise.all([
      this.db.db
        .select()
        .from(campaignDeliveries)
        .where(eq(campaignDeliveries.campaignId, campaignId))
        .limit(limite)
        .offset(offset),
      this.db.db
        .select()
        .from(campaignDeliveries)
        .where(eq(campaignDeliveries.campaignId, campaignId)),
    ]);

    return { rows, total: total.length };
  }
}
