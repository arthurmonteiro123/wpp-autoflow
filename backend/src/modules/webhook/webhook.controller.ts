import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('evolution')
  @UseGuards(WebhookGuard)
  @ApiOperation({
    summary: 'Receber evento do Evolution API',
    description: 'Endpoint receptor de eventos enviados pelo Evolution API (mensagens recebidas, status de entrega, conexão, etc.). Autenticado via segredo no header x-evolution-webhook-secret.',
  })
  @ApiHeader({
    name: 'x-evolution-webhook-secret',
    description: 'Segredo de validação do webhook configurado na instância Evolution',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Evento processado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Segredo do webhook ausente ou inválido' })
  handleEvent(@Body() body: any) {
    return this.webhookService.handleEvent(body);
  }
}
