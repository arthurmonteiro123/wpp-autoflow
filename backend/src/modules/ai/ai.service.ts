import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EvolutionService } from '../evolution/evolution.service';
import { InstanceMappingService } from '../instance-mapping/instance-mapping.service';
import { OperatingHoursService } from '../../common/services/operating-hours.service';
import { AIRepository } from './ai.repository';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Structured response the AI must return
interface AIStructuredReply {
  reply: string;
  sendCatalog: boolean;
  sendMedia: boolean;
  requestedProductId: string | null;
}

export interface MessageReceivedPayload {
  contactId: string;
  phoneNumber: string;
  message: string;
  instanceName?: string;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private config: ConfigService,
    private repo: AIRepository,
    private evolutionService: EvolutionService,
    private instanceMapping: InstanceMappingService,
    private operatingHours: OperatingHoursService,
  ) {}

  @OnEvent('message.received')
  async handleIncomingMessage(payload: MessageReceivedPayload) {
    try {
      const enabled = await this.repo.getParam('AI_ENABLED');
      if (enabled !== 'true') return;

      const withinHours = await this.operatingHours.isWithinOperatingHours();
      if (!withinHours) {
        this.logger.debug('AI response skipped: outside operating hours');
        return;
      }

      const [contact] = await this.repo.findContactById(payload.contactId);
      if (!contact) return;

      const contextSize = parseInt((await this.repo.getParam('AI_CONTEXT_MESSAGES')) ?? '20', 10);
      const history = await this.repo.findRecentMessages(payload.contactId, contextSize);

      const baseSystemPrompt =
        (await this.repo.getParam('AI_SYSTEM_PROMPT')) ??
        'Você é um assistente de vendas. Responda de forma natural e adaptada ao estilo de comunicação do cliente. Seja objetivo e cordial.';

      const activeProducts = await this.repo.findActiveProductsForPrompt();
      const productListText = activeProducts
        .map((p) => `- ${p.id}: ${p.name}`)
        .join('\n');

      const systemPrompt =
        `${baseSystemPrompt}\n` +
        `Cliente: ${contact.name} | Estrela: ${contact.starLevel}\n\n` +
        `Produtos disponíveis (id: nome):\n${productListText}\n\n` +
        `IMPORTANTE: responda SEMPRE em JSON com este formato exato (sem markdown, sem blocos de código):\n` +
        `{"reply":"sua resposta aqui","sendCatalog":false,"sendMedia":false,"requestedProductId":null}\n\n` +
        `Use "sendCatalog":true SOMENTE quando o cliente demonstrar interesse em preços ou produtos ` +
        `pela PRIMEIRA VEZ na conversa (ex: "quanto custa", "me manda a tabela", "quero comprar"). ` +
        `Se o catálogo já foi enviado, mantenha "sendCatalog":false.\n\n` +
        `Use "sendMedia":true SOMENTE quando o cliente pedir EXPLICITAMENTE foto, imagem ou vídeo do ` +
        `produto (ex: "manda uma foto", "tem imagem?", "quero ver o produto", "manda um vídeo"). ` +
        `Interesse genérico em preço NÃO conta como pedido de mídia — nesse caso use só "sendCatalog". ` +
        `Os dois campos são independentes e podem ser true ao mesmo tempo se o cliente pedir preço e foto juntos.\n\n` +
        `Quando "sendMedia":true e o cliente citar um produto específico (por nome, mesmo que parcial ou ` +
        `com erro de digitação), identifique o produto correspondente na lista acima e retorne o id exato ` +
        `dele em "requestedProductId". Se o cliente pedir foto de forma genérica, sem citar um produto ` +
        `específico (ex: "manda uma foto dos produtos"), deixe "requestedProductId":null.`;

      const model = (await this.repo.getParam('AI_MODEL')) ?? 'openai/gpt-4o-mini';
      const maxTokens = parseInt((await this.repo.getParam('AI_MAX_TOKENS')) ?? '300', 10);

      const messages: OpenRouterMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history
          .reverse()
          .map((msg) => ({
            role: (msg.direction === 'ENVIADA' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: msg.content,
          })),
        { role: 'user', content: payload.message },
      ];

      const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
      if (!apiKey) {
        this.logger.warn('OPENROUTER_API_KEY not configured — AI response skipped');
        return;
      }

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        { model, messages, max_tokens: maxTokens },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://wpp-autoflow',
            'X-Title': 'wpp-autoflow',
          },
          timeout: 30000,
        },
      );

      const rawReply: string = response.data?.choices?.[0]?.message?.content ?? '';
      if (!rawReply) {
        this.logger.warn('OpenRouter returned empty reply');
        return;
      }

      const { reply, sendCatalog, sendMedia, requestedProductId } =
        this.parseStructuredReply(rawReply);

      const starLevelStr = String(contact.starLevel);
      const instanceName = await this.instanceMapping.resolveInstanceForStarRating(starLevelStr);

      // Dispatch catálogo/mídia antes da resposta em texto, pra conversa fluir naturalmente
      if (sendCatalog) {
        const alreadySent = await this.repo.catalogAlreadySentRecently(payload.contactId);
        if (alreadySent) {
          this.logger.debug(`Catalog already sent recently for contact ${payload.contactId} — skipping`);
        } else {
          await this.dispatchCatalogText(
            contact.phoneNumber,
            contact.id,
            starLevelStr,
            instanceName,
          );
        }
      }

      if (sendMedia) {
        await this.dispatchCatalogMedia(
          contact.phoneNumber,
          contact.id,
          starLevelStr,
          instanceName,
          requestedProductId,
        );
      }

      await this.evolutionService.sendTextMessage(
        contact.phoneNumber,
        reply.trim(),
        contact.id,
        instanceName,
      );

      this.logger.log(
        `AI replied to ${contact.phoneNumber} via "${instanceName}" (model: ${model}, sendCatalog: ${sendCatalog}, sendMedia: ${sendMedia})`,
      );
    } catch (err: any) {
      this.logger.error(
        `AI service error: ${err?.response?.data?.error?.message ?? err?.message ?? err}`,
      );
    }
  }

  // ─── Catalog dispatch ─────────────────────────────────────────────────────

  private starLevelToProductTier(starLevel: string): string {
    if (starLevel === '3') return 'A';
    if (starLevel === '2') return 'B';
    return 'C';
  }

  /** Tier do produto + produtos com preço ativo naquele tier, para o starLevel do lead. */
  private async getProductsForStarLevel(starLevel: string) {
    const productTier = this.starLevelToProductTier(starLevel);
    const productsWithPrices = await this.repo.findProductsWithPrices(productTier);
    return { productTier, productsWithPrices };
  }

  private async dispatchCatalogText(
    phoneNumber: string,
    contactId: string,
    starLevel: string,
    instanceName: string,
  ) {
    const { productsWithPrices } = await this.getProductsForStarLevel(starLevel);

    if (productsWithPrices.length === 0) {
      this.logger.debug(`No active products with prices for starRating ${starLevel}`);
      return;
    }

    for (const product of productsWithPrices) {
      let tableText = `*Tabela de Preços — ${product.name}*\n\n`;
      for (const entry of product.prices) {
        const max = entry.maxQuantity ? ` – ${entry.maxQuantity}${product.unit}` : '+';
        tableText += `${entry.minQuantity}${product.unit}${max}: R$ ${entry.unitPrice}\n`;
      }

      await this.evolutionService.sendTextMessage(phoneNumber, tableText, contactId, instanceName);

      this.logger.log(`Catalog text dispatched for product "${product.name}" → ${phoneNumber}`);
    }
  }

  private readonly mediaTypeMap: Record<string, 'image' | 'video' | 'audio' | 'document'> = {
    IMAGEM: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    DOCUMENTO: 'document',
  };

  private async dispatchCatalogMedia(
    phoneNumber: string,
    contactId: string,
    starLevel: string,
    instanceName: string,
    requestedProductId?: string | null,
  ) {
    const productTier = this.starLevelToProductTier(starLevel);

    // Lead named a specific product — send only that one, regardless of it
    // having a price entry for this tier (photo isn't gated by price).
    if (requestedProductId) {
      const [product] = await this.repo.findActiveProductById(requestedProductId);
      if (!product) {
        this.logger.warn(
          `AI returned requestedProductId "${requestedProductId}" that doesn't match an active product — falling back to tier catalog`,
        );
      } else {
        const mediaItems = await this.repo.findMediaByProduct(product.id, productTier, 4);

        if (mediaItems.length === 0) {
          this.logger.warn(
            `No media found for requested product "${product.name}" (tier ${productTier}) → ${phoneNumber}`,
          );
          return;
        }

        for (const media of mediaItems) {
          await this.evolutionService.sendMedia(
            phoneNumber,
            media.url,
            media.caption ?? '',
            this.mediaTypeMap[media.mediaType] ?? 'image',
            contactId,
            instanceName,
          );
        }

        this.logger.log(
          `Media dispatched for requested product "${product.name}" → ${phoneNumber} (${mediaItems.length} media)`,
        );
        return;
      }
    }

    // Generic media request (no specific product identified) — fall back to
    // the tier-wide catalog blast, same as before.
    const { productsWithPrices } = await this.getProductsForStarLevel(starLevel);

    if (productsWithPrices.length === 0) {
      this.logger.debug(`No active products with prices for starRating ${starLevel}`);
      return;
    }

    for (const product of productsWithPrices) {
      const mediaItems = await this.repo.findMediaByProduct(product.id, productTier, 4);

      for (const media of mediaItems) {
        await this.evolutionService.sendMedia(
          phoneNumber,
          media.url,
          media.caption ?? '',
          this.mediaTypeMap[media.mediaType] ?? 'image',
          contactId,
          instanceName,
        );
      }

      if (mediaItems.length > 0) {
        this.logger.log(
          `Media dispatched for product "${product.name}" → ${phoneNumber} (${mediaItems.length} media)`,
        );
      }
    }
  }

  // ─── Parse structured reply ───────────────────────────────────────────────

  private parseStructuredReply(raw: string): AIStructuredReply {
    // Strip markdown code fences if the model wrapped JSON in ```
    const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        reply: typeof parsed.reply === 'string' ? parsed.reply : raw,
        sendCatalog: parsed.sendCatalog === true,
        sendMedia: parsed.sendMedia === true,
        requestedProductId:
          typeof parsed.requestedProductId === 'string' ? parsed.requestedProductId : null,
      };
    } catch {
      // Model didn't return valid JSON — treat entire response as plain text, no catalog/media
      this.logger.warn('AI did not return valid JSON — using plain text reply');
      return { reply: raw.trim(), sendCatalog: false, sendMedia: false, requestedProductId: null };
    }
  }
}
