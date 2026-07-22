import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

// Comparação em tempo constante — evita descobrir o secret por timing attack
function safeEquals(a: string | undefined, b: string): boolean {
  if (typeof a !== 'string' || a.length === 0) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expectedSecret = this.configService.get<string>('EVOLUTION_WEBHOOK_SECRET', '');

    // Sem secret configurado → aceita qualquer chamada (ambiente dev)
    if (!expectedSecret) return true;

    // Aceita via header (chamadas do frontend/API) ou query param (Evolution API webhook)
    const headerSecret = request.headers['x-evolution-webhook-secret'] as string;
    const querySecret = request.query['secret'] as string;

    if (safeEquals(headerSecret, expectedSecret) || safeEquals(querySecret, expectedSecret)) {
      return true;
    }

    throw new UnauthorizedException('Invalid webhook secret');
  }
}
