import { Injectable, NotFoundException } from '@nestjs/common';
import { EvolutionService } from '../evolution/evolution.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersRepository } from './orders.repository';

function calcularStarLevel(totalGasto: number): number {
  if (totalGasto >= 5000) return 3;
  if (totalGasto >= 1000) return 2;
  return 1;
}

@Injectable()
export class OrdersService {
  constructor(
    private repo: OrdersRepository,
    private evolutionService: EvolutionService,
  ) {}

  async create(dto: CreateOrderDto) {
    const estimatedTotal = dto.items.reduce((sum, item) => {
      const priceWithDiscount =
        item.unitPrice * (1 - item.discountPct / 100);
      return sum + priceWithDiscount * item.quantity;
    }, 0);

    const [result] = await this.repo.insert({
      contactId: dto.contactId,
      items: dto.items as any,
      estimatedTotal: estimatedTotal.toFixed(2),
      notes: dto.notes,
    });

    return result;
  }

  async findAll(query: { pagina?: number; limite?: number; status?: string }, role?: string) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const { rows, total } = await this.repo.findAllPaginated(pagina, limite);

    const data = rows.map((row) => {
      if (role === 'VENDEDOR') {
        const { contactId: _, ...rest } = row;
        return rest;
      }
      return row;
    });

    return { data, total, pagina, limite };
  }

  async findOne(id: string) {
    const [order] = await this.repo.findById(id);

    if (!order) {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }

    return order;
  }

  async fechar(id: string) {
    const order = await this.findOne(id);

    const [contact] = await this.repo.findContatoById(order.contactId);

    const [updatedOrder] = await this.repo.update(id, {
      status: 'FECHADO',
      closedAt: new Date(),
      updatedAt: new Date(),
    });

    if (contact) {
      const totalGasto = await this.repo.sumTotalGastoContato(contact.id);
      const novoStarLevel = contact.starLevelManual
        ? contact.starLevel
        : calcularStarLevel(totalGasto);

      await this.repo.updateContato(contact.id, {
        engagementStatus: 'ATIVO',
        starLevel: novoStarLevel,
        totalSpent: totalGasto.toFixed(2),
        updatedAt: new Date(),
      });

      try {
        await this.evolutionService.setLabel(contact.phoneNumber, 'ATIVO');
      } catch (err) {
        // Non-critical
      }

      const [param] = await this.repo.findParamByChave('VENDEDOR_1_NUMERO_WHATSAPP');

      if (param?.value) {
        try {
          const msg = `Novo pedido fechado!\nContato: ${contact.name}\nEstrela: ${novoStarLevel} ⭐\nTotal acumulado: R$ ${totalGasto.toFixed(2)}`;
          await this.evolutionService.sendTextMessage(param.value, msg);
        } catch (err) {
          // Non-critical
        }
      }

      await this.repo.update(id, { notifiedAt: new Date() });
    }

    return updatedOrder;
  }

  async cancelar(id: string) {
    await this.findOne(id);

    const [updated] = await this.repo.update(id, {
      status: 'CANCELADO',
      updatedAt: new Date(),
    });

    return updated;
  }

  async renotificar(id: string) {
    const order = await this.findOne(id);

    const [contact] = await this.repo.findContatoById(order.contactId);
    const [param] = await this.repo.findParamByChave('VENDEDOR_1_NUMERO_WHATSAPP');

    if (param?.value && contact) {
      const msg = `[Renotificação] Pedido: ${id}\nContato: ${contact.name}\nTotal: R$ ${order.estimatedTotal}`;
      await this.evolutionService.sendTextMessage(param.value, msg);
    }

    const [updated] = await this.repo.update(id, { notifiedAt: new Date() });

    return updated;
  }
}
