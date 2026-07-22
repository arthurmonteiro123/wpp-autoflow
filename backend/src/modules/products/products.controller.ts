import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreatePriceTableDto } from './dto/create-price-table.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { AttachProductMediaDto } from './dto/attach-product-media.dto';

@ApiTags('Produtos', 'Categorias', 'Tabela de Preço')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'OPERADOR')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // --- Categorias ---

  @Post('categorias-produto')
  @ApiOperation({
    summary: 'Criar categoria de produto',
    description: 'Cria uma nova categoria para organização de produtos.',
  })
  @ApiResponse({ status: 201, description: 'Categoria criada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 409, description: 'Categoria com este nome já existe' })
  createCategoria(@Body() dto: CreateCategoryDto) {
    return this.productsService.createCategoria(dto);
  }

  @Get('categorias-produto')
  @ApiOperation({
    summary: 'Listar categorias de produtos',
    description: 'Retorna todas as categorias de produtos cadastradas no sistema.',
  })
  @ApiResponse({ status: 200, description: 'Lista de categorias retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  listCategorias() {
    return this.productsService.listCategorias();
  }

  @Patch('categorias-produto/:id')
  @ApiOperation({
    summary: 'Atualizar categoria de produto',
    description: 'Atualiza os dados de uma categoria de produto existente.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID da categoria' })
  @ApiResponse({ status: 200, description: 'Categoria atualizada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  updateCategoria(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCategoryDto>,
  ) {
    return this.productsService.updateCategoria(id, dto);
  }

  @Delete('categorias-produto/:id')
  @ApiOperation({
    summary: 'Remover categoria de produto',
    description: 'Remove uma categoria de produto do sistema.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID da categoria' })
  @ApiResponse({ status: 200, description: 'Categoria removida com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  deleteCategoria(@Param('id') id: string) {
    return this.productsService.deleteCategoria(id);
  }

  // --- Produtos ---

  @Post('produtos')
  @ApiOperation({
    summary: 'Criar produto',
    description: 'Cadastra um novo produto no sistema com nome, unidade e categoria opcional.',
  })
  @ApiResponse({ status: 201, description: 'Produto criado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 409, description: 'Produto com este nome já existe' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get('produtos')
  @ApiOperation({
    summary: 'Listar produtos',
    description: 'Retorna lista paginada de todos os produtos ativos no sistema.',
  })
  @ApiQuery({ name: 'pagina', required: false, type: Number, description: 'Número da página', example: 1 })
  @ApiQuery({ name: 'limite', required: false, type: Number, description: 'Registros por página', example: 20 })
  @ApiResponse({ status: 200, description: 'Lista paginada de produtos retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  findAll(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    return this.productsService.findAll({
      pagina: pagina ? parseInt(pagina, 10) : 1,
      limite: limite ? parseInt(limite, 10) : 20,
    });
  }

  @Get('produtos/:id')
  @ApiOperation({
    summary: 'Buscar produto por ID',
    description: 'Retorna os dados completos de um produto, incluindo sua tabela de preços.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do produto' })
  @ApiResponse({ status: 200, description: 'Produto encontrado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch('produtos/:id')
  @ApiOperation({
    summary: 'Atualizar produto',
    description: 'Atualiza os dados de um produto existente.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do produto' })
  @ApiResponse({ status: 200, description: 'Produto atualizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateProductDto>) {
    return this.productsService.update(id, dto);
  }

  @Delete('produtos/:id')
  @ApiOperation({
    summary: 'Remover produto',
    description: 'Realiza a remoção lógica (soft delete) de um produto do sistema.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do produto' })
  @ApiResponse({ status: 200, description: 'Produto removido com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  softDelete(@Param('id') id: string) {
    return this.productsService.softDelete(id);
  }

  // --- Tabela de Preço ---

  @Post('produtos/:id/tabela-preco')
  @ApiOperation({
    summary: 'Criar entrada na tabela de preço',
    description: 'Adiciona uma faixa de preço por quantidade e tipo de cliente a um produto.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do produto' })
  @ApiResponse({ status: 201, description: 'Entrada na tabela de preço criada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  createPriceEntry(
    @Param('id') id: string,
    @Body() dto: CreatePriceTableDto,
  ) {
    return this.productsService.createPriceEntry(id, dto);
  }

  @Get('produtos/:id/tabela-preco')
  @ApiOperation({
    summary: 'Listar tabela de preços do produto',
    description: 'Retorna todas as faixas de preço cadastradas para um produto.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do produto' })
  @ApiResponse({ status: 200, description: 'Tabela de preços retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  listPriceTable(@Param('id') id: string) {
    return this.productsService.listPriceTable(id);
  }

  @Patch('produtos/:id/tabela-preco/:entryId')
  @ApiOperation({
    summary: 'Atualizar entrada da tabela de preço',
    description: 'Atualiza os dados de uma faixa de preço específica de um produto.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do produto' })
  @ApiParam({ name: 'entryId', type: 'string', format: 'uuid', description: 'UUID da entrada na tabela de preço' })
  @ApiResponse({ status: 200, description: 'Entrada na tabela de preço atualizada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Entrada na tabela de preço não encontrada' })
  updatePriceEntry(
    @Param('entryId') entryId: string,
    @Body() dto: Partial<CreatePriceTableDto>,
  ) {
    return this.productsService.updatePriceEntry(entryId, dto);
  }

  @Delete('produtos/:id/tabela-preco/:entryId')
  @ApiOperation({
    summary: 'Remover entrada da tabela de preço',
    description: 'Remove uma faixa de preço específica de um produto.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do produto' })
  @ApiParam({ name: 'entryId', type: 'string', format: 'uuid', description: 'UUID da entrada na tabela de preço' })
  @ApiResponse({ status: 200, description: 'Entrada na tabela de preço removida com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Entrada na tabela de preço não encontrada' })
  deletePriceEntry(@Param('entryId') entryId: string) {
    return this.productsService.deletePriceEntry(entryId);
  }

  // --- Mídia ---

  @Post('produtos/:id/midias')
  @ApiOperation({
    summary: 'Atrelar mídia ao produto',
    description: 'Vincula uma mídia já cadastrada na biblioteca de mídias a um produto, criando uma cópia dos dados na galeria do produto.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do produto' })
  @ApiResponse({ status: 201, description: 'Mídia atrelada ao produto com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Produto ou mídia não encontrada' })
  attachMedia(@Param('id') id: string, @Body() dto: AttachProductMediaDto) {
    return this.productsService.attachMedia(id, dto);
  }

  @Get('produtos/:id/midias')
  @ApiOperation({
    summary: 'Listar mídias do produto',
    description: 'Retorna todas as mídias atreladas a um produto.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do produto' })
  @ApiResponse({ status: 200, description: 'Lista de mídias do produto retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  listMedia(@Param('id') id: string) {
    return this.productsService.listMedia(id);
  }

  @Delete('produtos/:id/midias/:mediaEntryId')
  @ApiOperation({
    summary: 'Remover mídia do produto',
    description: 'Desvincula uma mídia da galeria de um produto.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do produto' })
  @ApiParam({ name: 'mediaEntryId', type: 'string', format: 'uuid', description: 'UUID da mídia do produto' })
  @ApiResponse({ status: 200, description: 'Mídia removida do produto com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Mídia não encontrada para este produto' })
  removeMedia(@Param('id') id: string, @Param('mediaEntryId') mediaEntryId: string) {
    return this.productsService.removeMedia(id, mediaEntryId);
  }
}
