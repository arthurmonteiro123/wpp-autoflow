import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MediaService } from './media.service';
import { ScheduleDeliveryDto } from './dto/schedule-delivery.dto';

@ApiTags('Mídias', 'Entregas de Mídia')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'OPERADOR')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('midias/upload')
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiOperation({
    summary: 'Fazer upload de mídia',
    description: 'Faz upload de um arquivo de mídia (imagem, vídeo, áudio ou documento) para o sistema. O arquivo é armazenado e uma URL pública é retornada.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['arquivo', 'nome'],
      properties: {
        arquivo: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo de mídia a ser enviado',
        },
        nome: {
          type: 'string',
          description: 'Nome amigável para identificar o arquivo no sistema',
          example: 'Catálogo de Produtos 2024',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Arquivo de mídia enviado com sucesso. Retorna dados da mídia incluindo URL pública.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('nome') nome: string,
    @CurrentUser() user: any,
  ) {
    return this.mediaService.upload(file, nome, user.id);
  }

  @Get('midias')
  @ApiOperation({
    summary: 'Listar mídias',
    description: 'Retorna todas as mídias ativas cadastradas no sistema.',
  })
  @ApiResponse({ status: 200, description: 'Lista de mídias retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  findAll() {
    return this.mediaService.findAll();
  }

  @Delete('midias/:id')
  @ApiOperation({
    summary: 'Remover mídia',
    description: 'Realiza a remoção lógica (soft delete) de uma mídia do sistema.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID da mídia' })
  @ApiResponse({ status: 200, description: 'Mídia removida com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Mídia não encontrada' })
  softDelete(@Param('id') id: string) {
    return this.mediaService.softDelete(id);
  }

  @Post('entregas-midia')
  @ApiOperation({
    summary: 'Agendar entrega de mídia',
    description: 'Agenda o envio de uma mídia para um contato em uma data e hora específicas.',
  })
  @ApiResponse({ status: 201, description: 'Entrega de mídia agendada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  scheduleDelivery(
    @Body() dto: ScheduleDeliveryDto,
    @CurrentUser() user: any,
  ) {
    return this.mediaService.scheduleDelivery(dto, user.id);
  }

  @Get('entregas-midia')
  @ApiOperation({
    summary: 'Listar entregas de mídia',
    description: 'Retorna lista paginada de todas as entregas de mídia agendadas e executadas.',
  })
  @ApiQuery({ name: 'pagina', required: false, type: Number, description: 'Número da página', example: 1 })
  @ApiQuery({ name: 'limite', required: false, type: Number, description: 'Registros por página', example: 20 })
  @ApiResponse({ status: 200, description: 'Lista paginada de entregas retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  getDeliveries(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    return this.mediaService.getDeliveries({
      pagina: pagina ? parseInt(pagina, 10) : 1,
      limite: limite ? parseInt(limite, 10) : 20,
    });
  }

  @Patch('entregas-midia/:id/cancelar')
  @ApiOperation({
    summary: 'Cancelar entrega de mídia',
    description: 'Cancela uma entrega de mídia agendada antes que ela seja executada.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID da entrega de mídia' })
  @ApiResponse({ status: 200, description: 'Entrega de mídia cancelada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Entrega de mídia não encontrada' })
  cancelDelivery(@Param('id') id: string) {
    return this.mediaService.cancelDelivery(id);
  }
}
