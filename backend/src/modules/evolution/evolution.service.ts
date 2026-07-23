import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';
import { DatabaseService } from '../../database/database.service';
import { messageLogs } from '../../../drizzle/schema/evolution.schema';
import { EvolutionException } from './evolution.exception';

type MediaType = 'image' | 'video' | 'audio' | 'document';

export type InstanceRole = 'shelby' | 'moritz' | 'cobrador' | 'prospectador';

interface InstanceState {
  cachedQr: string | null;
  isConnected: boolean;
  socket: Socket | null;
}

@Injectable()
export class EvolutionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly http: AxiosInstance;
  private readonly webhookSecret: string;
  private readonly baseURL: string;
  private readonly apiKey: string;

  // Mapa de estados por nome de instância
  private readonly states = new Map<string, InstanceState>();

  // Nomes configurados por papel
  readonly shelbyInstance: string;
  readonly moritzInstance: string | null;
  readonly cobradorInstance: string | null;
  readonly prospectadorInstance: string | null;

  // Overrides de desenvolvimento (DEV_INSTANCE_NAME / DEV_REDIRECT_PHONE no .env)
  private readonly devInstanceName: string | null;
  private readonly devRedirectPhone: string | null;

  // URL pública do S3/MinIO tal como vista pelo navegador (host) vs. pelo container da Evolution API
  private readonly s3PublicUrl: string | null;
  private readonly s3PublicUrlEvolution: string | null;

  // Host pelo qual a Evolution API alcança este backend para enviar webhooks.
  // Em Railway, RAILWAY_PRIVATE_DOMAIN é injetado automaticamente (rede privada);
  // em Docker Compose local, cai no host.docker.internal do docker-compose.yml.
  private readonly webhookHost: string;
  private readonly appPort: number;

  constructor(
    private configService: ConfigService,
    private db: DatabaseService,
  ) {
    this.baseURL = configService.getOrThrow('EVOLUTION_API_URL');
    this.apiKey = configService.getOrThrow('EVOLUTION_API_KEY');
    this.webhookSecret = configService.get('EVOLUTION_WEBHOOK_SECRET', '');

    this.shelbyInstance = configService.getOrThrow('EVOLUTION_INSTANCE_SHELBY_NAME');
    this.moritzInstance = configService.get('EVOLUTION_INSTANCE_MORITZ_NAME') || null;
    this.cobradorInstance = configService.get('EVOLUTION_INSTANCE_COBRADOR_NAME') || null;
    this.prospectadorInstance = configService.get('EVOLUTION_INSTANCE_PROSPECTADOR_NAME') || null;

    this.devInstanceName = configService.get('DEV_INSTANCE_NAME') || null;
    this.devRedirectPhone = configService.get('DEV_REDIRECT_PHONE') || null;

    this.s3PublicUrl = configService.get('S3_PUBLIC_URL') || null;
    this.s3PublicUrlEvolution = configService.get('S3_PUBLIC_URL_EVOLUTION') || null;

    this.webhookHost = configService.get('RAILWAY_PRIVATE_DOMAIN') || 'host.docker.internal';
    this.appPort = configService.get('APP_PORT', 3000);

    this.http = axios.create({
      baseURL: this.baseURL,
      headers: { apikey: this.apiKey, 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    // Inicializa estado para cada instância configurada
    for (const name of this.allInstances()) {
      this.states.set(name, { cachedQr: null, isConnected: false, socket: null });
    }
  }

  async onModuleInit() {
    for (const name of this.allInstances()) {
      await this.ensureInstance(name);
    }
    this.connectWebSocket();
  }

  onModuleDestroy() {
    for (const state of this.states.values()) {
      state.socket?.disconnect();
    }
  }

  // ─── Papel → nome de instância ────────────────────────────────────────────

  getInstanceName(role: InstanceRole = 'shelby'): string {
    if (role === 'moritz' && this.moritzInstance) return this.moritzInstance;
    if (role === 'cobrador' && this.cobradorInstance) return this.cobradorInstance;
    if (role === 'prospectador' && this.prospectadorInstance) return this.prospectadorInstance;
    return this.shelbyInstance;
  }

  private allInstances(): string[] {
    return [
      this.shelbyInstance,
      this.moritzInstance,
      this.cobradorInstance,
      this.prospectadorInstance,
    ].filter((n): n is string => !!n);
  }

  private stateOf(instanceName: string): InstanceState {
    return this.states.get(instanceName) ?? { cachedQr: null, isConnected: false, socket: null };
  }

  // ─── WebSocket (único — filtra por instância no payload) ─────────────────

  private async connectWebSocket() {
    let token = this.apiKey;
    try {
      const res = await this.http.get('/instance/fetchInstances', {
        params: { instanceName: this.shelbyInstance },
      });
      const list: any[] = Array.isArray(res.data) ? res.data : [];
      const found = list.find((i) => i.name === this.shelbyInstance);
      if (found?.token) token = found.token;
    } catch {
      // usa apikey como fallback
    }

    const tryConnect = (transport: string) => {
      const socket = io(this.baseURL, {
        transports: [transport],
        auth: { apikey: token },
        query: { apikey: token },
        reconnection: true,
        reconnectionDelay: 5000,
        reconnectionAttempts: 3,
        timeout: 10000,
      });

      socket.on('connect', () => {
        this.logger.log(`WebSocket conectado à Evolution API (${transport})`);
        // Associa o socket ao estado de cada instância conhecida
        for (const [name, state] of this.states.entries()) {
          this.states.set(name, { ...state, socket });
        }
      });

      socket.on('connect_error', (err) => {
        this.logger.warn(`WebSocket ${transport} falhou: ${err.message}`);
        socket.disconnect();
        if (transport === 'websocket') tryConnect('polling');
      });

      socket.on('disconnect', (reason) => {
        this.logger.warn(`WebSocket desconectado: ${reason}`);
      });

      socket.onAny((event: string, payload: any) => {
        const instanceName: string = payload?.instance ?? '';

        // Ignora eventos de instâncias que não gerenciamos
        if (instanceName && !this.states.has(instanceName)) return;

        const target = instanceName || this.shelbyInstance;

        this.logger.debug(
          `[WS-RAW] evento="${event}" instância="${instanceName}" dataKeys=${JSON.stringify(Object.keys(payload?.data ?? {}))}`,
        );

        if (event.toLowerCase().includes('qr')) {
          const inner = payload?.data ?? payload;
          const raw: string | null =
            inner?.qrcode?.base64 ??
            inner?.base64 ??
            inner?.qrcode ??
            (typeof inner === 'string' ? inner : null);
          if (raw) {
            this.logger.log(`QR Code capturado via WebSocket (evento: ${event}, instância: ${target})`);
            this.setQrCode(raw, target);
          }
        }

        if (event.toLowerCase().includes('connection')) {
          const inner = payload?.data ?? payload;
          const state: string = inner?.state ?? inner?.instance?.state ?? '';
          this.logger.log(`Connection update instância="${target}" state="${state}"`);
          if (state === 'open') this.setConnected(true, target);
          else if (['close', 'closed'].includes(state)) this.setConnected(false, target);
        }
      });
    };

    tryConnect('websocket');
  }

  // ─── Estado público ───────────────────────────────────────────────────────

  setQrCode(base64: string, instanceName?: string) {
    const name = instanceName || this.shelbyInstance;
    const prev = this.stateOf(name);
    const normalized = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    this.states.set(name, { ...prev, cachedQr: normalized, isConnected: false });
    this.logger.log(`QR Code atualizado — instância "${name}"`);
  }

  setConnected(connected: boolean, instanceName?: string) {
    const name = instanceName || this.shelbyInstance;
    const prev = this.stateOf(name);
    this.states.set(name, { ...prev, isConnected: connected, cachedQr: connected ? null : prev.cachedQr });
    if (connected) {
      this.logger.log(`WhatsApp conectado — instância "${name}" — QR descartado`);
    }
  }

  getQrCodeCache(instanceName?: string): { base64: string | null; connected: boolean } {
    const state = this.stateOf(instanceName || this.shelbyInstance);
    return { base64: state.cachedQr, connected: state.isConnected };
  }

  // ─── Instância ────────────────────────────────────────────────────────────

  private async ensureInstance(name: string) {
    let existing: any = null;

    try {
      const res = await this.http.get('/instance/fetchInstances', {
        params: { instanceName: name },
      });
      const list: any[] = Array.isArray(res.data) ? res.data : [];
      existing = list.find((i) => i.name === name) ?? null;
    } catch {
      // 404 ou outro erro = instância não existe
    }

    try {
      if (!existing) {
        this.logger.log(`Criando instância "${name}"...`);
        await this.createInstance(name);
        await this.sleep(2000);
        await this.configureWebhook(name);
        try {
          const connRes = await this.http.get(`/instance/connect/${name}`);
          this.cacheQrFromResponse(connRes.data, name);
        } catch { /* WebSocket entregará o QR */ }
      } else {
        const status = existing.connectionStatus;
        this.logger.log(`Instância "${name}" encontrada (status: ${status})`);

        if (status === 'open' && existing.ownerJid) {
          this.setConnected(true, name);
        } else {
          try {
            const connRes = await this.http.get(`/instance/connect/${name}`);
            this.cacheQrFromResponse(connRes.data, name);
          } catch { /* WebSocket receberá quando disponível */ }
        }

        await this.configureWebhook(name);
      }
    } catch (err) {
      this.logger.error(`Falha ao preparar instância "${name}"`, err);
    }
  }

  private async createInstance(name: string) {
    const res = await this.http.post('/instance/create', {
      instanceName: name,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    });
    this.logger.log(`Instância "${name}" criada.`);
    const qr = res.data?.qrcode?.base64 ?? res.data?.qrcode?.code ?? null;
    if (qr) this.setQrCode(qr, name);
  }

  private async configureWebhook(name: string) {
    const secret = this.webhookSecret;
    const webhookUrl = `http://${this.webhookHost}:${this.appPort}/webhook/evolution${secret ? `?secret=${encodeURIComponent(secret)}` : ''}`;

    const webhook: Record<string, any> = {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE'],
    };

    if (this.webhookSecret) {
      webhook['headers'] = { 'x-evolution-webhook-secret': this.webhookSecret };
    }

    try {
      await this.http.post(`/webhook/set/${name}`, { webhook });
      this.logger.log(`Webhook configurado para "${name}" → ${webhookUrl}`);
    } catch {
      try {
        await this.http.delete(`/webhook/set/${name}`).catch(() => null);
        await this.sleep(500);
        await this.http.post(`/webhook/set/${name}`, { webhook });
        this.logger.log(`Webhook reconfigurado para "${name}" → ${webhookUrl}`);
      } catch (err2: any) {
        this.logger.warn(`Falha ao configurar webhook para "${name}": ${err2?.response?.data?.message ?? err2.message}`);
      }
    }
  }

  // ─── Dev override ─────────────────────────────────────────────────────────

  // A Evolution API roda em outro container Docker: uma mediaUrl com host "localhost"
  // (usada para exibir a mídia no navegador) aponta para o próprio container da Evolution,
  // não para o host onde o MinIO está exposto. Por isso, ao enviar para a Evolution API,
  // trocamos o host pela variante alcançável via Docker (S3_PUBLIC_URL_EVOLUTION).
  private toEvolutionReachableUrl(mediaUrl: string): string {
    if (!this.s3PublicUrl || !this.s3PublicUrlEvolution) return mediaUrl;
    if (!mediaUrl.startsWith(this.s3PublicUrl)) return mediaUrl;
    return this.s3PublicUrlEvolution + mediaUrl.slice(this.s3PublicUrl.length);
  }

  private devOverride(to: string, instanceName: string): { to: string; instance: string } {
    const instance = this.devInstanceName ?? instanceName;
    const phone = this.devRedirectPhone ?? to;
    if (this.devInstanceName || this.devRedirectPhone) {
      this.logger.warn(`[DEV] redirecionando ${to}→${phone} via instância ${instance}`);
    }
    return { to: phone, instance };
  }

  // ─── Mensagens ────────────────────────────────────────────────────────────

  async sendTextMessage(
    to: string,
    text: string,
    contatoId?: string,
    instanceName?: string,
  ): Promise<string> {
    const { to: phone, instance } = this.devOverride(to, instanceName ?? this.shelbyInstance);
    return this.withRetry(async () => {
      const res = await this.http.post(`/message/sendText/${instance}`, {
        number: phone,
        text,
      });
      await this.logMessage(contatoId, 'ENVIADA', 'TEXTO', text, res.data?.key?.id);
      return res.data?.key?.id;
    }, { text, to: phone, instance });
  }

  async sendMedia(
    to: string,
    mediaUrl: string,
    caption: string,
    type: MediaType,
    contatoId?: string,
    instanceName?: string,
  ): Promise<string> {
    const { to: phone, instance } = this.devOverride(to, instanceName ?? this.shelbyInstance);
    const reachableMediaUrl = this.toEvolutionReachableUrl(mediaUrl);
    return this.withRetry(async () => {
      const res = await this.http.post(`/message/sendMedia/${instance}`, {
        number: phone,
        mediatype: type,
        media: reachableMediaUrl,
        caption,
      });
      const tipoMap: Record<MediaType, 'IMAGEM' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO'> = {
        image: 'IMAGEM',
        video: 'VIDEO',
        audio: 'AUDIO',
        document: 'DOCUMENTO',
      };
      await this.logMessage(contatoId, 'ENVIADA', tipoMap[type], mediaUrl, res.data?.key?.id);
      return res.data?.key?.id;
    }, { mediaUrl, to, instance });
  }

  async sendButtons(
    to: string,
    text: string,
    buttons: { id: string; text: string }[],
    instanceName?: string,
  ) {
    const instance = instanceName ?? this.shelbyInstance;
    return this.withRetry(async () => {
      const res = await this.http.post(`/message/sendButtons/${instance}`, {
        number: to,
        title: text,
        buttons: buttons.map((b) => ({ buttonId: b.id, buttonText: { displayText: b.text }, type: 1 })),
      });
      return res.data;
    }, { to, text, instance });
  }

  // ─── Labels ───────────────────────────────────────────────────────────────

  async setLabel(to: string, labelName: string, instanceName?: string) {
    const instance = instanceName ?? this.shelbyInstance;
    return this.withRetry(async () => {
      await this.http.post(`/label/handleLabel/${instance}`, {
        number: to,
        label: labelName,
        action: 'add',
      });
    }, { to, labelName, instance });
  }

  async removeLabel(to: string, labelName: string, instanceName?: string) {
    const instance = instanceName ?? this.shelbyInstance;
    return this.withRetry(async () => {
      await this.http.post(`/label/handleLabel/${instance}`, {
        number: to,
        label: labelName,
        action: 'remove',
      });
    }, { to, labelName, instance });
  }

  // ─── Status / QR ──────────────────────────────────────────────────────────

  async getInstance(instanceName?: string) {
    return this.withRetry(async () => {
      const res = await this.http.get(`/instance/fetchInstances`, {
        params: instanceName ? { instanceName } : undefined,
      });
      return res.data;
    }, {});
  }

  async connectInstance(instanceName?: string) {
    const name = instanceName ?? this.shelbyInstance;
    return this.withRetry(async () => {
      const res = await this.http.get(`/instance/connect/${name}`);
      this.cacheQrFromResponse(res.data, name);
      return res.data;
    }, {});
  }

  async reconnect(instanceName?: string) {
    const name = instanceName ?? this.shelbyInstance;
    this.setQrCode('', name); // limpa QR
    const prev = this.stateOf(name);
    this.states.set(name, { ...prev, cachedQr: null, isConnected: false });
    return this.withRetry(async () => {
      const res = await this.http.get(`/instance/connect/${name}`);
      this.cacheQrFromResponse(res.data, name);
      return res.data;
    }, {});
  }

  private cacheQrFromResponse(data: any, instanceName: string) {
    const qr = data?.base64 ?? data?.qrcode?.base64 ?? null;
    if (qr) {
      this.logger.log(`QR Code capturado via REST connect — instância "${instanceName}"`);
      this.setQrCode(qr, instanceName);
    }
  }

  // ─── Internos ─────────────────────────────────────────────────────────────

  private async withRetry<T>(fn: () => Promise<T>, payload: unknown, retries = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const delay = Math.pow(2, attempt) * 500;
        this.logger.warn(`Evolution API falhou (tentativa ${attempt}/${retries}). Retry em ${delay}ms`);
        if (attempt < retries) await this.sleep(delay);
      }
    }
    throw new EvolutionException('Falha na Evolution API após retries', lastError, payload);
  }

  private async logMessage(
    contatoId: string | undefined,
    direcao: 'ENVIADA' | 'RECEBIDA',
    tipo: 'TEXTO' | 'IMAGEM' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO' | 'BOTAO',
    conteudo: string,
    evolutionId?: string,
  ) {
    try {
      await this.db.db.insert(messageLogs).values({
        contactId: contatoId ?? null,
        direction: direcao,
        type: tipo,
        content: conteudo,
        status: 'ENTREGUE',
        evolutionId: evolutionId ?? null,
      });
    } catch (err) {
      this.logger.error('Falha ao registrar log de mensagem', err);
    }
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
