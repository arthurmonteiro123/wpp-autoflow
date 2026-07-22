import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EvolutionService } from '../evolution/evolution.service';
import { WebhookRepository } from './webhook.repository';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private repo: WebhookRepository,
    private evolutionService: EvolutionService,
    private eventEmitter: EventEmitter2,
  ) {}

  async handleEvent(body: any) {
    switch (body.event) {
      case 'messages.upsert':
        await this.handleMessageReceived(body);
        break;
      case 'messages.update':
        await this.handleMessageUpdate(body);
        break;
      case 'connection.update':
        this.handleConnectionUpdate(body);
        break;
      case 'qrcode.updated':
        this.handleQrCodeUpdated(body);
        break;
      default:
        this.logger.debug(`Unhandled event: ${body.event}`);
    }
  }

  async handleMessageReceived(body: any) {
    try {
      const remoteJid: string = body?.data?.key?.remoteJid ?? '';
      const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
      const instanceName: string = body?.instance ?? '';

      if (!phoneNumber) return;

      // Ignore messages sent by us (fromMe = true)
      if (body?.data?.key?.fromMe) return;

      const [contact] = await this.repo.findContatoByNumero(phoneNumber);

      if (contact) {
        await this.repo.updateContato(contact.id, {
          lastMessageAt: new Date(),
          engagementStatus: 'RESPONDEU',
          updatedAt: new Date(),
        });

        try {
          await this.evolutionService.setLabel(phoneNumber, 'RESPONDEU', instanceName || undefined);
          await this.evolutionService.removeLabel(phoneNumber, 'INATIVO', instanceName || undefined);
        } catch (err) {
          this.logger.error('Failed to update labels', err);
        }

        const message =
          body?.data?.message?.conversation ??
          body?.data?.message?.extendedTextMessage?.text ??
          '';

        await this.repo.insertMensagemLog({
          contactId: contact.id,
          direction: 'RECEBIDA',
          type: 'TEXTO',
          content: message,
          status: 'ENTREGUE',
          evolutionId: body?.data?.key?.id ?? null,
        });

        this.eventEmitter.emit('message.received', {
          contactId: contact.id,
          phoneNumber,
          message,
          instanceName: instanceName || undefined,
        });
      }
    } catch (err) {
      this.logger.error('Error processing received message', err);
    }
  }

  private handleQrCodeUpdated(body: any) {
    const instanceName: string = body?.instance ?? '';
    const raw: string | null =
      body?.data?.qrcode?.base64 ??
      body?.data?.qrcode ??
      body?.qrcode?.base64 ??
      null;

    if (raw) {
      this.evolutionService.setQrCode(raw, instanceName || undefined);
    } else {
      this.logger.warn('qrcode.updated recebido mas sem base64', JSON.stringify(body));
    }
  }

  private handleConnectionUpdate(body: any) {
    const instanceName: string = body?.instance ?? '';
    const state: string = body?.data?.state ?? body?.state ?? '';
    this.logger.log(`Connection update instância="${instanceName}" state="${state}"`);
    if (state === 'open') {
      this.evolutionService.setConnected(true, instanceName || undefined);
    } else if (state === 'close') {
      this.evolutionService.setConnected(false, instanceName || undefined);
    }
  }

  async handleMessageUpdate(body: any) {
    try {
      const updates = body?.data ?? [];
      const updateList = Array.isArray(updates) ? updates : [updates];

      for (const update of updateList) {
        const evolutionId = update?.key?.id;
        const ack = update?.update?.status;

        if (!evolutionId) continue;

        const ackMap: Record<number, 'ENTREGUE' | 'LIDO'> = {
          1: 'ENTREGUE',
          2: 'ENTREGUE',
          3: 'LIDO',
        };

        const status = ackMap[ack];
        if (status) {
          await this.repo.updateMensagemLogByEvolutionId(evolutionId, status);
        }
      }
    } catch (err) {
      this.logger.error('Erro ao atualizar status de mensagem', err);
    }
  }
}
