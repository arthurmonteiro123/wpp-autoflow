import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateCampaignDto, CampaignTypeEnum } from './dto/create-campaign.dto';
import { CampaignsRepository } from './campaigns.repository';

@Injectable()
export class CampaignsService {
  constructor(
    private repo: CampaignsRepository,
    @InjectQueue('broadcast') private broadcastQueue: Queue,
    @InjectQueue('campaign-recurring') private recurringQueue: Queue,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateCampaignDto, userId: string) {
    if (dto.type === CampaignTypeEnum.RECORRENTE) {
      return this.createRecorrente(dto, userId);
    }

    const [result] = await this.repo.insert({
      name: dto.name,
      type: dto.type,
      message: dto.message!,
      mediaUrl: dto.mediaUrl,
      mediaType: dto.mediaType,
      targetStarRating: dto.targetStarRating,
      targetStatus: dto.targetStatus,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
      createdBy: userId,
    });

    if (dto.type === CampaignTypeEnum.AGENDADO && dto.scheduledFor) {
      const scheduledAt = new Date(dto.scheduledFor);
      const delay = scheduledAt.getTime() - Date.now();

      if (delay > 0) {
        const job = await this.broadcastQueue.add(
          'broadcast-dispatch',
          { campanhaId: result.id },
          {
            delay,
            jobId: `scheduled-${result.id}`,
            removeOnComplete: true,
            removeOnFail: 100,
          },
        );
        await this.repo.update(result.id, {
          bullJobId: String(job.id),
          campaignStatus: 'AGENDADO',
          updatedAt: new Date(),
        });
        return {
          ...result,
          bullJobId: String(job.id),
          campaignStatus: 'AGENDADO',
        };
      }
    }

    return result;
  }

  private async createRecorrente(dto: CreateCampaignDto, userId: string) {
    const startAt = new Date(dto.startAt!);
    const endAt = dto.endAt ? new Date(dto.endAt) : null;

    if (endAt && endAt <= startAt) {
      throw new BadRequestException('endAt deve ser posterior a startAt');
    }

    const [result] = await this.repo.insert({
      name: dto.name,
      type: dto.type,
      message: dto.message?.trim() ?? '',
      targetStarRating: dto.targetStarRating,
      targetStatus: dto.targetStatus,
      startAt,
      endAt,
      repeatIntervalMinutes: dto.repeatIntervalMinutes,
      createdBy: userId,
    });

    const campaignStatus =
      startAt.getTime() <= Date.now() ? 'EM_ANDAMENTO' : 'AGENDADO';

    await this.recurringQueue.upsertJobScheduler(
      result.id,
      {
        every: dto.repeatIntervalMinutes! * 60_000,
        startDate: startAt,
        ...(endAt ? { endDate: endAt } : {}),
      },
      {
        name: 'recurring-dispatch',
        data: { campaignId: result.id },
        opts: { removeOnComplete: 50, removeOnFail: 50 },
      },
    );

    const [updated] = await this.repo.update(result.id, {
      bullJobId: result.id,
      campaignStatus,
      updatedAt: new Date(),
    });

    return updated;
  }

  async findAll(query: { pagina?: number; limite?: number }) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const { rows, total } = await this.repo.findAllPaginated(pagina, limite);
    return { data: rows, total, pagina, limite };
  }

  async findOne(id: string) {
    const [campaign] = await this.repo.findById(id);

    if (!campaign) {
      throw new NotFoundException(`Campanha ${id} não encontrada`);
    }

    return campaign;
  }

  async update(id: string, dto: Partial<CreateCampaignDto>) {
    const campaign = await this.findOne(id);

    if (
      campaign.campaignStatus !== 'RASCUNHO' &&
      campaign.campaignStatus !== 'AGENDADO'
    ) {
      throw new BadRequestException(
        'Apenas campanhas em rascunho ou agendadas podem ser editadas',
      );
    }

    if (campaign.type === CampaignTypeEnum.RECORRENTE) {
      return this.updateRecorrente(id, campaign, dto);
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.message !== undefined) updateData.message = dto.message;
    if (dto.mediaUrl !== undefined) updateData.mediaUrl = dto.mediaUrl;
    if (dto.mediaType !== undefined) updateData.mediaType = dto.mediaType;
    if (dto.targetStarRating !== undefined)
      updateData.targetStarRating = dto.targetStarRating;
    if (dto.targetStatus !== undefined)
      updateData.targetStatus = dto.targetStatus;

    const scheduledForChanged = dto.scheduledFor !== undefined;
    if (scheduledForChanged)
      updateData.scheduledFor = new Date(dto.scheduledFor!);

    const effectiveType = dto.type ?? campaign.type;
    const effectiveScheduledFor = scheduledForChanged
      ? new Date(dto.scheduledFor!)
      : campaign.scheduledFor;

    if (scheduledForChanged && effectiveType === CampaignTypeEnum.AGENDADO) {
      if (campaign.bullJobId) {
        try {
          await this.broadcastQueue.remove(campaign.bullJobId);
        } catch {}
      }

      const delay = effectiveScheduledFor
        ? effectiveScheduledFor.getTime() - Date.now()
        : -1;
      if (delay > 0) {
        const job = await this.broadcastQueue.add(
          'broadcast-dispatch',
          { campanhaId: id },
          {
            delay,
            jobId: `scheduled-${id}`,
            removeOnComplete: true,
            removeOnFail: 100,
          },
        );
        updateData.bullJobId = String(job.id);
        updateData.campaignStatus = 'AGENDADO';
      }
    }

    const [updated] = await this.repo.update(id, updateData);
    return updated;
  }

  private async updateRecorrente(
    id: string,
    campaign: any,
    dto: Partial<CreateCampaignDto>,
  ) {
    const startAt = dto.startAt ? new Date(dto.startAt) : campaign.startAt;
    const endAt =
      dto.endAt !== undefined ? (dto.endAt ? new Date(dto.endAt) : null) : campaign.endAt;
    const repeatIntervalMinutes =
      dto.repeatIntervalMinutes ?? campaign.repeatIntervalMinutes;

    if (endAt && endAt <= startAt) {
      throw new BadRequestException('endAt deve ser posterior a startAt');
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      startAt,
      endAt,
      repeatIntervalMinutes,
    };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.message !== undefined) updateData.message = dto.message.trim();
    if (dto.targetStarRating !== undefined)
      updateData.targetStarRating = dto.targetStarRating;
    if (dto.targetStatus !== undefined)
      updateData.targetStatus = dto.targetStatus;

    await this.recurringQueue.upsertJobScheduler(
      id,
      {
        every: repeatIntervalMinutes * 60_000,
        startDate: startAt,
        ...(endAt ? { endDate: endAt } : {}),
      },
      {
        name: 'recurring-dispatch',
        data: { campaignId: id },
        opts: { removeOnComplete: 50, removeOnFail: 50 },
      },
    );

    updateData.campaignStatus =
      startAt.getTime() <= Date.now() ? 'EM_ANDAMENTO' : 'AGENDADO';

    const [updated] = await this.repo.update(id, updateData);
    return updated;
  }

  async disparar(id: string) {
    const campaign = await this.findOne(id);

    if (campaign.type === CampaignTypeEnum.RECORRENTE) {
      // Job avulso e imediato, independente do agendamento recorrente. BullMQ
      // ignora o novo startDate de um upsertJobScheduler quando o `every` não
      // muda (reaproveita o próximo horário já calculado pelo scheduler
      // existente) — então "disparar agora" não pode depender de mexer no
      // scheduler; o scheduler criado em createRecorrente/updateRecorrente
      // segue intocado para os próximos ciclos.
      await this.recurringQueue.add(
        'recurring-dispatch',
        { campaignId: id },
        { removeOnComplete: 50, removeOnFail: 50 },
      );

      const [updated] = await this.repo.update(id, {
        campaignStatus: 'EM_ANDAMENTO',
        updatedAt: new Date(),
      });
      return updated;
    }

    if (campaign.bullJobId) {
      try {
        await this.broadcastQueue.remove(campaign.bullJobId);
      } catch {}
      await this.repo.update(id, { bullJobId: null, updatedAt: new Date() });
    }

    await this.broadcastQueue.add('broadcast-dispatch', { campanhaId: id });

    const [updated] = await this.repo.update(id, {
      campaignStatus: 'EM_ANDAMENTO',
      updatedAt: new Date(),
    });

    return updated;
  }

  async cancelar(id: string) {
    const campaign = await this.findOne(id);

    if (campaign.type === CampaignTypeEnum.RECORRENTE) {
      try {
        await this.recurringQueue.removeJobScheduler(id);
      } catch {}
    } else if (campaign.bullJobId) {
      try {
        await this.broadcastQueue.remove(campaign.bullJobId);
      } catch {}
    }

    const [updated] = await this.repo.update(id, {
      campaignStatus: 'CANCELADO',
      bullJobId: null,
      updatedAt: new Date(),
    });

    return updated;
  }

  async remove(id: string) {
    const campaign = await this.findOne(id);

    if (
      campaign.campaignStatus === 'EM_ANDAMENTO' ||
      campaign.campaignStatus === 'AGENDADO'
    ) {
      throw new BadRequestException(
        'Cancele a campanha antes de removê-la (apenas RASCUNHO, CANCELADO ou CONCLUIDO podem ser removidas)',
      );
    }

    // Remoção defensiva de jobs residuais no Redis (não deixa scheduler órfão)
    if (campaign.type === CampaignTypeEnum.RECORRENTE) {
      try {
        await this.recurringQueue.removeJobScheduler(id);
      } catch {}
    } else if (campaign.bullJobId) {
      try {
        await this.broadcastQueue.remove(campaign.bullJobId);
      } catch {}
    }

    await this.repo.delete(id);
    return { deleted: true };
  }

  async getEntregas(id: string, query: { pagina?: number; limite?: number }) {
    await this.findOne(id);

    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const { rows, total } = await this.repo.findEntregasByCampanha(
      id,
      pagina,
      limite,
    );
    return { data: rows, total, pagina, limite };
  }

  async getParametros() {
    return this.repo.findAllParams();
  }

  async updateParametro(key: string, value: string, userId?: string) {
    const [existing] = await this.repo.findParamByChave(key);

    if (!existing) {
      throw new NotFoundException(`Parâmetro ${key} não encontrado`);
    }

    const [updated] = await this.repo.updateParam(key, value);

    this.eventEmitter.emit('param.updated', { chave: key, valor: value });

    return updated;
  }
}
