# Slice — Campanhas, Templates e Automação de Disparo

> Última atualização: 2026-06-30
> Consome: API REST NestJS em `http://localhost:3000`
> Papéis: ADMIN · OPERADOR
> Status: Backend de Campanhas e Fluxos ✅ implementado. Sistema de Templates 🆕 a implementar.

---

## Sumário

1. [Contexto](#1-contexto)
2. [Dois Sistemas Distintos](#2-dois-sistemas-distintos)
3. [Modelo de Dados — Campanhas](#3-modelo-de-dados--campanhas)
4. [Endpoints REST — Campanhas](#4-endpoints-rest--campanhas)
5. [Máquina de Estados da Campanha](#5-máquina-de-estados-da-campanha)
6. [Como o Agendamento Automático Funciona](#6-como-o-agendamento-automático-funciona)
7. [Especificação do Modal de Campanha](#7-especificação-do-modal-de-campanha)
8. [Sistema de Templates Pré-definidos (a implementar)](#8-sistema-de-templates-pré-definidos-a-implementar)
9. [Papel da IA na Conversa](#9-papel-da-ia-na-conversa)
10. [Matriz de Permissões](#10-matriz-de-permissões)
11. [Wireframes](#11-wireframes)
12. [Checklist de Implementação](#12-checklist-de-implementação)

---

## 1. Contexto

O admin cria campanhas pelo painel para disparar mensagens em massa — imediatas ou agendadas
para um horário/data futuros. Hoje o modal de criação já existe no frontend com os campos:
nome, mensagem, imagem, agendamento (data), tipo de público-alvo, status dos leads.

Este documento define:
- O contrato de API completo que o frontend deve consumir (já implementado no backend).
- Como o agendamento automático dispara sem intervenção manual.
- Uma melhoria proposta: templates pré-definidos, para o operador não precisar redigir a
  mensagem do zero a cada campanha.
- Por que o modal **não precisa** cobrir 100% da conversa — a IA assume a partir da primeira
  resposta do lead.

---

## 2. Dois Sistemas Distintos

O backend tem dois mecanismos de envio de mensagem que não devem ser confundidos no frontend:

| | **Fluxos** (`/fluxos`) | **Campanhas** (`/campanhas`) |
|---|---|---|
| Gatilho | Automático, cíclico (Pulse a cada N min) | Manual: imediato ou agendado para 1 data |
| Alvo | Contatos elegíveis por `starRating` + cooldown | Contatos filtrados por `targetStarRating` + `targetStatus` |
| Conteúdo | Sequência de etapas (texto/mídia/delay/tabela preço) | Mensagem única + mídia opcional |
| Repetição | Sim, todo ciclo do Pulse re-executa para novos elegíveis | Não, dispara uma vez |
| Editado em | `/fluxos/[id]` (editor de etapas) | `/campanhas/nova` (modal) |

Este slice trata exclusivamente de **Campanhas**. Fluxos já estão documentados na seção 10 de
`FRONTEND_SLICE.md`.

---

## 3. Modelo de Dados — Campanhas

Tabela `campanha_broadcast` (schema: `drizzle/schema/campaigns.schema.ts`):

```typescript
interface BroadcastCampaign {
  id: string                          // uuid
  name: string                        // "nome"
  type: 'IMEDIATO' | 'AGENDADO'       // "tipo"
  message: string                     // "mensagem"
  mediaUrl: string | null             // "midia_url"
  mediaType: 'IMAGEM' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO' | null  // "midia_tipo"
  targetStarRating: 'A' | 'B' | 'C' | null   // "tipo_cliente_alvo" — null = todos
  targetStatus: string | null         // "status_alvo" — filtro por engagementStatus
  scheduledFor: string | null         // "agendado_para" — ISO 8601, obrigatório se AGENDADO
  bullJobId: string | null            // "bull_job_id" — id do job BullMQ pendente (uso interno)
  campaignStatus: 'RASCUNHO' | 'AGENDADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO'
  totalContacts: number | null        // preenchido ao concluir o disparo
  totalSent: number                   // default 0
  totalErrors: number                 // default 0
  createdBy: string | null            // uuid do admin/operador
  createdAt: string
  updatedAt: string
}
```

> `bullJobId` é detalhe de implementação — **não exibir no frontend**, apenas usado pelo
> backend para cancelar/reagendar o job na fila.

---

## 4. Endpoints REST — Campanhas

```
GET    /campanhas?pagina=1&limite=20        → lista paginada
POST   /campanhas                           → criar (dispara agendamento automático se AGENDADO)
GET    /campanhas/:id                       → detalhe
PATCH  /campanhas/:id                       → editar (só RASCUNHO ou AGENDADO)
POST   /campanhas/:id/disparar              → forçar disparo imediato (cancela agendamento pendente)
POST   /campanhas/:id/cancelar              → cancela e remove job pendente da fila
GET    /campanhas/:id/entregas?pagina=1     → log de envios por contato
GET    /parametros                          → todos os parâmetros do sistema
PATCH  /parametros/:key                     → atualizar 1 parâmetro
```

### `POST /campanhas` — Request body

```typescript
{
  name: string                  // obrigatório
  type: 'IMEDIATO' | 'AGENDADO' // obrigatório
  message: string                // obrigatório
  mediaUrl?: string
  mediaType?: 'IMAGEM' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO'
  targetStarRating?: 'A' | 'B' | 'C'
  targetStatus?: string
  scheduledFor?: string          // ISO 8601 — obrigatório quando type = AGENDADO
}
```

### Resposta — `BroadcastCampaign` (ver seção 3)

Quando `type = AGENDADO` e `scheduledFor` está no futuro, a resposta já vem com
`campaignStatus: "AGENDADO"` — o disparo já está agendado, nenhuma ação adicional é necessária.

### `GET /campanhas/:id/entregas` — Resposta

```typescript
{
  data: Array<{
    id: string
    campaignId: string
    contactId: string
    status: 'PENDENTE' | 'ENVIADO' | 'ERRO'
    errorDetails: string | null
    sentAt: string | null
    createdAt: string
  }>
  total: number
  pagina: number
  limite: number
}
```

---

## 5. Máquina de Estados da Campanha

```
RASCUNHO ──┬─→ [disparar]  → EM_ANDAMENTO → CONCLUIDO
           └─→ [scheduledFor definido + type=AGENDADO] → AGENDADO

AGENDADO ──┬─→ [horário chega]        → EM_ANDAMENTO → CONCLUIDO
           ├─→ [editar scheduledFor]  → AGENDADO (reagendado)
           ├─→ [disparar manual]      → EM_ANDAMENTO (pula a espera)
           └─→ [cancelar]             → CANCELADO

EM_ANDAMENTO → [erro interno] → CANCELADO
```

Regras de edição (`PATCH`): só permitido em `RASCUNHO` ou `AGENDADO`. Tentar editar uma
campanha `EM_ANDAMENTO`, `CONCLUIDO` ou `CANCELADO` retorna `400 Bad Request`.

---

## 6. Como o Agendamento Automático Funciona

Não há polling nem cron — o disparo agendado usa um **job BullMQ com delay calculado**:

1. Ao criar com `type=AGENDADO`, o backend calcula `delay = scheduledFor - agora` e enfileira
   o job `broadcast-dispatch` com esse delay. O Redis segura o job até o horário exato.
2. Se o admin editar `scheduledFor` de uma campanha já agendada, o backend remove o job antigo
   da fila e cria um novo com o delay recalculado.
3. Se o admin cancelar, o job pendente é removido da fila — garante que nada dispara depois do
   cancelamento.
4. Se o admin clicar "Disparar Agora" numa campanha agendada, o job pendente é removido e um
   disparo imediato é enfileirado no lugar.

**Implicação para o frontend:** o campo `scheduledFor` no modal de edição deve sempre acionar
um novo `PATCH` (não basta atualizar localmente) — é o que recalcula o agendamento no backend.

---

## 7. Especificação do Modal de Campanha

### 7.1 Campos e validação (Zod)

```typescript
const campaignSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(255),
  type: z.enum(['IMEDIATO', 'AGENDADO']),
  templateId: z.string().uuid().optional(),   // ver seção 8 — preenche `message` automaticamente
  message: z.string().min(1, 'Mensagem obrigatória'),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['IMAGEM', 'VIDEO', 'AUDIO', 'DOCUMENTO']).optional(),
  targetStarRating: z.enum(['A', 'B', 'C']).optional(),  // omitido = todos os tipos
  targetStatus: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
}).refine(
  (data) => data.type !== 'AGENDADO' || !!data.scheduledFor,
  { message: 'Data obrigatória para campanhas agendadas', path: ['scheduledFor'] },
).refine(
  (data) => !data.mediaType || !!data.mediaUrl,
  { message: 'Selecione uma mídia', path: ['mediaUrl'] },
)
```

### 7.2 Layout do modal

```
┌─────────────────────────────────────────────────────────────┐
│  Nova Campanha                                          [X] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Nome da campanha *                                          │
│  [_________________________________________________]         │
│                                                               │
│  Tipo de disparo *                                           │
│  ( ) Imediato        (•) Agendado                            │
│                                                               │
│  Data e hora do disparo *           ← só se Agendado          │
│  [📅 30/06/2026]  [🕐 14:30]                                  │
│                                                               │
│  ───────────────────────────────────────────────────────    │
│                                                               │
│  Template (opcional)                ← ver seção 8            │
│  [Selecionar um pré-set ▾]                                    │
│                                                               │
│  Mensagem *                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Olá {{nome}}! Temos uma oferta especial...             │  │
│  │                                                         │  │
│  └───────────────────────────────────────────────────────┘  │
│  Variáveis disponíveis: {{nome}} {{starRating}} {{today}}    │
│                                                               │
│  Mídia (opcional)                                            │
│  [📎 Anexar imagem/vídeo/documento]                           │
│                                                               │
│  ───────────────────────────────────────────────────────    │
│                                                               │
│  Segmentação                                                 │
│  Tipo de cliente: [Todos ▾]  (A | B | C | Todos)              │
│  Status do lead:  [Todos ▾]  (NOVO|RESPONDEU|ATIVO|INATIVO)   │
│                                                               │
│  Estimativa: ~142 contatos receberão esta mensagem            │
│                                                               │
│  ───────────────────────────────────────────────────────    │
│                                                               │
│  Preview (bolha estilo WhatsApp)                              │
│  ┌─────────────────────────────────┐                         │
│  │ Olá João! Temos uma oferta...    │                         │
│  └─────────────────────────────────┘                         │
│                                                               │
│              [Salvar como Rascunho]   [Criar Campanha]        │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Comportamento

- **Estimativa de contatos**: ao alterar `targetStarRating`/`targetStatus`, debounce de 500ms
  e chamar um endpoint de contagem (ver nota abaixo) para atualizar "~142 contatos".
  > Não existe endpoint dedicado ainda. Reaproveitar `GET /contatos?tipoCliente=A&status=ATIVO`
  > e usar o campo `total` da resposta paginada.
- **Template selecionado**: preenche `message` (editável depois — não é travado).
- **Botão "Criar Campanha"**: se `type=IMEDIATO`, cria e já chama `POST /:id/disparar` em
  seguida. Se `type=AGENDADO`, só cria — o backend já agenda automaticamente (seção 6).
- **Botão "Salvar como Rascunho"**: sempre cria com status implícito `RASCUNHO` (não dispara
  nem agenda), independente do `type` selecionado.
- **Edição de campanha `AGENDADO`**: reabrir o mesmo modal pré-preenchido. Ao salvar, sempre
  `PATCH` completo (nunca editar só localmente) — necessário para o backend recalcular o job.

---

## 8. Sistema de Templates Pré-definidos (a implementar)

### 8.1 Motivação

O operador não deve precisar redigir a mensagem do zero toda vez. Os templates funcionam como
ponto de partida — o texto final continua editável no modal antes de salvar.

### 8.2 Schema novo — `mensagem_template`

```typescript
// drizzle/schema/campaigns.schema.ts — adicionar

export const messageTemplates = pgTable('mensagem_template', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('nome', { length: 255 }).notNull(),
  message: text('mensagem').notNull(),
  mediaUrl: text('midia_url'),
  mediaType: campaignMediaTypeEnum('midia_tipo'),
  category: varchar('categoria', { length: 100 }),   // "Promoção", "Reativação", "Cobrança"...
  active: boolean('ativo').notNull().default(true),
  createdBy: uuid('criado_por').references(() => adminUsers.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### 8.3 Endpoints propostos

```
GET    /templates              → lista (filtro opcional ?categoria=Promoção)
POST   /templates               → criar (ADMIN only)
PATCH  /templates/:id           → editar (ADMIN only)
DELETE /templates/:id           → desativar — soft delete via campo `ativo` (ADMIN only)
```

### 8.4 Uso no modal

```typescript
// hooks/queries/use-templates.ts
export function useTemplates(categoria?: string) {
  return useQuery({
    queryKey: ['templates', categoria],
    queryFn: () => templatesApi.list({ categoria }),
    staleTime: 60_000,
  })
}

// Ao selecionar um template no <Select>:
function onTemplateSelect(templateId: string) {
  const tpl = templates.find(t => t.id === templateId)
  if (!tpl) return
  form.setValue('message', tpl.message)
  if (tpl.mediaUrl) {
    form.setValue('mediaUrl', tpl.mediaUrl)
    form.setValue('mediaType', tpl.mediaType)
  }
}
```

### 8.5 Tela de gestão de templates (ADMIN only)

**Rota:** `/configuracoes/templates`

```
Header: "Templates de Mensagem"     [+ Novo Template]

┌────────────────────────────────────────────────────────────┐
│ Nome              │ Categoria   │ Status  │ Ações           │
│──────────────────────────────────────────────────────────── │
│ Promoção relâmpago│ Promoção    │ ● Ativo │ [✏️][🗑️]        │
│ Retomada contato  │ Reativação  │ ● Ativo │ [✏️][🗑️]        │
└────────────────────────────────────────────────────────────┘
```

Formulário (Sheet lateral): nome, categoria (combobox livre), mensagem (textarea com
chips de variável `{{nome}}` `{{starRating}}` `{{today}}`), mídia opcional, preview WhatsApp.

> Operador só visualiza/usa templates ao criar campanha — não pode criar/editar/excluir.

---

## 9. Papel da IA na Conversa

O modal de campanha **não precisa cobrir toda a conversa de venda** — apenas a mensagem de
abertura/gancho. Quando `AI_ENABLED = true` (parâmetro do sistema), o lead que responder à
campanha é atendido automaticamente pela IA (`AiService`, modelo configurável via
`AI_MODEL`), que conduz a negociação até o fechamento do pedido.

**Implicação de design:** o template/mensagem da campanha deve ser pensado como **gancho**
(call-to-action curto), não como roteiro de vendas completo. Por isso a categoria sugerida
nos templates ("Promoção", "Reativação") reflete intenções de abertura, não scripts longos.

Parâmetros relevantes (editáveis em `/configuracoes`, seção IA):

| Chave | Descrição |
|---|---|
| `AI_ENABLED` | Liga/desliga resposta automática da IA |
| `AI_MODEL` | Modelo OpenRouter usado (ex: `openai/gpt-4o-mini`) |
| `AI_SYSTEM_PROMPT` | Prompt-base que define tom e comportamento de venda |
| `AI_CONTEXT_MESSAGES` | Quantas mensagens anteriores entram de contexto |
| `AI_MAX_TOKENS` | Limite de tokens por resposta |

---

## 10. Matriz de Permissões

| Ação | ADMIN | OPERADOR |
|---|---|---|
| Ver campanhas | ✅ | ✅ |
| Criar/editar campanha | ✅ | ✅ |
| Disparar/cancelar campanha | ✅ | ✅ |
| Ver log de entregas | ✅ | ✅ |
| Usar templates ao criar campanha | ✅ | ✅ |
| Criar/editar/excluir templates | ✅ | ❌ |
| Editar fluxos de conversa | ✅ | ❌ |
| Editar parâmetros do sistema (incl. IA) | ✅ | ❌ |
| Ver parâmetros do sistema | ✅ | ✅ (somente leitura) |

---

## 11. Wireframes

### 11.1 Lista de campanhas com badge de agendamento

```
Header: "Campanhas"                                    [+ Nova Campanha]

Filtros: [Status ▾]   [Tipo ▾]

┌──────────────────────────────────────────────────────────────────┐
│ Nome          │ Tipo      │ Alvo │ Status        │ Disparo       │ Ações │
│────────────────────────────────────────────────────────────────── │
│ Promoção Seg  │ AGENDADO  │  A   │ ⏰ AGENDADO   │ 30/06 14:30  │  [⋯]  │
│ Salve Família │ IMEDIATO  │ ALL  │ ✅ CONCLUIDO  │ —             │  [⋯]  │
│ Rascunho Ver  │ IMEDIATO  │  B   │ 📝 RASCUNHO   │ —             │  [⋯]  │
└──────────────────────────────────────────────────────────────────┘
```

Menu `[⋯]` por linha: Editar · Disparar Agora · Cancelar · Ver Entregas · Duplicar.
"Disparar Agora" e "Cancelar" só aparecem habilitados conforme a máquina de estados (seção 5).

### 11.2 Drawer de detalhe (após clicar na linha)

```
┌──────────────────────────────────────────────────────┐
│  Promoção Seg                          ⏰ AGENDADO    │
│  ────────────────────────────────────────────────────│
│  Disparo previsto: 30/06/2026 às 14:30                │
│  Alvo: Tipo A · Status: Todos                          │
│  Mensagem: "Olá {{nome}}! Temos uma oferta..."         │
│                                                        │
│  [Editar]  [Disparar Agora]  [Cancelar Agendamento]    │
│  ────────────────────────────────────────────────────│
│  Entregas (vazio até disparar)                         │
└──────────────────────────────────────────────────────┘
```

Após `EM_ANDAMENTO`/`CONCLUIDO`, a seção de entregas mostra progress bar
(`totalSent`/`totalContacts`) e tabela paginada de `GET /campanhas/:id/entregas`.

---

## 12. Checklist de Implementação

### Backend (pendente)

- [ ] Criar schema `mensagem_template` + migration
- [ ] `TemplatesModule`: controller + service + repository (CRUD, soft delete via `ativo`)
- [ ] Restringir criação/edição/exclusão de templates a `ADMIN` (`@Roles('ADMIN')`)
- [ ] Adicionar `templateId` opcional no `CreateCampaignDto` (uso só de auditoria — frontend
      resolve o texto antes de enviar; backend não precisa persistir o vínculo)

### Frontend

- [ ] `lib/api/endpoints/campaigns.ts` com os 8 endpoints da seção 4
- [ ] `lib/api/endpoints/templates.ts` com os 4 endpoints da seção 8.3
- [ ] Modal de campanha conforme seção 7 (schema Zod + layout)
- [ ] Tela `/configuracoes/templates` conforme seção 8.5 (ADMIN only)
- [ ] `<StatusBadge>` cobrindo os 5 estados da seção 5
- [ ] Lista de campanhas com menu de ações condicionado ao estado (seção 11.1)
- [ ] Drawer de detalhe com progress bar de entregas (seção 11.2)
- [ ] Garantir que edição de `scheduledFor` sempre dispara `PATCH` ao backend (seção 6)

---

*Slice gerado em 2026-06-30 — complementa a seção 11 (Campanhas) de `FRONTEND_SLICE.md` e
referencia o backend descrito em `TECHNICAL_DOCS.md`.*
