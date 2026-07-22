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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateParamDto } from './dto/update-param.dto';

@ApiTags('Campanhas', 'Parâmetros')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'OPERADOR')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('campanhas')
  @ApiOperation({
    summary: 'Listar campanhas',
    description:
      'Retorna lista paginada de todas as campanhas de disparo cadastradas.',
  })
  @ApiQuery({
    name: 'pagina',
    required: false,
    type: Number,
    description: 'Número da página',
    example: 1,
  })
  @ApiQuery({
    name: 'limite',
    required: false,
    type: Number,
    description: 'Registros por página',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de campanhas retornada com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  findAll(@Query('pagina') pagina?: string, @Query('limite') limite?: string) {
    return this.campaignsService.findAll({
      pagina: pagina ? parseInt(pagina, 10) : 1,
      limite: limite ? parseInt(limite, 10) : 20,
    });
  }

  @Post('campanhas')
  @ApiOperation({
    summary: 'Criar campanha',
    description:
      'Cria uma nova campanha de disparo de mensagens. Pode ser imediata ou agendada.',
  })
  @ApiResponse({ status: 201, description: 'Campanha criada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: any) {
    return this.campaignsService.create(dto, user.id);
  }

  @Get('campanhas/:id')
  @ApiOperation({
    summary: 'Buscar campanha por ID',
    description:
      'Retorna os dados completos de uma campanha, incluindo estatísticas de envio.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID da campanha',
  })
  @ApiResponse({ status: 200, description: 'Campanha encontrada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Campanha não encontrada' })
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Patch('campanhas/:id')
  @ApiOperation({
    summary: 'Atualizar campanha',
    description:
      'Atualiza os dados de uma campanha. Somente campanhas com status RASCUNHO ou AGENDADO podem ser editadas.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID da campanha',
  })
  @ApiResponse({ status: 200, description: 'Campanha atualizada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Campanha não encontrada' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateCampaignDto>) {
    return this.campaignsService.update(id, dto);
  }

  @Post('campanhas/:id/disparar')
  @ApiOperation({
    summary: 'Disparar campanha',
    description:
      'Inicia o disparo imediato de uma campanha para todos os contatos qualificados.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID da campanha',
  })
  @ApiResponse({ status: 201, description: 'Campanha disparada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Campanha não encontrada' })
  disparar(@Param('id') id: string) {
    return this.campaignsService.disparar(id);
  }

  @Post('campanhas/:id/cancelar')
  @ApiOperation({
    summary: 'Cancelar campanha',
    description:
      'Cancela uma campanha agendada ou em andamento, interrompendo os disparos pendentes.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID da campanha',
  })
  @ApiResponse({ status: 201, description: 'Campanha cancelada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Campanha não encontrada' })
  cancelar(@Param('id') id: string) {
    return this.campaignsService.cancelar(id);
  }

  @Delete('campanhas/:id')
  @ApiOperation({
    summary: 'Remover campanha',
    description:
      'Remove definitivamente uma campanha (produtos e entregas associados caem junto via cascade). Somente RASCUNHO, CANCELADO ou CONCLUIDO — campanhas em andamento/agendadas devem ser canceladas antes.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID da campanha',
  })
  @ApiResponse({ status: 200, description: 'Campanha removida com sucesso.' })
  @ApiResponse({
    status: 400,
    description: 'Campanha em andamento/agendada — cancele antes',
  })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Campanha não encontrada' })
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }

  @Get('campanhas/:id/entregas')
  @ApiOperation({
    summary: 'Listar entregas da campanha',
    description:
      'Retorna lista paginada dos registros de entrega de uma campanha, com status de cada envio.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID da campanha',
  })
  @ApiQuery({
    name: 'pagina',
    required: false,
    type: Number,
    description: 'Número da página',
    example: 1,
  })
  @ApiQuery({
    name: 'limite',
    required: false,
    type: Number,
    description: 'Registros por página',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de entregas retornada com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Campanha não encontrada' })
  getEntregas(
    @Param('id') id: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    return this.campaignsService.getEntregas(id, {
      pagina: pagina ? parseInt(pagina, 10) : 1,
      limite: limite ? parseInt(limite, 10) : 20,
    });
  }

  @Get('parametros')
  @ApiOperation({
    summary: 'Listar parâmetros do sistema',
    description:
      'Retorna todos os parâmetros de configuração do sistema de automação (intervalos, limites, etc.).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de parâmetros retornada com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  getParametros() {
    return this.campaignsService.getParametros();
  }

  @Patch('parametros/:key')
  @ApiOperation({
    summary: 'Atualizar parâmetro do sistema',
    description: 'Atualiza o valor de um parâmetro de configuração do sistema.',
  })
  @ApiParam({
    name: 'key',
    type: 'string',
    description:
      'Chave identificadora do parâmetro (ex: INTERVALO_DISPARO_SEGUNDOS)',
  })
  @ApiResponse({
    status: 200,
    description: 'Parâmetro atualizado com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Parâmetro não encontrado' })
  updateParametro(
    @Param('key') key: string,
    @Body() dto: UpdateParamDto,
    @CurrentUser() user: any,
  ) {
    return this.campaignsService.updateParametro(key, dto.value, user?.id);
  }
}
