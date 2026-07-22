import { IsUUID, IsISO8601, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScheduleDeliveryDto {
  @ApiProperty({
    description: 'UUID do contato que receberá a entrega de mídia',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    format: 'uuid',
  })
  @IsUUID()
  contactId: string;

  @ApiProperty({
    description: 'UUID da mídia a ser entregue ao contato',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    format: 'uuid',
  })
  @IsUUID()
  mediaId: string;

  @ApiProperty({
    description: 'Data e hora agendada para o envio da mídia ao contato (ISO 8601)',
    example: '2024-12-25T09:00:00.000Z',
  })
  @IsISO8601()
  scheduledFor: string;

  @ApiPropertyOptional({
    description: 'Legenda opcional a ser enviada junto com a mídia',
    example: 'Segue o catálogo de produtos que você solicitou!',
  })
  @IsOptional()
  @IsString()
  caption?: string;
}
