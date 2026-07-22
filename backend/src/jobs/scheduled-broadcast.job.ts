import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EvolutionService } from '../modules/evolution/evolution.service';
import { InstanceMappingService } from '../modules/instance-mapping/instance-mapping.service';
import { BroadcastRepository } from './broadcast.repository';

@Processor('broadcast')
@Injectable()
export class ScheduledBroadcastJob extends WorkerHost {
  private readonly logger = new Logger(ScheduledBroadcastJob.name);

  constructor(
    private repo: BroadcastRepository,
    private evolutionService: EvolutionService,
    private instanceMapping: InstanceMappingService,
  ) {
    super();
  }

  async process(job: Job<{ campanhaId: string }>) {
    if (job.name !== 'broadcast-dispatch') return;

    const { campanhaId } = job.data;
    this.logger.log(`Iniciando broadcast ${campanhaId}`);

    try {
      const [campaign] = await this.repo.findCampanhaById(campanhaId);

      if (!campaign) {
        this.logger.error(`Campanha ${campanhaId} não encontrada`);
        return;
      }

      await this.repo.updateCampanha(campanhaId, {
        campaignStatus: 'EM_ANDAMENTO',
        updatedAt: new Date(),
      });

      const [delayParam] = await this.repo.findParamByChave('BROADCAST_DELAY_ENTRE_ENVIOS_MS');
      const delayMs = delayParam ? parseInt(delayParam.value, 10) : 1000;

      const contactsToProcess = await this.repo.findContatosFiltrados(
        campaign.targetStarRating,
        campaign.targetStatus,
      );

      let totalSent = 0;
      let totalErrors = 0;

      for (const contact of contactsToProcess) {
        await new Promise((r) => setTimeout(r, delayMs));

        const instanceName = await this.instanceMapping.resolveInstanceForStarRating(
          String(contact.starLevel),
        );

        let status: 'ENVIADO' | 'ERRO' = 'ENVIADO';
        let errorDetails: string | undefined;

        try {
          if (campaign.mediaUrl && campaign.mediaType) {
            const mediaTypeMap: Record<string, 'image' | 'video' | 'audio' | 'document'> = {
              IMAGEM: 'image',
              VIDEO: 'video',
              AUDIO: 'audio',
              DOCUMENTO: 'document',
            };
            const mediaType = mediaTypeMap[campaign.mediaType] ?? 'image';
            await this.evolutionService.sendMedia(
              contact.phoneNumber,
              campaign.mediaUrl,
              campaign.message,
              mediaType,
              contact.id,
              instanceName,
            );
          } else {
            await this.evolutionService.sendTextMessage(
              contact.phoneNumber,
              campaign.message,
              contact.id,
              instanceName,
            );
          }
          totalSent++;
        } catch (err: any) {
          status = 'ERRO';
          errorDetails = err.message;
          totalErrors++;
          this.logger.error(`Erro ao enviar para ${contact.phoneNumber}`, err);
        }

        await this.repo.insertEntrega({
          campaignId: campanhaId,
          contactId: contact.id,
          status,
          errorDetails,
          sentAt: status === 'ENVIADO' ? new Date() : undefined,
        });
      }

      await this.repo.updateCampanha(campanhaId, {
        campaignStatus: 'CONCLUIDO',
        totalContacts: contactsToProcess.length,
        totalSent,
        totalErrors,
        updatedAt: new Date(),
      });

      this.logger.log(
        `Broadcast ${campanhaId} concluído: ${totalSent} enviados, ${totalErrors} erros`,
      );
    } catch (err) {
      this.logger.error(`Erro no broadcast ${campanhaId}`, err);
      await this.repo.updateCampanha(campanhaId, {
        campaignStatus: 'CANCELADO',
        updatedAt: new Date(),
      });
      throw err;
    }
  }
}
