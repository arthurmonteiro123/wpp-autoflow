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
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';

@ApiTags('Contatos')
@ApiBearerAuth('access-token')
@Controller('contatos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary: 'Listar contatos',
    description: 'Retorna lista paginada de contatos com filtros opcionais por nível de estrela, status de engajamento e cooldown.',
  })
  @ApiQuery({ name: 'pagina', required: false, type: Number, description: 'Número da página', example: 1 })
  @ApiQuery({ name: 'limite', required: false, type: Number, description: 'Registros por página', example: 20 })
  @ApiQuery({ name: 'starLevel', required: false, type: Number, enum: [1, 2, 3], description: 'Filtrar por nível de estrela do lead' })
  @ApiQuery({ name: 'engagementStatus', required: false, enum: ['NOVO', 'RESPONDEU', 'INATIVO', 'ATIVO', 'BLOQUEADO'], description: 'Filtrar por status de engajamento' })
  @ApiQuery({ name: 'somenteSemCooldown', required: false, type: Boolean, description: 'Retornar apenas contatos sem cooldown ativo' })
  @ApiResponse({ status: 200, description: 'Lista paginada de contatos retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  findAll(@Query() query: QueryContactsDto) {
    return this.contactsService.findAll(query);
  }

  @Post()
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary: 'Criar contato',
    description: 'Cria um novo contato. O nível de estrela começa em 1 e é atualizado automaticamente conforme os pedidos são fechados.',
  })
  @ApiResponse({ status: 201, description: 'Contato criado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 409, description: 'Número de WhatsApp já cadastrado no sistema' })
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @Post('importar-csv')
  @Roles('ADMIN', 'OPERADOR')
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiOperation({
    summary: 'Importar contatos via CSV',
    description: 'Importa múltiplos contatos a partir de um arquivo CSV. Colunas esperadas: name, phoneNumber, notes.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['arquivo'],
      properties: {
        arquivo: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo CSV com os contatos a importar',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Contatos importados com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  importarCsv(@UploadedFile() file: Express.Multer.File) {
    return this.contactsService.importarCsv(file.buffer);
  }

  @Get(':id/historico')
  @Roles('ADMIN', 'OPERADOR', 'VENDEDOR')
  @ApiOperation({
    summary: 'Histórico de mensagens do contato',
    description: 'Retorna o histórico completo de mensagens enviadas e recebidas de um contato.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do contato' })
  @ApiResponse({ status: 200, description: 'Histórico de mensagens retornado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Contato não encontrado' })
  getHistorico(@Param('id') id: string) {
    return this.contactsService.getHistorico(id);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary: 'Atualizar status de engajamento',
    description: 'Altera o status de engajamento de um contato (NOVO, RESPONDEU, INATIVO, ATIVO, BLOQUEADO).',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do contato' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: ['NOVO', 'RESPONDEU', 'INATIVO', 'ATIVO', 'BLOQUEADO'],
          description: 'Novo status de engajamento do contato',
          example: 'ATIVO',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Status de engajamento atualizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Contato não encontrado' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.contactsService.updateStatus(id, status);
  }

  @Patch(':id/nivel-estrela')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Ajustar nível de estrela manualmente (admin)',
    description: 'Permite que o admin sobrescreva o nível de estrela calculado automaticamente.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do contato' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['starLevel'],
      properties: {
        starLevel: {
          type: 'integer',
          enum: [1, 2, 3],
          description: 'Novo nível de estrela do lead',
          example: 2,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Nível de estrela atualizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Contato não encontrado' })
  updateStarLevel(@Param('id') id: string, @Body('starLevel') starLevel: number) {
    return this.contactsService.updateStarLevel(id, starLevel);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary: 'Atualizar dados do contato',
    description: 'Atualiza os dados gerais de um contato existente.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do contato' })
  @ApiResponse({ status: 200, description: 'Contato atualizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Contato não encontrado' })
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(id, dto);
  }

  @Post(':id/reiniciar-bot')
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary: 'Reiniciar bot para o contato',
    description: 'Zera o cooldown e define o status como NOVO, tornando o contato elegível para o próximo ciclo do Pulse.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do contato' })
  @ApiResponse({ status: 201, description: 'Bot reiniciado com sucesso.' })
  @ApiResponse({ status: 404, description: 'Contato não encontrado' })
  reiniciarBot(@Param('id') id: string) {
    return this.contactsService.reiniciarBot(id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'OPERADOR')
  @ApiOperation({
    summary: 'Remover contato',
    description: 'Realiza a remoção lógica (soft delete) de um contato do sistema.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do contato' })
  @ApiResponse({ status: 200, description: 'Contato removido com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Contato não encontrado' })
  softDelete(@Param('id') id: string) {
    return this.contactsService.softDelete(id);
  }
}
