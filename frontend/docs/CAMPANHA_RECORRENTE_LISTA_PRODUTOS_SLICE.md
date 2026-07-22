# Slice — Campanha Recorrente com Lista de Produtos

> Criado em: 2026-07-08 · Decisões fechadas em: 2026-07-08
> Status: ✅ implementado (ver `CAMPANHA_RECORRENTE_API_PRONTA.md`)
> **Definição atual evoluiu**: esta feature agora é o script "Salve" — ver `SCRIPT_SALVE_SLICE.md`
> (seletor de tipo de script no modal, mensagem de salve customizada, intervalo mínimo de 10 min).
> Depende de: `campanha_broadcast` (já existe), `produto` + `produto_tabela_preco` + `produto_midia` (já existem)
>
> ⚠️ **Superado em 2026-07-16**: o modelo de picker manual de produtos (`productIds` /
> tabela `campanha_produto`) descrito neste doc foi substituído por seleção automática por
> tier — cada ciclo puxa todos os produtos ativos com preço no tier do lead, sem lista
> curada por campanha. Mantido como registro histórico da decisão original.

---

## Sumário

1. [Contexto](#1-contexto)
2. [Decisões de design já tomadas](#2-decisões-de-design-já-tomadas)
3. [Segmentação, pausa por resposta e formato do catálogo](#3-segmentação-pausa-por-resposta-e-formato-do-catálogo)
4. [Modelo de dados](#4-modelo-de-dados)
5. [Como o disparo recorrente funciona (sem tabela de auditoria)](#5-como-o-disparo-recorrente-funciona-sem-tabela-de-auditoria)
6. [Endpoints REST](#6-endpoints-rest)
7. [Especificação do modal (frontend)](#7-especificação-do-modal-frontend)
8. [Máquina de estados](#8-máquina-de-estados)
9. [Checklist de implementação](#9-checklist-de-implementação)

---

## 1. Contexto

Hoje o admin consegue montar, na tela de tabela de preços, uma lista de produtos com preço,
descrição e foto, segmentada por `starRating` do produto (`A`/`B`/`C`). A ideia deste slice é
permitir que essa lista seja disparada como campanha para os leads de um tipo de estrela
(`starLevel` 1/2/3, ou todos), dentro de uma janela de tempo (início/término), reenviando em
um intervalo configurável — sem que o admin precise montar condicionais ou fluxo: depois do
disparo da lista, o atendimento segue pelo fluxo/Pulse já programado normalmente.

Volume esperado: **~200-300 leads**. Isso é relevante para a decisão da seção 2.

---

## 2. Decisões de design já tomadas

- **Sem tabela de auditoria por lead.** Diferente da campanha de disparo único (que grava 1
  linha em `campanha_entrega` por contato), aqui **não** vamos gravar quem recebeu cada ciclo.
  Com 200-300 leads e reenvio periódico, isso geraria uma tabela crescendo indefinidamente
  (`leads × ciclos`) só para um controle que, na prática, ninguém vai auditar linha a linha.
- **BullMQ cuida da recorrência nativamente.** BullMQ já suporta jobs repetíveis com
  `repeat: { every, startDate, endDate }` — o próprio Redis agenda e para de agendar sozinho
  quando passa do `endDate`. Não precisamos de nenhuma tabela de "próxima execução" nem de um
  cron caseiro checando datas.
- **Segmentação é sempre consultada ao vivo.** A cada execução do ciclo, a query busca os
  contatos que casam com o filtro **naquele momento** (`starLevel`, não bloqueado, etc.) — não
  existe conceito de "fila de quem falta receber". Todo ciclo, todo mundo do segmento recebe de
  novo.
- **Sem tracking por lead ⇒ sem replay seletivo.** Se o job falhar no meio (ex: Evolution API
  fora do ar), não temos como saber quem recebeu e quem não recebeu naquele ciclo específico —
  só logs de aplicação (Nest `Logger`, os mesmos usados no `PulseJob`/`ScheduledBroadcastJob`).
  Isso é uma troca consciente pela simplicidade — ver seção 3.
- **Contadores agregados, não por lead.** A campanha mantém `totalSent`/`totalErrors` como
  contadores cumulativos simples (somados a cada ciclo), só para o admin ter uma noção de
  volume — igual já existe hoje em `campanha_broadcast`, sem tabela nova.

---

## 3. Segmentação, pausa por resposta e formato do catálogo

### 3.1 Mapeamento `starLevel` (lead, 1/2/3) ↔ `starRating` (produto, A/B/C)

Fechado: **1↔C, 2↔B, 3↔A**. Não precisa de UI nova — vira uma função pura hardcoded no
backend (`mapStarLevelToProductRating`), usada só para filtrar quais linhas de
`produto_tabela_preco`/`produto_midia` entram no catálogo daquele ciclo.

### 3.2 Pausa por resposta ("stopOnConversion")

Fechado, com um ajuste importante em relação à proposta original: **não é uma exclusão
permanente, é uma pausa reavaliada a cada ciclo.**

- A cada execução do job, a query de segmento exclui contatos com
  `engagementStatus IN ('RESPONDEU', 'ATIVO', 'BLOQUEADO')`.
- `RESPONDEU` já é setado automaticamente pelo `WebhookService` assim que o lead manda
  **qualquer mensagem** de volta ([webhook.service.ts:48-53](src/modules/webhook/webhook.service.ts#L48-L53)) — ou seja, no
  momento em que ele demonstra interesse naquele chat, ele já sai do próximo ciclo sem
  precisar de nenhum campo novo ou lógica extra.
- Como a query é sempre ao vivo (sem tabela de auditoria) e o intervalo típico é diário, isso
  já implementa exatamente o "pausado até o próximo dia seguinte": se até o próximo ciclo o
  lead **voltar** para `NOVO`/`INATIVO` (ex: operador chama `POST /contatos/:id/reiniciar-bot`
  depois que a conversa esfria sem fechar), ele volta a receber o catálogo automaticamente. Se
  continuar `RESPONDEU` (ainda em negociação) ou virar `ATIVO` (fechou pedido), continua fora
  — o que é o comportamento desejado, não um bug.
- Não precisamos do campo `stopOnConversion` como boolean opcional no DTO — vira
  comportamento padrão sempre ativo do job recorrente (mais simples, e é o que foi pedido).

### 3.3 Formato do catálogo

Fechado: **uma única mensagem de texto consolidada**, no mesmo formato que o front já usa na
tela de tabela de preços — não uma mensagem por produto. As fotos dos produtos (já cadastradas
em `produto_midia`) são enviadas **antes** da mensagem de texto, uma por produto que tiver
foto (sem legenda, ou legenda curta = nome do produto), e a mensagem de texto consolidada fecha
o disparo.

Template do texto (baseado no exemplo que você mandou), montado a partir dos produtos da
campanha + suas faixas em `produto_tabela_preco` filtradas pelo `starRating` mapeado:

```
Tabela de Preços
Condições especiais para clientes ⭐

📦 {NOME_PRODUTO_1}
{DESCRICAO_PRODUTO_1}
• {minQuantity}–{maxQuantity} {unit}: R$ {unitPrice}/{unit}{ se maxDiscountPct>0: " (desc. até X%)" }

📦 {NOME_PRODUTO_2}
• {faixa...}

Preços válidos hoje. Da um salve se quiser fechar batida com nós! 💬
```

Regras de montagem:
- Um bloco `📦 NOME` por produto da campanha (`campanha_produto`, na ordem `order`).
- Segunda linha com a `description` do produto **só aparece se ela existir** (produto sem
  descrição pula direto pras faixas de preço) — no exemplo, "FROZEM DE FRUTAS" não tem
  segunda linha.
- Uma linha `•` por faixa em `produto_tabela_preco` daquele produto (filtrada pelo
  `starRating` mapeado), ordenada por `minQuantity`.
- Rodapé fixo (call-to-action) — pode ficar configurável via parâmetro do sistema no futuro,
  mas por ora hardcoded igual ao `message` de abertura das campanhas hoje.

---

## 4. Modelo de dados

### 4.1 Alterações em `campanha_broadcast` (`drizzle/schema/campaigns.schema.ts`)

```typescript
export const campaignTypeEnum = pgEnum('tipo_campanha_enum', [
  'IMEDIATO',
  'AGENDADO',
  'RECORRENTE',        // 🆕
]);

export const broadcastCampaigns = pgTable('campanha_broadcast', {
  // ...campos existentes (id, name, type, message, mediaUrl, mediaType,
  //    targetStarRating, targetStatus, scheduledFor, bullJobId,
  //    campaignStatus, totalContacts, totalSent, totalErrors, createdBy,
  //    createdAt, updatedAt) — inalterados

  startAt: timestamp('inicio_em'),              // 🆕 início da janela (type=RECORRENTE)
  endAt: timestamp('termino_em'),                // 🆕 fim da janela (type=RECORRENTE)
  repeatIntervalMinutes: integer('intervalo_repeticao_minutos'), // 🆕
  totalCycles: integer('total_ciclos').notNull().default(0),    // 🆕 quantos ciclos já rodaram
  lastCycleAt: timestamp('ultimo_ciclo_em'),     // 🆕
});
```

> Não há coluna `stopOnConversion` — a pausa por resposta (seção 3.2) é comportamento sempre
> ativo do job, não uma opção configurável.

`scheduledFor` continua existindo só para `type=AGENDADO`. Para `RECORRENTE`, usamos `startAt`/
`endAt` — não reaproveita `scheduledFor` para não misturar semânticas diferentes.

### 4.2 Tabela nova — `campanha_produto` (M:N campanha ↔ produto)

```typescript
export const campaignProducts = pgTable('campanha_produto', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campanha_id').notNull()
    .references(() => broadcastCampaigns.id, { onDelete: 'cascade' }),
  productId: uuid('produto_id').notNull()
    .references(() => products.id),
  order: integer('ordem').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

Essa é a única tabela nova do slice — bem mais barata que uma tabela de auditoria por lead
(no máximo dezenas de linhas por campanha, não milhares).

**Sem tabela `campanha_entrega` para este fluxo.** A tabela existente continua sendo usada
normalmente pelas campanhas `IMEDIATO`/`AGENDADO` (não mexe nelas) — só não é populada pelo
novo job recorrente.

---

## 5. Como o disparo recorrente funciona (sem tabela de auditoria)

Novo processor, ex. `src/jobs/recurring-campaign.job.ts`, registrado numa fila nova
`campaign-recurring` (ao lado de `pulse`, `broadcast`, `media-delivery` em `app.module.ts`).

### 5.1 Registro do job repetível (ao criar/ativar a campanha)

```typescript
await this.recurringQueue.add(
  'recurring-dispatch',
  { campanhaId: result.id },
  {
    jobId: `recurring-${result.id}`,
    repeat: {
      every: dto.repeatIntervalMinutes * 60_000,
      startDate: new Date(dto.startAt),
      endDate: new Date(dto.endAt),   // BullMQ para de agendar sozinho depois disso
    },
  },
);
```

Isso substitui qualquer necessidade de cron caseiro ou tabela de "próxima execução" — é
literalmente o que você pediu: "o cronJob do BullMQ cronometrar para realizar o disparo
novamente em X tempo".

### 5.2 O que o processor faz a cada execução

```typescript
async process(job: Job<{ campanhaId: string }>) {
  const campaign = await this.repo.findCampanhaById(campanhaId);
  if (!campaign || campaign.campaignStatus === 'CANCELADO') return;

  // fim da janela: encerra e remove o job repetível (não deixa "zumbi")
  if (new Date() > campaign.endAt) {
    await this.repo.updateCampanha(campanhaId, { campaignStatus: 'CONCLUIDO' });
    await this.recurringQueue.removeRepeatableByKey(job.repeatJobKey);
    return;
  }

  const starRatingProduto = mapStarLevelToProductRating(campaign.targetStarRating); // 1↔C, 2↔B, 3↔A
  const products = await this.repo.findCampaignProducts(campanhaId, starRatingProduto); // produto + faixas de preço + mídia
  const catalogText = buildCatalogMessage(products); // seção 3.3 — monta o texto consolidado 1x por ciclo
  const photoUrls = products.flatMap((p) => p.media.map((m) => m.url));

  // ao vivo, todo ciclo: exclui quem já respondeu, já converteu ou está bloqueado (seção 3.2)
  const contacts = await this.repo.findContatosFiltrados(campaign.targetStarRating);

  let sent = 0, errors = 0;
  for (const contact of contacts) {
    try {
      for (const url of photoUrls) {
        await this.evolutionService.sendMedia(contact.phoneNumber, url, '', 'image', contact.id);
        await sleep(delayMs); // reaproveita BROADCAST_DELAY_ENTRE_ENVIOS_MS
      }
      await this.evolutionService.sendTextMessage(contact.phoneNumber, catalogText, contact.id);
      sent++;
    } catch (err) {
      errors++; // só loga, não persiste por lead
      this.logger.error(`Falha ao enviar catálogo para ${contact.phoneNumber}`, err);
    }
    await sleep(delayMs);
  }

  await this.repo.updateCampanha(campanhaId, {
    campaignStatus: 'EM_ANDAMENTO',
    totalSent: campaign.totalSent + sent,
    totalErrors: campaign.totalErrors + errors,
    totalCycles: campaign.totalCycles + 1,
    lastCycleAt: new Date(),
  });
}
```

Sem `insert` nenhum por lead — só updates agregados na própria linha da campanha, uma vez por
ciclo (barato, independente de ter 200 ou 2000 leads).

### 5.3 Cancelamento

`POST /campanhas/:id/cancelar` precisa, além de atualizar o status, remover o job repetível:

```typescript
await this.recurringQueue.removeRepeatableByKey(campaign.bullRepeatJobKey);
```

(`bullJobId` guarda o `repeatJobKey` retornado pelo BullMQ, igual já se guarda o `job.id` no
fluxo de `AGENDADO` hoje.)

---

## 6. Endpoints REST

Reaproveita os mesmos endpoints de campanha — não cria rota nova, só estende o contrato:

```
POST   /campanhas                    → aceita type=RECORRENTE com os campos novos
GET    /campanhas                    → totalCycles/lastCycleAt aparecem na listagem
GET    /campanhas/:id                → idem
PATCH  /campanhas/:id                → editar startAt/endAt/repeatIntervalMinutes/produtos
                                        (só se RASCUNHO — remove e recria o job repetível)
POST   /campanhas/:id/disparar       → RECORRENTE: força o registro do job repetível já
                                        (ignora startAt futuro, começa agora)
POST   /campanhas/:id/cancelar       → remove o job repetível do Redis
```

`GET /campanhas/:id/entregas` **não se aplica** a campanhas `RECORRENTE` (não existe log por
lead) — o frontend deve esconder essa aba/seção quando `type === 'RECORRENTE'`.

### `POST /campanhas` — body estendido

```typescript
{
  name: string
  type: 'IMEDIATO' | 'AGENDADO' | 'RECORRENTE'   // 🆕 RECORRENTE

  // campos existentes (obrigatórios só para IMEDIATO/AGENDADO)
  message?: string
  mediaUrl?: string
  mediaType?: 'IMAGEM' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO'

  targetStarRating?: '1' | '2' | '3'   // omitido = todos
  targetStatus?: string

  scheduledFor?: string                 // obrigatório se AGENDADO

  // 🆕 obrigatórios se RECORRENTE
  startAt?: string          // ISO 8601
  endAt?: string             // ISO 8601, deve ser > startAt
  repeatIntervalMinutes?: number   // ex: 1440 = 1x por dia
  productIds?: string[]      // uuids de produtos já cadastrados na tabela de preço
}
```

Para `RECORRENTE`, `message`/`mediaUrl` **não são usados** — o conteúdo do disparo é sempre
gerado automaticamente: fotos dos produtos + 1 texto consolidado com a tabela de preços
(seção 3.3). Não existe campo de mensagem livre nem `stopOnConversion` no payload — a pausa
por resposta é comportamento fixo do job, não uma opção.

---

## 7. Especificação do modal (frontend)

### 7.1 Campos novos, condicionais a `type === 'RECORRENTE'`

```
┌─────────────────────────────────────────────────────────────┐
│  Nova Campanha                                          [X] │
├─────────────────────────────────────────────────────────────┤
│  Nome da campanha *                                          │
│  [_________________________________________________]         │
│                                                               │
│  Tipo de disparo *                                           │
│  ( ) Imediato   ( ) Agendado   (•) Lista de produtos          │
│                                                               │
│  ── campos abaixo só aparecem se "Lista de produtos" ──       │
│                                                               │
│  Lista de produtos *                                         │
│  [Selecionar produtos da tabela de preço ▾]  (multi-select)   │
│  ✓ Cimento CP-II 50kg    ✓ Gelato 110    + adicionar          │
│                                                               │
│  Tipo de lead alvo *                                          │
│  ( ) ⭐1   ( ) ⭐2   ( ) ⭐3   (•) Todos                        │
│                                                               │
│  Data/hora de início *        Data/hora de término *          │
│  [📅 08/07/2026] [🕐 09:00]   [📅 15/07/2026] [🕐 23:59]       │
│                                                               │
│  Reenviar a cada *                                            │
│  [ 24 ] horas   (ou combobox: 1h / 6h / 12h / 24h / 48h)      │
│                                                               │
│  ℹ Leads que responderem ou já tiverem comprado ficam de fora  │
│    dos próximos envios automaticamente — sem configuração.    │
│                                                               │
│              [Salvar como Rascunho]   [Criar Campanha]        │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Validação (Zod, a acrescentar em `campaignSchema`)

```typescript
.refine(
  (data) => data.type !== 'RECORRENTE' || (!!data.startAt && !!data.endAt),
  { message: 'Início e término são obrigatórios', path: ['startAt'] },
).refine(
  (data) => data.type !== 'RECORRENTE' || new Date(data.endAt!) > new Date(data.startAt!),
  { message: 'Término deve ser depois do início', path: ['endAt'] },
).refine(
  (data) => data.type !== 'RECORRENTE' || !!data.repeatIntervalMinutes,
  { message: 'Defina o intervalo de reenvio', path: ['repeatIntervalMinutes'] },
).refine(
  (data) => data.type !== 'RECORRENTE' || (data.productIds?.length ?? 0) > 0,
  { message: 'Selecione ao menos 1 produto', path: ['productIds'] },
)
```

### 7.3 Comportamento

- Aba "Entregas" (`GET /campanhas/:id/entregas`) **não deve aparecer** para campanhas
  `RECORRENTE` — mostrar só os contadores agregados (`totalSent`, `totalErrors`,
  `totalCycles`, `lastCycleAt`) que já vêm no detalhe da campanha.
- Seletor de produtos deve reaproveitar a listagem que já existe na tela de tabela de preços
  (`GET /produtos`), com preview de foto/preço do plano de estrela correspondente.

---

## 8. Máquina de estados

```
RASCUNHO ──[disparar / startAt definido]──→ AGENDADO ──[startAt chega]──→ EM_ANDAMENTO
                                                                              │
                                                          [endAt passa, job   │
                                                           roda e detecta]    │
                                                                              ▼
                                                                         CONCLUIDO

Qualquer estado (exceto CONCLUIDO) ──[cancelar]──→ CANCELADO
  (remove o job repetível do Redis)
```

Diferença chave em relação ao fluxo de `AGENDADO`: aqui `EM_ANDAMENTO` persiste por vários
ciclos (não é um estado transitório de um único disparo) — só sai desse estado quando o job
detecta `now() > endAt` ou o admin cancela manualmente.

---

## 9. Checklist de implementação

**Backend**
- [ ] Migration: `tipo_campanha_enum` + `RECORRENTE`; novas colunas em `campanha_broadcast`
      (`startAt`, `endAt`, `repeatIntervalMinutes`, `totalCycles`, `lastCycleAt`)
- [ ] Migration: tabela `campanha_produto`
- [ ] `CreateCampaignDto`: campos condicionais (`startAt`, `endAt`, `repeatIntervalMinutes`,
      `productIds`) + validação condicional por `type` (seção 6)
- [ ] Registrar fila `campaign-recurring` em `app.module.ts`
- [ ] `RecurringCampaignJob` (processor) — lógica da seção 5.2
- [ ] Função `buildCatalogMessage(products)` — monta o texto consolidado (seção 3.3)
- [ ] Função `mapStarLevelToProductRating` (1↔C, 2↔B, 3↔A — seção 3.1)
- [ ] `CampaignsService.create/update/disparar/cancelar` — registrar/remover job repetível
- [ ] `CampaignsRepository.findCampaignProducts(campaignId, starRating)` — join produto +
      tabela de preço (filtrada por `starRating`) + mídia
- [ ] `CampaignsRepository.findContatosFiltrados` — reaproveitar/estender o que já existe em
      `broadcast.repository.ts`, excluindo sempre `engagementStatus IN ('RESPONDEU','ATIVO','BLOQUEADO')`
      (seção 3.2 — não é opcional, não tem flag no DTO)

**Frontend**
- [ ] Novo tipo `'RECORRENTE'` no seletor "Tipo de disparo" do modal
- [ ] Campos condicionais: seletor de produtos, tipo de lead, início/término, intervalo
- [ ] Esconder aba "Entregas" para campanhas `RECORRENTE`; mostrar `totalCycles`/`lastCycleAt`
      no detalhe
- [ ] Validação Zod da seção 7.2
