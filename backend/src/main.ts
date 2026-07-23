import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Headers de segurança (CSP desabilitado para não quebrar Swagger UI / Scalar em /docs e /reference)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // CORS restrito: em produção definir CORS_ORIGINS (lista separada por vírgula);
  // sem a env, aceita apenas origens localhost (ambiente de desenvolvimento)
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : /^https?:\/\/localhost(:\d+)?$/,
    credentials: true,
  });

  // Documentação da API (Swagger/Scalar) apenas fora de produção —
  // em produção esses endpoints expõem todo o mapa da API para reconhecimento
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('wpp-autoflow API')
    .setDescription(
      `## API de Automação de WhatsApp\n\n` +
      `Sistema que simula o comportamento de um vendedor humano no WhatsApp, ` +
      `segmentando clientes em perfis A, B e C, enviando tabelas de preço e mídias ` +
      `personalizadas, e notificando o vendedor quando um pedido é fechado.\n\n` +
      `### Autenticação\n` +
      `Use o endpoint **POST /auth/login** para obter o \`accessToken\` e clique em **Authorize** acima.\n\n` +
      `### Roles\n` +
      `| Role | Acesso |\n` +
      `|---|---|\n` +
      `| \`ADMIN\` | Acesso total |\n` +
      `| \`OPERADOR\` | Contatos, produtos, fluxos, campanhas, pedidos |\n` +
      `| \`VENDEDOR\` | Somente pedidos fechados (sem ver número do cliente) |`,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addTag('Auth', 'Autenticação e gestão de usuários admin')
    .addTag('Evolution', 'Status e conexão da instância WhatsApp')
    .addTag('Contatos', 'Cadastro e segmentação de clientes')
    .addTag('Produtos', 'Catálogo de produtos')
    .addTag('Categorias', 'Categorias de produtos')
    .addTag('Tabela de Preço', 'Faixas de preço por produto e tipo de cliente')
    .addTag('Fluxos', 'Fluxos de conversa por tipo de cliente')
    .addTag('Campanhas', 'Disparos manuais e agendados')
    .addTag('Parâmetros', 'Configurações globais do sistema')
    .addTag('Pedidos', 'Pedidos e notificação ao vendedor')
    .addTag('Mídias', 'Upload e gerenciamento de arquivos')
    .addTag('Entregas de Mídia', 'Agendamento de envio de mídias')
    .addTag('Webhook', 'Recebimento de eventos da Evolution API')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Swagger UI clássico em /docs
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'wpp-autoflow — API Docs',
  });

  // Scalar em /reference
  app.use(
    '/reference',
    apiReference({
      spec: { content: document },
      theme: 'deepSpace',
      layout: 'modern',
      defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
    }),
  );
  }

  const config = app.get(ConfigService);
  const port = config.get('APP_PORT', 3000);
  const evolutionUrl = config.get('EVOLUTION_API_URL', 'http://localhost:8080');
  await app.listen(port);
  console.log(`Application running on:  http://localhost:${port}`);
  console.log(`Scalar API Reference:    http://localhost:${port}/reference`);
  console.log(`Swagger UI:              http://localhost:${port}/docs`);
  console.log(`Evolution API:           ${evolutionUrl}`);
  console.log(`Evolution Manager:       ${evolutionUrl}/manager`);
}
bootstrap().catch((err) => {
  console.error('Falha ao inicializar a aplicação:', err);
  process.exit(1);
});
