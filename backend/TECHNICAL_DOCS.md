# Documentação Técnica — wpp-autoflow

> Última atualização: 2026-06-18
> Stack: NestJS 11 · TypeScript 5 · Drizzle ORM · PostgreSQL 15 · BullMQ · Redis 7 · MinIO · Evolution API

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Stack e Dependências](#2-stack-e-dependências)
3. [Estrutura de Diretórios](#3-estrutura-de-diretórios)
4. [Infraestrutura (Docker Compose)](#4-infraestrutura-docker-compose)
5. [Variáveis de Ambiente](#5-variáveis-de-ambiente)
6. [Banco de Dados — Schemas Drizzle](#6-banco-de-dados--schemas-drizzle)
7. [Infraestrutura da Aplicação](#7-infraestrutura-da-aplicação)
8. [Slice 0 — Auth](#8-slice-0--auth)
9. [Slice 1 — Evolution Wrapper](#9-slice-1--evolution-wrapper)
10. [Slice 2 — Contacts](#10-slice-2--contacts)
11. [Slice 3 — Products](#11-slice-3--products)
12. [Slice 4 — Flows](#12-slice-4--flows)
13. [Slice 5 — Campaigns](#13-slice-5--campaigns)
14. [Slice 6 — Orders](#14-slice-6--orders)
15. [Slice 7 — Media](#15-slice-7--media)
16. [Slice 8 — Webhook](#16-slice-8--webhook)
17. [Jobs BullMQ](#17-jobs-bullmq)
18. [Padrões Globais da API](#18-padrões-globais-da-api)
19. [Fluxo Principal de Negócio](#19-fluxo-principal-de-negócio)
20. [Guia de Inicialização](#20-guia-de-inicialização)

---

## 1. Visão Geral da Arquitetura

O sistema automatiza conversas de WhatsApp simulando o comportamento de um vendedor humano. Ele opera em ciclos de disparo (Pulse), processa respostas dos clientes via webhook, gerencia fluxos de conversa por segmento de cliente (A/B/C) e notifica o vendedor humano quando um pedido é fechado.

```
┌─────────────────────────────────────────────────────────────┐
│                        NestJS App                           │
│                                                             │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────┐  │
│  │  Auth   │  │Evolution │  │Contacts │  │  Products   │  │
│  └─────────┘  └────┬─────┘  └─────────┘  └─────────────┘  │
│                    │                                        │
│  ┌─────────┐  ┌────┴─────┐  ┌─────────┐  ┌─────────────┐  │
│  │  Flows  │  │Campaigns │  │ Orders  │  │    Media    │  │
│  └─────────┘  └──────────┘  └─────────┘  └─────────────┘  │
│                                                             │
│  ┌─────────┐  Jobs: pulse · broadcast · media-delivery      │
│  │Webhook  │                                                │
│  └─────────┘                                               │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼─────────────────┐
        │                │                 │
   PostgreSQL          Redis           MinIO/S3
   (Drizzle ORM)      (BullMQ)       (arquivos)
                         │
                  Evolution API
                  (WhatsApp)
```

### Princípios arquiteturais

- **Isolamento por domínio**: cada slice é um módulo NestJS independente. A Evolution API é a única dependência externa crítica e está encapsulada no `EvolutionModule` — nenhum outro módulo importa diretamente o cliente HTTP.
- **Jobs assíncronos**: toda lógica de disparo usa BullMQ. Proibido `setTimeout`/`setInterval` para lógica de negócio.
- **Soft delete universal**: todas as entidades principais têm `deleted_at`. Selects filtram com `isNull(table.deletedAt)`.
- **Parâmetros em tempo real**: configurações como `PULSE_INTERVALO_MINUTOS` são lidas do banco e alteráveis sem restart.
- **Validação de env na inicialização**: Zod valida todas as variáveis obrigatórias na subida do app.

---

## 2. Stack e Dependências

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 22 |
| Framework | NestJS | 11 |
| Linguagem | TypeScript | 5.7 |
| ORM | Drizzle ORM | 0.45 |
| Driver PostgreSQL | postgres (postgres.js) | 3.4 |
| Filas | BullMQ + `@nestjs/bullmq` | 5.78 / 11 |
| Cache/Filas broker | Redis | 7 (via ioredis interno do BullMQ) |
| Agendamento | `@nestjs/schedule` | 6.1 |
| Eventos internos | `@nestjs/event-emitter` | 3.1 |
| WhatsApp | Evolution API | latest (Docker) |
| Storage | MinIO / AWS S3 | `@aws-sdk/client-s3` 3.x |
| Autenticação | JWT + Passport | `@nestjs/jwt` 11 / `passport-jwt` 4 |
| Validação | class-validator + class-transformer | 0.15 / 0.5 |
| Env | Zod | 4.4 |
| HTTP client | Axios | 1.x |
| Hash de senha | bcrypt | 6.x |
| CSV parse | csv-parse | 7.x |

### Scripts npm disponíveis

```bash
npm run start:dev        # modo desenvolvimento com watch
npm run build            # compila para dist/
npm run start:prod       # executa dist/main.js
npm run db:generate      # drizzle-kit generate (cria migrations)
npm run db:migrate       # drizzle-kit migrate (aplica migrations)
npm run db:studio        # Drizzle Studio (UI do banco)
npm run db:seed          # popula dados iniciais (admin + parâmetros)
```

---

## 3. Estrutura de Diretórios

```
wpp-autoflow/
├── docker-compose.yml
├── Dockerfile
├── drizzle.config.ts
├── .env.example
├── .gitignore
│
├── drizzle/
│   ├── schema/
│   │   ├── index.ts                  ← exporta todos os schemas
│   │   ├── auth.schema.ts
│   │   ├── contacts.schema.ts
│   │   ├── products.schema.ts
│   │   ├── flows.schema.ts
│   │   ├── campaigns.schema.ts
│   │   ├── orders.schema.ts
│   │   ├── media.schema.ts
│   │   ├── evolution.schema.ts
│   │   └── system.schema.ts
│   ├── migrations/                   ← gerado pelo drizzle-kit
│   └── seed.ts                       ← admin padrão + parâmetros
│
└── src/
    ├── main.ts
    ├── app.module.ts
    │
    ├── config/
    │   ├── env.ts                    ← schema Zod de validação
    │   └── app.config.ts             ← registerAs por domínio
    │
    ├── database/
    │   ├── database.module.ts        ← @Global()
    │   └── database.service.ts       ← instância Drizzle + pool postgres.js
    │
    ├── common/
    │   ├── decorators/
    │   │   ├── current-user.decorator.ts
    │   │   └── roles.decorator.ts
    │   ├── filters/
    │   │   └── http-exception.filter.ts
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts
    │   │   └── roles.guard.ts
    │   └── interceptors/
    │       └── response.interceptor.ts
    │
    ├── modules/
    │   ├── auth/
    │   ├── evolution/
    │   ├── contacts/
    │   ├── products/
    │   ├── flows/
    │   ├── campaigns/
    │   ├── orders/
    │   ├── media/
    │   └── webhook/
    │
    └── jobs/
        ├── pulse.job.ts
        ├── scheduled-broadcast.job.ts
        └── media-delivery.job.ts
```

---

## 4. Infraestrutura (Docker Compose)

O `docker-compose.yml` define 5 serviços. O serviço `app` está no profile `production` e não sobe por padrão em desenvolvimento.

### Serviços

| Serviço | Imagem | Porta padrão | Volume |
|---|---|---|---|
| `postgres` | `postgres:15-alpine` | 5432 | `postgres_data` |
| `redis` | `redis:7-alpine` | 6379 | `redis_data` |
| `minio` | `minio/minio:latest` | 9000 (API) / 9001 (Console) | `minio_data` |
| `evolution-api` | `atendai/evolution-api:latest` | 8080 | `evolution_data` |
| `app` | Dockerfile local | 3000 | — |

### Healthchecks

Todos os serviços têm healthcheck configurado:
- **postgres**: `pg_isready -U <user>` a cada 10s
- **redis**: `redis-cli ping` a cada 10s
- **minio**: `curl -f http://localhost:9000/minio/health/live` a cada 30s
- **evolution-api**: `curl -f http://localhost:8080` a cada 30s

### Iniciar só o stack de dependências (desenvolvimento)

```bash
docker compose up -d postgres redis minio evolution-api
```

---

## 5. Variáveis de Ambiente

Arquivo `.env.example` contém todas as variáveis. O Zod valida na inicialização as obrigatórias. A aplicação não sobe se qualquer variável obrigatória estiver ausente ou inválida.

### Variáveis obrigatórias (validadas pelo Zod em `src/config/env.ts`)

| Variável | Tipo | Descrição |
|---|---|---|
| `DATABASE_URL` | `string (url)` | URL completa de conexão PostgreSQL |
| `JWT_SECRET` | `string (min 32)` | Segredo do access token |
| `JWT_REFRESH_SECRET` | `string (min 32)` | Segredo do refresh token |
| `EVOLUTION_API_URL` | `string (url)` | URL da instância Evolution API |
| `EVOLUTION_API_KEY` | `string` | Chave de API da Evolution |
| `EVOLUTION_INSTANCE_NAME` | `string` | Nome da instância WhatsApp |
| `EVOLUTION_WEBHOOK_SECRET` | `string` | Secret para validar webhooks |
| `S3_ENDPOINT` | `string (url)` | Endpoint do MinIO/S3 |
| `S3_ACCESS_KEY` | `string` | Access key do storage |
| `S3_SECRET_KEY` | `string` | Secret key do storage |
| `S3_BUCKET` | `string` | Nome do bucket |
| `S3_PUBLIC_URL` | `string (url)` | URL pública base para arquivos |

### Variáveis com defaults

| Variável | Default | Descrição |
|---|---|---|
| `NODE_ENV` | `development` | Ambiente |
| `APP_PORT` | `3000` | Porta da aplicação |
| `REDIS_HOST` | `localhost` | Host do Redis |
| `REDIS_PORT` | `6379` | Porta do Redis |
| `JWT_EXPIRES_IN` | `8h` | Expiração do access token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Expiração do refresh token |
| `S3_REGION` | `us-east-1` | Região do storage |
| `MAX_UPLOAD_TAMANHO_MB` | `50` | Tamanho máximo de upload |

---

## 6. Banco de Dados — Schemas Drizzle

Todos os schemas ficam em `drizzle/schema/` e são exportados centralmente via `index.ts`. O Drizzle usa `postgres.js` como driver com pool de 10 conexões.

### Configuração (`drizzle.config.ts`)

```typescript
dialect: 'postgresql'
schema: './drizzle/schema/index.ts'
out: './drizzle/migrations'
```

---

### Tabela: `usuario_admin`

```
id             uuid          PK, defaultRandom()
nome           varchar(255)  NOT NULL
email          varchar(255)  NOT NULL, UNIQUE
senha_hash     text          NOT NULL
role           enum          ADMIN | VENDEDOR | OPERADOR  default OPERADOR
status         enum          ATIVO | INATIVO              default ATIVO
created_at     timestamp     defaultNow()
updated_at     timestamp     defaultNow()
deleted_at     timestamp     nullable  ← soft delete
```

---

### Tabela: `contato`

```
id                   uuid         PK
nome                 varchar(255) NOT NULL
numero_whatsapp      varchar(20)  NOT NULL, UNIQUE
tipo_cliente         enum         A | B | C               default C
status_engajamento   enum         NOVO | RESPONDEU | INATIVO | ATIVO | BLOQUEADO  default NOVO
ultima_mensagem_em   timestamp    nullable
ultimo_pedido_em     timestamp    nullable
cooldown_ate         timestamp    nullable  ← bloqueia disparo até esta data
observacoes          text         nullable
created_at           timestamp    defaultNow()
updated_at           timestamp    defaultNow()
deleted_at           timestamp    nullable
```

---

### Tabela: `categoria_produto`

```
id          uuid         PK
nome        varchar(255) NOT NULL
status      enum         ATIVO | INATIVO  default ATIVO
created_at  timestamp
updated_at  timestamp
deleted_at  timestamp    nullable
```

### Tabela: `produto`

```
id           uuid         PK
nome         varchar(255) NOT NULL
categoria_id uuid         FK → categoria_produto.id  nullable
descricao    text         nullable
unidade      varchar(50)  NOT NULL  (ex: "g", "kg", "unidade")
status       enum         ATIVO | INATIVO  default ATIVO
created_at   timestamp
updated_at   timestamp
deleted_at   timestamp    nullable
```

### Tabela: `produto_tabela_preco`

```
id                   uuid     PK
produto_id           uuid     FK → produto.id  NOT NULL
tipo_cliente         enum     A | B | C  NOT NULL
quantidade_min       decimal(12,3)  NOT NULL
quantidade_max       decimal(12,3)  nullable  (null = sem limite)
preco_unitario       decimal(12,2)  NOT NULL
desconto_maximo_pct  decimal(5,2)   default '0'
created_at           timestamp
updated_at           timestamp
```

### Tabela: `produto_midia`

```
id           uuid     PK
produto_id   uuid     FK → produto.id
tipo_cliente enum     A | B | C | TODOS  default TODOS
tipo_midia   enum     IMAGEM | VIDEO | AUDIO | DOCUMENTO
url          text     NOT NULL
caption      text     nullable
ordem        integer  default 0
created_at   timestamp
updated_at   timestamp
```

---

### Tabela: `fluxo_conversa`

```
id           uuid     PK
nome         varchar(255)  NOT NULL
tipo_cliente enum     A | B | C | INATIVO | BROADCAST
ativo        boolean  default true
created_at   timestamp
updated_at   timestamp
```

### Tabela: `etapa_fluxo`

```
id              uuid     PK
fluxo_id        uuid     FK → fluxo_conversa.id  ON DELETE CASCADE
ordem           integer  NOT NULL
tipo            enum     TEXTO | MIDIA | TABELA_PRECO | DELAY
conteudo_texto  text     nullable  ← suporta {{nome}} {{tipoCliente}} {{dataHoje}} {{vendedor}}
midia_url       text     nullable
midia_tipo      enum     IMAGEM | VIDEO | AUDIO  nullable
caption         text     nullable
produto_id      uuid     FK → produto.id  nullable
delay_segundos  integer  nullable
created_at      timestamp
updated_at      timestamp
```

---

### Tabela: `campanha_broadcast`

```
id                uuid     PK
nome              varchar(255)
tipo              enum     IMEDIATO | AGENDADO
mensagem          text     NOT NULL
midia_url         text     nullable
midia_tipo        enum     IMAGEM | VIDEO | AUDIO | DOCUMENTO  nullable
tipo_cliente_alvo varchar(1)    nullable  (A, B ou C; null = todos)
status_alvo       varchar(50)   nullable
agendado_para     timestamp     nullable
status_campanha   enum     RASCUNHO | AGENDADO | EM_ANDAMENTO | CONCLUIDO | CANCELADO  default RASCUNHO
total_contatos    integer  nullable
total_enviados    integer  default 0
total_erros       integer  default 0
criado_por        uuid     FK → usuario_admin.id  nullable
created_at        timestamp
updated_at        timestamp
```

### Tabela: `campanha_entrega`

```
id           uuid     PK
campanha_id  uuid     FK → campanha_broadcast.id  ON DELETE CASCADE
contato_id   uuid     FK → contato.id
status       enum     PENDENTE | ENVIADO | ERRO  default PENDENTE
erro_detalhes  text   nullable
enviado_em   timestamp  nullable
created_at   timestamp
```

---

### Tabela: `pedido`

```
id              uuid     PK
contato_id      uuid     FK → contato.id  NOT NULL
tipo_cliente    enum     A | B | C
status          enum     ABERTO | FECHADO | CANCELADO  default ABERTO
itens           jsonb    NOT NULL  default []
  └─ array de: { produtoId, nome, quantidade, precoUnitario, descontoPct }
total_estimado  decimal(12,2)  nullable
observacoes     text     nullable
fechado_em      timestamp  nullable
notificado_em   timestamp  nullable  ← preenchido após notificar vendedor
created_at      timestamp
updated_at      timestamp
```

---

### Tabela: `midia`

```
id              uuid         PK
nome            varchar(255) NOT NULL
tipo            enum         IMAGEM | VIDEO | AUDIO | DOCUMENTO
url             text         NOT NULL  ← URL pública MinIO/S3
tamanho_bytes   integer      NOT NULL
mime_type       varchar(100) NOT NULL
criado_por      uuid         FK → usuario_admin.id  nullable
created_at      timestamp
deleted_at      timestamp    nullable
```

### Tabela: `entrega_midia_agendada`

```
id             uuid     PK
contato_id     uuid     FK → contato.id
midia_id       uuid     FK → midia.id
caption        text     nullable
agendado_para  timestamp  NOT NULL
status         enum     PENDENTE | ENVIADO | ERRO | CANCELADO  default PENDENTE
enviado_em     timestamp  nullable
erro_detalhes  text     nullable
criado_por     uuid     FK → usuario_admin.id  nullable
created_at     timestamp
```

---

### Tabela: `mensagem_log`

```
id            uuid     PK
contato_id    uuid     FK → contato.id  nullable
direcao       enum     ENVIADA | RECEBIDA
tipo          enum     TEXTO | IMAGEM | VIDEO | AUDIO | DOCUMENTO | BOTAO
conteudo      text     NOT NULL
status        enum     PENDENTE | ENTREGUE | LIDO | ERRO  default PENDENTE
evolution_id  text     nullable  ← ID retornado pela Evolution API
erro_detalhes jsonb    nullable
created_at    timestamp
```

---

### Tabela: `parametro_sistema`

```
id          uuid         PK
chave       varchar(100) NOT NULL, UNIQUE
valor       text         NOT NULL
descricao   text         nullable
updated_at  timestamp
```

#### Parâmetros pré-populados pelo seed

| Chave | Valor padrão | Descrição |
|---|---|---|
| `PULSE_ATIVO` | `true` | Liga/desliga o pulse |
| `PULSE_INTERVALO_MINUTOS` | `5` | Intervalo do job (alterável em tempo real) |
| `PULSE_MAX_CONTATOS_POR_CICLO` | `5` | Máx de contatos por ciclo |
| `PULSE_COOLDOWN_HORAS` | `24` | Horas de cooldown após disparo |
| `BROADCAST_DELAY_ENTRE_ENVIOS_MS` | `3000` | Delay entre envios do broadcast |
| `VENDEDOR_1_NUMERO_WHATSAPP` | `""` | Número do vendedor principal |
| `VENDEDOR_1_NOME` | `Vendedor` | Nome do vendedor |
| `MAX_UPLOAD_TAMANHO_MB` | `50` | Limite de upload |
| `FLUXO_DELAY_PADRAO_SEGUNDOS` | `3` | Delay padrão entre etapas |

---

### Tabela: `auditoria_sistema`

```
id                uuid     PK
entidade          varchar(100)
entidade_id       varchar(255)
acao              enum     CREATE | UPDATE | DELETE | LOGIN | DISPATCH
dados_anteriores  jsonb    nullable
dados_novos       jsonb    nullable
usuario_id        uuid     FK → usuario_admin.id  nullable
ip_origem         varchar(45)  nullable
created_at        timestamp
```

---

## 7. Infraestrutura da Aplicação

### `main.ts` — Bootstrap

```typescript
// Pipes globais
ValidationPipe({ whitelist: true, transform: true })
// Filtros globais
HttpExceptionFilter
// Interceptors globais
ResponseInterceptor
// CORS habilitado
app.enableCors()
```

### `app.module.ts` — Módulo raiz

Registra todos os módulos e configurações globais:

```
ConfigModule.forRoot({ isGlobal: true })
BullModule.forRootAsync()          ← conecta ao Redis
BullModule.registerQueue(
  'pulse', 'broadcast', 'media-delivery'
)
ScheduleModule.forRoot()
EventEmitterModule.forRoot()
DatabaseModule                     ← @Global, injeta DatabaseService
AuthModule, EvolutionModule, ContactsModule, ProductsModule,
FlowsModule, CampaignsModule, OrdersModule, MediaModule, WebhookModule
Providers: PulseJob, ScheduledBroadcastJob, MediaDeliveryJob
```

### `DatabaseModule` + `DatabaseService`

- `@Global()` — disponível em todos os módulos sem reimportar
- `onModuleInit`: cria o pool `postgres.js` com `max: 10` conexões
- `onModuleDestroy`: fecha o pool ao encerrar
- Expõe `db: PostgresJsDatabase<typeof schema>` com type safety total

### `HttpExceptionFilter`

Captura qualquer `HttpException` e padroniza a resposta de erro:

```json
{
  "statusCode": 404,
  "message": "Contato abc não encontrado",
  "timestamp": "2026-06-18T10:00:00.000Z",
  "path": "/contatos/abc"
}
```

### `ResponseInterceptor`

Envolve toda resposta bem-sucedida em:

```json
{
  "success": true,
  "data": { ... }
}
```

Não envolve novamente se a resposta já tiver chave `data`.

### Guards globais reutilizáveis

| Guard | Localização | Função |
|---|---|---|
| `JwtAuthGuard` | `common/guards/jwt-auth.guard.ts` | Valida Bearer token JWT |
| `RolesGuard` | `common/guards/roles.guard.ts` | Verifica `user.role` contra `@Roles(...)` |
| `WebhookGuard` | `modules/webhook/webhook.guard.ts` | Valida header `x-evolution-webhook-secret` |

### Decorators customizados

| Decorator | Uso |
|---|---|
| `@CurrentUser()` | Extrai `req.user` (payload do JWT) |
| `@Roles(...roles)` | Define roles permitidas no endpoint via `SetMetadata` |

---

## 8. Slice 0 — Auth

**Arquivo:** `src/modules/auth/`

### Estratégia JWT

- **Access token**: expiração `JWT_EXPIRES_IN` (padrão 8h), secret `JWT_SECRET`
- **Refresh token**: expiração `JWT_REFRESH_EXPIRES_IN` (padrão 7d), secret `JWT_REFRESH_SECRET`
- Payload: `{ sub: userId, email, role }`
- `JwtStrategy` (passport-jwt): extrai token do header `Authorization: Bearer <token>`

### Roles

| Role | Acesso |
|---|---|
| `ADMIN` | Acesso total |
| `OPERADOR` | Contatos, produtos, fluxos, campanhas, pedidos |
| `VENDEDOR` | Apenas pedidos fechados (sem ver `contatoId`) |

### Endpoints

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| `POST` | `/auth/login` | Pública | Login com email/senha |
| `POST` | `/auth/refresh` | Pública | Renova access token via `refreshToken` no body |
| `GET` | `/auth/me` | JwtAuthGuard | Retorna dados do usuário logado |
| `POST` | `/admin/users` | ADMIN | Cria novo usuário admin |
| `GET` | `/admin/users` | ADMIN | Lista usuários (sem `senhaHash`) |
| `PATCH` | `/admin/users/:id` | ADMIN | Atualiza nome, senha, role ou status |
| `DELETE` | `/admin/users/:id` | ADMIN | Soft delete do usuário |

### DTOs

**`LoginDto`**
```typescript
email: string  // @IsEmail
senha: string  // @IsString @MinLength(6)
```

**`CreateUserDto`**
```typescript
nome: string
email: string        // @IsEmail
senha: string        // @MinLength(6)
role: 'ADMIN' | 'VENDEDOR' | 'OPERADOR'
```

**`UpdateUserDto`** — todos opcionais:
```typescript
nome?: string
senha?: string
role?: 'ADMIN' | 'VENDEDOR' | 'OPERADOR'
status?: 'ATIVO' | 'INATIVO'
```

### Regras de negócio

- `senhaHash` nunca é retornado nas respostas (`sanitize()` remove o campo)
- Email único verificado na criação com `ConflictException`
- Usuário com `status = INATIVO` não consegue fazer login
- Soft delete: `deletedAt` é preenchido, usuário não aparece em listagens
- Atualização de senha faz novo hash com bcrypt (salt rounds: 10)

---

## 9. Slice 1 — Evolution Wrapper

**Arquivo:** `src/modules/evolution/`

### EvolutionService

Único ponto de comunicação com a Evolution API. Usa Axios com `baseURL`, `apikey` no header e timeout de 15s.

#### Métodos públicos

```typescript
sendTextMessage(to, text, contatoId?)
  → POST /message/sendText/{instance}
  → retorna evolution_id (string)

sendMedia(to, mediaUrl, caption, type: 'image'|'video'|'audio'|'document', contatoId?)
  → POST /message/sendMedia/{instance}
  → retorna evolution_id

sendButtons(to, text, buttons[{id, text}])
  → POST /message/sendButtons/{instance}

setLabel(to, labelName)
  → POST /label/handleLabel/{instance}  action: 'add'

removeLabel(to, labelName)
  → POST /label/handleLabel/{instance}  action: 'remove'

getInstance()
  → GET /instance/fetchInstances

connectInstance()
  → GET /instance/connect/{instance}

getQrCode()
  → GET /instance/connect/{instance}
```

#### Retry automático

Todos os métodos passam por `withRetry(fn, payload, retries=3)`:
- 3 tentativas com backoff exponencial: 1000ms → 2000ms → 4000ms
- Em caso de falha total, lança `EvolutionException(message, originalError, payload)`

#### Log automático de mensagens

Após cada `sendTextMessage` e `sendMedia` bem-sucedidos, insere automaticamente em `mensagem_log`:
- `direcao: ENVIADA`
- `status: ENTREGUE`
- `evolutionId` retornado pela API
- `contatoId` quando fornecido

#### EvolutionException

```typescript
class EvolutionException extends Error {
  originalError: unknown  // erro original do Axios
  payload: unknown        // payload que foi enviado
}
```

### Endpoints admin (Roles: ADMIN)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/evolution/status` | Status da instância |
| `POST` | `/evolution/connect` | Conecta a instância |
| `GET` | `/evolution/qrcode` | Obtém QR Code para scan |

---

## 10. Slice 2 — Contacts

**Arquivo:** `src/modules/contacts/`

### Entidade `contato` — estados de engajamento

```
NOVO       → nunca foi contactado
    ↓ (pulse dispara)
INATIVO    → disparo enviado, sem resposta
    ↓ (cliente responde)
RESPONDEU  → respondeu ao disparo
    ↓ (pedido fechado)
ATIVO      → fechou pedido
BLOQUEADO  → nunca contatar (excluído de todos os disparos)
```

### Endpoints (Roles: ADMIN | OPERADOR, exceto historico que aceita VENDEDOR)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/contatos` | Lista paginada com filtros |
| `POST` | `/contatos` | Cria contato |
| `PATCH` | `/contatos/:id` | Atualiza contato |
| `DELETE` | `/contatos/:id` | Soft delete |
| `POST` | `/contatos/importar-csv` | Importação em lote via CSV |
| `GET` | `/contatos/:id/historico` | Histórico de mensagens (últimas 50) |
| `PATCH` | `/contatos/:id/status` | Altera `statusEngajamento` |
| `PATCH` | `/contatos/:id/tipo` | Altera `tipoCliente` |

### DTOs

**`CreateContactDto`**
```typescript
nome: string               // @IsString @IsNotEmpty
numeroWhatsapp: string     // @Matches(/^[0-9]{10,15}$/)
tipoCliente: 'A' | 'B' | 'C'
observacoes?: string
```

**`UpdateContactDto`** — todos opcionais:
```typescript
nome?, numeroWhatsapp?, tipoCliente?
observacoes?
statusEngajamento?: 'NOVO'|'RESPONDEU'|'INATIVO'|'ATIVO'|'BLOQUEADO'
cooldownAte?: string  // ISO 8601 → convertido para Date
```

**`QueryContactsDto`** — parâmetros de query:
```typescript
pagina?: number           // default 1
limite?: number           // default 20
tipoCliente?: 'A'|'B'|'C'
statusEngajamento?: enum
somenteSemCooldown?: boolean  // @Transform 'true' → true
```

### Importação CSV

- **Endpoint**: `POST /contatos/importar-csv` com multipart/form-data, campo `arquivo`
- **Colunas esperadas**: `nome`, `numeroWhatsapp`, `tipoCliente`
- **Validações por linha**: campos obrigatórios, regex do número, enum do tipoCliente
- **Estratégia**: `onConflictDoNothing` — duplicatas ignoradas silenciosamente
- **Resposta**:
  ```json
  { "importados": 42, "erros": ["Número inválido: abc para João"] }
  ```

### Filtros de listagem

```sql
WHERE deleted_at IS NULL
  AND tipo_cliente = ?        (se informado)
  AND status_engajamento = ?  (se informado)
  AND (cooldown_ate IS NULL OR cooldown_ate < NOW())  (se somenteSemCooldown=true)
LIMIT ? OFFSET ?
```

### Paginação (padrão de todas as listagens)

```json
{
  "success": true,
  "data": {
    "data": [...],
    "total": 150,
    "pagina": 1,
    "limite": 20
  }
}
```

---

## 11. Slice 3 — Products

**Arquivo:** `src/modules/products/`

### Endpoints (Roles: ADMIN | OPERADOR)

**Categorias:**

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/categorias-produto` | Cria categoria |
| `GET` | `/categorias-produto` | Lista categorias ativas |
| `PATCH` | `/categorias-produto/:id` | Atualiza categoria |
| `DELETE` | `/categorias-produto/:id` | Soft delete |

**Produtos:**

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/produtos` | Cria produto |
| `GET` | `/produtos` | Lista paginada (join com categoria) |
| `GET` | `/produtos/:id` | Detalhe (join com categoria) |
| `PATCH` | `/produtos/:id` | Atualiza |
| `DELETE` | `/produtos/:id` | Soft delete |

**Tabela de preço:**

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/produtos/:id/tabela-preco` | Adiciona faixa de preço |
| `GET` | `/produtos/:id/tabela-preco` | Lista todas as faixas |
| `PATCH` | `/produtos/:id/tabela-preco/:entryId` | Atualiza faixa |
| `DELETE` | `/produtos/:id/tabela-preco/:entryId` | Remove faixa |

### DTOs

**`CreateProductDto`**
```typescript
nome: string
categoriaId?: string    // @IsUUID @IsOptional
descricao?: string
unidade: string         // "g", "kg", "unidade"
```

**`CreatePriceTableDto`**
```typescript
tipoCliente: 'A' | 'B' | 'C'
quantidadeMin: number         // @IsNumber
quantidadeMax?: number
precoUnitario: number
descontoMaximoPct: number     // default 0
```

**`CreateCategoryDto`**
```typescript
nome: string
```

### Particularidades

- `findAll` e `findOne` de produtos fazem `LEFT JOIN` com `categorias_produto` para retornar `categoriaNome`
- Campos decimais do Drizzle são armazenados como `string` no PostgreSQL e convertidos para `String()` no insert
- Produto com `status = INATIVO` não é filtrado automaticamente nas listagens — cabe ao front/operador gerenciar

---

## 12. Slice 4 — Flows

**Arquivo:** `src/modules/flows/`

### Conceito

Um `FluxoConversa` é uma sequência de `EtapaFluxo`. O PulseJob executa o fluxo correspondente ao `tipoCliente` de cada contato. Apenas um fluxo pode estar **ativo** por tipo de cliente.

### Tipos de etapa

| Tipo | Comportamento |
|---|---|
| `TEXTO` | Envia mensagem de texto com template interpolado |
| `MIDIA` | Envia imagem, vídeo ou áudio |
| `TABELA_PRECO` | Formata e envia tabela de preços do produto como texto |
| `DELAY` | Pausa a execução pelo tempo configurado (simula digitação) |

### Template — variáveis disponíveis

```
{{nome}}          → contato.nome
{{tipoCliente}}   → contato.tipoCliente (A, B ou C)
{{dataHoje}}      → data atual em pt-BR (ex: 18/06/2026)
{{vendedor}}      → parâmetro VENDEDOR_1_NOME
```

A interpolação é feita pelo método `FlowsService.interpolate(text, vars)` via regex global (`/\{\{variavel\}\}/g`).

### Formato da tabela de preço gerada

```
*Tabela de Preços - Gelato 110*

Tipo A: R$ 120.00 (min: 1)
Tipo A: R$ 100.00 (min: 5)
Tipo A: R$ 95.00 (min: 10)
```

### Endpoints (Roles: ADMIN | OPERADOR)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/fluxos` | Lista todos os fluxos com contagem de etapas |
| `POST` | `/fluxos` | Cria fluxo (erro se já existe ativo para o tipo) |
| `GET` | `/fluxos/:id` | Detalhe do fluxo com etapas ordenadas por `ordem` |
| `PATCH` | `/fluxos/:id` | Atualiza nome ou status |
| `DELETE` | `/fluxos/:id` | Hard delete em cascata (apaga etapas) |
| `POST` | `/fluxos/:id/etapas` | Adiciona etapa |
| `PATCH` | `/fluxos/:id/etapas/:etapaId` | Atualiza etapa |
| `DELETE` | `/fluxos/:id/etapas/:etapaId` | Remove etapa |
| `POST` | `/fluxos/:id/testar/:contatoId` | Disparo de teste (sem delays) |

### Teste de fluxo

`POST /fluxos/:id/testar/:contatoId`

- Executa todas as etapas do fluxo para o contato especificado
- DELAYs são **ignorados** (apenas registrados no resultado)
- Retorna log de execução:
  ```json
  {
    "fluxoId": "...",
    "contatoId": "...",
    "resultados": [
      "[DELAY] 3s (ignorado em teste)",
      "[TEXTO] Enviado: Oi João, tudo bem?...",
      "[MIDIA] Enviado: https://..."
    ]
  }
  ```

### DTOs

**`CreateFlowDto`**
```typescript
nome: string
tipoCliente: 'A' | 'B' | 'C' | 'INATIVO' | 'BROADCAST'
```

**`CreateStepDto`**
```typescript
ordem: number              // @IsInt
tipo: 'TEXTO' | 'MIDIA' | 'TABELA_PRECO' | 'DELAY'
conteudoTexto?: string
midiaUrl?: string
midiaTipo?: 'IMAGEM' | 'VIDEO' | 'AUDIO'
caption?: string
produtoId?: string         // @IsUUID
delaySegundos?: number     // @IsInt
```

---

## 13. Slice 5 — Campaigns

**Arquivo:** `src/modules/campaigns/`

### Dois modos de disparo

1. **Broadcast** — envia a mesma mensagem a uma lista de contatos, com filtros por `tipoCliente` e `statusEngajamento`. Pode ser IMEDIATO ou AGENDADO.
2. **Pulse** — job recorrente com intervalo dinâmico (veja seção Jobs).

### Ciclo de vida de uma campanha

```
RASCUNHO → (editar) → RASCUNHO
RASCUNHO → (disparar) → EM_ANDAMENTO → CONCLUIDO
RASCUNHO | AGENDADO → (cancelar) → CANCELADO
```

### Endpoints (Roles: ADMIN | OPERADOR)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/campanhas` | Lista paginada |
| `POST` | `/campanhas` | Cria campanha |
| `GET` | `/campanhas/:id` | Detalhe |
| `PATCH` | `/campanhas/:id` | Edita (só se RASCUNHO) |
| `POST` | `/campanhas/:id/disparar` | Enfileira job broadcast-dispatch, muda status para EM_ANDAMENTO |
| `POST` | `/campanhas/:id/cancelar` | Cancela |
| `GET` | `/campanhas/:id/entregas` | Lista entregas paginadas da campanha |
| `GET` | `/parametros` | Lista todos os parâmetros do sistema |
| `PATCH` | `/parametros/:chave` | Atualiza parâmetro e emite evento `param.updated` |

### DTOs

**`CreateCampaignDto`**
```typescript
nome: string
tipo: 'IMEDIATO' | 'AGENDADO'
mensagem: string
midiaUrl?: string
midiaTipo?: 'IMAGEM' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO'
tipoClienteAlvo?: 'A' | 'B' | 'C'    // null = todos
statusAlvo?: string
agendadoPara?: string                  // @IsISO8601
```

**`UpdateParamDto`**
```typescript
valor: string   // @IsString @IsNotEmpty
```

### Parâmetro em tempo real

Ao chamar `PATCH /parametros/PULSE_INTERVALO_MINUTOS`:
1. O valor é atualizado no banco
2. EventEmitter2 emite `param.updated` com `{ chave, valor }`
3. `PulseJob` escuta via `@OnEvent('param.updated')` e reagenda o job sem restart

---

## 14. Slice 6 — Orders

**Arquivo:** `src/modules/orders/`

### Regra crítica de privacidade

A role `VENDEDOR` **nunca** vê o `contatoId` do pedido. O `findAll` remove o campo antes de retornar quando `role === 'VENDEDOR'`.

### Endpoints

| Método | Rota | Auth / Role | Descrição |
|---|---|---|---|
| `GET` | `/pedidos` | JwtAuthGuard (qualquer role) | Lista paginada, filtra `contatoId` para VENDEDOR |
| `POST` | `/pedidos` | ADMIN \| OPERADOR | Cria pedido com cálculo automático do total |
| `GET` | `/pedidos/:id` | JwtAuthGuard | Detalhe |
| `PATCH` | `/pedidos/:id/fechar` | ADMIN \| OPERADOR | Fecha pedido e notifica vendedor |
| `PATCH` | `/pedidos/:id/cancelar` | ADMIN \| OPERADOR | Cancela |
| `POST` | `/pedidos/:id/renotificar` | ADMIN \| OPERADOR | Reenvio de notificação ao vendedor |

### Cálculo do total

```typescript
total = itens.reduce((sum, item) => {
  const precoComDesconto = item.precoUnitario * (1 - item.descontoPct / 100);
  return sum + precoComDesconto * item.quantidade;
}, 0);
```

### Fluxo de fechamento (`fechar`)

1. Atualiza pedido: `status = FECHADO`, `fechadoEm = now()`
2. Atualiza contato: `statusEngajamento = ATIVO`
3. Evolution: `setLabel(numero, 'ATIVO')` — não-crítico (falha não aborta)
4. Lê `VENDEDOR_1_NUMERO_WHATSAPP` dos parâmetros
5. Envia mensagem ao vendedor (sem o número do cliente):
   ```
   Novo pedido fechado!
   Contato: João Silva
   Total: R$ 85.50
   ```
6. Atualiza `notificadoEm = now()`

### DTOs

**`CreateOrderDto`**
```typescript
contatoId: string     // @IsUUID
tipoCliente: 'A' | 'B' | 'C'
itens: ItemPedidoDto[]
observacoes?: string
```

**`ItemPedidoDto`** (nested, via `@ValidateNested`)
```typescript
produtoId: string
nome: string
quantidade: number
precoUnitario: number
descontoPct: number
```

---

## 15. Slice 7 — Media

**Arquivo:** `src/modules/media/`

### Upload para S3/MinIO

- Cliente: `@aws-sdk/client-s3` com `S3Client`
- `forcePathStyle: true` — necessário para MinIO
- Key gerada: `midias/{Date.now()}-{originalname}`
- URL pública: `${S3_PUBLIC_URL}/midias/{timestamp}-{filename}`
- Detecção de tipo por MIME:
  ```
  image/*   → IMAGEM
  video/*   → VIDEO
  audio/*   → AUDIO
  outros    → DOCUMENTO
  ```

### Entrega agendada

`POST /entregas-midia` com `agendadoPara` (ISO 8601):
1. Insere `entrega_midia_agendada` com `status = PENDENTE`
2. Calcula `delay = agendadoPara - now()` em ms
3. Enfileira job `media-delivery` no BullMQ com o delay calculado
4. O job `MediaDeliveryJob` executa no horário e envia a mídia

### Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/midias/upload` | ADMIN \| OPERADOR | Upload de arquivo (multipart/form-data, campo `arquivo`) |
| `GET` | `/midias` | ADMIN \| OPERADOR | Lista mídias ativas |
| `DELETE` | `/midias/:id` | ADMIN \| OPERADOR | Soft delete |
| `POST` | `/entregas-midia` | ADMIN \| OPERADOR | Agenda entrega para contato |
| `GET` | `/entregas-midia` | ADMIN \| OPERADOR | Lista entregas paginadas |
| `PATCH` | `/entregas-midia/:id/cancelar` | ADMIN \| OPERADOR | Cancela entrega pendente |

### DTOs

**`UploadMediaDto`**
```typescript
nome: string   // @IsString — nome amigável para o arquivo
```

**`ScheduleDeliveryDto`**
```typescript
contatoId: string       // @IsUUID
midiaId: string         // @IsUUID
agendadoPara: string    // @IsISO8601
caption?: string
```

---

## 16. Slice 8 — Webhook

**Arquivo:** `src/modules/webhook/`

### Segurança

`WebhookGuard` implementa `CanActivate`:
- Lê o header `x-evolution-webhook-secret`
- Compara com `EVOLUTION_WEBHOOK_SECRET` do ConfigService
- Retorna 401 se não bater

O endpoint **não usa** `JwtAuthGuard` — é acessado pela Evolution API, não pelo frontend.

### Endpoint

```
POST /webhook/evolution
```

### Eventos tratados

| Evento | Processamento |
|---|---|
| `messages.upsert` | Mensagem recebida de cliente |
| `messages.update` | Atualização de status de entrega (ack) |
| `connection.update` | Log do status de conexão |
| `qrcode.updated` | Log do novo QR Code |

### Processamento de `messages.upsert`

```
1. Extrai número: remoteJid.replace('@s.whatsapp.net', '')
2. Busca contato por numeroWhatsapp
3. Se encontrado:
   a. Atualiza ultima_mensagem_em = now()
   b. Atualiza statusEngajamento = RESPONDEU
   c. setLabel(numero, 'RESPONDEU')
   d. removeLabel(numero, 'INATIVO')
   e. Insere mensagem_log (direcao=RECEBIDA, tipo=TEXTO)
   f. Emite EventEmitter2: 'mensagem.recebida' { contatoId, numero, mensagem }
```

Extração do texto da mensagem:
```typescript
body?.data?.message?.conversation
  ?? body?.data?.message?.extendedTextMessage?.text
  ?? ''
```

### Processamento de `messages.update`

Mapeamento de ack → status em `mensagem_log`:

| Ack | Status |
|---|---|
| 1 | ENTREGUE |
| 2 | ENTREGUE |
| 3 | LIDO |

Atualiza por `evolution_id` no log.

### Eventos emitidos via EventEmitter2

| Evento | Payload | Consumidores |
|---|---|---|
| `mensagem.recebida` | `{ contatoId, numero, mensagem }` | Disponível para extensão futura |
| `param.updated` | `{ chave, valor }` | `PulseJob.rescheduleIfPulseParam` |

---

## 17. Jobs BullMQ

### Filas registradas

| Fila | Job name | Produtor | Consumidor |
|---|---|---|---|
| `pulse` | `run` | `PulseJob.onModuleInit` + repeat | `PulseJob.process` |
| `broadcast` | `broadcast-dispatch` | `CampaignsService.disparar` | `ScheduledBroadcastJob.process` |
| `media-delivery` | `media-delivery` | `MediaService.scheduleDelivery` | `MediaDeliveryJob.process` |

---

### `PulseJob` (`src/jobs/pulse.job.ts`)

**Decorator**: `@Processor('pulse')`, estende `WorkerHost`

#### Inicialização (`onModuleInit`)

1. Lê `PULSE_INTERVALO_MINUTOS` da tabela `parametro_sistema`
2. Agenda job repetível com `repeat: { every: N * 60 * 1000 }`
3. Configurado com `removeOnComplete: true`, `removeOnFail: 100`

#### Reagendamento dinâmico (`@OnEvent('param.updated')`)

```typescript
if (payload.chave === 'PULSE_INTERVALO_MINUTOS') {
  // Remove todos os jobs repetíveis existentes
  // Adiciona novo com o intervalo atualizado
}
```

#### Processamento do ciclo (`process(job)`)

```
1. Lê PULSE_ATIVO → se false, pula o ciclo
2. Lê PULSE_MAX_CONTATOS_POR_CICLO e PULSE_COOLDOWN_HORAS
3. Consulta contatos:
   WHERE status_engajamento IN ('NOVO', 'INATIVO')
     AND deleted_at IS NULL
     AND (cooldown_ate IS NULL OR cooldown_ate < now())
   LIMIT max_contatos
4. Para cada contato:
   a. Busca fluxo ativo para tipoCliente
   b. Busca etapas ordenadas por `ordem`
   c. Executa cada etapa:
      - DELAY → setTimeout(delaySegundos * 1000)
      - TEXTO → sendTextMessage com interpolação
      - MIDIA → sendMedia com mapa de tipo
      - TABELA_PRECO → formata texto e sendTextMessage
   d. Após fluxo:
      - cooldown_ate = now() + cooldown_horas
      - status_engajamento = INATIVO
      - setLabel(numero, 'INATIVO')
```

---

### `ScheduledBroadcastJob` (`src/jobs/scheduled-broadcast.job.ts`)

**Decorator**: `@Processor('broadcast')`, estende `WorkerHost`

#### Processamento (`broadcast-dispatch`)

```
1. Carrega campanha_broadcast
2. Define status EM_ANDAMENTO
3. Lê BROADCAST_DELAY_ENTRE_ENVIOS_MS
4. Filtra contatos (all → filter por tipoClienteAlvo → filter por statusAlvo → filter deleted_at IS NULL)
5. Para cada contato:
   a. await sleep(delayMs)
   b. Se campanha tem midia: sendMedia(numero, midiaUrl, mensagem, tipo)
      Senão: sendTextMessage(numero, mensagem)
   c. Insert campanha_entrega com status ENVIADO ou ERRO
6. Atualiza campanha: status CONCLUIDO, totalEnviados, totalErros, totalContatos
7. Em caso de erro geral: status CANCELADO (throw para o BullMQ tentar novamente)
```

---

### `MediaDeliveryJob` (`src/jobs/media-delivery.job.ts`)

**Decorator**: `@Processor('media-delivery')`, estende `WorkerHost`

#### Processamento (`media-delivery`)

```
1. Carrega entrega_midia_agendada
2. Se status = CANCELADO → retorna sem processar
3. Carrega midia (valida existência)
4. Carrega contato (valida existência)
5. sendMedia(numero, url, caption, tipo)
6. Atualiza status = ENVIADO, enviadoEm = now()
7. Em caso de erro:
   - Atualiza status = ERRO, erro_detalhes = err.message
   - Faz throw para o BullMQ registrar a falha
```

---

## 18. Padrões Globais da API

### Autenticação

Todos os endpoints (exceto `/auth/login`, `/auth/refresh`, `/webhook/evolution`) exigem:

```
Authorization: Bearer <jwt_access_token>
```

### Formato de resposta bem-sucedida

```json
{
  "success": true,
  "data": {
    ...
  }
}
```

### Formato de resposta de erro

```json
{
  "statusCode": 400,
  "message": "Email já cadastrado",
  "timestamp": "2026-06-18T10:30:00.000Z",
  "path": "/admin/users"
}
```

### Paginação

Todas as listagens aceitam `?pagina=1&limite=20` e retornam:

```json
{
  "success": true,
  "data": {
    "data": [...],
    "total": 150,
    "pagina": 1,
    "limite": 20
  }
}
```

### Validação

- `ValidationPipe` global com `whitelist: true` (remove campos não declarados no DTO) e `transform: true` (converte tipos automaticamente)
- Erros de validação retornam 400 com lista de mensagens em português

### Soft delete

Todas as entidades principais (`contato`, `produto`, `categoria_produto`, `midia`, `usuario_admin`) usam `deleted_at`. Selects filtram com `isNull(table.deletedAt)`.

---

## 19. Fluxo Principal de Negócio

```
[PulseJob — intervalo configurável, padrão 5 min]
         ↓
Consulta contatos:
  status IN (NOVO, INATIVO)
  AND cooldown_ate IS NULL OR < now()
  AND deleted_at IS NULL
  LIMIT PULSE_MAX_CONTATOS_POR_CICLO
         ↓
Para cada contato → busca fluxo ativo pelo tipoCliente
         ↓
Executa etapas do fluxo em ordem:
  DELAY → pausa (simula digitação)
  TEXTO → envia mensagem com {{variáveis}} substituídas
  MIDIA → envia imagem/vídeo/áudio
  TABELA_PRECO → formata e envia tabela de preços
         ↓
Após execução:
  cooldown_ate = now() + PULSE_COOLDOWN_HORAS
  statusEngajamento = INATIVO
  setLabel(numero, 'INATIVO')

─────────────────────────────────────────────────────

[Evolution API → webhook POST /webhook/evolution]
         ↓
  event: messages.upsert
         ↓
Encontra contato por numero
  statusEngajamento = RESPONDEU
  ultima_mensagem_em = now()
  setLabel(numero, 'RESPONDEU')
  removeLabel(numero, 'INATIVO')
  Insert mensagem_log (RECEBIDA)
  Emit 'mensagem.recebida'

─────────────────────────────────────────────────────

[PATCH /pedidos/:id/fechar]
         ↓
  status = FECHADO, fechadoEm = now()
  contato.statusEngajamento = ATIVO
  setLabel(numero, 'ATIVO')
  Envia notificação ao vendedor (sem número do cliente):
    "Novo pedido fechado! Contato: João Silva. Total: R$ 85,50"
  notificadoEm = now()
```

---

## 20. Guia de Inicialização

### Pré-requisitos

- Docker e Docker Compose
- Node.js 20+
- npm 10+

### Passo a passo

```bash
# 1. Configurar ambiente
cp .env.example .env
# editar .env com seus valores reais

# 2. Subir serviços de infra
docker compose up -d postgres redis minio evolution-api

# 3. Instalar dependências
npm install

# 4. Gerar e aplicar migrations
npm run db:generate
npm run db:migrate

# 5. Popular dados iniciais
npm run db:seed
# Cria: admin@wpp-autoflow.com / admin123
# Cria: todos os parâmetros de sistema

# 6. Iniciar aplicação
npm run start:dev
```

### Credenciais padrão após seed

| Campo | Valor |
|---|---|
| Email | `admin@wpp-autoflow.com` |
| Senha | `admin123` |
| Role | `ADMIN` |

**Alterar a senha no primeiro acesso via** `PATCH /admin/users/:id`.

### Verificar saúde da aplicação

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@wpp-autoflow.com","senha":"admin123"}'

# Status da instância Evolution (com o token retornado)
curl http://localhost:3000/evolution/status \
  -H "Authorization: Bearer <token>"
```

### Configurar a instância WhatsApp

1. `GET /evolution/qrcode` → escanear QR Code com o WhatsApp
2. `GET /evolution/status` → verificar se `status: connected`
3. Configurar `VENDEDOR_1_NUMERO_WHATSAPP` em `PATCH /parametros/VENDEDOR_1_NUMERO_WHATSAPP`

### Configurar o primeiro fluxo

1. Criar produto: `POST /produtos`
2. Adicionar tabela de preço: `POST /produtos/:id/tabela-preco`
3. Criar fluxo: `POST /fluxos` com `tipoCliente: "A"`
4. Adicionar etapas: `POST /fluxos/:id/etapas`
5. Testar: `POST /fluxos/:id/testar/:contatoId`
6. Ativar pulse: verificar `PATCH /parametros/PULSE_ATIVO` com `{"valor":"true"}`

### Build para produção

```bash
npm run build
docker compose --profile production up -d
```

---

*Documentação gerada a partir do código-fonte em 2026-06-18. Todos os endpoints, schemas e comportamentos descritos refletem a implementação real.*
