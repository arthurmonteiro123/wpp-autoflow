# Frontend Integration Guide — wpp-autoflow

> Complementa o Scalar API Reference (`http://localhost:3000/reference`).
> Este documento cobre **o que o Scalar não mostra**: estratégia de auth, tratamento de erros, regras de negócio que afetam o UI, máquinas de estado e padrões de integração.

---

## Sumário

1. [Configuração Base](#1-configuração-base)
2. [Autenticação e Ciclo de Vida dos Tokens](#2-autenticação-e-ciclo-de-vida-dos-tokens)
3. [Tratamento de Erros](#3-tratamento-de-erros)
4. [Padrão de Resposta da API](#4-padrão-de-resposta-da-api)
5. [Controle de Acesso por Role](#5-controle-de-acesso-por-role)
6. [Máquinas de Estado](#6-máquinas-de-estado)
7. [Upload de Arquivos](#7-upload-de-arquivos)
8. [Paginação](#8-paginação)
9. [Parâmetros do Sistema em Tempo Real](#9-parâmetros-do-sistema-em-tempo-real)
10. [Regras Críticas de Negócio](#10-regras-críticas-de-negócio)
11. [Gotchas e Armadilhas](#11-gotchas-e-armadilhas)

---

## 1. Configuração Base

```
Base URL:        http://localhost:3000
Scalar Docs:     http://localhost:3000/reference
Swagger UI:      http://localhost:3000/docs
Content-Type:    application/json  (exceto uploads: multipart/form-data)
```

Todas as requisições autenticadas exigem:
```
Authorization: Bearer <accessToken>
```

---

## 2. Autenticação e Ciclo de Vida dos Tokens

### Tokens

| Token | Duração padrão | Onde usar |
|---|---|---|
| `accessToken` | 8 horas | Header `Authorization: Bearer` em toda requisição |
| `refreshToken` | 7 dias | Apenas no endpoint `POST /auth/refresh` |

### Onde armazenar

- **`accessToken`**: memória (variável de estado/store). Nunca `localStorage` — é sensível e tem vida curta.
- **`refreshToken`**: `localStorage` ou `sessionStorage`. Precisar sobreviver a reload de página.

### Fluxo de login

```
POST /auth/login  →  { accessToken, refreshToken, user: { id, nome, email, role, status } }
```

Salvar ambos os tokens e o objeto `user` no store. O `user.role` determina o que renderizar.

### Fluxo de refresh (renovação silenciosa)

Quando qualquer requisição retornar **401**:

```
1. Verificar se há refreshToken armazenado
2. Se sim → POST /auth/refresh  body: { refreshToken }
3. Resposta: { accessToken }  (apenas o accessToken é renovado)
4. Atualizar o accessToken no store
5. Repetir a requisição original com o novo token
6. Se /auth/refresh também retornar 401 → o refreshToken expirou → redirecionar para /login
```

Implementar com interceptor no cliente HTTP. Usar uma flag para evitar múltiplas chamadas simultâneas de refresh (race condition).

```typescript
// Exemplo de lógica de interceptor
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

// Em qualquer 401:
if (!isRefreshing) {
  isRefreshing = true;
  const { accessToken } = await refreshTokenCall();
  isRefreshing = false;
  refreshSubscribers.forEach(cb => cb(accessToken));
  refreshSubscribers = [];
}
```

### Logout

Apenas limpar os tokens do store/localStorage. Não há endpoint de logout no servidor.

---

## 3. Tratamento de Erros

### Formato de erro padrão (todos os erros HTTP)

```json
{
  "statusCode": 400,
  "message": "string ou array de strings",
  "timestamp": "2026-06-18T10:30:00.000Z",
  "path": "/contatos"
}
```

### O campo `message` pode ser string ou array

- **Erro de negócio** (409, 404, 401, 403): `message` é **string** — exibir diretamente.
- **Erro de validação** (400): `message` é **array de strings** — uma mensagem por campo inválido.

```typescript
function extractErrorMessage(error: ApiError): string {
  if (Array.isArray(error.message)) {
    return error.message.join('\n');
  }
  return error.message;
}
```

### Mapeamento de status → UX

| Status | Significado | Ação no frontend |
|---|---|---|
| `400` | Campos inválidos | Exibir mensagens de validação abaixo dos campos |
| `401` | Token expirado ou ausente | Tentar refresh → se falhar, redirecionar para login |
| `403` | Role sem permissão | Exibir "Acesso negado" ou ocultar o recurso |
| `404` | Recurso não encontrado | Exibir estado vazio ou redirecionar |
| `409` | Conflito (ex: email duplicado) | Exibir mensagem no campo correspondente |
| `500` | Erro interno | Exibir mensagem genérica de erro |

---

## 4. Padrão de Resposta da API

### Resposta de sucesso — item único ou ação

```json
{
  "success": true,
  "data": { ... }
}
```

### Resposta de sucesso — listagem paginada

```json
{
  "success": true,
  "data": {
    "data": [ ... ],
    "total": 150,
    "pagina": 1,
    "limite": 20
  }
}
```

Acessar sempre via `response.data` (camada externa) e depois `response.data.data` para listas.

### Resposta de importação CSV

```json
{
  "success": true,
  "data": {
    "importados": 42,
    "erros": ["Número inválido: abc para João", "tipoCliente inválido para Maria"]
  }
}
```

Sempre exibir os erros mesmo quando `importados > 0` — importação parcial é válida.

---

## 5. Controle de Acesso por Role

### Roles existentes

| Role | Valor no token |
|---|---|
| Administrador | `ADMIN` |
| Operador | `OPERADOR` |
| Vendedor | `VENDEDOR` |

O `role` está no objeto `user` retornado no login e em `GET /auth/me`.

### O que cada role pode acessar

| Funcionalidade | ADMIN | OPERADOR | VENDEDOR |
|---|---|---|---|
| Gestão de usuários (`/admin/users`) | ✅ | ❌ | ❌ |
| Gestão da instância Evolution | ✅ | ❌ | ❌ |
| Contatos | ✅ | ✅ | ❌ |
| Produtos e categorias | ✅ | ✅ | ❌ |
| Fluxos de conversa | ✅ | ✅ | ❌ |
| Campanhas e parâmetros | ✅ | ✅ | ❌ |
| Pedidos (listar/criar/fechar) | ✅ | ✅ | ✅ (só ver) |
| Histórico de contato | ✅ | ✅ | ✅ |
| Upload e agendamento de mídias | ✅ | ✅ | ❌ |

### Regra crítica: VENDEDOR não vê número do cliente

Em `GET /pedidos` e `GET /pedidos/:id`, quando o usuário tem role `VENDEDOR`, o campo `contatoId` **não virá na resposta**. O backend remove antes de retornar.

- Não exibir coluna de contato para vendedores
- Não tentar navegar para o perfil do contato a partir de um pedido quando for vendedor

---

## 6. Máquinas de Estado

### Status de engajamento do contato

```
NOVO ──(pulse dispara)──► INATIVO
                               │
                    (cliente responde via WhatsApp)
                               ▼
                          RESPONDEU
                               │
                    (pedido fechado manualmente)
                               ▼
                            ATIVO

QUALQUER ──(operador bloqueia)──► BLOQUEADO
```

Contatos `BLOQUEADO` são excluídos de todos os disparos automáticos. Exibir alerta visual diferenciado.

Ao alterar status via `PATCH /contatos/:id/status`, apenas as transições acima fazem sentido de negócio — o frontend pode restringir as opções exibidas no select.

### Ciclo de vida de campanha

```
RASCUNHO ──(disparar)──► EM_ANDAMENTO ──► CONCLUIDO
    │
    ├──(agendar)──► AGENDADO ──► EM_ANDAMENTO ──► CONCLUIDO
    │
    └──(cancelar)──► CANCELADO
AGENDADO ──(cancelar)──► CANCELADO
```

Regras de UI:
- Só exibir botão **Editar** se `status === 'RASCUNHO'`
- Só exibir botão **Disparar** se `status === 'RASCUNHO'`
- Só exibir botão **Cancelar** se `status === 'RASCUNHO'` ou `status === 'AGENDADO'`
- Campanhas `EM_ANDAMENTO` ou `CONCLUIDO` são somente leitura

### Status de pedido

```
ABERTO ──(fechar)──► FECHADO
ABERTO ──(cancelar)──► CANCELADO
```

- `PATCH /pedidos/:id/fechar` → notifica automaticamente o vendedor via WhatsApp
- `POST /pedidos/:id/renotificar` → reenvia a notificação ao vendedor (útil se o primeiro envio falhou)

### Status de entrega de mídia agendada

```
PENDENTE ──(job executa)──► ENVIADO
PENDENTE ──(erro no envio)──► ERRO
PENDENTE ──(cancelar)──► CANCELADO
```

Só é possível cancelar entregas com `status === 'PENDENTE'`.

---

## 7. Upload de Arquivos

### Endpoint de upload de mídia

```
POST /midias/upload
Content-Type: multipart/form-data
```

Campos do FormData:
- `arquivo`: o arquivo binário (campo obrigatório)
- `nome`: string — nome amigável para exibição (campo obrigatório no body JSON, mas enviado junto no form)

```typescript
const formData = new FormData();
formData.append('arquivo', file);
formData.append('nome', 'Catálogo de Verão');

fetch('/midias/upload', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
  // NÃO definir Content-Type manualmente — o browser define o boundary automaticamente
});
```

### Limite de tamanho

Padrão: **50 MB** (configurável via parâmetro `MAX_UPLOAD_TAMANHO_MB`).

### Tipos detectados automaticamente

| MIME type | Tipo armazenado |
|---|---|
| `image/*` | `IMAGEM` |
| `video/*` | `VIDEO` |
| `audio/*` | `AUDIO` |
| qualquer outro | `DOCUMENTO` |

### Importação de contatos via CSV

```
POST /contatos/importar-csv
Content-Type: multipart/form-data
Campo: arquivo
```

Formato esperado do CSV:
```
nome,numeroWhatsapp,tipoCliente
João Silva,5511999990001,A
Maria Souza,5511999990002,B
```

- Separador: vírgula
- Linha de cabeçalho obrigatória com esses nomes exatos
- `numeroWhatsapp`: apenas dígitos, entre 10 e 15 caracteres
- `tipoCliente`: `A`, `B` ou `C`
- Duplicatas (mesmo número) são ignoradas silenciosamente

---

## 8. Paginação

Todos os endpoints de listagem aceitam:

```
?pagina=1&limite=20
```

Valores padrão: `pagina=1`, `limite=20`.

A resposta sempre retorna `total` (total de registros, não da página). Use para calcular o número de páginas:

```typescript
const totalPages = Math.ceil(total / limite);
```

Endpoints com filtros adicionais (exemplo de contatos):

```
GET /contatos?pagina=1&limite=20&tipoCliente=A&statusEngajamento=RESPONDEU&somenteSemCooldown=true
```

---

## 9. Parâmetros do Sistema em Tempo Real

Os parâmetros em `GET /parametros` controlam comportamentos do sistema e podem ser alterados sem restart.

### Parâmetros relevantes para o frontend exibir/editar

| Chave | Tipo do valor | Descrição |
|---|---|---|
| `PULSE_ATIVO` | `"true"` / `"false"` | Liga ou desliga o disparo automático |
| `PULSE_INTERVALO_MINUTOS` | número como string | Intervalo entre ciclos do pulse |
| `PULSE_MAX_CONTATOS_POR_CICLO` | número como string | Máx de contatos por ciclo |
| `PULSE_COOLDOWN_HORAS` | número como string | Horas de cooldown após disparo |
| `BROADCAST_DELAY_ENTRE_ENVIOS_MS` | número como string | Delay entre envios em ms |
| `VENDEDOR_1_NUMERO_WHATSAPP` | string | Número do vendedor (com DDI, ex: 5511999990001) |
| `VENDEDOR_1_NOME` | string | Nome exibido nas mensagens |
| `FLUXO_DELAY_PADRAO_SEGUNDOS` | número como string | Delay entre etapas do fluxo |

**Atenção**: todos os valores são `string` no banco. Converter para number antes de usar em cálculos no frontend.

### Atualizar parâmetro

```
PATCH /parametros/:chave
Body: { "valor": "10" }
```

A chave é a string exata da tabela acima (ex: `PULSE_INTERVALO_MINUTOS`).

---

## 10. Regras Críticas de Negócio

### Fluxos de conversa

- Só pode existir **um fluxo ativo por tipo de cliente** (A, B ou C).
- Ao criar um fluxo, se já existir um ativo para o mesmo `tipoCliente`, a API retorna 409.
- Antes de ativar um novo fluxo, desativar o anterior via `PATCH /fluxos/:id` com `{ "ativo": false }`.
- Etapas são executadas em ordem crescente do campo `ordem`. Exibir com drag-and-drop e atualizar os valores de `ordem` manualmente.

### Contatos em cooldown

Contatos com `cooldownAte` no futuro não recebem disparos automáticos. O campo `cooldownAte` é uma ISO 8601 date string.

Para filtrar contatos disponíveis para disparo: `?somenteSemCooldown=true`.

### Fechamento de pedido

`PATCH /pedidos/:id/fechar` dispara automaticamente:
1. Atualiza status do contato para `ATIVO`
2. Adiciona label `ATIVO` no Evolution API
3. Envia mensagem de notificação ao vendedor (número configurado em `VENDEDOR_1_NUMERO_WHATSAPP`)

Se `VENDEDOR_1_NUMERO_WHATSAPP` estiver vazio, o fechamento ocorre mas a notificação falha silenciosamente. Exibir aviso no frontend se o parâmetro não estiver preenchido.

### Soft delete

Entidades deletadas não aparecem nas listagens. Não há endpoint de restauração — soft delete é permanente do ponto de vista do UI.

---

## 11. Gotchas e Armadilhas

### Campos decimais chegam como string

O Drizzle ORM retorna campos `decimal` do PostgreSQL como `string`. Converter antes de exibir valores monetários:

```typescript
const preco = parseFloat(item.precoUnitario); // "120.00" → 120.00
```

Campos afetados: `precoUnitario`, `descontoMaximoPct`, `totalEstimado`, `quantidadeMin`, `quantidadeMax`.

### Datas chegam como string ISO 8601

Converter para `Date` ou usar biblioteca de formatação. Exemplo com `Intl`:

```typescript
new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  .format(new Date(item.createdAt));
```

### Status HTTP de criação

- `POST` que cria recurso retorna **201** em alguns endpoints (ex: `POST /admin/users`) e **200** em outros.
- Não assumir sempre 201. Tratar qualquer `2xx` como sucesso.

### Upload: não definir Content-Type manualmente

Ao usar `FormData`, o browser precisa definir o `Content-Type` automaticamente para incluir o `boundary`. Se você definir `Content-Type: multipart/form-data` no header manualmente, o boundary será omitido e a requisição falhará.

### Parâmetros do sistema são sempre string

O endpoint `PATCH /parametros/:chave` recebe e retorna `valor` sempre como `string`. Para booleanos, usar `"true"` e `"false"` (string), nunca `true` (boolean).

### Número de WhatsApp — formato esperado

Apenas dígitos, sem espaços, traços ou parênteses. Entre 10 e 15 caracteres. Com DDI mas sem o `+`:
- ✅ `5511999990001`
- ❌ `+55 (11) 99999-0001`

### Roles Guard retorna 403, não 404

Se um usuário sem permissão tentar acessar um endpoint restrito, receberá **403 Forbidden**, não 404. Tratar 403 como "sem permissão" e não como "não encontrado".

### Evolution API — dependência externa

Os endpoints `GET /evolution/status`, `POST /evolution/connect` e `GET /evolution/qrcode` fazem proxy direto para a Evolution API. Se a instância estiver offline, esses endpoints retornarão erro. Exibir estado de "serviço indisponível" e não travar o restante da UI.

---

*Para shapes exatos de request/response de cada endpoint, consulte o Scalar: `http://localhost:3000/reference`*
