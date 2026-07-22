import { Injectable } from '@nestjs/common';
import { eq, isNull, or, lt, inArray, and } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  systemParams,
  contacts,
  conversationFlows,
  flowSteps,
  products,
  productPriceTable,
} from '../../drizzle/schema';

@Injectable()
export class PulseRepository {
  constructor(private db: DatabaseService) {}

  findParamByChave(key: string) {
    return this.db.db
      .select()
      .from(systemParams)
      .where(eq(systemParams.key, key))
      .limit(1);
  }

  findAllParams() {
    return this.db.db.select().from(systemParams);
  }

  findEligibleContacts(max: number) {
    return this.db.db
      .select()
      .from(contacts)
      .where(
        and(
          isNull(contacts.deletedAt),
          inArray(contacts.engagementStatus, ['NOVO', 'INATIVO']),
          or(isNull(contacts.cooldownUntil), lt(contacts.cooldownUntil, new Date())),
        ),
      )
      .limit(max);
  }

  findActiveFlowByStarLevel(starLevel: string) {
    return this.db.db
      .select()
      .from(conversationFlows)
      .where(
        and(
          eq(conversationFlows.starRating, starLevel as any),
          eq(conversationFlows.active, true),
        ),
      )
      .limit(1);
  }

  findStepsByFlowId(flowId: string) {
    return this.db.db
      .select()
      .from(flowSteps)
      .where(eq(flowSteps.flowId, flowId))
      .orderBy(flowSteps.order);
  }

  findProdutoById(id: string) {
    return this.db.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
  }

  findPricesByProduto(productId: string) {
    return this.db.db
      .select()
      .from(productPriceTable)
      .where(eq(productPriceTable.productId, productId));
  }

  updateContato(id: string, data: Partial<typeof contacts.$inferInsert>) {
    return this.db.db
      .update(contacts)
      .set(data)
      .where(eq(contacts.id, id));
  }
}
