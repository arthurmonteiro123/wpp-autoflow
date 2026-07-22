import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  broadcastCampaigns,
  campaignDeliveries,
  systemParams,
  contacts,
} from '../../drizzle/schema';

@Injectable()
export class BroadcastRepository {
  constructor(private db: DatabaseService) {}

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

  findParamByChave(key: string) {
    return this.db.db
      .select()
      .from(systemParams)
      .where(eq(systemParams.key, key))
      .limit(1);
  }

  async findContatosFiltrados(targetStarRating?: string | null, targetStatus?: string | null) {
    let list = await this.db.db.select().from(contacts);

    if (targetStarRating) {
      list = list.filter((c) => String(c.starLevel) === targetStarRating);
    }
    if (targetStatus) {
      list = list.filter((c) => c.engagementStatus === targetStatus);
    }
    list = list.filter((c) => c.deletedAt === null);

    return list;
  }

  insertEntrega(data: typeof campaignDeliveries.$inferInsert) {
    return this.db.db.insert(campaignDeliveries).values(data);
  }
}
