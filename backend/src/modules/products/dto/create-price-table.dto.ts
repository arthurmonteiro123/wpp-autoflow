import {
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum StarRatingPriceEnum {
  A = 'A',
  B = 'B',
  C = 'C',
}

export class CreatePriceTableDto {
  @ApiProperty({
    description: 'Segmentação do cliente à qual esta faixa de preço se aplica',
    enum: ['A', 'B', 'C'],
    example: 'A',
  })
  @IsEnum(StarRatingPriceEnum)
  starRating: StarRatingPriceEnum;

  @ApiProperty({
    description: 'Quantidade mínima para aplicação desta faixa de preço',
    example: 1,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  minQuantity: number;

  @ApiPropertyOptional({
    description: 'Quantidade máxima desta faixa de preço (null = sem limite superior)',
    example: 100,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxQuantity?: number;

  @ApiProperty({
    description: 'Preço unitário do produto nesta faixa de quantidade',
    example: 49.90,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({
    description: 'Percentual máximo de desconto permitido para esta faixa (0 a 100)',
    example: 10,
    minimum: 0,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  maxDiscountPct: number = 0;
}
