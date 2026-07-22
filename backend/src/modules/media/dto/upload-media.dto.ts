import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadMediaDto {
  @ApiProperty({
    description: 'Nome amigável para identificar o arquivo de mídia no sistema',
    example: 'Catálogo de Produtos 2024',
  })
  @IsString()
  @IsNotEmpty()
  nome: string;
}
