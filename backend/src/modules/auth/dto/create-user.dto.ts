import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'João Silva',
  })
  @IsString()
  nome: string;

  @ApiProperty({
    description: 'Endereço de e-mail do usuário (único no sistema)',
    example: 'joao.silva@empresa.com.br',
  })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiProperty({
    description: 'Senha do usuário (mínimo 6 caracteres)',
    example: 'senha123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  senha: string;

  @ApiProperty({
    description: 'Perfil de acesso do usuário no sistema',
    enum: ['ADMIN', 'VENDEDOR', 'OPERADOR'],
    example: 'OPERADOR',
  })
  @IsEnum(['ADMIN', 'VENDEDOR', 'OPERADOR'])
  role: 'ADMIN' | 'VENDEDOR' | 'OPERADOR';
}
