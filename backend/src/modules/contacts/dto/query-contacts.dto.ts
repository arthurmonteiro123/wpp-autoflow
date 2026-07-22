import { IsOptional, IsEnum, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EngagementStatusEnum } from './update-contact.dto';

export class QueryContactsDto {
  @ApiPropertyOptional({
    description: 'Número da página para paginação',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @ApiPropertyOptional({
    description: 'Quantidade de registros por página',
    example: 20,
    minimum: 1,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limite?: number = 20;

  @ApiPropertyOptional({
    description: 'Filtrar contatos pelo nível de estrela (1 = até R$1.000 | 2 = R$1.000–R$5.000 | 3 = R$5.000+)',
    enum: [1, 2, 3],
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  starLevel?: number;

  @ApiPropertyOptional({
    description: 'Filtrar contatos pelo status de engajamento',
    enum: ['NOVO', 'RESPONDEU', 'INATIVO', 'ATIVO', 'BLOQUEADO'],
    example: 'ATIVO',
  })
  @IsOptional()
  @IsEnum(EngagementStatusEnum)
  engagementStatus?: EngagementStatusEnum;

  @ApiPropertyOptional({
    description: 'Quando true, retorna apenas contatos sem período de cooldown ativo',
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  somenteSemCooldown?: boolean;
}
