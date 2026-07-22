import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    description: 'Nome do produto',
    example: 'Cimento CP-II 50kg',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'UUID da categoria à qual o produto pertence',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Descrição detalhada do produto',
    example: 'Cimento Portland Composto de alta resistência para construção civil',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Unidade de medida do produto (ex: kg, un, saco, caixa)',
    example: 'saco',
  })
  @IsString()
  @IsNotEmpty()
  unit: string;
}
