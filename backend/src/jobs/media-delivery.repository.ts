import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { scheduledMediaDeliveries, mediaFiles, contacts } from '../../drizzle/schema';

@Injectable()
export class MediaDeliveryRepository {
  constructor(private db: DatabaseService) {}

  findEntregaById(id: string) {
    return this.db.db
      .select()
      .from(scheduledMediaDeliveries)
      .where(eq(scheduledMediaDeliveries.id, id))
      .limit(1);
  }

  findMidiaById(id: string) {
    return this.db.db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, id))
      .limit(1);
  }

  findContatoById(id: string) {
    return this.db.db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);
  }

  updateEntrega(id: string, data: Partial<typeof scheduledMediaDeliveries.$inferInsert>) {
    return this.db.db
      .update(scheduledMediaDeliveries)
      .set(data)
      .where(eq(scheduledMediaDeliveries.id, id));
  }
}
