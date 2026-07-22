# Frontend Spec — Star Level System & Gestão de Tabela de Preços

> Documento gerado em 2026-07-01.  
> Destinatário: Agente / Dev Frontend.  
> Contexto: refatoração do sistema de segmentação de leads (A/B/C → ⭐ 1/2/3) e novo slice de gestão de tabela de preços por produto.

---

## Parte 1 — Breaking Changes no Backend

### 1.1 Contatos (`/contatos`)

| Campo anterior | Campo atual | Observação |
|---|---|---|
| `starRating: 'A' \| 'B' \| 'C'` | `starLevel: 1 \| 2 \| 3` | Tipo mudou de string para integer |
| — | `totalSpent: string` (decimal) | Campo novo — total acumulado em pedidos fechados |
| `starRating` obrigatório no `POST` | **Não enviar** | Calculado automaticamente |
| `starRating` no `PATCH` body | **Removido** | Não faz parte do update geral |
| `PATCH /contatos/:id/tipo` com `{ starRating }` | `PATCH /contatos/:id/nivel-estrela` com `{ starLevel }` | Endpoint renomeado — apenas ADMIN |
| Query param `?starRating=A` | Query param `?starLevel=1` | Filtro da listagem |

**Regra de negócio — cálculo automático ao fechar pedido:**

| Total gasto acumulado | `starLevel` | Exibição |
|---|---|---|
| R$ 0 – R$ 999,99 | `1` | ⭐ |
| R$ 1.000 – R$ 4.999,99 | `2` | ⭐⭐ |
| R$ 5.000 ou mais | `3` | ⭐⭐⭐ |

**Exemplo de objeto contato (resposta atual):**

```json
{
  "id": "uuid",
  "name": "João Silva",
  "phoneNumber": "5511999999999",
  "starLevel": 2,
  "totalSpent": "2340.00",
  "engagementStatus": "ATIVO",
  "cooldownUntil": null,
  "notes": null
}
```

---

### 1.2 Fluxos (`/fluxos`)

| Campo | Antes | Depois |
|---|---|---|
| `starRating` (valores aceitos) | `'A' \| 'B' \| 'C' \| 'INATIVO' \| 'BROADCAST'` | `'1' \| '2' \| '3' \| 'INATIVO' \| 'BROADCAST'` |

> O nome do campo (`starRating`) permanece o mesmo. Apenas os valores mudaram.

---

### 1.3 Pedidos (`/pedidos`)

| Campo | Antes | Depois |
|---|---|---|
| `starRating` no body do `POST` | Obrigatório (`'A' \| 'B' \| 'C'`) | **Removido** — não enviar |

---

### 1.4 Campanhas (`/campanhas`)

| Campo | Antes | Depois |
|---|---|---|
| `targetStarRating` | `'A' \| 'B' \| 'C'` | `'1' \| '2' \| '3'` |

---

### 1.5 Produtos — sem breaking change

As tabelas de preços de produtos **mantêm A/B/C** — representam tiers do catálogo, não segmentação do lead.

**Mapeamento lead → tier de produto** (para saber qual preço exibir):

| Lead | `starLevel` | Tier de produto | Campo `starRating` na tabela |
|---|---|---|---|
| ⭐ | 1 | Padrão | `C` |
| ⭐⭐ | 2 | Intermediário | `B` |
| ⭐⭐⭐ | 3 | Premium | `A` |

---

## Parte 2 — Novo Slice: Gestão de Tabela de Preços por Produto

### 2.1 Contexto funcional

A tabela de preços é definida **dentro do produto** (não é uma entidade global). Cada produto pode ter até 3 conjuntos de faixas de preço — um por tier (A, B, C) — com intervalos de quantidade e preço unitário. A IA usa essa tabela para enviar ao lead o preço correspondente ao seu nível de estrela automaticamente.

---

### 2.2 Endpoints disponíveis (já existem no backend)

```
GET    /produtos                                   Lista produtos com categorias
GET    /produtos/:id                               Produto com tabela de preços e mídias
POST   /produtos/:id/tabela-preco                  Adiciona uma faixa de preço
GET    /produtos/:id/tabela-preco                  Lista todas as faixas do produto
PATCH  /produtos/:id/tabela-preco/:entryId         Edita uma faixa
DELETE /produtos/:id/tabela-preco/:entryId         Remove uma faixa
```

---

### 2.3 Body de criação de faixa

`POST /produtos/:id/tabela-preco`

```json
{
  "starRating": "B",
  "minQuantity": 1,
  "maxQuantity": 100,
  "unitPrice": 49.90,
  "maxDiscountPct": 10
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `starRating` | `"A" \| "B" \| "C"` | Sim | Tier do catálogo (A = premium, C = padrão) |
| `minQuantity` | number ≥ 0 | Sim | Quantidade mínima desta faixa |
| `maxQuantity` | number \| null | Não | Sem preenchimento = sem limite superior |
| `unitPrice` | number ≥ 0 | Sim | Preço unitário nesta faixa |
| `maxDiscountPct` | number 0–100 | Sim (default 0) | Desconto máximo que o vendedor pode conceder |

---

### 2.4 Estrutura da UI

**Localização:** Página de detalhes de um Produto → aba **"Tabela de Preços"**

---

#### A. Lista de faixas — Cards verticais por tier

Cada tier (A, B, C) é representado como um card retangular vertical. Dentro de cada card ficam as faixas de quantidade cadastradas para aquele tier.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Tabela de Preços — Cimento CP-II 50kg                [+ Adicionar]  │
└──────────────────────────────────────────────────────────────────────┘

┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│   Tier C  ⭐       │  │  Tier B  ⭐⭐      │  │  Tier A  ⭐⭐⭐    │
│  Lead 1 estrela   │  │  Lead 2 estrelas  │  │  Lead 3 estrelas  │
│───────────────────│  │───────────────────│  │───────────────────│
│  1 – 50 un        │  │  1 – 50 un        │  │  1 – 50 un        │
│  R$ 54,90 / un    │  │  R$ 49,90 / un    │  │  R$ 44,90 / un    │
│  desc. máx. 0%    │  │  desc. máx. 5%    │  │  desc. máx. 10%   │
│  [···]  [✏]  [🗑] │  │  [···]  [✏]  [🗑] │  │  [···]  [✏]  [🗑] │
│───────────────────│  │───────────────────│  │───────────────────│
│  51 – 200 un      │  │  51 – 200 un      │  │  51 – 200 un      │
│  R$ 52,00 / un    │  │  R$ 46,00 / un    │  │  R$ 41,00 / un    │
│  desc. máx. 0%    │  │  desc. máx. 8%    │  │  desc. máx. 15%   │
│  [···]  [✏]  [🗑] │  │  [···]  [✏]  [🗑] │  │  [···]  [✏]  [🗑] │
│───────────────────│  │───────────────────│  │───────────────────│
│  201+ un          │  │  201+ un          │  │  201+ un          │
│  R$ 48,00 / un    │  │  R$ 42,00 / un    │  │  R$ 37,00 / un    │
│  desc. máx. 0%    │  │  desc. máx. 10%   │  │  desc. máx. 20%   │
│  [···]  [✏]  [🗑] │  │  [···]  [✏]  [🗑] │  │  [···]  [✏]  [🗑] │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

**Ação `[···]`:** abre o painel de detalhes com preview WhatsApp (seção C abaixo).  
**Ação `[✏]`:** abre o modal de edição da faixa.  
**Ação `[🗑]`:** confirmação de exclusão inline.

---

#### B. Modal de criação / edição de faixa

**Trigger:** botão `[+ Adicionar]` ou ação `[✏]` em uma faixa existente.

```
┌─────────────────────────────────────────────┐
│  Nova faixa de preço                  [✕]   │
│─────────────────────────────────────────────│
│  Tier do cliente *                           │
│  ┌──────────────────────────────────────┐   │
│  │  ⭐ Tier C — Leads com 1 estrela  ▾  │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Quantidade mínima *     Quantidade máxima  │
│  ┌────────────────┐      ┌────────────────┐ │
│  │  1             │      │  100           │ │
│  └────────────────┘      └────────────────┘ │
│                          (vazio = sem limite)│
│                                             │
│  Preço unitário (R$) *   Desc. máx. (%)    │
│  ┌────────────────┐      ┌────────────────┐ │
│  │  49,90         │      │  10            │ │
│  └────────────────┘      └────────────────┘ │
│                                             │
│  ⚠ Validações inline:                       │
│  • Qtd. mínima não pode ser maior que máxima│
│  • Faixas do mesmo tier não podem se        │
│    sobrepor (validação visual no card)      │
│                                             │
│  [Cancelar]                  [Salvar faixa] │
└─────────────────────────────────────────────┘
```

**Select de tier — opções:**

| Valor enviado | Label exibido |
|---|---|
| `C` | ⭐ Tier C — Leads com 1 estrela |
| `B` | ⭐⭐ Tier B — Leads com 2 estrelas |
| `A` | ⭐⭐⭐ Tier A — Leads com 3 estrelas |

---

#### C. Painel de detalhes + Preview WhatsApp

**Trigger:** ação `[···]` em qualquer faixa, ou clique no header do card de tier.

Abre um **drawer lateral** (ou modal largo) com duas colunas:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Detalhes — Tier B  ⭐⭐  (Leads com 2 estrelas)          [Fechar ✕] │
├──────────────────────────────┬───────────────────────────────────────┤
│  DADOS DA TABELA             │  PREVIEW — Como o lead recebe         │
│                              │                                       │
│  Produto: Cimento CP-II 50kg │    ┌──────────────────────────────┐   │
│  Tier: B  (Lead 2 estrelas)  │    │                              │   │
│                              │    │  *Tabela de Preços*          │   │
│  ── Faixa 1 ──               │    │  Cimento CP-II 50kg          │   │
│  1 a 50 unidades             │    │                              │   │
│  R$ 49,90 / unidade          │    │  1 a 50 unidades:            │   │
│  Desconto máx.: 5%           │    │  R$ 49,90/un                 │   │
│                              │    │                              │   │
│  ── Faixa 2 ──               │    │  51 a 200 unidades:          │   │
│  51 a 200 unidades           │    │  R$ 46,00/un                 │   │
│  R$ 46,00 / unidade          │    │                              │   │
│  Desconto máx.: 8%           │    │  201 ou mais unidades:       │   │
│                              │    │  R$ 42,00/un                 │   │
│  ── Faixa 3 ──               │    │                              │   │
│  201 ou mais unidades        │    │  _Condições válidas hoje_    │   │
│  R$ 42,00 / unidade          │    │              11:32 ✓✓        │   │
│  Desconto máx.: 10%          │    └──────────────────────────────┘   │
│                              │    Bolha cinza = mensagem do bot       │
│  [✏️ Editar tier]            │                                       │
└──────────────────────────────┴───────────────────────────────────────┘
```

**Regras do preview:**
- Usar o **mesmo componente de preview** já existente na seção de Campanhas.
- Renderizar `*texto*` como negrito (WhatsApp markdown).
- Renderizar `_texto_` como itálico.
- Exibir timestamp fictício + ícone de lido (✓✓).
- Bolha cinza (mensagem recebida = bot) pois é o bot enviando para o lead.

---

#### D. Estados dos cards de tier

| Estado | Visual |
|---|---|
| Tier sem faixas cadastradas | Card com contorno tracejado e botão central `[+ Definir preços para este tier]` |
| Tier com pelo menos uma faixa | Card sólido com a lista de faixas |
| Faixas com sobreposição de quantidade | Badge vermelho de erro no header do card + tooltip explicativo |

---

#### E. Comportamento da IA com esta tabela (contexto)

Quando um lead demonstra interesse em preços no WhatsApp:

1. A IA detecta a intenção (via OpenRouter).
2. Busca os produtos ativos e suas tabelas para o **tier correspondente ao `starLevel` do lead**:
   - `starLevel 1` → tier `C`
   - `starLevel 2` → tier `B`
   - `starLevel 3` → tier `A`
3. Formata e envia a mensagem com a tabela de preços + mídias do tier.
4. O frontend deve exibir em cada card de tier o badge informativo:
   - Tier C → `"Enviado para leads ⭐"`
   - Tier B → `"Enviado para leads ⭐⭐"`
   - Tier A → `"Enviado para leads ⭐⭐⭐"`

---

### 2.5 Permissões por perfil

| Ação | ADMIN | OPERADOR | VENDEDOR |
|---|---|---|---|
| Visualizar tabela de preços | ✅ | ✅ | ✅ |
| Criar faixa de preço | ✅ | ✅ | ❌ |
| Editar faixa de preço | ✅ | ✅ | ❌ |
| Excluir faixa de preço | ✅ | ✅ | ❌ |
| Ajustar `starLevel` de lead manualmente | ✅ | ❌ | ❌ |

---

### 2.6 Resumo de componentes necessários

| Componente | Descrição |
|---|---|
| `PriceTableTab` | Container da aba com os 3 cards de tier |
| `PriceTierCard` | Card vertical de um tier (A, B ou C) com suas faixas |
| `PriceEntryRow` | Linha de faixa dentro do card com ações de editar/excluir/detalhar |
| `PriceEntryModal` | Modal de criação e edição de faixa |
| `PriceTierDrawer` | Drawer de detalhes com preview WhatsApp |
| `WhatsAppPreview` | Componente existente (reusar de Campanhas) |

---

> **Backend:** todos os endpoints estão prontos — nenhuma alteração necessária no servidor para este slice.
