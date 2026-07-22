import {
  IsUUID,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({
    description: 'UUID do produto incluído no pedido',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Nome do produto no momento da venda (snapshot)',
    example: 'Cimento CP-II 50kg',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Quantidade do produto no pedido',
    example: 10,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({
    description: 'Preço unitário aplicado no momento da venda',
    example: 49.90,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({
    description: 'Percentual de desconto aplicado a este item (0 a 100)',
    example: 5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  discountPct: number;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'UUID do contato/cliente que realizou o pedido',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    format: 'uuid',
  })
  @IsUUID()
  contactId: string;

  @ApiProperty({
    description: 'Lista de itens do pedido com seus respectivos produtos, quantidades e preços',
    type: [OrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({
    description: 'Observações adicionais sobre o pedido',
    example: 'Entregar no período da manhã, solicitar nota fiscal',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
