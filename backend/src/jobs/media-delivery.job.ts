import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EvolutionService } from '../modules/evolution/evolution.service';
import { MediaDeliveryRepository } from './media-delivery.repository';

@Processor('media-delivery')
@Injectable()
export class MediaDeliveryJob extends WorkerHost {
  private readonly logger = new Logger(MediaDeliveryJob.name);

  constructor(
    private repo: MediaDeliveryRepository,
    private evolutionService: EvolutionService,
  ) {
    super();
  }

  async process(job: Job<{ entregaId: string }>) {
    if (job.name !== 'media-delivery') return;

    const { entregaId } = job.data;
    this.logger.log(`Processando entrega de mídia ${entregaId}`);

    try {
      const [entrega] = await this.repo.findEntregaById(entregaId);

      if (!entrega) {
        this.logger.error(`Entrega ${entregaId} não encontrada`);
        return;
      }

      if (entrega.status === 'CANCELADO') {
        this.logger.log(`Entrega ${entregaId} foi cancelada, pulando`);
        return;
      }

      const [mediaFile] = await this.repo.findMidiaById(entrega.mediaId);

      if (!mediaFile) {
        throw new Error(`Mídia ${entrega.mediaId} não encontrada`);
      }

      const [contact] = await this.repo.findContatoById(entrega.contactId);

      if (!contact) {
        throw new Error(`Contato ${entrega.contactId} não encontrado`);
      }

      const mediaTypeMap: Record<string, 'image' | 'video' | 'audio' | 'document'> = {
        IMAGEM: 'image',
        VIDEO: 'video',
        AUDIO: 'audio',
        DOCUMENTO: 'document',
      };
      const mediaType = mediaTypeMap[mediaFile.type] ?? 'image';

      await this.evolutionService.sendMedia(
        contact.phoneNumber,
        mediaFile.url,
        entrega.caption ?? '',
        mediaType,
        contact.id,
      );

      await this.repo.updateEntrega(entregaId, {
        status: 'ENVIADO',
        sentAt: new Date(),
      });

      this.logger.log(`Entrega ${entregaId} concluída com sucesso`);
    } catch (err: any) {
      this.logger.error(`Erro na entrega ${entregaId}: ${err.message}`);

      await this.repo.updateEntrega(entregaId, {
        status: 'ERRO',
        errorDetails: err.message,
      });

      throw err;
    }
  }
}
