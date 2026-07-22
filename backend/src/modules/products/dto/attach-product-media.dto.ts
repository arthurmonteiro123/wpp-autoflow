import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum StarRatingMediaEnum {
  A = 'A',
  B = 'B',
  C = 'C',
  TODOS = 'TODOS',
}

export class AttachProductMediaDto {
  @ApiProperty({
    description: 'UUID da mídia já cadastrada na biblioteca de mídias',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  mediaId: string;

  @ApiPropertyOptional({
    description: 'Segmentação de cliente para a qual esta mídia deve ser exibida',
    enum: StarRatingMediaEnum,
    default: StarRatingMediaEnum.TODOS,
  })
  @IsOptional()
  @IsEnum(StarRatingMediaEnum)
  starRating?: StarRatingMediaEnum;

  @ApiPropertyOptional({
    description: 'Legenda exibida junto à mídia do produto',
    example: 'Foto do produto embalado',
  })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({
    description: 'Ordem de exibição da mídia na galeria do produto',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}
