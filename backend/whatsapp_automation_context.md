# Contexto do Projeto: WhatsApp Automation Bot (Evolution API)

## Visão Geral

Sistema de automação de WhatsApp construído sobre a **Evolution API** (self-hosted via Docker),
com backend em **NestJS + TypeScript**, banco de dados **PostgreSQL** (via Drizzle ORM),
filas de jobs com **BullMQ + Redis**, e armazenamento de mídias via **S3-compatible storage**.

O sistema simula o comportamento humano do vendedor em conversas de WhatsApp, segmenta clientes
em perfis (A, B, C), envia tabelas de preço e mídias personalizadas, rotula contatos no WhatsApp,
notifica o vendedor humano quando um pedido é fechado, e suporta disparos programados.

---

## Stack Técnica

| Camada             | Tecnologia                                     |
| ------------------ | ---------------------------------------------- |
| Runtime            | Node.js 20+                                    |
| Framework          | NestJS (TypeScript)                            |
| ORM                | Drizzle ORM                                    |
| Banco de dados     | PostgreSQL 15                                  |
| Filas              | BullMQ + Redis                                 |
| WhatsApp           | Evolution API (Docker, self-hosted)            |
| Armazenamento      | MinIO ou S3 (mídias: imagens, vídeos, áudios)  |
| Scheduler          | @nestjs/schedule (CronJobs) + BullMQ           |
| Validação          | class-validator + class-transformer + Zod      |
| Autenticação       | JWT + Guards NestJS                            |
| Infraestrutura     | Docker Compose                                 |
| Variáveis de Env   | dotenv + Zod schema de validação               |

---

## Razão da Escolha: NestJS sobre Fastify puro

- O sistema de **módulos do NestJS** espelha exatamente a separação por domínio que o projeto exige.
- **BullMQ integrado** via `@nestjs/bullmq` para disparos com intervalo configurável (padrão 5 min, alterável pelo painel) e agendamentos por horário.
- **Guards e Interceptors** nativos para autenticação de webhook da Evolution API e do painel admin.
- **@nestjs/schedule** para CronJobs de disparo em horário programado.
- O agente consegue adicionar novos módulos sem quebrar os existentes, pois cada domínio é isolado.
- A Evolution API é instável a cada atualização do WhatsApp — a separação por módulo permite trocar
  a camada de integração sem reescrever a lógica de negócio.
- **Drizzle ORM** se encaixa nativamente com TypeScript — schemas são arquivos `.ts` puros, sem
  DSL proprietária. As migrations são geradas via `drizzle-kit` e versionadas junto ao código.

---

## Estrutura de Diretórios Alvo

```
whatsapp-automation/
├── docker-compose.yml              # PostgreSQL, Redis, MinIO, Evolution API
├── .env / .env.example
├── drizzle/
│   ├── schema/                     # Schemas Drizzle por módulo (ex: contacts.schema.ts)
│   ├── migrations/                 # Migrations geradas pelo drizzle-kit
│   └── seed.ts
└── src/
    ├── main.ts                     # Bootstrap NestJS
    ├── app.module.ts               # Módulo raiz
    ├── config/
    │   ├── env.ts                  # Validação de env com Zod
    │   └── app.config.ts
    ├── database/
    │   ├── database.module.ts      # Módulo Drizzle global (exporta DrizzleService)
    │   └── database.service.ts     # Instância do cliente Drizzle + pool PostgreSQL
    ├── common/
    │   ├── decorators/
    │   ├── filters/                # Exception filters globais
    │   ├── guards/                 # Auth guards
    │   ├── interceptors/           # Logging, auditoria
    │   ├── pipes/                  # Validação global
    │   └── utils/
    ├── modules/
    │   ├── auth/                   # [Slice 0] Autenticação JWT, usuários admin
    │   ├── evolution/              # [Slice 1] Wrapper da Evolution API
    │   ├── contacts/               # [Slice 2] Cadastro e segmentação de contatos
    │   ├── products/               # [Slice 3] Catálogo de produtos e tabelas de preço
    │   ├── flows/                  # [Slice 4] Fluxos de conversa por tipo de cliente
    │   ├── campaigns/              # [Slice 5] Disparos manuais e agendados
    │   ├── orders/                 # [Slice 6] Pedidos fechados e notificação ao vendedor
    │   ├── media/                  # [Slice 7] Upload e entrega de mídias
    │   └── webhook/                # [Slice 8] Recebimento de eventos da Evolution API
    └── jobs/
        ├── pulse.job.ts            # Job com intervalo configurável (padrão 5 min) — verifica quem chamar
        ├── scheduled-broadcast.job.ts  # Disparos em horário programado
        └── media-delivery.job.ts   # Entrega de mídia agendada por lead
```

---

## Docker Compose (serviços necessários)

```yaml
services:
  postgres:
    image: postgres:15
  redis:
    image: redis:7-alpine
  minio:
    image: minio/minio
  evolution-api:
    image: atendai/evolution-api:latest
    # Precisa de variáveis de instância, webhook URL, etc.
```

---

## Fluxo Principal (conforme imagem)

```
[Job Pulse — intervalo configurável via painel, padrão 5 min]
    ↓
Seleciona contatos elegíveis (não ATIVO, não em cooldown)
    ↓
Envia mensagem humanizada "Oi [nome], tudo bem?" — tom pessoal
    ↓
Cliente respondeu?
  SIM → Etiqueta RESPONDEU → Identifica tipo (A / B / C) → Envia tabela + mídia específica
  NÃO → Etiqueta INATIVO → Envia apenas "Salve 👋"
    ↓
Cliente fechou pedido?
  SIM → Etiqueta ATIVO + mídias completas desbloqueadas → Notifica vendedor
        (Vendedor vê: nome do cliente + resumo do pedido. NÃO vê número.)
```

---

## Módulos e Responsabilidades

---

### [Slice 0] Auth — Autenticação e Usuários Admin

**Objetivo:** Proteger o painel de gestão. Apenas usuários autenticados podem gerenciar
contatos, produtos, disparos e visualizar pedidos.

**Entidades:**

```
usuario_admin
├── id             UUID
├── nome           String
├── email          String (único)
├── senha_hash     String
├── role           Enum: ADMIN | VENDEDOR | OPERADOR
├── status         Enum: ATIVO | INATIVO
├── created_at     DateTime
├── updated_at     DateTime
└── deleted_at     DateTime (soft delete)
```

**Regras:**
- Role `VENDEDOR` acessa apenas módulo de pedidos fechados, sem ver número do cliente.
- Role `OPERADOR` gerencia contatos, disparos e fluxos.
- Role `ADMIN` acessa tudo, incluindo configuração da instância Evolution.
- JWT com expiração de 8h, refresh token opcional.
- Soft delete com `deleted_at`.

**Endpoints:**
```
POST /auth/login
POST /auth/refresh
GET  /auth/me
POST /admin/users
GET  /admin/users
PATCH /admin/users/:id
DELETE /admin/users/:id
```

---

### [Slice 1] Evolution — Wrapper da Evolution API

**Objetivo:** Isolar toda comunicação com a Evolution API em um único módulo.
Quando a Evolution quebrar por atualização do WhatsApp, só este módulo muda.

**Serviços internos (não expostos como endpoints REST):**

```
EvolutionService
  ├── sendTextMessage(to, text)
  ├── sendMedia(to, mediaUrl, caption, type)   // image | video | audio | document
  ├── sendButtons(to, text, buttons[])
  ├── setLabel(to, labelName)                  // Etiqueta no WhatsApp
  ├── removeLabel(to, labelName)
  ├── getInstance()
  ├── connectInstance()
  └── getQrCode()
```

**Configuração via env:**
```
EVOLUTION_API_URL
EVOLUTION_API_KEY
EVOLUTION_INSTANCE_NAME
EVOLUTION_WEBHOOK_SECRET
```

**Tratamento de erros:**
- Wrapper com retry automático (3 tentativas com backoff exponencial).
- Log de erro com payload original para reprocessamento manual.
- Nunca lança exceção para cima sem contexto; sempre encapsula em `EvolutionException`.

**Tabela de log de mensagens enviadas:**
```
mensagem_log
├── id              UUID
├── contato_id      UUID (FK)
├── direcao         Enum: ENVIADA | RECEBIDA
├── tipo            Enum: TEXTO | IMAGEM | VIDEO | AUDIO | DOCUMENTO | BOTAO
├── conteudo        String (texto ou URL da mídia)
├── status          Enum: PENDENTE | ENTREGUE | LIDO | ERRO
├── evolution_id    String (ID retornado pela Evolution API)
├── erro_detalhes   JSONB (nullable)
└── created_at      DateTime
```

**Endpoints (admin):**
```
GET  /evolution/status
POST /evolution/connect
GET  /evolution/qrcode
```

---

### [Slice 2] Contacts — Cadastro e Segmentação de Contatos

**Objetivo:** Gerenciar a lista de clientes/leads do WhatsApp, com segmentação por tipo,
status de engajamento, etiquetas e histórico.

**Entidades:**

```
contato
├── id                   UUID
├── nome                 String
├── numero_whatsapp      String (formato internacional: 5511999999999)
├── tipo_cliente         Enum: A | B | C
├── status_engajamento   Enum: NOVO | RESPONDEU | INATIVO | ATIVO | BLOQUEADO
├── ultima_mensagem_em   DateTime (nullable)
├── ultimo_pedido_em     DateTime (nullable)
├── cooldown_ate         DateTime (nullable)  // não chamar antes desta data
├── observacoes          String (nullable)
├── created_at           DateTime
├── updated_at           DateTime
└── deleted_at           DateTime
```

**Enum TipoCliente:**
```
A   // Recebe Tabela A + Mídia A
B   // Recebe Tabela B + Mídia B
C   // Recebe Tabela C + Mídia C
```

**Enum StatusEngajamento:**
```
NOVO          // Nunca foi contactado
RESPONDEU     // Respondeu ao último disparo (etiqueta WhatsApp: RESPONDEU)
INATIVO       // Não respondeu (etiqueta WhatsApp: INATIVO)
ATIVO         // Fechou pedido (etiqueta WhatsApp: ATIVO)
BLOQUEADO     // Não contactar
```

**Regras:**
- Número de WhatsApp deve ser único e no formato internacional.
- Contato `BLOQUEADO` nunca entra em disparos automáticos.
- `cooldown_ate` impede que o contato seja chamado antes do prazo (evitar spam).
- Soft delete: contatos deletados não entram em disparos.
- Importação em lote via CSV (campo `numero_whatsapp`, `nome`, `tipo_cliente`).

**Endpoints:**
```
GET    /contatos
POST   /contatos
PATCH  /contatos/:id
DELETE /contatos/:id
POST   /contatos/importar-csv
GET    /contatos/:id/historico
PATCH  /contatos/:id/status
PATCH  /contatos/:id/tipo
```

**Filtros:**
```
tipo_cliente
status_engajamento
criado_apos
ultimo_contato_antes
somente_sem_cooldown
```

---

### [Slice 3] Products — Catálogo e Tabelas de Preço

**Objetivo:** Gerenciar o catálogo de produtos com categorias, tabelas de preço por quantidade,
e desconto máximo permitido por cliente.

**Entidades:**

```
categoria_produto
├── id          UUID
├── nome        String
├── status      Enum: ATIVO | INATIVO
├── created_at  DateTime
├── updated_at  DateTime
└── deleted_at  DateTime
```

```
produto
├── id              UUID
├── nome            String          // ex: "Gelato 110"
├── categoria_id    UUID (FK)
├── descricao       String (nullable)
├── unidade         String          // ex: "g", "kg", "unidade"
├── status          Enum: ATIVO | INATIVO
├── created_at      DateTime
├── updated_at      DateTime
└── deleted_at      DateTime
```

```
produto_tabela_preco
├── id                    UUID
├── produto_id            UUID (FK)
├── tipo_cliente          Enum: A | B | C     // tabela específica por tipo
├── quantidade_min        Decimal             // ex: 1
├── quantidade_max        Decimal (nullable)  // ex: 4 (null = sem limite superior)
├── preco_unitario        Decimal
├── desconto_maximo_pct   Decimal             // ex: 10.00 = 10%
├── created_at            DateTime
└── updated_at            DateTime
```

**Exemplo de dados (conforme briefing):**
```
Produto: Gelato 110
Categoria: B
Tipo Cliente: A

Faixas de preço:
  1g  → R$ 120,00  (desconto máx: 10%)
  5g  → R$ 100,00  (desconto máx: 10%)
  10g → R$  95,00  (desconto máx: 10%)
```

**Regras:**
- Cada produto pode ter tabelas distintas para tipo A, B e C.
- Se não houver tabela para um tipo de cliente, usar tabela padrão ou bloquear envio.
- `desconto_maximo_pct` é validado no momento de montar a mensagem/tabela.
- Produto inativo não aparece em disparos nem no catálogo público.

```
produto_midia
├── id            UUID
├── produto_id    UUID (FK)
├── tipo_cliente  Enum: A | B | C | TODOS
├── tipo_midia    Enum: IMAGEM | VIDEO | AUDIO | DOCUMENTO
├── url           String    // URL do storage (MinIO/S3)
├── caption       String (nullable)
├── ordem         Int       // ordem de envio quando houver múltiplas
├── created_at    DateTime
└── updated_at    DateTime
```

**Endpoints:**
```
GET    /produtos
POST   /produtos
GET    /produtos/:id
PATCH  /produtos/:id
DELETE /produtos/:id

GET    /produtos/:id/tabela-preco
POST   /produtos/:id/tabela-preco
PATCH  /produtos/:id/tabela-preco/:faixaId
DELETE /produtos/:id/tabela-preco/:faixaId

GET    /categorias-produto
POST   /categorias-produto
PATCH  /categorias-produto/:id
DELETE /categorias-produto/:id
```

---

### [Slice 4] Flows — Fluxos de Conversa por Tipo de Cliente

**Objetivo:** Definir as etapas de conversa para cada tipo de cliente (A, B, C) e para
contatos inativos. O sistema deve soar como o próprio vendedor conversando.

**Conceito:**
Cada tipo de cliente tem um `FluxoConversa` composto por `EtapaFluxo`. Cada etapa é
um bloco de mensagem (texto, mídia, tabela de preço formatada) que o bot envia em sequência,
com delay entre as mensagens para parecer humano.

**Entidades:**

```
fluxo_conversa
├── id                UUID
├── nome              String         // ex: "Fluxo Cliente A"
├── tipo_cliente      Enum: A | B | C | INATIVO | BROADCAST
├── ativo             Boolean
├── created_at        DateTime
└── updated_at        DateTime
```

```
etapa_fluxo
├── id                UUID
├── fluxo_id          UUID (FK)
├── ordem             Int
├── tipo              Enum: TEXTO | MIDIA | TABELA_PRECO | DELAY
├── conteudo_texto    String (nullable)     // para tipo TEXTO
├── midia_url         String (nullable)     // para tipo MIDIA
├── midia_tipo        Enum (nullable)       // IMAGEM | VIDEO | AUDIO
├── caption           String (nullable)     // legenda da mídia
├── produto_id        UUID (nullable)       // para tipo TABELA_PRECO
├── delay_segundos    Int (nullable)        // para tipo DELAY (simula digitação)
├── created_at        DateTime
└── updated_at        DateTime
```

**Variáveis de template disponíveis no conteúdo:**
```
{{nome}}          → nome do contato
{{tipo_cliente}}  → A, B ou C
{{data_hoje}}     → data atual formatada
{{vendedor}}      → nome do vendedor responsável (se configurado)
```

**Regras:**
- O fluxo `INATIVO` envia apenas uma mensagem do tipo "Salve 👋" (sem tabela).
- O fluxo de cliente A/B/C envia: saudação → delay → tabela de preço → mídia específica.
- Delays entre etapas são obrigatórios para simular digitação humana.
- Apenas um fluxo ativo por tipo de cliente.
- Se o cliente responder durante o fluxo, o job registra a resposta e para o envio.

**Endpoints:**
```
GET    /fluxos
POST   /fluxos
GET    /fluxos/:id
PATCH  /fluxos/:id
DELETE /fluxos/:id
POST   /fluxos/:id/etapas
PATCH  /fluxos/:id/etapas/:etapaId
DELETE /fluxos/:id/etapas/:etapaId
POST   /fluxos/:id/testar/:contatoId    // dispara fluxo manualmente para teste
```

---

### [Slice 5] Campaigns — Disparos Automáticos e Agendados

**Objetivo:** Controlar os dois tipos de disparo do sistema:

1. **Pulse automático** — job recorrente com intervalo configurável (padrão: 5 min, alterável pelo painel sem reiniciar o servidor) que verifica quem pode ser chamado.
2. **Broadcast agendado** — mensagem enviada a uma lista em horário programado.
   Ex: "Salve Família, Vamos comprar Hoje?" às 10h de segunda.

**Entidades:**

```
campanha_broadcast
├── id                UUID
├── nome              String
├── tipo              Enum: IMEDIATO | AGENDADO
├── mensagem          String
├── midia_url         String (nullable)
├── midia_tipo        Enum (nullable)
├── tipo_cliente_alvo Enum (nullable)   // null = todos
├── status_alvo       Enum (nullable)   // null = todos elegíveis
├── agendado_para     DateTime (nullable)
├── status_campanha   Enum: RASCUNHO | AGENDADO | EM_ANDAMENTO | CONCLUIDO | CANCELADO
├── total_contatos    Int (nullable)
├── total_enviados    Int
├── total_erros       Int
├── criado_por        UUID (FK usuario_admin)
├── created_at        DateTime
└── updated_at        DateTime
```

```
campanha_entrega
├── id              UUID
├── campanha_id     UUID (FK)
├── contato_id      UUID (FK)
├── status          Enum: PENDENTE | ENVIADO | ERRO
├── erro_detalhes   String (nullable)
├── enviado_em      DateTime (nullable)
└── created_at      DateTime
```

**Regras do Pulse:**
- O intervalo de execução é controlado pelo parâmetro `PULSE_INTERVALO_MINUTOS` (padrão: 5).
- Quando o parâmetro é alterado pelo painel, o job BullMQ é reagendado **sem reiniciar o servidor**.
- Seleciona contatos com `status_engajamento IN (NOVO, INATIVO)`.
- Ignora contatos com `cooldown_ate > agora`.
- Ignora contatos com `status_engajamento = BLOQUEADO`.
- Executa o fluxo correspondente ao `tipo_cliente` do contato.
- Após o disparo, define `cooldown_ate = agora + X horas` (configurável por parâmetro).
- Número máximo de contatos por ciclo é configurável (evitar ban do WhatsApp).

**Parâmetros globais relacionados:**
```
PULSE_INTERVALO_MINUTOS         // ex: 5  (padrão; alterável pelo painel em tempo real)
PULSE_MAX_CONTATOS_POR_CICLO    // ex: 5
PULSE_COOLDOWN_HORAS            // ex: 24 (não chamar o mesmo contato por 24h)
PULSE_ATIVO                     // true | false (liga/desliga o pulse)
BROADCAST_DELAY_ENTRE_ENVIOS_MS // ex: 3000 (delay entre cada envio do broadcast)
```

**Endpoints:**
```
GET    /campanhas
POST   /campanhas
GET    /campanhas/:id
PATCH  /campanhas/:id
POST   /campanhas/:id/disparar      // força disparo imediato
POST   /campanhas/:id/cancelar
GET    /campanhas/:id/entregas

GET    /parametros
PATCH  /parametros/:chave
```

---

### [Slice 6] Orders — Pedidos e Notificação ao Vendedor

**Objetivo:** Registrar quando um cliente fechou um pedido e notificar o vendedor humano
via WhatsApp — exibindo nome e resumo do pedido, **sem expor o número do cliente**.

**Entidades:**

```
pedido
├── id                UUID
├── contato_id        UUID (FK)
├── tipo_cliente      Enum: A | B | C
├── status            Enum: ABERTO | FECHADO | CANCELADO
├── itens             JSONB    // array de { produto_id, nome, quantidade, preco_unitario, desconto_pct }
├── total_estimado    Decimal (nullable)
├── observacoes       String (nullable)
├── fechado_em        DateTime (nullable)
├── notificado_em     DateTime (nullable)
├── created_at        DateTime
└── updated_at        DateTime
```

**Regra de notificação ao vendedor:**
- Quando `status = FECHADO`, o sistema envia mensagem para o número do vendedor configurado.
- Mensagem contém: nome do cliente, tipo, itens do pedido, total estimado.
- Mensagem **NÃO contém** número de telefone do cliente.
- Exemplo de mensagem:
  ```
  🛒 *Novo Pedido Fechado*
  Cliente: João Silva (Tipo A)
  
  Itens:
  - Gelato 110 | 10g | R$ 85,50 (10% desc.)
  
  Total estimado: R$ 85,50
  ```
- Após notificação, o campo `notificado_em` é preenchido.
- Etiqueta `ATIVO` é aplicada ao contato no WhatsApp.

**Número do vendedor:**
- Configurado em `parametro_sistema` com chave `VENDEDOR_NUMERO_WHATSAPP`.
- Pode haver mais de um vendedor (chaves `VENDEDOR_1_NUMERO`, `VENDEDOR_2_NUMERO`, etc.).

**Endpoints:**
```
GET    /pedidos
POST   /pedidos
GET    /pedidos/:id
PATCH  /pedidos/:id/fechar
PATCH  /pedidos/:id/cancelar
POST   /pedidos/:id/renotificar    // reenviar notificação ao vendedor
```

**Acesso por role:**
- `VENDEDOR`: vê lista de pedidos fechados. Não vê número do contato.
- `OPERADOR` / `ADMIN`: acesso completo.

---

### [Slice 7] Media — Upload e Entrega de Mídias

**Objetivo:** Gerenciar upload de imagens, vídeos e áudios para o MinIO/S3,
e suportar entrega de mídia agendada para um lead específico em horário determinado.

**Entidades:**

```
midia
├── id            UUID
├── nome          String
├── tipo          Enum: IMAGEM | VIDEO | AUDIO | DOCUMENTO
├── url           String      // URL pública do MinIO/S3
├── tamanho_bytes Int
├── mime_type     String
├── criado_por    UUID (FK)
├── created_at    DateTime
└── deleted_at    DateTime
```

```
entrega_midia_agendada
├── id              UUID
├── contato_id      UUID (FK)
├── midia_id        UUID (FK)
├── caption         String (nullable)
├── agendado_para   DateTime
├── status          Enum: PENDENTE | ENVIADO | ERRO | CANCELADO
├── enviado_em      DateTime (nullable)
├── erro_detalhes   String (nullable)
├── criado_por      UUID (FK)
└── created_at      DateTime
```

**Regras:**
- Upload suporta: JPG, PNG, MP4, MP3, OGG, PDF.
- Tamanho máximo por arquivo: 50MB (configurável).
- Mídias podem ser vinculadas a produtos (Slice 3) ou a entregas avulsas.
- Entregas agendadas são processadas pelo `media-delivery.job.ts` via BullMQ.

**Endpoints:**
```
POST   /midias/upload
GET    /midias
DELETE /midias/:id

POST   /entregas-midia            // agendar entrega para um contato
GET    /entregas-midia
PATCH  /entregas-midia/:id/cancelar
```

---

### [Slice 8] Webhook — Recebimento de Eventos da Evolution API

**Objetivo:** Receber eventos do WhatsApp via webhook da Evolution API e processar
respostas de clientes, atualizações de status de mensagem e conexão da instância.

**Eventos tratados:**

| Evento Evolution           | Ação no sistema                                           |
| -------------------------- | --------------------------------------------------------- |
| `messages.upsert`          | Registra mensagem recebida, atualiza status do contato    |
| `messages.update`          | Atualiza status de entrega (ENTREGUE / LIDO)              |
| `connection.update`        | Atualiza status da instância (conectado/desconectado)     |
| `qrcode.updated`           | Armazena novo QR Code para reconexão                      |

**Lógica de `messages.upsert` (mensagem recebida):**
1. Identifica contato pelo número.
2. Se contato existir: atualiza `ultima_mensagem_em`, muda `status_engajamento = RESPONDEU`.
3. Aplica etiqueta `RESPONDEU` no WhatsApp via `EvolutionService.setLabel`.
4. Remove etiqueta `INATIVO` se existia.
5. Emite evento interno para o módulo de Flows processar a resposta.
6. Registra na `mensagem_log` com `direcao = RECEBIDA`.

**Segurança do Webhook:**
- Header `x-evolution-webhook-secret` validado via Guard.
- Chave configurada em `EVOLUTION_WEBHOOK_SECRET`.

**Endpoint:**
```
POST /webhook/evolution     // recebe todos os eventos da Evolution API
```

---

## Parâmetros Globais do Sistema

Tabela `parametro_sistema`:

| Chave                              | Valor padrão | Descrição                                             |
| ---------------------------------- | ------------ | ----------------------------------------------------- |
| `PULSE_ATIVO`                      | `true`       | Liga/desliga o job de disparo automático              |
| `PULSE_INTERVALO_MINUTOS`          | `5`          | Intervalo do job em minutos (alterável pelo painel)   |
| `PULSE_MAX_CONTATOS_POR_CICLO`     | `5`          | Máx de contatos por ciclo do pulse                    |
| `PULSE_COOLDOWN_HORAS`             | `24`         | Horas de cooldown após disparo                        |
| `BROADCAST_DELAY_ENTRE_ENVIOS_MS`  | `3000`       | Delay (ms) entre envios de broadcast                  |
| `VENDEDOR_1_NUMERO_WHATSAPP`       | —            | Número do vendedor principal                          |
| `VENDEDOR_1_NOME`                  | —            | Nome do vendedor principal                            |
| `MAX_UPLOAD_TAMANHO_MB`            | `50`         | Tamanho máximo de upload de mídia                     |
| `FLUXO_DELAY_PADRAO_SEGUNDOS`      | `3`          | Delay padrão entre etapas do fluxo                    |

---

## Auditoria

Tabela `auditoria_sistema` (padrão idêntico ao Slice 0 do projeto de referência):

| Campo              | Tipo        | Descrição                  |
| ------------------ | ----------- | -------------------------- |
| `id`               | UUID        |                            |
| `entidade`         | String      | Nome da tabela             |
| `entidade_id`      | String      | ID do registro             |
| `acao`             | Enum        | CREATE/UPDATE/DELETE/etc.  |
| `dados_anteriores` | JSONB       |                            |
| `dados_novos`      | JSONB       |                            |
| `usuario_id`       | UUID (null) | Admin que fez a ação       |
| `ip_origem`        | String      |                            |
| `created_at`       | DateTime    |                            |

Ações auditadas obrigatoriamente:
- Alteração de status de contato.
- Fechamento de pedido.
- Criação/edição de produto e tabela de preço.
- Criação/disparo de campanha.
- Alteração de parâmetros globais.

---

## Separação por Slices sugerida para o Agente

| Slice | Módulo              | Dependências          | Prioridade |
| ----- | ------------------- | --------------------- | ---------- |
| 0     | Auth + Foundation   | —                     | 🔴 Crítico |
| 1     | Evolution Wrapper   | Slice 0               | 🔴 Crítico |
| 2     | Contacts            | Slice 0               | 🔴 Crítico |
| 3     | Products            | Slice 0               | 🟡 Alta    |
| 4     | Flows               | Slices 1, 2, 3        | 🟡 Alta    |
| 5     | Campaigns           | Slices 1, 2, 4        | 🟡 Alta    |
| 6     | Orders              | Slices 1, 2           | 🟠 Média   |
| 7     | Media               | Slice 0               | 🟠 Média   |
| 8     | Webhook             | Slices 1, 2, 4        | 🟡 Alta    |

---

## Frontend de Gerenciamento (Escopo Futuro Previsto)

O sistema prevê um painel frontend para gerenciamento completo do bot. A API REST deve ser
construída já considerando este consumidor. Funcionalidades previstas para o painel:

- Gerenciamento de contatos (criar, editar, importar CSV, visualizar histórico, alterar tipo A/B/C).
- Catálogo de produtos: criar/editar SKUs, categorias, tabelas de preço por faixa e tipo de cliente.
- Configuração de fluxos de conversa e etapas.
- Controle de campanhas e broadcasts agendados.
- Visualização de pedidos fechados (vendedor não vê número do cliente).
- **Painel de configuração do Pulse:** alterar `PULSE_INTERVALO_MINUTOS` e demais parâmetros
  globais em tempo real, sem reiniciar o servidor.
- Status da instância Evolution (conectado/desconectado, QR Code).

> O agente deve garantir que todos os endpoints retornem respostas padronizadas e paginadas,
> prontas para consumo por um frontend React/Next.js.

---

## Fora do Escopo Inicial

Não implementar por enquanto:

- Painel frontend (implementar apenas API REST; o frontend é escopo futuro previsto acima).
- Multi-instância (múltiplos números de WhatsApp simultâneos).
- IA generativa para resposta automática de mensagens livres.
- Relatórios analíticos avançados (funil de conversão, taxa de resposta).
- Integração com CRM externo.
- Sistema de pagamento.

---

## Observações Importantes para o Agente

1. **Nunca expor o número de telefone do cliente para a role `VENDEDOR`.**
   Todos os endpoints de pedidos devem omitir `numero_whatsapp` na serialização para esta role.

2. **A Evolution API é instável.** Todo acesso a ela deve passar pelo `EvolutionModule`.
   Nenhum outro módulo deve importar diretamente o cliente HTTP da Evolution.

3. **Delays humanizados são obrigatórios.** O sistema não deve enviar mensagens em rajada
   sem delay. O padrão mínimo é `FLUXO_DELAY_PADRAO_SEGUNDOS` entre cada etapa.

4. **Soft delete em todas as entidades principais** com campo `deleted_at`.

5. **Validação de env na inicialização** com Zod — a aplicação não deve subir com variáveis
   obrigatórias ausentes.

6. **BullMQ com Redis** para todos os jobs assíncronos. Não usar `setTimeout` ou `setInterval`
   diretamente para lógica de negócio.

7. **Drizzle ORM:** schemas ficam em `drizzle/schema/` organizados por módulo (ex: `contacts.schema.ts`,
   `products.schema.ts`). Migrations são geradas via `drizzle-kit generate` e aplicadas via
   `drizzle-kit migrate`. O `DrizzleModule` é global e injeta o cliente via DI do NestJS.

8. **Intervalo do Pulse é dinâmico.** O job não usa cron string fixa. Ao iniciar, lê
   `PULSE_INTERVALO_MINUTOS` do banco. Quando esse parâmetro é alterado pelo painel via
   `PATCH /parametros/PULSE_INTERVALO_MINUTOS`, o serviço cancela o job atual no BullMQ e
   reagenda com o novo intervalo — sem restart da aplicação.

9. **Todos os endpoints devem ser construídos pensando no frontend de gerenciamento.**
   Respostas paginadas, filtros via query params, e erros com mensagens claras em português.
