import { Injectable } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { orders, contacts, systemParams } from '../../../drizzle/schema';

@Injectable()
export class OrdersRepository {
  constructor(private db: DatabaseService) {}

  insert(data: typeof orders.$inferInsert) {
    return this.db.db.insert(orders).values(data).returning();
  }

  async findAllPaginated(pagina: number, limite: number) {
    const offset = (pagina - 1) * limite;

    const [rows, total] = await Promise.all([
      this.db.db.select().from(orders).limit(limite).offset(offset),
      this.db.db.select().from(orders),
    ]);

    return { rows, total: total.length };
  }

  findById(id: string) {
    return this.db.db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);
  }

  update(id: string, data: Partial<typeof orders.$inferInsert>) {
    return this.db.db
      .update(orders)
      .set(data)
      .where(eq(orders.id, id))
      .returning();
  }

  findContatoById(id: string) {
    return this.db.db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);
  }

  updateContato(id: string, data: Partial<typeof contacts.$inferInsert>) {
    return this.db.db
      .update(contacts)
      .set(data)
      .where(eq(contacts.id, id));
  }

  async sumTotalGastoContato(contactId: string): Promise<number> {
    const [row] = await this.db.db
      .select({ total: sql<string>`coalesce(sum(${orders.estimatedTotal}), 0)` })
      .from(orders)
      .where(
        and(
          eq(orders.contactId, contactId),
          eq(orders.status, 'FECHADO'),
        ),
      );
    return parseFloat(row?.total ?? '0');
  }

  findParamByChave(key: string) {
    return this.db.db
      .select()
      .from(systemParams)
      .where(eq(systemParams.key, key))
      .limit(1);
  }
}
