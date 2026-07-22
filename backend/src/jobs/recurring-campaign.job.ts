import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { EvolutionService } from '../modules/evolution/evolution.service';
import { InstanceMappingService } from '../modules/instance-mapping/instance-mapping.service';
import { RecurringCampaignRepository } from './recurring-campaign.repository';
import {
  mapStarLevelToProductRating,
  buildCatalogMessage,
} from './campaign-catalog.util';

@Processor('campaign-recurring')
@Injectable()
export class RecurringCampaignJob extends WorkerHost {
  private readonly logger = new Logger(RecurringCampaignJob.name);

  constructor(
    @InjectQueue('campaign-recurring') private recurringQueue: Queue,
    private repo: RecurringCampaignRepository,
    private evolutionService: EvolutionService,
    private instanceMapping: InstanceMappingService,
  ) {
    super();
  }

  async process(job: Job<{ campaignId: string }>) {
    if (job.name !== 'recurring-dispatch') return;

    const { campaignId } = job.data;
    this.logger.log(`Ciclo recorrente iniciado — campanha ${campaignId}`);

    const [campaign] = await this.repo.findCampanhaById(campaignId);

    if (!campaign || campaign.campaignStatus === 'CANCELADO') {
      this.logger.warn(
        `Campanha ${campaignId} não encontrada ou cancelada — ciclo abortado`,
      );
      return;
    }

    if (campaign.endAt && new Date() > new Date(campaign.endAt)) {
      await this.repo.updateCampanha(campaignId, {
        campaignStatus: 'CONCLUIDO',
        updatedAt: new Date(),
      });
      await this.recurringQueue.removeJobScheduler(campaignId);
      this.logger.log(
        `Campanha ${campaignId} concluída — janela encerrada, scheduler removido`,
      );
      return;
    }

    const catalogProducts = await this.repo.findActiveProductsWithPrices();

    if (catalogProducts.length === 0) {
      this.logger.warn(
        `Campanha ${campaignId} sem produtos válidos — ciclo pulado`,
      );
      return;
    }

    const [delayParam] = await this.repo.findParamByChave(
      'BROADCAST_DELAY_ENTRE_ENVIOS_MS',
    );
    const delayMs = delayParam ? parseInt(delayParam.value, 10) : 1000;

    const contactsToProcess = await this.repo.findContatosFiltrados(
      campaign.targetStarRating,
    );
    this.logger.log(
      `Campanha ${campaignId} — ${contactsToProcess.length} contatos elegíveis neste ciclo`,
    );

    // Script "Salve": mensagem de abertura escrita pelo admin/operador, enviada
    // antes do catálogo; quando presente, o catálogo perde o rodapé fixo de CTA
    // (SCRIPT_SALVE_SLICE.md, seção 3)
    const salveMessage = campaign.message?.trim() || null;

    let sent = 0;
    let errors = 0;

    for (const contact of contactsToProcess) {
      const starRating = mapStarLevelToProductRating(contact.starLevel);
      const catalogText = buildCatalogMessage(catalogProducts, starRating, {
        omitFooter: !!salveMessage,
      });
      const instanceName =
        await this.instanceMapping.resolveInstanceForStarRating(
          String(contact.starLevel),
        );

      try {
        if (salveMessage) {
          await this.evolutionService.sendTextMessage(
            contact.phoneNumber,
            salveMessage,
            contact.id,
            instanceName,
          );
          await this.sleep(delayMs);
        }

        await this.evolutionService.sendTextMessage(
          contact.phoneNumber,
          catalogText,
          contact.id,
          instanceName,
        );
        sent++;
      } catch (err) {
        errors++;
        this.logger.error(
          `Falha ao enviar catálogo da campanha ${campaignId} para ${contact.phoneNumber}`,
          err,
        );
      }

      await this.sleep(delayMs);
    }

    await this.repo.updateCampanha(campaignId, {
      campaignStatus: 'EM_ANDAMENTO',
      totalSent: campaign.totalSent + sent,
      totalErrors: campaign.totalErrors + errors,
      totalCycles: campaign.totalCycles + 1,
      lastCycleAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(
      `Campanha ${campaignId} — ciclo concluído: ${sent} enviados, ${errors} erros`,
    );
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
