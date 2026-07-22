import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { contacts, messageLogs } from '../../../drizzle/schema';

@Injectable()
export class WebhookRepository {
  constructor(private db: DatabaseService) {}

  findContatoByNumero(numero: string) {
    return this.db.db
      .select()
      .from(contacts)
      .where(eq(contacts.phoneNumber, numero))
      .limit(1);
  }

  updateContato(id: string, data: Partial<typeof contacts.$inferInsert>) {
    return this.db.db
      .update(contacts)
      .set(data)
      .where(eq(contacts.id, id));
  }

  insertMensagemLog(data: typeof messageLogs.$inferInsert) {
    return this.db.db.insert(messageLogs).values(data);
  }

  updateMensagemLogByEvolutionId(evolutionId: string, status: 'ENTREGUE' | 'LIDO') {
    return this.db.db
      .update(messageLogs)
      .set({ status })
      .where(eq(messageLogs.evolutionId, evolutionId));
  }
}
