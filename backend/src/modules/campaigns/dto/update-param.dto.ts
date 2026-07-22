import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateParamDto {
  @ApiProperty({
    description: 'Novo valor do parâmetro de configuração do sistema',
    example: '30',
  })
  @IsString()
  @IsNotEmpty()
  value!: string;
}
