import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsIn,
  IsISO8601,
  IsInt,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CampaignTypeEnum {
  IMEDIATO = 'IMEDIATO',
  AGENDADO = 'AGENDADO',
  RECORRENTE = 'RECORRENTE',
}

export enum CampaignMediaTypeEnum {
  IMAGEM = 'IMAGEM',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENTO = 'DOCUMENTO',
}

export class CreateCampaignDto {
  @ApiProperty({
    description: 'Nome identificador da campanha de disparo',
    example: 'Promoção de Natal 2024',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description:
      'Tipo de disparo: IMEDIATO (dispara ao salvar), AGENDADO (dispara na data definida em scheduledFor) ou RECORRENTE (reenvia um catálogo de produtos em ciclos, dentro de uma janela de tempo)',
    enum: ['IMEDIATO', 'AGENDADO', 'RECORRENTE'],
    example: 'AGENDADO',
  })
  @IsEnum(CampaignTypeEnum)
  type: CampaignTypeEnum;

  @ApiPropertyOptional({
    description:
      'Texto da mensagem a ser enviada para os contatos da campanha. Obrigatório para IMEDIATO/AGENDADO. Para RECORRENTE (script "Salve") é opcional: quando presente, é enviada como primeira mensagem de cada ciclo (antes do catálogo) e o rodapé fixo do catálogo é omitido; quando ausente, o ciclo envia apenas o catálogo gerado (comportamento anterior). Ver SCRIPT_SALVE_SLICE.md.',
    example: 'Salve! Chegou tabela nova com preço especial pra você 👊',
  })
  @ValidateIf((o) => o.type !== CampaignTypeEnum.RECORRENTE)
  @IsString()
  @IsNotEmpty()
  message?: string;

  @ApiPropertyOptional({
    description: 'URL pública do arquivo de mídia a ser anexado à mensagem',
    example: 'https://cdn.empresa.com.br/promo-natal.jpg',
  })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({
    description: 'Tipo do arquivo de mídia anexado',
    enum: ['IMAGEM', 'VIDEO', 'AUDIO', 'DOCUMENTO'],
    example: 'IMAGEM',
  })
  @IsOptional()
  @IsEnum(CampaignMediaTypeEnum)
  mediaType?: CampaignMediaTypeEnum;

  @ApiPropertyOptional({
    description:
      'Nível de estrela alvo da campanha (1, 2 ou 3). Quando ausente, dispara para todos.',
    enum: ['1', '2', '3'],
    example: '2',
  })
  @IsOptional()
  @IsIn(['1', '2', '3'])
  targetStarRating?: string;

  @ApiPropertyOptional({
    description: 'Filtrar contatos por status de engajamento para este disparo',
    example: 'ATIVO',
  })
  @IsOptional()
  @IsString()
  targetStatus?: string;

  @ApiPropertyOptional({
    description:
      'Data e hora de agendamento do disparo (ISO 8601). Obrigatório quando type = AGENDADO.',
    example: '2024-12-25T10:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;

  @ApiPropertyOptional({
    description:
      'Início da janela de disparo recorrente (ISO 8601). Obrigatório quando type = RECORRENTE.',
    example: '2026-07-08T09:00:00.000Z',
  })
  @ValidateIf((o) => o.type === CampaignTypeEnum.RECORRENTE)
  @IsISO8601()
  startAt?: string;

  @ApiPropertyOptional({
    description:
      'Término da janela de disparo recorrente (ISO 8601, deve ser posterior a startAt). Opcional: quando ausente/null, a campanha roda por tempo indeterminado.',
    example: '2026-07-15T23:59:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601()
  endAt?: string | null;

  @ApiPropertyOptional({
    description:
      'Intervalo de reenvio do catálogo, em minutos (ex: 1440 = 1x por dia). Obrigatório quando type = RECORRENTE. Mínimo: 10 minutos (piso oficial do produto — ver SCRIPT_SALVE_SLICE.md, seção 4).',
    example: 1440,
    minimum: 10,
  })
  @ValidateIf((o) => o.type === CampaignTypeEnum.RECORRENTE)
  @IsInt()
  @Min(10, { message: 'repeatIntervalMinutes deve ser no mínimo 10 (minutos)' })
  repeatIntervalMinutes?: number;
}
