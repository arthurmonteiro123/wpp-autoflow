# Slice — Scripts de Automação: tipo "Salve"

> Criado em: 2026-07-15 · Status: ✅ implementado em 2026-07-15 (backend + frontend; ver checklist na seção 6)
> Evolui: `CAMPANHA_RECORRENTE_LISTA_PRODUTOS_SLICE.md` (implementado, ver `CAMPANHA_RECORRENTE_API_PRONTA.md`)
> **Doc canônico para as duas stacks** — o checklist backend está na seção 6 (não duplicar este arquivo em `backend/`).
>
> ⚠️ **Superado em 2026-07-16**: o passo "Fotos dos produtos" do ciclo foi removido — a
> campanha Salve manda só texto (mensagem de salve + catálogo). Mídia agora só sai sob
> pedido explícito do lead, via bot de IA (`ai.service.ts`). A "Lista de produtos"
> (`productIds`/`campanha_produto`) também deixou de existir: cada ciclo puxa automaticamente
> todos os produtos ativos com preço no tier do lead, direto da tela Tabelas de Preços.

---

## 1. Decisão de produto

A aba **Campanhas** passa a abrigar o conceito de **scripts de automação**: automações de
prospecção que o admin/operador monta e o bot executa sozinho. No modal de criação, o
usuário escolhe **o tipo de script** que vai criar.

**No lançamento existe um único tipo: "Salve" 👋** — os demais aparecem como placeholders
desabilitados ("em breve"), deixando claro que a aba vai crescer sem precisar redesenhar nada.
Candidatos futuros (não especificados aqui, só reservam espaço visual): Reativação de
inativos, Aniversário, Palavra-chave.

Os disparos avulsos já existentes (`IMEDIATO`/`AGENDADO`) continuam funcionando como estão —
o seletor de script só reorganiza a apresentação do modal, não muda contrato de API.

### O que é o script "Salve"

Prospecção ativa em ciclo: chama o lead para convertê-lo em venda, repetindo em intervalo
configurável **até o lead responder**. Cada ciclo envia, nesta ordem:

1. **Mensagem de salve** — texto livre escrito pelo admin/operador (🆕 este slice);
2. **Fotos dos produtos** — as mídias já cadastradas em `produto_midia` (já implementado);
3. **Catálogo consolidado** — tabela de preços do nível de estrela **do lead**
   (1→A, 2→B, 3→C, já implementado).

Quando o lead responde qualquer coisa, ele **sai automaticamente dos próximos ciclos**
(pausa por resposta, comportamento fixo já implementado) e a conversa passa a ser conduzida
pela IA/fluxo com contexto armazenado — **fora do escopo do script**: o script só faz o salve
e sai da frente. Se a negociação esfriar, `POST /contatos/:id/reiniciar-bot` devolve o lead
ao ciclo.

### Regra do sistema (registrada para não se perder)

> As respostas ao lead são sempre conduzidas por IA (com armazenamento de contexto). Scripts
> de automação **nunca** respondem lead — eles apenas iniciam/reiniciam a abordagem. Todo tipo
> de script futuro deve respeitar essa divisão: script = abordagem proativa; IA/fluxo = conversa.

---

## 2. O que já existe (não reimplementar)

O script Salve **é** a campanha `type=RECORRENTE` já entregue e testada
(`CAMPANHA_RECORRENTE_API_PRONTA.md`):

| Peça | Status |
|---|---|
| Janela `startAt`/`endAt` + `repeatIntervalMinutes` via BullMQ repetível | ✅ pronto |
| Lista de produtos (`productIds`, tabela `campanha_produto`) | ✅ pronto |
| Fotos dos produtos antes + catálogo consolidado por nível do lead | ✅ pronto |
| Pausa automática por resposta (sempre ativa, sem flag) | ✅ pronto |
| Produto sem preço no nível do lead é omitido do ciclo | ✅ pronto |
| Contadores `totalSent`/`totalErrors`/`totalCycles`/`lastCycleAt` | ✅ pronto |
| Disparar agora / cancelar (remove job do Redis) | ✅ pronto |

**Faltam exatamente duas mudanças de backend e a reorganização do modal** — seções 3–5.

---

## 3. Mudança backend 1 — mensagem de salve no `RECORRENTE`

Hoje o `message` é ignorado para `RECORRENTE` (texto 100% gerado). Passa a valer:

- `POST /campanhas` e `PATCH /campanhas/:id` aceitam `message?: string` também quando
  `type=RECORRENTE` (a coluna já existe em `campanha_broadcast` — sem migration).
- No processor (`recurring-campaign.job`), quando `message` estiver preenchida, ela é enviada
  como **primeira mensagem do ciclo** (texto puro, antes das fotos).
- Quando `message` presente, **omitir o rodapé fixo** do catálogo ("Da um salve se quiser
  fechar…") — a chamada já foi feita pelo salve do usuário; manter os dois soaria robótico.
- `message` ausente/vazia → comportamento atual inalterado (catálogo com rodapé fixo).
- Placeholder de personalização (ex.: `{{nome}}`) fica de fora deste slice — anotar como
  melhoria futura.

## 4. Mudança backend 2 — intervalo mínimo de 10 minutos

- Validação no DTO: `repeatIntervalMinutes >= 10` quando `type=RECORRENTE` (hoje não há
  mínimo formal; 10 min passa a ser o piso oficial do produto).
- Nenhuma mudança no job — BullMQ já aceita qualquer `every`.

⚠️ **Risco assumido e comunicado na UI** (seção 5): reenvio de catálogo com fotos a cada
10–20 min para quem não respondeu é padrão típico de detecção de spam do WhatsApp — risco
real de banimento do número. Intervalos < 60 min devem ser usados com janela curta
(`endAt` no mesmo dia). O produto permite, mas avisa.

---

## 5. Especificação do modal (frontend)

### 5.1 Passo 1 — tipo de criação

```
┌──────────────────────────────────────────────────────────────┐
│  Nova Campanha                                           [X] │
├──────────────────────────────────────────────────────────────┤
│  O que você quer criar?                                       │
│                                                                │
│  ┌──────────────────┐  ┌───────────────────────────────────┐ │
│  │ 📣 Disparo avulso │  │ 🤖 Script de automação             │ │
│  │ Imediato/Agendado │  │ O bot trabalha sozinho em ciclos   │ │
│  └──────────────────┘  └───────────────────────────────────┘ │
│                                                                │
│  ── se "Script de automação": ──                               │
│  Tipo de script *                                              │
│  ┌────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ 👋 Salve    │ │ ♻️ Reativação │ │ 🎂 Aniversário│            │
│  │            │ │   Em breve    │ │   Em breve    │            │
│  └────────────┘ └──────────────┘ └──────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

- "Disparo avulso" abre os campos atuais de `IMEDIATO`/`AGENDADO` (inalterados).
- "Salve" abre os campos da 5.2 e envia `type=RECORRENTE` por baixo — **o seletor de script é
  só apresentação**, o contrato da API não ganha campo novo de tipo.
- Cards "Em breve" ficam desabilitados (opacidade reduzida, sem clique).

### 5.2 Campos do script Salve

Mantém os campos já implementados do RECORRENTE (produtos, alvo por estrela, início/término)
e acrescenta/ajusta:

- **Mensagem de salve** * — textarea. Reutilizar o `WhatsAppPreview` já existente mostrando a
  sequência do ciclo: balão do salve → miniaturas das fotos dos produtos → balão do catálogo.
  É o principal "aha" do modal: o operador vê exatamente o que o lead vai receber.
- **Reenviar a cada** * — novas opções: `10 min · 20 min · 30 min · 1h · 6h · 12h · 24h · 48h`
  (hoje o front começa em 1h). Quando a escolha for **< 60 min**, exibir alerta persistente:

  > ⚠️ Intervalos curtos aumentam o risco de bloqueio do número pelo WhatsApp.
  > Recomendado apenas com término no mesmo dia.

- Info fixa (já prevista no slice anterior, manter): *"Leads que responderem ficam de fora dos
  próximos envios automaticamente."*

### 5.3 Validação (acrescentar ao schema existente)

```typescript
.refine((d) => d.type !== "RECORRENTE" || !!d.message?.trim(),
  { message: "Escreva a mensagem de salve", path: ["message"] })
.refine((d) => d.type !== "RECORRENTE" || (d.repeatIntervalMinutes ?? 0) >= 10,
  { message: "Intervalo mínimo: 10 minutos", path: ["repeatIntervalMinutes"] })
```

(As validações de janela/produtos do slice anterior permanecem.)

### 5.4 Listagem

- Campanhas `RECORRENTE` aparecem na listagem com badge **"Script · Salve"** (em vez do rótulo
  genérico "Lista de produtos"), preparando a UI para os próximos tipos.

---

## 6. Checklist de implementação

**Backend**
- [x] `CreateCampaignDto`: aceitar `message` para `RECORRENTE` (create persiste `dto.message`;
      `updateRecorrente` aceita alterar) — `campaigns.service.ts`
- [x] Validação `repeatIntervalMinutes >= 10` (`@Min(10)` no DTO)
- [x] `recurring-campaign.job`: envia `message` como 1ª mensagem do ciclo quando presente
- [x] `buildCatalogMessage`: parâmetro `omitFooter` — rodapé fixo omitido quando há salve

**Frontend** (`_app.campanhas.tsx`)
- [x] Passo "O que você quer criar?" no modal (avulso × script) + seletor de tipo de script
      com "Salve" ativo e placeholders "Em breve" (Reativação, Aniversário)
- [x] Campo "Mensagem de salve" + `SalveSequencePreview` (salve → fotos → catálogo)
- [x] Opções de intervalo 10/20/30 min + alerta de risco para < 60 min
- [x] Badge "👋 Script · Salve" na listagem, filtro e detalhe para `type=RECORRENTE`;
      detalhe mostra a mensagem de salve em `WhatsAppPreview`
- [x] Validações da seção 5.3 (mensagem obrigatória, intervalo mínimo)
- [x] Duplicar campanha RECORRENTE preserva a mensagem de salve
