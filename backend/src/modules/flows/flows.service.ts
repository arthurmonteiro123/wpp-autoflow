import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { EvolutionService } from '../evolution/evolution.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { CreateStepDto } from './dto/create-step.dto';
import { FlowsRepository } from './flows.repository';

@Injectable()
export class FlowsService {
  constructor(
    private repo: FlowsRepository,
    private evolutionService: EvolutionService,
  ) {}

  interpolate(
    text: string,
    vars: {
      name?: string;
      starLevel?: number | string;
      dataHoje?: string;
      vendedor?: string;
    },
  ): string {
    return text
      .replace(/\{\{nome\}\}/g, vars.name ?? '')
      .replace(/\{\{nivelEstrela\}\}/g, String(vars.starLevel ?? ''))
      .replace(/\{\{dataHoje\}\}/g, vars.dataHoje ?? new Date().toLocaleDateString('pt-BR'))
      .replace(/\{\{vendedor\}\}/g, vars.vendedor ?? '');
  }

  async createFlow(dto: CreateFlowDto) {
    const existing = await this.repo.findActiveByTipo(dto.starRating);

    if (existing.length > 0 && existing[0].active) {
      throw new ConflictException(
        `Já existe um fluxo ativo para o tipo de cliente ${dto.starRating}`,
      );
    }

    const [result] = await this.repo.createFlow({
      name: dto.name,
      starRating: dto.starRating,
    });

    return result;
  }

  async listFlows() {
    const flows = await this.repo.findAllFlows();

    const flowsWithCount = await Promise.all(
      flows.map(async (flow) => {
        const steps = await this.repo.countStepsByFlowId(flow.id);
        return {
          ...flow,
          stepCount: Number(steps[0]?.count ?? 0),
        };
      }),
    );

    return flowsWithCount;
  }

  async findFlow(id: string) {
    const [flow] = await this.repo.findFlowById(id);

    if (!flow) {
      throw new NotFoundException(`Fluxo ${id} não encontrado`);
    }

    const steps = await this.repo.findStepsByFlowId(id);

    return { ...flow, steps };
  }

  async updateFlow(id: string, dto: Partial<CreateFlowDto>) {
    await this.findFlow(id);

    const [updated] = await this.repo.updateFlow(id, {
      ...dto,
      updatedAt: new Date(),
    });

    return updated;
  }

  async deleteFlow(id: string) {
    await this.findFlow(id);
    await this.repo.deleteFlow(id);
    return { message: 'Fluxo removido com sucesso' };
  }

  async createStep(flowId: string, dto: CreateStepDto) {
    await this.findFlow(flowId);

    const [result] = await this.repo.createStep({
      flowId,
      order: dto.order,
      type: dto.type,
      textContent: dto.textContent,
      mediaUrl: dto.mediaUrl,
      mediaType: dto.mediaType,
      caption: dto.caption,
      productId: dto.productId,
      delaySeconds: dto.delaySeconds,
    });

    return result;
  }

  async updateStep(stepId: string, dto: Partial<CreateStepDto>) {
    const [existing] = await this.repo.findStepById(stepId);

    if (!existing) {
      throw new NotFoundException(`Etapa ${stepId} não encontrada`);
    }

    const [updated] = await this.repo.updateStep(stepId, {
      ...dto,
      updatedAt: new Date(),
    });

    return updated;
  }

  async deleteStep(stepId: string) {
    const result = await this.repo.deleteStep(stepId);

    if (result.length === 0) {
      throw new NotFoundException(`Etapa ${stepId} não encontrada`);
    }

    return { message: 'Etapa removida com sucesso' };
  }

  async testarFluxo(flowId: string, contactId: string) {
    const flow = await this.findFlow(flowId);

    const [contact] = await this.repo.findContatoById(contactId);

    if (!contact) {
      throw new NotFoundException(`Contato ${contactId} não encontrado`);
    }

    const vars = {
      name: contact.name,
      starLevel: contact.starLevel,
      dataHoje: new Date().toLocaleDateString('pt-BR'),
    };

    const resultados: string[] = [];

    for (const step of flow.steps) {
      switch (step.type) {
        case 'DELAY':
          resultados.push(`[DELAY] ${step.delaySeconds}s (ignorado em teste)`);
          break;

        case 'TEXTO':
          if (step.textContent) {
            const texto = this.interpolate(step.textContent, vars);
            await this.evolutionService.sendTextMessage(
              contact.phoneNumber,
              texto,
              contactId,
            );
            resultados.push(`[TEXTO] Enviado: ${texto.substring(0, 50)}...`);
          }
          break;

        case 'MIDIA':
          if (step.mediaUrl) {
            const caption = step.caption
              ? this.interpolate(step.caption, vars)
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
              contactId,
            );
            resultados.push(`[MIDIA] Enviado: ${step.mediaUrl}`);
          }
          break;

        case 'TABELA_PRECO':
          if (step.productId) {
            const priceEntries = await this.repo.findPricesByProduto(step.productId);
            const [product] = await this.repo.findProdutoById(step.productId);

            if (product && priceEntries.length > 0) {
              let priceTableText = `*Tabela de Preços - ${product.name}*\n\n`;
              for (const entry of priceEntries) {
                priceTableText += `Tipo ${entry.starRating}: R$ ${entry.unitPrice} (min: ${entry.minQuantity})\n`;
              }
              await this.evolutionService.sendTextMessage(
                contact.phoneNumber,
                priceTableText,
                contactId,
              );
              resultados.push(`[TABELA_PRECO] Enviado para produto ${step.productId}`);
            }
          }
          break;
      }
    }

    return { flowId, contactId, resultados };
  }
}
