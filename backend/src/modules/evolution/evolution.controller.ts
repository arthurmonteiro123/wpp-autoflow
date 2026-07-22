import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { EvolutionService } from './evolution.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Evolution')
@ApiBearerAuth('access-token')
@Controller('evolution')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class EvolutionController {
  constructor(private evolutionService: EvolutionService) {}

  @Get('status')
  @ApiOperation({ summary: 'Status das instâncias Evolution' })
  @ApiQuery({ name: 'instance', required: false, description: 'Nome da instância (omita para listar todas)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  getStatus(@Query('instance') instance?: string) {
    return this.evolutionService.getInstance(instance);
  }

  @Post('connect')
  @ApiOperation({ summary: 'Conectar instância Evolution (gera QR se necessário)' })
  @ApiQuery({ name: 'instance', required: false, description: 'Nome da instância (padrão: primária)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  connect(@Query('instance') instance?: string) {
    return this.evolutionService.connectInstance(instance);
  }

  @Get('qrcode')
  @ApiOperation({ summary: 'QR Code em JSON (base64)' })
  @ApiQuery({ name: 'instance', required: false, description: 'Nome da instância (padrão: primária)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  getQrCode(@Query('instance') instance?: string) {
    return this.evolutionService.getQrCodeCache(instance);
  }

  @Get('instances')
  @ApiOperation({ summary: 'Lista todas as instâncias configuradas e seus status' })
  @ApiResponse({ status: 200 })
  getAllInstances() {
    const svc = this.evolutionService;
    const entry = (name: string, role: string) => ({
      name,
      role,
      ...svc.getQrCodeCache(name),
    });

    return {
      shelby: entry(svc.shelbyInstance, 'Vendedor Principal'),
      ...(svc.moritzInstance ? { moritz: entry(svc.moritzInstance, 'Vendedor') } : {}),
      ...(svc.cobradorInstance ? { cobrador: entry(svc.cobradorInstance, 'Cobrador') } : {}),
      ...(svc.prospectadorInstance ? { prospectador: entry(svc.prospectadorInstance, 'Prospectador') } : {}),
    };
  }

  @Get('manager')
  @Public()
  @ApiOperation({ summary: 'Redireciona para o Evolution Manager' })
  manager(@Res() res: Response) {
    res.redirect('http://localhost:8080/manager');
  }

  @Get('qrcode/view')
  @Public()
  @ApiOperation({ summary: 'QR Code visual (HTML) — abre página para escanear' })
  @ApiQuery({ name: 'instance', required: false, description: 'Nome da instância (padrão: primária)' })
  @ApiResponse({ status: 200 })
  async viewQrCode(@Query('instance') instance: string | undefined, @Res() res: Response) {
    const instanceName = instance ?? this.evolutionService.shelbyInstance;
    const { base64, connected } = this.evolutionService.getQrCodeCache(instanceName);

    if (connected) {
      return res.send(this.htmlPage(
        `Instância "${instanceName}" conectada ✅`,
        `<p style="font-size:1.2rem;color:#4ade80;">WhatsApp já está conectado.<br>Nenhuma ação necessária.</p>`,
      ));
    }

    if (!base64) {
      return res.send(this.htmlPage(
        `QR Code indisponível — "${instanceName}"`,
        `<p style="color:#f87171;">Não foi possível gerar o QR Code.<br>Tente reconectar via <code>POST /evolution/connect?instance=${instanceName}</code> e recarregue a página.</p>`,
      ));
    }

    return res.send(this.htmlPage(
      `Escaneie com o WhatsApp — "${instanceName}"`,
      `<img src="${base64}" alt="QR Code" style="width:280px;height:280px;border:8px solid #fff;border-radius:12px;" />
       <p style="color:#9ca3af;margin-top:12px;">WhatsApp → Aparelhos conectados → Conectar aparelho</p>
       <p style="color:#6b7280;font-size:.85rem;">Página atualiza em <span id="t">30</span>s</p>
       <script>let s=30;setInterval(()=>{s--;document.getElementById('t').textContent=s;if(s<=0)location.reload();},1000);</script>`,
    ));
  }

  @Post('reconnect')
  @ApiOperation({ summary: 'Forçar reconexão — gera novo QR Code' })
  @ApiQuery({ name: 'instance', required: false, description: 'Nome da instância (padrão: primária)' })
  @ApiResponse({ status: 200 })
  reconnect(@Query('instance') instance?: string) {
    return this.evolutionService.reconnect(instance);
  }

  private htmlPage(title: string, body: string) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — wpp-autoflow</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#0f172a;color:#f1f5f9;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px;padding:24px;text-align:center}
    h2{font-size:1.5rem;font-weight:600}
  </style>
</head>
<body>
  <h2>${title}</h2>
  ${body}
</body>
</html>`;
  }
}
