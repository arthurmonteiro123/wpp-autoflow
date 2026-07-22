import { Injectable } from '@nestjs/common';
import { eq, asc, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  conversationFlows,
  flowSteps,
  contacts,
  productPriceTable,
  products,
} from '../../../drizzle/schema';

@Injectable()
export class FlowsRepository {
  constructor(private db: DatabaseService) {}

  createFlow(data: typeof conversationFlows.$inferInsert) {
    return this.db.db.insert(conversationFlows).values(data).returning();
  }

  findActiveByTipo(starRating: string) {
    return this.db.db
      .select()
      .from(conversationFlows)
      .where(
        sql`${conversationFlows.starRating} = ${starRating} AND ${conversationFlows.active} = true`,
      )
      .limit(1);
  }

  findAllFlows() {
    return this.db.db.select().from(conversationFlows);
  }

  findFlowById(id: string) {
    return this.db.db
      .select()
      .from(conversationFlows)
      .where(eq(conversationFlows.id, id))
      .limit(1);
  }

  countStepsByFlowId(flowId: string) {
    return this.db.db
      .select({ count: sql<number>`count(*)` })
      .from(flowSteps)
      .where(eq(flowSteps.flowId, flowId));
  }

  findStepsByFlowId(flowId: string) {
    return this.db.db
      .select()
      .from(flowSteps)
      .where(eq(flowSteps.flowId, flowId))
      .orderBy(asc(flowSteps.order));
  }

  updateFlow(id: string, data: Partial<typeof conversationFlows.$inferInsert>) {
    return this.db.db
      .update(conversationFlows)
      .set(data)
      .where(eq(conversationFlows.id, id))
      .returning();
  }

  deleteFlow(id: string) {
    return this.db.db.delete(conversationFlows).where(eq(conversationFlows.id, id));
  }

  createStep(data: typeof flowSteps.$inferInsert) {
    return this.db.db.insert(flowSteps).values(data).returning();
  }

  findStepById(id: string) {
    return this.db.db
      .select()
      .from(flowSteps)
      .where(eq(flowSteps.id, id))
      .limit(1);
  }

  updateStep(id: string, data: Partial<typeof flowSteps.$inferInsert>) {
    return this.db.db
      .update(flowSteps)
      .set(data)
      .where(eq(flowSteps.id, id))
      .returning();
  }

  deleteStep(id: string) {
    return this.db.db
      .delete(flowSteps)
      .where(eq(flowSteps.id, id))
      .returning();
  }

  findPricesByProduto(productId: string) {
    return this.db.db
      .select()
      .from(productPriceTable)
      .where(eq(productPriceTable.productId, productId));
  }

  findProdutoById(id: string) {
    return this.db.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
  }

  findContatoById(id: string) {
    return this.db.db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);
  }
}
