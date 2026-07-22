import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Nome da categoria de produtos',
    example: 'Materiais de Construção',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
