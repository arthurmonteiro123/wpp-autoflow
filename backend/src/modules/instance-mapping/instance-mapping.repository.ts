import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { instanceStarMappings } from '../../../drizzle/schema';

@Injectable()
export class InstanceMappingRepository {
  constructor(private db: DatabaseService) {}

  findAll() {
    return this.db.db.select().from(instanceStarMappings);
  }

  async findActiveForStarRating(starRating: string) {
    const all = await this.db.db
      .select()
      .from(instanceStarMappings)
      .where(eq(instanceStarMappings.active, true));

    return all.filter((m) => m.starRatings.includes(starRating));
  }

  upsert(instanceRole: string, starRatings: string[]) {
    return this.db.db
      .insert(instanceStarMappings)
      .values({ instanceRole: instanceRole as any, starRatings, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: instanceStarMappings.instanceRole,
        set: { starRatings, active: true, updatedAt: new Date() },
      });
  }

  setActive(instanceRole: string, active: boolean) {
    return this.db.db
      .update(instanceStarMappings)
      .set({ active, updatedAt: new Date() })
      .where(eq(instanceStarMappings.instanceRole, instanceRole as any));
  }
}
