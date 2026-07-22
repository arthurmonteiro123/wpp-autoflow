import { IsString, IsEnum, IsOptional, IsNotEmpty, IsBoolean, IsNumberString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum EngagementStatusEnum {
  NOVO = 'NOVO',
  RESPONDEU = 'RESPONDEU',
  INATIVO = 'INATIVO',
  ATIVO = 'ATIVO',
  BLOQUEADO = 'BLOQUEADO',
}

export class UpdateContactDto {
  @ApiPropertyOptional({
    description: 'Nome completo do contato/cliente',
    example: 'João Silva Atualizado',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description: 'Número WhatsApp no formato internacional sem + ou espaços (10 a 15 dígitos)',
    example: '5511988887777',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10,15}$/, { message: 'phoneNumber deve conter apenas dígitos (10 a 15)' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Observações internas sobre o contato/cliente',
    example: 'Cliente VIP, atender com prioridade',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Status atual de engajamento do contato no fluxo de mensagens',
    enum: ['NOVO', 'RESPONDEU', 'INATIVO', 'ATIVO', 'BLOQUEADO'],
    example: 'ATIVO',
  })
  @IsOptional()
  @IsEnum(EngagementStatusEnum)
  engagementStatus?: EngagementStatusEnum;

  @ApiPropertyOptional({
    description: 'Data/hora até quando o contato está em período de cooldown (ISO 8601)',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsString()
  cooldownUntil?: string;

  @ApiPropertyOptional({
    description: 'Endereço do contato/cliente',
    example: 'Rua das Hortências, 800 — São Carlos',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Rede social do contato/cliente (ex.: usuário do Instagram)',
    example: '@joaosilva',
  })
  @IsOptional()
  @IsString()
  socialMedia?: string;

  @ApiPropertyOptional({
    description: 'Indica se o contato/cliente possui dívida em aberto',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  owesDebt?: boolean;

  @ApiPropertyOptional({
    description: 'Valor da dívida em aberto (string decimal, ex.: "150.00")',
    example: '150.00',
  })
  @IsOptional()
  @IsNumberString()
  debtAmount?: string;
}
