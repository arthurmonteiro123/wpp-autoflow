# Mudanças de contrato da API — Refatoração Clean Code (PT → EN)

**Contexto:** após a integração inicial com o frontend, o backend passou por uma refatoração para melhorar a legibilidade do código, renomeando identificadores de português para inglês (`nome` → `name`, `descricao` → `description`, etc.). Essa refatoração alterou os **nomes dos campos em vários DTOs** (body de requisições e respostas), mas **não alterou as rotas/URLs**.

Este documento lista, módulo a módulo, tudo que mudou em relação à integração original, para o time de frontend atualizar os payloads.

> ⚠️ Regra geral: **as rotas continuam em português** (`/produtos`, `/contatos`, `/campanhas`, etc.). O que mudou foram os **nomes dos campos dentro do JSON** de body, query string e resposta.

---

## Índice

1. [Categorias e Produtos](#1-categorias-e-produtos) ⚠️ afetado
2. [Contatos](#2-contatos) ⚠️ afetado + mudança de valor (não só nome)
3. [Fluxos](#3-fluxos)
4. [Campanhas e Parâmetros](#4-campanhas-e-parâmetros)
5. [Pedidos](#5-pedidos)
6. [Mídia](#6-mídia)
7. [Auth / Usuários](#7-auth--usuários) — não afetado
8. [⚠️ Atenção especial: `starRating` tem 3 formatos diferentes na API](#8-atenção-especial-starrating-tem-3-formatos-diferentes-na-api)

---

## 1. Categorias e Produtos

Rotas: `/categorias-produto`, `/produtos`, `/produtos/:id/tabela-preco` — **inalteradas**.

### `POST /categorias-produto` — `CreateCategoryDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `nome` | `name` |

### `POST /produtos` e `PATCH /produtos/:id` — `CreateProductDto`

| Campo antigo (PT) | Campo novo (EN) | Obs. |
|---|---|---|
| `nome` | `name` | obrigatório |
| `categoriaId` | `categoryId` | opcional, UUID |
| `descricao` | `description` | opcional |
| `unidade` | `unit` | obrigatório |

**Atenção:** a resposta do `POST /produtos` (criação) retorna só o `categoryId` bruto, **sem** o nome da categoria. O nome da categoria (`categoryName`) só vem em `GET /produtos` e `GET /produtos/:id`, que fazem join com a tabela de categorias. Se o front espera `categoryName` já na resposta do POST, precisa buscar via `GET /produtos/:id` depois de criar.

### `POST /produtos/:id/tabela-preco` — `CreatePriceTableDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `tipoCliente` | `starRating` (⚠️ ainda usa valores `'A'\|'B'\|'C'`, ver seção 8) |
| `quantidadeMin` | `minQuantity` |
| `quantidadeMax` | `maxQuantity` |
| `precoUnitario` | `unitPrice` |
| `descontoMaximoPct` | `maxDiscountPct` |

### `POST /produtos/:id/midias` — `AttachProductMediaDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| — (novo campo) | `mediaId` (UUID da mídia da biblioteca) |
| `tipoCliente` | `starRating` (valores `'A'\|'B'\|'C'\|'TODOS'`, ver seção 8) |
| — | `caption`, `order` (mesmos nomes) |

### Resposta de listagem/detalhe (`GET /produtos`, `GET /produtos/:id`)

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `categoriaNome` | `categoryName` |

---

## 2. Contatos

Rota: `/contatos` — **inalterada**.

### `POST /contatos` — `CreateContactDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `nome` | `name` |
| `numeroWhatsapp` | `phoneNumber` |
| `observacoes` | `notes` |
| `tipoCliente` (obrigatório) | ❌ **removido do create** — todo contato novo nasce com `starLevel = 1` automaticamente |

### `PATCH /contatos/:id` — `UpdateContactDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `nome` | `name` |
| `numeroWhatsapp` | `phoneNumber` |
| `observacoes` | `notes` |
| `statusEngajamento` | `engagementStatus` (valores continuam iguais: `NOVO`, `RESPONDEU`, `INATIVO`, `ATIVO`, `BLOQUEADO`) |
| `cooldownAte` | `cooldownUntil` |
| `tipoCliente` | ❌ removido daqui — ver endpoint dedicado abaixo |

### ⚠️ Mudança de conceito, não só de nome: `tipoCliente` → `starLevel`

O campo `tipoCliente: 'A'|'B'|'C'` **não existe mais em lugar nenhum do módulo de contatos**. Foi substituído por `starLevel: number` (1, 2 ou 3), com semântica de faixa de valor gasto pelo cliente (1 = até R$1.000, 2 = R$1.000–5.000, 3 = R$5.000+).

- Não é só tradução de nome — **o tipo do valor mudou de string enum (`'A'|'B'|'C'`) para número (`1|2|3`)**.
- Endpoint dedicado para ajuste manual (só ADMIN): `PATCH /contatos/:id/nivel-estrela` com body `{ "starLevel": 2 }`.
- Filtro de listagem: `GET /contatos?starLevel=2` (antes era `?tipoCliente=A`).

### `GET /contatos` — `QueryContactsDto` (query string)

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `pagina`, `limite` | inalterados |
| `tipoCliente` | `starLevel` (agora número `1\|2\|3`) |
| `statusEngajamento` | `engagementStatus` |
| `somenteSemCooldown` | inalterado |

---

## 3. Fluxos

Rota: `/fluxos` — **inalterada**.

### `POST /fluxos` — `CreateFlowDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `nome` | `name` |
| `tipoCliente` | `starRating` (valores agora `'1'\|'2'\|'3'\|'INATIVO'\|'BROADCAST'`, ver seção 8) |

### `POST /fluxos/:id/etapas` — `CreateStepDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `ordem` | `order` |
| `tipo` | `type` (valores continuam iguais: `TEXTO`, `MIDIA`, `TABELA_PRECO`, `DELAY`) |
| `conteudoTexto` | `textContent` |
| `midiaUrl` | `mediaUrl` (já era igual) |
| `midiaTipo` | `mediaType` (valores continuam iguais: `IMAGEM`, `VIDEO`, `AUDIO`) |
| `produtoId` | `productId` |
| `delaySegundos` | `delaySeconds` |

**Não mudou:** as variáveis de template continuam em português: `{{nome}}`, `{{dataHoje}}`, `{{vendedor}}`, e foi adicionada `{{nivelEstrela}}` (para o novo `starLevel`). O front não precisa alterar os templates de mensagem já cadastrados.

---

## 4. Campanhas e Parâmetros

Rota: `/campanhas`, `/parametros` — **inalteradas**.

### `POST /campanhas` — `CreateCampaignDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `nome` | `name` |
| `tipo` | `type` (valores iguais: `IMEDIATO`, `AGENDADO`) |
| `mensagem` | `message` |
| `midiaUrl` | `mediaUrl` (já era igual) |
| `midiaTipo` | `mediaType` (valores iguais: `IMAGEM`, `VIDEO`, `AUDIO`, `DOCUMENTO`) |
| `tipoClienteAlvo` | `targetStarRating` (valores agora `'1'\|'2'\|'3'`, string — ver seção 8) |
| `statusAlvo` | `targetStatus` |
| `agendadoPara` | `scheduledFor` |

### `PATCH /parametros/:chave` — `UpdateParamDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `valor` | `value` |

O nome do parâmetro no path continua o mesmo (`PULSE_INTERVALO_MINUTOS`, `PULSE_ATIVO`, `VENDEDOR_1_NOME`, etc.) — só o nome do parâmetro de rota mudou de `:chave` para `:key`, mas isso é transparente pro front (é só a URL com o valor da chave).

---

## 5. Pedidos

Rota: `/pedidos` — **inalterada**.

### `POST /pedidos` — `CreateOrderDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `contatoId` | `contactId` |
| `itens` | `items` |
| `observacoes` | `notes` |

### Item do pedido (`ItemPedidoDto` → `OrderItemDto`)

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `produtoId` | `productId` |
| `nome` | `name` |
| `quantidade` | `quantity` |
| `precoUnitario` | `unitPrice` |
| `descontoPct` | `discountPct` |

---

## 6. Mídia

Rotas: `/midias`, `/entregas-midia` — **inalteradas**.

### `POST /midias/upload` — `UploadMediaDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `nome` | ⚠️ **continua `nome`** — este DTO não foi renomeado |

### `POST /entregas-midia` — `ScheduleDeliveryDto`

| Campo antigo (PT) | Campo novo (EN) |
|---|---|
| `contatoId` | `contactId` |
| `midiaId` | `mediaId` |
| `agendadoPara` | `scheduledFor` |
| `caption` | inalterado |

---

## 7. Auth / Usuários

Rotas: `/auth/login`, `/auth/refresh`, `/auth/me`, `/admin/users` — **não foram tocadas pela refatoração**.

`LoginDto`, `CreateUserDto` e `UpdateUserDto` continuam com `email`, `senha`, `nome`, `role`, `status` exatamente como antes. Nenhuma ação necessária aqui.

---

## 8. ⚠️ Atenção especial: `starRating` tem 3 formatos diferentes na API

A refatoração não deixou o conceito de "segmentação de cliente" consistente. Hoje existem **três representações diferentes** para o mesmo conceito, dependendo do módulo — isso é a causa mais provável de bugs sutis no front, então vale mapear com cuidado:

| Módulo | Campo | Tipo/valores aceitos |
|---|---|---|
| Contatos (`/contatos`) | `starLevel` | **número**: `1`, `2` ou `3` |
| Fluxos (`/fluxos`) | `starRating` | **string**: `'1'`, `'2'`, `'3'`, `'INATIVO'`, `'BROADCAST'` |
| Campanhas (`/campanhas`) | `targetStarRating` | **string**: `'1'`, `'2'`, `'3'` |
| Produtos — tabela de preço (`/produtos/:id/tabela-preco`) | `starRating` | **string**: `'A'`, `'B'`, `'C'` |
| Produtos — mídia (`/produtos/:id/midias`) | `starRating` | **string**: `'A'`, `'B'`, `'C'`, `'TODOS'` |

Ou seja: o front **não pode reutilizar** o mesmo componente/valor de "nível de estrela do cliente" (numérico, usado em contatos/fluxos/campanhas) para preencher os campos de segmentação de produto (que ainda usam a letra A/B/C). São dois domínios de valores diferentes que só coincidem no nome do campo (`starRating`).

---

## Resumo rápido para busca (find & replace no front)

```
nome              → name          (exceto UploadMediaDto, que continua "nome")
descricao         → description
unidade           → unit
categoriaId       → categoryId
categoriaNome     → categoryName
numeroWhatsapp    → phoneNumber
observacoes       → notes
statusEngajamento → engagementStatus
cooldownAte       → cooldownUntil
tipoCliente       → starLevel (contatos, numérico) OU starRating (fluxos/campanhas/produtos, string — ver seção 8)
ordem             → order
tipo              → type
conteudoTexto     → textContent
midiaTipo         → mediaType
produtoId         → productId
delaySegundos     → delaySeconds
mensagem          → message
tipoClienteAlvo   → targetStarRating
statusAlvo        → targetStatus
agendadoPara      → scheduledFor
valor             → value
contatoId         → contactId
itens             → items
quantidade        → quantity
precoUnitario     → unitPrice
descontoPct       → discountPct
midiaId           → mediaId
```
