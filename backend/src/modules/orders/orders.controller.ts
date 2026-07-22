import {
  Controller,
  Get,
  Post,
  Patch,
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
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('Pedidos')
@ApiBearerAuth('access-token')
@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar pedidos',
    description: 'Retorna lista paginada de pedidos. VENDEDOR vê apenas seus próprios pedidos; ADMIN e OPERADOR veem todos.',
  })
  @ApiQuery({ name: 'pagina', required: false, type: Number, description: 'Número da página', example: 1 })
  @ApiQuery({ name: 'limite', required: false, type: Number, description: 'Registros por página', example: 20 })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filtrar por status do pedido (ABERTO, FECHADO, CANCELADO)', example: 'ABERTO' })
  @ApiResponse({ status: 200, description: 'Lista paginada de pedidos retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  findAll(
    @CurrentUser() user: any,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('status') status?: string,
  ) {
    return this.ordersService.findAll(
      {
        pagina: pagina ? parseInt(pagina, 10) : 1,
        limite: limite ? parseInt(limite, 10) : 20,
        status,
      },
      user?.role,
    );
  }

  @Post()
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary: 'Criar pedido',
    description: 'Registra um novo pedido para um contato com lista de itens, quantidades e preços.',
  })
  @ApiResponse({ status: 201, description: 'Pedido criado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Buscar pedido por ID',
    description: 'Retorna os dados completos de um pedido, incluindo itens, preços e histórico de status.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do pedido' })
  @ApiResponse({ status: 200, description: 'Pedido encontrado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/fechar')
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary: 'Fechar pedido',
    description: 'Marca um pedido como fechado/confirmado, encerrando possibilidade de edição.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do pedido' })
  @ApiResponse({ status: 200, description: 'Pedido fechado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  fechar(@Param('id') id: string) {
    return this.ordersService.fechar(id);
  }

  @Patch(':id/cancelar')
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary: 'Cancelar pedido',
    description: 'Cancela um pedido em aberto, tornando-o indisponível para novas alterações.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do pedido' })
  @ApiResponse({ status: 200, description: 'Pedido cancelado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  cancelar(@Param('id') id: string) {
    return this.ordersService.cancelar(id);
  }

  @Post(':id/renotificar')
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary: 'Renotificar contato sobre pedido',
    description: 'Reenvia a notificação WhatsApp com o resumo do pedido para o contato vinculado.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do pedido' })
  @ApiResponse({ status: 201, description: 'Renotificação enviada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  renotificar(@Param('id') id: string) {
    return this.ordersService.renotificar(id);
  }
}
