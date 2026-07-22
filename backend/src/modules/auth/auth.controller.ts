import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('auth/login')
  // Anti brute-force: máximo 5 tentativas de login por IP por minuto
  @Throttle({ burst: { ttl: 60_000, limit: 5 }, sustained: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Autenticar usuário',
    description: 'Realiza login com e-mail e senha e retorna tokens de acesso (JWT) e refresh.',
  })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso. Retorna accessToken, refreshToken e dados do usuário.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('auth/refresh')
  @Throttle({ burst: { ttl: 60_000, limit: 20 }, sustained: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Renovar token de acesso',
    description: 'Utiliza o refreshToken para obter um novo accessToken sem necessidade de novo login.',
  })
  @ApiResponse({ status: 200, description: 'Novo accessToken gerado com sucesso.' })
  @ApiResponse({ status: 401, description: 'RefreshToken ausente, inválido ou expirado' })
  refresh(@Body('refreshToken') token: string) {
    return this.authService.refresh(token);
  }

  @Get('auth/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Dados do usuário autenticado',
    description: 'Retorna os dados do usuário atual com base no token JWT informado.',
  })
  @ApiResponse({ status: 200, description: 'Dados do usuário autenticado retornados com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  getMe(@CurrentUser() user: { id: string }) {
    return this.authService.getMe(user.id);
  }

  @Post('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Criar novo usuário',
    description: 'Cria um novo usuário no sistema. Exclusivo para administradores.',
  })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado no sistema' })
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Get('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Listar todos os usuários',
    description: 'Retorna a lista de todos os usuários cadastrados no sistema. Exclusivo para administradores.',
  })
  @ApiResponse({ status: 200, description: 'Lista de usuários retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  listUsers() {
    return this.authService.listUsers();
  }

  @Patch('admin/users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Atualizar usuário',
    description: 'Atualiza os dados de um usuário existente. Exclusivo para administradores.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do usuário' })
  @ApiResponse({ status: 200, description: 'Usuário atualizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  updateUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.authService.updateUser(id, dto);
  }

  @Delete('admin/users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Remover usuário',
    description: 'Remove um usuário do sistema. Exclusivo para administradores.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'UUID do usuário' })
  @ApiResponse({ status: 200, description: 'Usuário removido com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Acesso negado para seu perfil' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.authService.deleteUser(id);
  }
}
