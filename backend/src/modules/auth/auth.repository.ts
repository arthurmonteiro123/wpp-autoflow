import { Injectable } from '@nestjs/common';
import { eq, isNull, and } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { adminUsers } from '../../../drizzle/schema/auth.schema';

@Injectable()
export class AuthRepository {
  constructor(private db: DatabaseService) {}

  findByEmail(email: string) {
    return this.db.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email));
  }

  findByIdActive(id: string) {
    return this.db.db
      .select()
      .from(adminUsers)
      .where(and(eq(adminUsers.id, id), isNull(adminUsers.deletedAt)));
  }

  findAllActive() {
    return this.db.db
      .select()
      .from(adminUsers)
      .where(isNull(adminUsers.deletedAt));
  }

  insert(data: typeof adminUsers.$inferInsert) {
    return this.db.db.insert(adminUsers).values(data).returning();
  }

  update(id: string, data: Partial<typeof adminUsers.$inferInsert>) {
    return this.db.db
      .update(adminUsers)
      .set(data)
      .where(and(eq(adminUsers.id, id), isNull(adminUsers.deletedAt)))
      .returning();
  }

  softDelete(id: string) {
    return this.db.db
      .update(adminUsers)
      .set({ deletedAt: new Date() })
      .where(and(eq(adminUsers.id, id), isNull(adminUsers.deletedAt)))
      .returning();
  }
}
