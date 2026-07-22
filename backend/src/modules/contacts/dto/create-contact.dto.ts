import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumberString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({
    description: 'Nome completo do contato/cliente',
    example: 'João Silva',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Número WhatsApp no formato internacional sem + ou espaços (10 a 15 dígitos)',
    example: '5511999999999',
  })
  @IsString()
  @Matches(/^[0-9]{10,15}$/, { message: 'phoneNumber deve conter apenas dígitos (10 a 15)' })
  phoneNumber: string;

  @ApiPropertyOptional({
    description: 'Observações internas sobre o contato/cliente',
    example: 'Prefere contato pela manhã',
  })
  @IsOptional()
  @IsString()
  notes?: string;

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
