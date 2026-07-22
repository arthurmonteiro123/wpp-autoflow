import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Novo nome completo do usuário',
    example: 'João Silva Atualizado',
  })
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({
    description: 'Nova senha do usuário (mínimo 6 caracteres)',
    example: 'novaSenha456',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  senha?: string;

  @ApiPropertyOptional({
    description: 'Novo perfil de acesso do usuário',
    enum: ['ADMIN', 'VENDEDOR', 'OPERADOR'],
    example: 'VENDEDOR',
  })
  @IsOptional()
  @IsEnum(['ADMIN', 'VENDEDOR', 'OPERADOR'])
  role?: 'ADMIN' | 'VENDEDOR' | 'OPERADOR';

  @ApiPropertyOptional({
    description: 'Status de ativação da conta do usuário',
    enum: ['ATIVO', 'INATIVO'],
    example: 'ATIVO',
  })
  @IsOptional()
  @IsEnum(['ATIVO', 'INATIVO'])
  status?: 'ATIVO' | 'INATIVO';
}
