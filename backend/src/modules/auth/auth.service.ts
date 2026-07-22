import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { adminUsers } from '../../../drizzle/schema/auth.schema';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthRepository } from './auth.repository';

@Injectable()
export class AuthService {
  constructor(
    private repo: AuthRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Hash dummy comparado quando o e-mail não existe, para o tempo de resposta
  // ser igual com e sem usuário (evita enumeração de e-mails por timing)
  private static readonly DUMMY_HASH =
    '$2b$10$C6UzMDM.H6dfI/f/IKcEeO7ZBpUvW1nlDkS0uEspoRLC7QW04GJGa';

  async login(dto: LoginDto) {
    const [user] = await this.repo.findByEmail(dto.email);

    const hashToCompare =
      user && !user.deletedAt ? user.passwordHash : AuthService.DUMMY_HASH;
    const passwordOk = await bcrypt.compare(dto.senha, hashToCompare);

    if (!user || user.deletedAt || !passwordOk) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    if (user.status === 'INATIVO') {
      throw new UnauthorizedException('Usuário inativo');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
    });

    return { accessToken, refreshToken, user: this.sanitize(user) };
  }

  async refresh(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
      const newPayload = { sub: payload.sub, email: payload.email, role: payload.role };
      return { accessToken: this.jwtService.sign(newPayload) };
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  async getMe(userId: string) {
    const [user] = await this.repo.findByIdActive(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return this.sanitize(user);
  }

  async createUser(dto: CreateUserDto) {
    const [existing] = await this.repo.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email já cadastrado');

    const passwordHash = await bcrypt.hash(dto.senha, 10);
    const [user] = await this.repo.insert({
      name: dto.nome,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });

    return this.sanitize(user);
  }

  async listUsers() {
    const users = await this.repo.findAllActive();
    return users.map(this.sanitize);
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const updates: Partial<typeof adminUsers.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (dto.nome) updates.name = dto.nome;
    if (dto.senha) updates.passwordHash = await bcrypt.hash(dto.senha, 10);
    if (dto.role) updates.role = dto.role;
    if (dto.status) updates.status = dto.status;

    const [user] = await this.repo.update(id, updates);

    if (!user) throw new NotFoundException('Usuário não encontrado');
    return this.sanitize(user);
  }

  async deleteUser(id: string) {
    const [user] = await this.repo.softDelete(id);

    if (!user) throw new NotFoundException('Usuário não encontrado');
    return { message: 'Usuário removido com sucesso' };
  }

  private sanitize(user: typeof adminUsers.$inferSelect) {
    const { passwordHash: _, ...safe } = user;
    return safe;
  }
}
