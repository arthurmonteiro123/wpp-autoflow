import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum FlowTypeEnum {
  STAR_1 = '1',
  STAR_2 = '2',
  STAR_3 = '3',
  INATIVO = 'INATIVO',
  BROADCAST = 'BROADCAST',
}

export class CreateFlowDto {
  @ApiProperty({
    description: 'Nome identificador do fluxo de mensagens',
    example: 'Fluxo de Boas-vindas Estrela 1',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Nível de estrela alvo deste fluxo. BROADCAST dispara para todos.',
    enum: ['1', '2', '3', 'INATIVO', 'BROADCAST'],
    example: '2',
  })
  @IsEnum(FlowTypeEnum)
  starRating: FlowTypeEnum;
}
