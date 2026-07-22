import { Injectable } from '@nestjs/common';
import { eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { mediaFiles, scheduledMediaDeliveries, contacts } from '../../../drizzle/schema';

@Injectable()
export class MediaRepository {
  constructor(private db: DatabaseService) {}

  insertMidia(data: typeof mediaFiles.$inferInsert) {
    return this.db.db.insert(mediaFiles).values(data).returning();
  }

  findAllMidias() {
    return this.db.db.select().from(mediaFiles).where(isNull(mediaFiles.deletedAt));
  }

  findMidiaById(id: string) {
    return this.db.db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, id))
      .limit(1);
  }

  softDeleteMidia(id: string) {
    return this.db.db
      .update(mediaFiles)
      .set({ deletedAt: new Date() })
      .where(eq(mediaFiles.id, id));
  }

  insertEntrega(data: typeof scheduledMediaDeliveries.$inferInsert) {
    return this.db.db.insert(scheduledMediaDeliveries).values(data).returning();
  }

  async findAllEntregasPaginated(pagina: number, limite: number) {
    const offset = (pagina - 1) * limite;

    const [rows, total] = await Promise.all([
      this.db.db
        .select()
        .from(scheduledMediaDeliveries)
        .limit(limite)
        .offset(offset),
      this.db.db.select().from(scheduledMediaDeliveries),
    ]);

    return { rows, total: total.length };
  }

  findEntregaById(id: string) {
    return this.db.db
      .select()
      .from(scheduledMediaDeliveries)
      .where(eq(scheduledMediaDeliveries.id, id))
      .limit(1);
  }

  updateEntrega(id: string, data: Partial<typeof scheduledMediaDeliveries.$inferInsert>) {
    return this.db.db
      .update(scheduledMediaDeliveries)
      .set(data)
      .where(eq(scheduledMediaDeliveries.id, id))
      .returning();
  }

  findContatoById(id: string) {
    return this.db.db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);
  }
}
