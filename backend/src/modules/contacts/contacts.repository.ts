import { Injectable } from '@nestjs/common';
import { eq, isNull, or, lt, and, desc } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { contacts, messageLogs } from '../../../drizzle/schema';

@Injectable()
export class ContactsRepository {
  constructor(private db: DatabaseService) {}

  findByNumero(numero: string) {
    return this.db.db
      .select()
      .from(contacts)
      .where(eq(contacts.phoneNumber, numero))
      .limit(1);
  }

  async findAllPaginated(
    filters: {
      starLevel?: number;
      engagementStatus?: string;
      somenteSemCooldown?: boolean;
    },
    pagina: number,
    limite: number,
  ) {
    const offset = (pagina - 1) * limite;
    const conditions: any[] = [isNull(contacts.deletedAt)];

    if (filters.starLevel) {
      conditions.push(eq(contacts.starLevel, filters.starLevel));
    }
    if (filters.engagementStatus) {
      conditions.push(eq(contacts.engagementStatus, filters.engagementStatus as any));
    }
    if (filters.somenteSemCooldown) {
      conditions.push(
        or(isNull(contacts.cooldownUntil), lt(contacts.cooldownUntil, new Date())),
      );
    }

    const where = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      this.db.db.select().from(contacts).where(where).limit(limite).offset(offset),
      this.db.db.select().from(contacts).where(where),
    ]);

    return { rows, total: totalRows.length };
  }

  findById(id: string) {
    return this.db.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
      .limit(1);
  }

  insert(data: typeof contacts.$inferInsert) {
    return this.db.db.insert(contacts).values(data).returning();
  }

  upsertFromCsv(data: typeof contacts.$inferInsert) {
    return this.db.db.insert(contacts).values(data).onConflictDoNothing();
  }

  update(id: string, data: Partial<typeof contacts.$inferInsert>) {
    return this.db.db
      .update(contacts)
      .set(data)
      .where(eq(contacts.id, id))
      .returning();
  }

  softDelete(id: string) {
    return this.db.db
      .update(contacts)
      .set({ deletedAt: new Date() })
      .where(eq(contacts.id, id));
  }

  findHistoricoByContatoId(contactId: string) {
    return this.db.db
      .select()
      .from(messageLogs)
      .where(eq(messageLogs.contactId, contactId))
      .orderBy(desc(messageLogs.createdAt))
      .limit(50);
  }
}
