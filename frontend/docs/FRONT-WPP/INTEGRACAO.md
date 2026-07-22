# Integração Frontend ↔ Backend

Documentação do que foi implementado durante a integração do `wpp-autoflow-front` com o backend `http://localhost:3000`.

---

## Arquitetura de integração

### `src/lib/api.ts` — cliente HTTP central

Responsável por todas as chamadas HTTP. Destaques:

- **Token injection**: lê o `accessToken` de uma variável de módulo (`_accessToken`), evitando problemas de closure em React.
- **Refresh automático**: ao receber `401`, chama `POST /auth/refresh` com o `refreshToken` do localStorage e repete a requisição original. Usa flag `_isRefreshing` + fila de subscribers para evitar race conditions em chamadas simultâneas.
- **Envelope unwrap**: o backend retorna `{ success, data }`. O cliente unwrap automaticamente, entregando `data` diretamente ao chamador.
- **Paginação**: respostas paginadas chegam como `{ data: [...], total, pagina, limite }` — exportadas como `PagedData<T>`.
- **Exports úteis**: `api<T>()`, `apiGet`, `apiPost`, `apiPatch`, `apiDelete`, `apiUpload`, `setAccessToken`, `setUnauthenticatedHandler`, `extractErrorMessage`.

### `src/lib/queries.ts` — hooks TanStack Query

Todos os hooks de dados da aplicação. Segue convenções:

- Tipos TypeScript mapeam exatamente os campos retornados pelo backend (nomes em camelCase).
- Campos decimais do Drizzle vêm como `string`. Use `toNumber(value)` antes de operações aritméticas ou exibição.
- `QK` centraliza as query keys para invalidação consistente.
- Mutations chamam `queryClient.invalidateQueries` automaticamente via `onSuccess`.

### `src/lib/auth.tsx` — contexto de autenticação

- Login via `POST /auth/login` → recebe `{ accessToken, refreshToken }`.
- `refreshToken` persiste em `localStorage` como `wpp_refresh_token`.
- `accessToken` fica em memória (módulo) via `setAccessToken()`.
- Na montagem: tenta `POST /auth/refresh` + `GET /auth/me` para restaurar sessão sem novo login.
- `logout()` limpa localStorage, zera token, redireciona via `window.location.href`.
- `isLoading: boolean` exposto no contexto para o spinner do layout.

---

## O que está integrado

### Autenticação
| Rota | Endpoint | Status |
|------|----------|--------|
| `/login` | `POST /auth/login` | ✅ |
| Restaurar sessão | `POST /auth/refresh` + `GET /auth/me` | ✅ |
| Logout | limpa localStorage + token | ✅ |
| Redirect não autenticado | `localStorage.wpp_refresh_token` | ✅ |

### Leads (`/leads`)
| Função | Endpoint | Status |
|--------|----------|--------|
| Listar | `GET /contatos?pagina=&limite=&status=` | ✅ |
| Criar | `POST /contatos` | ✅ |
| Atualizar status | `PATCH /contatos/:id/status` | ✅ |
| Importar CSV | `POST /contatos/importar-csv` (FormData) | ✅ |

Campos mapeados: `numeroWhatsapp`, `tipoCliente`, `statusEngajamento`, `cooldownAte`.

### Pedidos (`/pedidos`)
| Função | Endpoint | Status |
|--------|----------|--------|
| Listar | `GET /pedidos?pagina=&limite=&status=` | ✅ |
| Fechar | `PATCH /pedidos/:id/fechar` | ✅ |
| Cancelar | `PATCH /pedidos/:id/cancelar` | ✅ |
| Renotificar | `POST /pedidos/:id/renotificar` | ✅ |

Campos: `totalEstimado` é string decimal — convertido com `toNumber()`. VENDEDOR não recebe `contatoId` (backend omite), coluna "Cliente" é ocultada para esse papel.

### Fluxos (`/fluxos`)
| Função | Endpoint | Status |
|--------|----------|--------|
| Listar | `GET /fluxos` | ✅ |
| Criar | `POST /fluxos` | ✅ |
| Atualizar | `PATCH /fluxos/:id` | ✅ |
| Deletar | `DELETE /fluxos/:id` | ✅ |
| Duplicar | criar novo com mesmo conteúdo | ✅ |

### Produtos (`/produtos`)
| Função | Endpoint | Status |
|--------|----------|--------|
| Listar | `GET /produtos` | ✅ |
| Criar | `POST /produtos` | ✅ |
| Atualizar | `PATCH /produtos/:id` | ✅ |
| Deletar | `DELETE /produtos/:id` | ✅ |
| Listar mídias para imagem | `GET /midias` | ✅ |

Preços (`PrecoProduto`): campos `tipoCliente`, `quantidadeMin`, `quantidadeMax`, `precoUnitario` (string), `descontoMaximoPct` (string).

### Campanhas (`/campanhas`)
| Função | Endpoint | Status |
|--------|----------|--------|
| Listar | `GET /campanhas` | ✅ |
| Criar | `POST /campanhas` | ✅ |
| Atualizar status | `PATCH /campanhas/:id` | ✅ |
| Deletar | `DELETE /campanhas/:id` | ✅ |

Status possíveis: `RASCUNHO`, `AGENDADO`, `EM_ANDAMENTO`, `CONCLUIDO`, `CANCELADO`.

### Mídias (`/midias`)
| Função | Endpoint | Status |
|--------|----------|--------|
| Listar | `GET /midias` | ✅ |
| Upload | `POST /midias/upload` (FormData: `file`, `nome`) | ✅ |
| Deletar | `DELETE /midias/:id` | ✅ |

Campo de tamanho: `tamanhoBytes` (não `tamanhoKb`).

### Usuários (`/usuarios`)
| Função | Endpoint | Status |
|--------|----------|--------|
| Listar | `GET /admin/users` (ADMIN only) | ✅ |
| Criar | `POST /admin/users` | ✅ |
| Atualizar (ativo/papel) | `PATCH /admin/users/:id` | ✅ |

### Configurações (`/configuracoes`)
| Função | Endpoint | Status |
|--------|----------|--------|
| Listar parâmetros | `GET /parametros` | ✅ |
| Atualizar parâmetro | `PATCH /parametros/:chave` | ✅ |

Chaves mapeadas: `PULSE_ATIVO`, `PULSE_INTERVALO_MINUTOS`, `PULSE_MAX_CONTATOS_POR_CICLO`, `PULSE_COOLDOWN_HORAS`, `BROADCAST_DELAY_ENTRE_ENVIOS_MS`, `FLUXO_DELAY_PADRAO_SEGUNDOS`, `VENDEDOR_1_NUMERO_WHATSAPP`, `VENDEDOR_1_NOME`.

### WhatsApp (`/configuracoes/whatsapp`)
| Função | Endpoint | Status |
|--------|----------|--------|
| Status da conexão | `GET /evolution/status` (refetch 30s) | ✅ |
| Reconectar | `POST /evolution/conectar` | ✅ |
| Gerar QR Code | `GET /evolution/qrcode` | ✅ |

Comportamento graceful: se a Evolution API estiver offline, exibe "Serviço indisponível" sem propagar erro para o restante da UI.

### Dashboard (`/dashboard`)
| Dado | Fonte | Status |
|------|-------|--------|
| Pedidos hoje / total | `GET /pedidos` | ✅ |
| Faturamento fechados | calculado dos pedidos | ✅ |
| Total leads | `GET /contatos?limite=1` (campo `total`) | ✅ |
| Status WhatsApp | `GET /evolution/status` | ✅ |
| Tabela de pedidos recentes | `GET /pedidos` | ✅ |
| Gráficos (faturamento, top produtos) | **mock** — sem endpoint de analytics | ⚠️ |
| Distribuição de leads por status | **mock** — sem endpoint de analytics | ⚠️ |

### Painel do Vendedor (`/painel`)
| Dado | Fonte | Status |
|------|-------|--------|
| Pedidos em aberto | `GET /pedidos?status=ABERTO` | ✅ |
| Pedidos fechados hoje | calculado dos pedidos | ✅ |
| Fechar pedido | `PATCH /pedidos/:id/fechar` | ✅ |
| Auto-refresh 30s | `setInterval` + `refetch()` | ✅ |
| Kanban novos / vistos / concluídos | estado local `seen: Set<string>` | ✅ |

---

## O que NÃO está integrado (sem endpoint no backend)

| Tela/Dado | Motivo |
|-----------|--------|
| Gráficos de faturamento por dia | Backend não expõe endpoint de analytics/timeseries |
| Top produtos mais vendidos | Idem |
| Distribuição de leads por status (gráfico) | Idem — `GET /contatos` não agrega por status |
| Notificação sonora (painel vendedor) | Frontend only — toggle presente, integração com áudio omitida por não ter evento server-push |

---

## Detalhes técnicos

### Conversão de decimais (Drizzle ORM)
Campos como `precoUnitario`, `totalEstimado`, `descontoMaximoPct` chegam como `string` porque o Drizzle retorna `decimal`/`numeric` assim. Use sempre:

```ts
import { toNumber } from "@/lib/queries";
const valor = toNumber(pedido.totalEstimado); // → number
```

### Papéis (roles)
- `ADMIN`: acesso total, incluindo `/admin/users`.
- `OPERADOR`: acesso a todas as telas exceto usuários.
- `VENDEDOR`: redireciona para `/painel` após login; backend omite `contatoId` das respostas de pedidos.

### Autenticação SSR-safe
Todos os `beforeLoad` verificam `typeof window === "undefined"` antes de ler `localStorage`, evitando crash no servidor.

### Cache e invalidação
Mutations usam `queryClient.invalidateQueries` via `onSuccess` para manter o cache sempre fresco após write operations. O painel do vendedor usa `setInterval` adicional de 30s para pedidos ao vivo.
