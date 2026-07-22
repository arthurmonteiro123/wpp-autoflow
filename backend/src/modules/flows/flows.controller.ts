import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FlowsService } from './flows.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { CreateStepDto } from './dto/create-step.dto';

@ApiTags('Fluxos')
@ApiBearerAuth('access-token')
@Controller('fluxos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'OPERADOR')
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar fluxos',
    description: 'Retorna todos os fluxos de mensagens cadastrados no sistema.',
  })
  @ApiResponse({ status: 200, description: 'Lista de fluxos retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  listFlows() {
    return this.flowsService.listFlows();
  }

  @Post()
  @ApiOperation({
    summary: 'Criar fluxo',
    description: 'Cria um novo fluxo de mensagens automatizadas para um segmento de clientes.',
  })
  @ApiResponse({ status: 201, description: 'Fluxo criado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 409, description: 'Já existe um fluxo ativo para este tipo de cliente' })
  createFlow(@Body() dto: CreateFlowDto) {
    return this.flowsService.createFlow(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Buscar fluxo por ID',
    description: 'Retorna os dados completos de um fluxo, incluindo todas as suas etapas.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do fluxo' })
  @ApiResponse({ status: 200, description: 'Fluxo encontrado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Fluxo não encontrado' })
  findFlow(@Param('id') id: string) {
    return this.flowsService.findFlow(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar fluxo',
    description: 'Atualiza os dados gerais de um fluxo de mensagens.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do fluxo' })
  @ApiResponse({ status: 200, description: 'Fluxo atualizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Fluxo não encontrado' })
  updateFlow(@Param('id') id: string, @Body() dto: Partial<CreateFlowDto>) {
    return this.flowsService.updateFlow(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remover fluxo',
    description: 'Remove um fluxo e todas as suas etapas do sistema.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do fluxo' })
  @ApiResponse({ status: 200, description: 'Fluxo removido com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Fluxo não encontrado' })
  deleteFlow(@Param('id') id: string) {
    return this.flowsService.deleteFlow(id);
  }

  @Post(':id/etapas')
  @ApiOperation({
    summary: 'Adicionar etapa ao fluxo',
    description: 'Adiciona uma nova etapa (texto, mídia, tabela de preços ou delay) a um fluxo existente.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do fluxo' })
  @ApiResponse({ status: 201, description: 'Etapa adicionada ao fluxo com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Fluxo não encontrado' })
  createStep(@Param('id') id: string, @Body() dto: CreateStepDto) {
    return this.flowsService.createStep(id, dto);
  }

  @Patch(':id/etapas/:etapaId')
  @ApiOperation({
    summary: 'Atualizar etapa do fluxo',
    description: 'Atualiza os dados de uma etapa específica de um fluxo.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do fluxo' })
  @ApiParam({ name: 'etapaId', type: 'string', format: 'uuid', description: 'UUID da etapa' })
  @ApiResponse({ status: 200, description: 'Etapa atualizada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Etapa não encontrada' })
  updateStep(
    @Param('etapaId') etapaId: string,
    @Body() dto: Partial<CreateStepDto>,
  ) {
    return this.flowsService.updateStep(etapaId, dto);
  }

  @Delete(':id/etapas/:etapaId')
  @ApiOperation({
    summary: 'Remover etapa do fluxo',
    description: 'Remove uma etapa específica de um fluxo.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do fluxo' })
  @ApiParam({ name: 'etapaId', type: 'string', format: 'uuid', description: 'UUID da etapa' })
  @ApiResponse({ status: 200, description: 'Etapa removida com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Etapa não encontrada' })
  deleteStep(@Param('etapaId') etapaId: string) {
    return this.flowsService.deleteStep(etapaId);
  }

  @Post(':id/testar/:contatoId')
  @ApiOperation({
    summary: 'Testar fluxo com contato',
    description: 'Executa o fluxo manualmente para um contato específico, permitindo validar o comportamento antes de ativar em produção.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do fluxo' })
  @ApiParam({ name: 'contatoId', type: 'string', format: 'uuid', description: 'UUID do contato para teste' })
  @ApiResponse({ status: 201, description: 'Fluxo de teste iniciado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Fluxo ou contato não encontrado' })
  testarFluxo(
    @Param('id') id: string,
    @Param('contatoId') contatoId: string,
  ) {
    return this.flowsService.testarFluxo(id, contatoId);
  }
}
