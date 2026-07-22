import { IsArray, IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertMappingDto {
  @ApiProperty({
    enum: ['shelby', 'moritz', 'cobrador', 'prospectador'],
    description: 'Instance role identifier',
  })
  @IsEnum(['shelby', 'moritz', 'cobrador', 'prospectador'])
  instanceRole: string;

  @ApiProperty({
    type: [String],
    example: ['1', '2'],
    description: 'Níveis de estrela que esta instância atende (1, 2 ou 3)',
  })
  @IsArray()
  @IsString({ each: true })
  starRatings: string[];
}
