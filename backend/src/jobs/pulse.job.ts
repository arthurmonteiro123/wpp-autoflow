import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { EvolutionService } from '../modules/evolution/evolution.service';
import { FlowsService } from '../modules/flows/flows.service';
import { InstanceMappingService } from '../modules/instance-mapping/instance-mapping.service';
import { OperatingHoursService } from '../common/services/operating-hours.service';
import { PulseRepository } from './pulse.repository';

@Processor('pulse')
@Injectable()
export class PulseJob extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PulseJob.name);

  constructor(
    @InjectQueue('pulse') private pulseQueue: Queue,
    private repo: PulseRepository,
    private evolutionService: EvolutionService,
    private flowsService: FlowsService,
    private instanceMapping: InstanceMappingService,
    private operatingHours: OperatingHoursService,
  ) {
    super();
  }

  async onModuleInit() {
    try {
      const [param] = await this.repo.findParamByChave('PULSE_INTERVALO_MINUTOS');
      const intervalMinutes = param ? parseInt(param.value, 10) : 60;
      await this.scheduleRepeatable(intervalMinutes);
    } catch {
      this.logger.warn('Could not initialize pulse job (database not ready?)');
    }
  }

  @OnEvent('param.updated')
  async rescheduleIfPulseParam(payload: { key: string; value: string }) {
    if (payload.key === 'PULSE_INTERVALO_MINUTOS') {
      const repeatableJobs = await this.pulseQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        await this.pulseQueue.removeRepeatableByKey(job.key);
      }
      const intervalMinutes = parseInt(payload.value, 10);
      await this.scheduleRepeatable(intervalMinutes);
      this.logger.log(`Pulse rescheduled to every ${intervalMinutes} minutes`);
    }
  }

  private async scheduleRepeatable(intervalMinutes: number) {
    await this.pulseQueue.add(
      'run',
      {},
      {
        repeat: { every: intervalMinutes * 60 * 1000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  async process(job: Job) {
    if (job.name !== 'run') return;

    this.logger.log('Pulse started');

    try {
      const params = await this.repo.findAllParams();
      const paramMap = Object.fromEntries(params.map((p) => [p.key, p.value]));

      if (paramMap['PULSE_ATIVO'] === 'false' || paramMap['PULSE_ATIVO'] === '0') {
        this.logger.log('Pulse disabled — skipping cycle');
        return;
      }

      const withinHours = await this.operatingHours.isWithinOperatingHours();
      if (!withinHours) {
        this.logger.log('Pulse skipped — outside operating hours');
        return;
      }

      const maxContacts = parseInt(paramMap['PULSE_MAX_CONTATOS_POR_CICLO'] ?? '10', 10);
      const cooldownHours = parseInt(paramMap['PULSE_COOLDOWN_HORAS'] ?? '24', 10);

      const contactsToProcess = await this.repo.findEligibleContacts(maxContacts);
      this.logger.log(`Processing ${contactsToProcess.length} contacts`);

      for (const contact of contactsToProcess) {
        try {
          const starLevelStr = String(contact.starLevel);
          const [flow] = await this.repo.findActiveFlowByStarLevel(starLevelStr);

          if (!flow) {
            this.logger.debug(`No active flow for starLevel ${contact.starLevel}`);
            continue;
          }

          const steps = await this.repo.findStepsByFlowId(flow.id);

          const instanceName = await this.instanceMapping.resolveInstanceForStarRating(starLevelStr);

          const vars = {
            name: contact.name,
            starLevel: contact.starLevel,
            today: new Date().toLocaleDateString('pt-BR'),
          };

          for (const step of steps) {
            switch (step.type) {
              case 'DELAY':
                if (step.delaySeconds) {
                  await new Promise((r) => setTimeout(r, step.delaySeconds! * 1000));
                }
                break;

              case 'TEXTO':
                if (step.textContent) {
                  const text = this.flowsService.interpolate(step.textContent, vars);
                  await this.evolutionService.sendTextMessage(
                    contact.phoneNumber,
                    text,
                    contact.id,
                    instanceName,
                  );
                }
                break;

              case 'MIDIA':
                if (step.mediaUrl) {
                  const caption = step.caption
                    ? this.flowsService.interpolate(step.caption, vars)
                    : '';
                  const mediaTypeMap: Record<string, 'image' | 'video' | 'audio'> = {
                    IMAGEM: 'image',
                    VIDEO: 'video',
                    AUDIO: 'audio',
                  };
                  const mediaType = mediaTypeMap[step.mediaType ?? 'IMAGEM'] ?? 'image';
                  await this.evolutionService.sendMedia(
                    contact.phoneNumber,
                    step.mediaUrl,
                    caption,
                    mediaType,
                    contact.id,
                    instanceName,
                  );
                }
                break;

              case 'TABELA_PRECO':
                if (step.productId) {
                  const [product] = await this.repo.findProdutoById(step.productId);
                  const priceEntries = await this.repo.findPricesByProduto(step.productId);

                  if (product && priceEntries.length > 0) {
                    let priceTableText = `*Tabela de Preços — ${product.name}*\n\n`;
                    for (const entry of priceEntries) {
                      priceTableText += `Tipo ${entry.starRating}: R$ ${entry.unitPrice} (mín: ${entry.minQuantity})\n`;
                    }
                    await this.evolutionService.sendTextMessage(
                      contact.phoneNumber,
                      priceTableText,
                      contact.id,
                      instanceName,
                    );
                  }
                }
                break;
            }
          }

          const cooldownUntil = new Date();
          cooldownUntil.setHours(cooldownUntil.getHours() + cooldownHours);

          await this.repo.updateContato(contact.id, {
            cooldownUntil,
            engagementStatus: 'INATIVO',
            updatedAt: new Date(),
          });

          try {
            await this.evolutionService.setLabel(contact.phoneNumber, 'INATIVO', instanceName);
          } catch (err: any) {
            this.logger.error(`Failed to set label for ${contact.phoneNumber}: ${err?.message ?? err}`);
          }
        } catch (err: any) {
          this.logger.error(`Error processing contact ${contact.id}: ${err?.message ?? err}`);
        }
      }

      this.logger.log('Pulse completed');
    } catch (err: any) {
      this.logger.error(`Pulse job error: ${err?.message ?? err}`);
      throw err;
    }
  }
}
