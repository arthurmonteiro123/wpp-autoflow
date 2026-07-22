import { IsInt, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum StepTypeEnum {
  TEXTO = 'TEXTO',
  MIDIA = 'MIDIA',
  TABELA_PRECO = 'TABELA_PRECO',
  DELAY = 'DELAY',
}

export enum StepMediaTypeEnum {
  IMAGEM = 'IMAGEM',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
}

export class CreateStepDto {
  @ApiProperty({
    description: 'Posição/order de execução desta etapa no fluxo (começa em 1)',
    example: 1,
  })
  @IsInt()
  order: number;

  @ApiProperty({
    description: 'Tipo da etapa: TEXTO (mensagem de texto), MIDIA (arquivo de mídia), TABELA_PRECO (tabela de preços do produto) ou DELAY (aguardar N segundos)',
    enum: ['TEXTO', 'MIDIA', 'TABELA_PRECO', 'DELAY'],
    example: 'TEXTO',
  })
  @IsEnum(StepTypeEnum)
  type: StepTypeEnum;

  @ApiPropertyOptional({
    description: 'Conteúdo textual da mensagem. Obrigatório quando type = TEXTO.',
    example: 'Olá {{nome}}, temos ofertas especiais para você!',
  })
  @IsOptional()
  @IsString()
  textContent?: string;

  @ApiPropertyOptional({
    description: 'URL pública do arquivo de mídia. Obrigatório quando type = MIDIA.',
    example: 'https://cdn.empresa.com.br/catalogo.pdf',
  })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({
    description: 'Tipo do arquivo de mídia. Obrigatório quando type = MIDIA.',
    enum: ['IMAGEM', 'VIDEO', 'AUDIO'],
    example: 'IMAGEM',
  })
  @IsOptional()
  @IsEnum(StepMediaTypeEnum)
  mediaType?: StepMediaTypeEnum;

  @ApiPropertyOptional({
    description: 'Legenda exibida junto à mídia enviada',
    example: 'Confira nosso catálogo completo de produtos',
  })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({
    description: 'UUID do produto para exibição da tabela de preços. Obrigatório quando type = TABELA_PRECO.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Duração do delay em segundos. Obrigatório quando type = DELAY.',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  delaySeconds?: number;
}
