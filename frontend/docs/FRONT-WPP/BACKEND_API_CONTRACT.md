# wpp-autoflow — Contrato de API do Backend

> Documento técnico derivado das integrações implementadas no frontend.
> Descreve todas as rotas, payloads, tipos e contratos esperados pelo cliente React.

**Base URL:** `http://localhost:3000` (configurável em `src/lib/api.ts`)
**Autenticação:** Bearer JWT no header `Authorization`
**Envelope padrão de resposta:**

```json
{ "success": true, "data": <T> }
```

O cliente desempacota automaticamente `data`. Respostas sem envelope (`{ accessToken, ... }`) também são aceitas. Erros devem seguir:

```json
{ "statusCode": 400, "message": "mensagem ou array de mensagens", "timestamp": "ISO", "path": "/rota" }
```

---

## Sumário de Domínios

| Domínio | Prefixo |
|---|---|
| Autenticação | `/auth` |
| Leads / Contatos | `/contatos` |
| Pedidos | `/pedidos` |
| Produtos | `/produtos` |
| Categorias de Produto | `/categorias-produto` |
| Fluxos de Conversa | `/fluxos` |
| Campanhas | `/campanhas` |
| Mídias | `/midias` |
| Usuários (Admin) | `/admin/users` |
| Parâmetros do Sistema | `/parametros` |
| WhatsApp / Evolution API | `/evolution` |

---

## Enums e Tipos Compartilhados

```typescript
type LeadStatus      = "NOVO" | "INATIVO" | "RESPONDEU" | "ATIVO" | "BLOQUEADO"
type TipoCliente     = "A" | "B" | "C"
type OrderStatus     = "ABERTO" | "FECHADO" | "CANCELADO"
type Role            = "ADMIN" | "OPERADOR" | "VENDEDOR"
type MidiaTipo       = "IMAGEM" | "VIDEO" | "AUDIO" | "DOCUMENTO"
type CampanhaStatus  = "RASCUNHO" | "AGENDADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO"
type ProdutoStatus   = "ATIVO" | "INATIVO"
type FluxoTipoCliente= "A" | "B" | "C" | "INATIVO" | "BROADCAST"
type GatilhoTipo     = "NOVO_LEAD" | "PALAVRA_CHAVE" | "INATIVO_30D" | "ANIVERSARIO" | "PEDIDO_ABERTO"
type EtapaTipo       = "MENSAGEM" | "AGUARDAR" | "CONDICAO" | "IA" | "ENCERRAR"
```

**Resposta paginada (`PagedData<T>`):**

```typescript
{
  data:   T[]
  total:  number
  pagina: number
  limite: number
}
```

---

## 1. Autenticação — `/auth`

### `POST /auth/login`
Login com e-mail e senha. Retorna tokens e dados do usuário.

**Request body:**
```json
{ "email": "string", "senha": "string" }
```

**Response `200`:**
```json
{
  "accessToken":  "jwt_string",
  "refreshToken": "jwt_string",
  "user": {
    "id":    "uuid",
    "nome":  "string",
    "email": "string",
    "role":  "ADMIN | OPERADOR | VENDEDOR",
    "status": "ATIVO | INATIVO"
  }
}
```

> O frontend armazena `refreshToken` em `localStorage` (`wpp_refresh_token`) e o `accessToken` em memória.

---

### `POST /auth/refresh`
Renova o `accessToken` usando o `refreshToken` armazenado.

**Request body:**
```json
{ "refreshToken": "string" }
```

**Response `200`:**
```json
{ "accessToken": "jwt_string" }
```

> Aceita também envelope `{ "data": { "accessToken": "..." } }`.
> Em caso de falha (`401`/`400`), o frontend remove o `refreshToken` do storage e redireciona para `/login`.

---

### `GET /auth/me`
Retorna o usuário autenticado. Chamado após cada renovação de token na inicialização.

**Response `200`:**
```json
{
  "id":    "uuid",
  "nome":  "string",
  "email": "string",
  "role":  "ADMIN | OPERADOR | VENDEDOR",
  "status": "ATIVO | INATIVO"
}
```

---

## 2. Leads / Contatos — `/contatos`

### `GET /contatos`
Lista paginada de contatos com filtros opcionais.

**Query params:**
| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `pagina` | number | 1 | Página atual |
| `limite` | number | 50 | Registros por página |
| `tipoCliente` | `TipoCliente` | — | Filtro por tipo A/B/C |
| `statusEngajamento` | `LeadStatus` | — | Filtro por status |
| `busca` | string | — | Busca por nome ou número |
| `somenteSemCooldown` | boolean | — | Exclui contatos em cooldown |

**Response `200`:** `PagedData<Contato>`

```typescript
interface Contato {
  id:               string   // uuid
  nome:             string
  numeroWhatsapp:   string   // somente dígitos, ex: "5511999999999"
  tipoCliente:      TipoCliente
  statusEngajamento: LeadStatus
  cooldownAte:      string | null  // ISO 8601 ou null
  observacoes:      string | null
  createdAt:        string   // ISO 8601
  updatedAt:        string   // ISO 8601
}
```

---

### `POST /contatos`
Cria um novo contato/lead.

**Request body:**
```json
{
  "nome":           "string",
  "numeroWhatsapp": "string",
  "tipoCliente":    "A | B | C",
  "observacoes":    "string (opcional)"
}
```

**Response `201`:** `Contato`

---

### `PATCH /contatos/:id/status`
Atualiza apenas o status de engajamento de um contato.

**Request body:**
```json
{ "status": "NOVO | INATIVO | RESPONDEU | ATIVO | BLOQUEADO" }
```

**Response `200`:** `Contato`

---

### `POST /contatos/importar-csv`
Importa contatos em massa via arquivo CSV.

**Request:** `multipart/form-data`
| Campo | Tipo | Descrição |
|---|---|---|
| `arquivo` | File | Arquivo `.csv` |

**Formato esperado do CSV:** `nome,numeroWhatsapp,tipoCliente` (cabeçalho + linhas)

**Response `200`:**
```json
{
  "importados": 42,
  "erros": ["linha 3: número inválido", "..."]
}
```

---

## 3. Pedidos — `/pedidos`

### `GET /pedidos`
Lista paginada de pedidos.

**Query params:**
| Param | Tipo | Default |
|---|---|---|
| `pagina` | number | 1 |
| `limite` | number | 50 |
| `status` | `OrderStatus` | — |

**Response `200`:** `PagedData<Pedido>`

```typescript
interface Pedido {
  id:             string
  contatoId?:     string
  contatoNome?:   string
  contatoTipo?:   TipoCliente
  status:         OrderStatus
  itens:          PedidoItem[]
  totalEstimado:  string   // decimal como string, ex: "149.90"
  createdAt:      string
  fechadoEm:      string | null
}

interface PedidoItem {
  produtoNome:    string
  produtoSku?:    string
  unidade:        string
  quantidade:     number
  precoUnitario:  string  // decimal como string
  desconto:       number  // percentual 0-100
}
```

---

### `PATCH /pedidos/:id/fechar`
Fecha um pedido e notifica o vendedor configurado via WhatsApp.

**Request body:** `{}` (body vazio aceito)

**Response `200`:** `Pedido`

---

### `PATCH /pedidos/:id/cancelar`
Cancela um pedido aberto.

**Request body:** `{}` (body vazio aceito)

**Response `200`:** `Pedido`

---

### `POST /pedidos/:id/renotificar`
Reenvio da notificação de pedido fechado ao vendedor.

**Request body:** `{}` (body vazio aceito)

**Response `204`** ou `200`

---

## 4. Produtos — `/produtos`

### `GET /produtos`
Lista paginada de produtos.

**Query params:** `pagina` (default 1), `limite` (default 100)

**Response `200`:** `PagedData<Produto>`

```typescript
interface Produto {
  id:           string
  nome:         string
  categoriaNome: string | null
  categoriaId:  string | null
  descricao:    string
  unidade:      string   // ex: "kg", "un", "cx"
  status:       ProdutoStatus
  precos?:      PrecoProdutoEntry[]
  createdAt:    string
  updatedAt:    string
}
```

---

### `POST /produtos`
Cria um novo produto.

**Request body:**
```json
{
  "nome":        "string",
  "unidade":     "string",
  "descricao":   "string (opcional)",
  "categoriaId": "uuid (opcional)"
}
```

**Response `201`:** `Produto`

---

### `PATCH /produtos/:id`
Atualiza parcialmente um produto.

**Request body (todos opcionais):**
```json
{
  "nome":        "string",
  "unidade":     "string",
  "descricao":   "string",
  "categoriaId": "uuid",
  "status":      "ATIVO | INATIVO"
}
```

**Response `200`:** `Produto`

---

### `DELETE /produtos/:id`

**Response `204`**

---

### `GET /produtos/:id/tabela-preco`
Retorna a tabela de preços por tipo de cliente e faixa de quantidade.

**Response `200`:** `PagedData<PrecoProdutoEntry>`

```typescript
interface PrecoProdutoEntry {
  id:                string
  tipoCliente:       TipoCliente
  quantidadeMin:     number
  quantidadeMax:     number | null
  precoUnitario:     string  // decimal como string
  descontoMaximoPct: string  // percentual como string, ex: "10.00"
}
```

---

### `POST /produtos/:id/tabela-preco`
Adiciona uma entrada à tabela de preços.

**Request body:**
```json
{
  "tipoCliente":      "A | B | C",
  "quantidadeMin":    1,
  "quantidadeMax":    10,
  "precoUnitario":    49.90,
  "descontoMaximoPct": 5
}
```

**Response `201`:** `PrecoProdutoEntry`

---

### `DELETE /produtos/:id/tabela-preco/:entryId`

**Response `204`**

---

## 5. Categorias de Produto — `/categorias-produto`

### `GET /categorias-produto`

**Response `200`:** `PagedData<Categoria>`

```typescript
interface Categoria {
  id:   string
  nome: string
}
```

---

### `POST /categorias-produto`

**Request body:**
```json
{ "nome": "string" }
```

**Response `201`:** `Categoria`

---

## 6. Fluxos de Conversa — `/fluxos`

### `GET /fluxos`

**Response `200`:** `PagedData<Fluxo>`

```typescript
interface Fluxo {
  id:          string
  nome:        string
  descricao?:  string
  ativo:       boolean
  tipoCliente?: FluxoTipoCliente
  gatilho?:    GatilhoTipo
  etapas?:     FluxoEtapaApi[]
  stepCount?:  number    // alternativa a etapas.length para listagem leve
  createdAt:   string
  updatedAt:   string
}

interface FluxoEtapaApi {
  id:       string
  tipo:     EtapaTipo
  titulo:   string
  conteudo?: string   // texto da mensagem, instrução IA ou condição
  delay?:   number    // minutos (apenas tipo AGUARDAR)
  ordem:    number
}
```

**Regra de negócio:** Deve existir no máximo **um fluxo ativo por `tipoCliente`**.

---

### `POST /fluxos`

**Request body:**
```json
{
  "nome":        "string",
  "tipoCliente": "A | B | C | INATIVO | BROADCAST",
  "descricao":   "string (opcional)",
  "gatilho":     "NOVO_LEAD | PALAVRA_CHAVE | INATIVO_30D | ANIVERSARIO | PEDIDO_ABERTO (opcional)"
}
```

**Response `201`:** `Fluxo`

---

### `PATCH /fluxos/:id`
Atualização parcial. Usado também para ativar/desativar via `{ "ativo": true/false }`.

**Request body (todos opcionais):**
```json
{
  "nome":        "string",
  "tipoCliente": "FluxoTipoCliente",
  "descricao":   "string",
  "gatilho":     "GatilhoTipo",
  "ativo":       true
}
```

**Response `200`:** `Fluxo`

---

### `DELETE /fluxos/:id`

**Response `204`**

---

## 7. Campanhas — `/campanhas`

### `GET /campanhas`

**Response `200`:** `PagedData<Campanha>`

```typescript
interface Campanha {
  id:                  string
  nome:                string
  status:              CampanhaStatus
  mensagem:            string
  midiaUrl?:           string
  midiaTipo?:          MidiaTipo
  tipoClienteAlvo?:    TipoCliente
  statusAlvo?:         string   // LeadStatus separados por vírgula, ex: "ATIVO,NOVO"
  agendadoPara?:       string | null  // ISO 8601
  totalDestinatarios:  number
  enviados:            number
  createdAt:           string
}
```

---

### `POST /campanhas`
Cria uma campanha. Se `tipo === "AGENDADO"`, a campanha fica com status `AGENDADO`; se `"IMEDIATO"`, fica `RASCUNHO` aguardando disparo manual.

**Request body:**
```json
{
  "nome":             "string",
  "tipo":             "IMEDIATO | AGENDADO",
  "mensagem":         "string",
  "midiaUrl":         "string (opcional)",
  "midiaTipo":        "IMAGEM | VIDEO | AUDIO | DOCUMENTO (opcional)",
  "tipoClienteAlvo":  "A | B | C (opcional — omitir = todos)",
  "statusAlvo":       "string CSV ex: 'ATIVO,NOVO' (opcional)",
  "agendadoPara":     "ISO 8601 (obrigatório se tipo=AGENDADO)"
}
```

> Variáveis de personalização suportadas na `mensagem`: `{{nome}}`, `{{numero}}`, `{{tipo}}`

**Response `201`:** `Campanha`

---

### `PATCH /campanhas/:id`
Atualização parcial de uma campanha existente.

**Response `200`:** `Campanha`

---

### `POST /campanhas/:id/disparar`
Dispara imediatamente uma campanha com status `RASCUNHO`.

**Request body:** `{}` (body vazio aceito)

**Response `200`** ou `204`

---

### `POST /campanhas/:id/cancelar`
Cancela uma campanha com status `RASCUNHO` ou `AGENDADO`.

**Request body:** `{}` (body vazio aceito)

**Response `200`** ou `204`

---

### `DELETE /campanhas/:id`

**Response `204`**

---

## 8. Mídias — `/midias`

### `GET /midias`

**Response `200`:** `PagedData<Midia>`

```typescript
interface Midia {
  id:           string
  nome:         string
  tipo:         MidiaTipo
  tamanhoBytes: number
  url?:         string   // URL de acesso público ao arquivo
  createdAt:    string
}
```

---

### `POST /midias/upload`
Upload de arquivo de mídia.

**Request:** `multipart/form-data`
| Campo | Tipo | Descrição |
|---|---|---|
| `arquivo` | File | Arquivo de mídia |
| `nome` | string | Nome de exibição |

**Response `201`:** `Midia`

---

### `DELETE /midias/:id`

**Response `204`**

---

## 9. Usuários (Admin) — `/admin/users`

> Todas as rotas deste módulo exigem `role === "ADMIN"`.

### `GET /admin/users`

**Response `200`:** `PagedData<Usuario>`

```typescript
interface Usuario {
  id:        string
  nome:      string
  email:     string
  role:      Role
  status:    "ATIVO" | "INATIVO"
  createdAt: string
}
```

---

### `POST /admin/users`
Cria um novo usuário do sistema.

**Request body:**
```json
{
  "nome":  "string",
  "email": "string",
  "senha": "string",
  "role":  "ADMIN | OPERADOR | VENDEDOR"
}
```

**Response `201`:** `Usuario`

---

### `PATCH /admin/users/:id`
Atualiza parcialmente um usuário.

**Request body (todos opcionais):**
```json
{
  "nome":   "string",
  "senha":  "string",
  "role":   "Role",
  "status": "ATIVO | INATIVO"
}
```

**Response `200`:** `Usuario`

---

## 10. Parâmetros do Sistema — `/parametros`

Chave-valor persistidos que controlam o comportamento do bot (Pulse).

### `GET /parametros`

**Response `200`:** `Parametro[]` *(array direto, sem paginação)*

```typescript
interface Parametro {
  chave:     string
  valor:     string   // sempre string; o frontend converte conforme o tipo
  descricao?: string
}
```

---

### `PATCH /parametros/:chave`
Atualiza o valor de um parâmetro pelo identificador.

**Request body:**
```json
{ "valor": "string" }
```

**Response `200`:** `Parametro`

---

### Parâmetros obrigatórios

| Chave | Tipo lógico | Descrição |
|---|---|---|
| `PULSE_ATIVO` | boolean (`"true"/"false"`) | Liga/desliga toda a automação |
| `PULSE_INTERVALO_MINUTOS` | number | Tempo entre ciclos do Pulse |
| `PULSE_MAX_CONTATOS_POR_CICLO` | number | Limite de disparos por ciclo |
| `PULSE_COOLDOWN_HORAS` | number | Horas de cooldown entre disparos para o mesmo lead |
| `BROADCAST_DELAY_ENTRE_ENVIOS_MS` | number | Delay entre mensagens em campanhas broadcast (ms) |
| `FLUXO_DELAY_PADRAO_SEGUNDOS` | number | Delay padrão entre etapas de fluxo |
| `VENDEDOR_1_NUMERO_WHATSAPP` | string | Número do vendedor (apenas dígitos com DDI, ex: `5511999990001`) |
| `VENDEDOR_1_NOME` | string | Nome do vendedor exibido nas mensagens do bot |

---

## 11. WhatsApp / Evolution API — `/evolution`

Proxy do backend para a [Evolution API](https://doc.evolution-api.com/). O backend deve gerenciar a instância e expor estes endpoints.

### `GET /evolution/status`
Verifica o estado da conexão WhatsApp. Chamado a cada 30 segundos pelo frontend.

**Response `200`:**
```typescript
interface EvolutionStatus {
  connected:      boolean
  instanceName?:  string   // nome da instância na Evolution API
  since?:         string   // ISO 8601 — data de conexão
  state?:         string   // estado interno da Evolution API
}
```

> Em caso de Evolution API offline, retornar `200` com `{ connected: false }` ou um erro estruturado — o frontend exibe "Serviço indisponível" quando a requisição falha.

---

### `POST /evolution/connect`
Solicita reconexão/criação da instância WhatsApp.

**Request body:** `{}` (body vazio aceito)

**Response `200`** ou `204`

---

### `GET /evolution/qrcode`
Retorna o QR Code atual para escanear no celular.

**Response `200`:**
```json
{ "qrcode": "data:image/png;base64,..." }
```

> Aceita tanto base64 data URI quanto URL pública de imagem.

---

## Comportamentos Gerais

### Autenticação e refresh silencioso
O cliente executa refresh automático em qualquer resposta `401`:
1. Busca `wpp_refresh_token` do `localStorage`
2. Chama `POST /auth/refresh`
3. Repete a requisição original com o novo token
4. Se o refresh falhar, redireciona para `/login`

Requests paralelas com `401` são enfileiradas e resolvidas com o mesmo token renovado (deduplicação via fila interna).

### CORS
O backend deve permitir requisições de `http://localhost` (porta variável durante desenvolvimento).

### Datas
Todos os campos de data devem ser retornados em formato **ISO 8601** (`2025-01-15T10:30:00.000Z`).

### Campos decimais
Campos monetários (`precoUnitario`, `totalEstimado`, `descontoMaximoPct`) devem ser retornados como **string decimal** (`"149.90"`) — o frontend usa `parseFloat()` na conversão. Isso evita perda de precisão em JSON.

### Paginação
Todos os endpoints de listagem devem aceitar `?pagina=1&limite=N` e retornar `PagedData<T>` com o campo `total` refletindo o total absoluto de registros (sem paginação), para que o frontend possa calcular número de páginas.
