# Frontend Slice — wpp-autoflow Panel

> Última atualização: 2026-06-18
> Consome: API REST NestJS em `http://localhost:3000`
> Papéis: ADMIN · OPERADOR · VENDEDOR

---

## Sumário

1. [Stack Técnica](#1-stack-técnica)
2. [Design System](#2-design-system)
3. [Estrutura de Rotas](#3-estrutura-de-rotas)
4. [Autenticação e Guards](#4-autenticação-e-guards)
5. [Layout Global](#5-layout-global)
6. [Página: Login](#6-página-login)
7. [Dashboard Admin](#7-dashboard-admin)
8. [Módulo: Produtos e SKUs](#8-módulo-produtos-e-skus)
9. [Módulo: Leads e Contatos](#9-módulo-leads-e-contatos)
10. [Módulo: Fluxos de Conversa](#10-módulo-fluxos-de-conversa)
11. [Módulo: Campanhas](#11-módulo-campanhas)
12. [Módulo: Mídia](#12-módulo-mídia)
13. [Módulo: Pedidos (Admin/Operador)](#13-módulo-pedidos-adminoperador)
14. [Configurações do Bot](#14-configurações-do-bot)
15. [Status da Instância WhatsApp](#15-status-da-instância-whatsapp)
16. [Painel do Vendedor](#16-painel-do-vendedor)
17. [Camada de API (Cliente HTTP)](#17-camada-de-api-cliente-http)
18. [Gerenciamento de Estado](#18-gerenciamento-de-estado)
19. [Notificações em Tempo Real](#19-notificações-em-tempo-real)
20. [Componentes Globais Reutilizáveis](#20-componentes-globais-reutilizáveis)
21. [Animações e Microinterações](#21-animações-e-microinterações)
22. [Responsividade](#22-responsividade)
23. [Guia de Inicialização](#23-guia-de-inicialização)

---

## 1. Stack Técnica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 15 |
| Linguagem | TypeScript | 5.7 |
| Estilização | Tailwind CSS v4 | 4.x |
| Componentes | shadcn/ui (Radix UI base) | latest |
| Gráficos | Recharts | 2.x |
| Formulários | React Hook Form + Zod | 7.x / 4.x |
| Data fetching | TanStack Query (React Query) | 5.x |
| Estado global | Zustand | 5.x |
| Animações | Framer Motion | 11.x |
| Ícones | Lucide React | latest |
| HTTP client | Axios | 1.x |
| Notificações | Sonner (toast) | 1.x |
| Drag & Drop | @dnd-kit/core + sortable | 6.x |
| Upload | react-dropzone | 14.x |
| Datas | date-fns + date-fns/locale (pt-BR) | 4.x |
| SSE / tempo real | native EventSource API | — |
| Variáveis env | next/env com Zod | — |

### Scripts

```bash
npm run dev          # Next.js em modo desenvolvimento (porta 4000)
npm run build        # Build de produção
npm run start        # Serve build
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
```

### Variáveis de Ambiente

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=wpp-autoflow
```

---

## 2. Design System

### Paleta de Cores

A identidade visual é centrada em **verde esmeralda** com fundo escuro, transmitindo modernidade,
confiança e tecnologia. A paleta evita o "verde WhatsApp" por ser genérico — usa tons mais
profundos e sofisticados.

```css
/* globals.css — CSS variables */
:root {
  /* Brand */
  --brand-50:  #f0fdf4;
  --brand-100: #dcfce7;
  --brand-200: #bbf7d0;
  --brand-300: #86efac;
  --brand-400: #4ade80;
  --brand-500: #22c55e;   /* primary action */
  --brand-600: #16a34a;   /* primary hover */
  --brand-700: #15803d;
  --brand-800: #166534;
  --brand-900: #14532d;

  /* Neutral (dark theme como padrão) */
  --bg-base:       #09090b;   /* zinc-950 */
  --bg-surface:    #18181b;   /* zinc-900 */
  --bg-elevated:   #27272a;   /* zinc-800 */
  --bg-muted:      #3f3f46;   /* zinc-700 */

  --text-primary:  #fafafa;
  --text-secondary:#a1a1aa;   /* zinc-400 */
  --text-muted:    #71717a;   /* zinc-500 */

  /* Semantic */
  --success: #22c55e;
  --warning: #f59e0b;
  --error:   #ef4444;
  --info:    #3b82f6;

  /* Border */
  --border:        rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.15);

  /* Glow effect (verde) */
  --glow-green: 0 0 20px rgba(34, 197, 94, 0.25);
}
```

### Tipografia

```css
/* Fontes via next/font (Google Fonts) */
--font-sans: 'Geist', 'Inter', system-ui, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

/* Escala */
--text-xs:   0.75rem;   /* 12px — labels, badges */
--text-sm:   0.875rem;  /* 14px — body secundário */
--text-base: 1rem;      /* 16px — body principal */
--text-lg:   1.125rem;  /* 18px — subtítulos */
--text-xl:   1.25rem;   /* 20px — títulos de seção */
--text-2xl:  1.5rem;    /* 24px — títulos de página */
--text-3xl:  1.875rem;  /* 30px — dashboard metrics */
--text-4xl:  2.25rem;   /* 36px — hero/valores grandes */
```

### Tokens de Border Radius

```css
--radius-sm:  4px;
--radius-md:  8px;
--radius-lg:  12px;
--radius-xl:  16px;
--radius-2xl: 24px;
--radius-full: 9999px;
```

### Componentes shadcn/ui instalados

```bash
npx shadcn@latest add button card badge input label
npx shadcn@latest add select checkbox switch textarea
npx shadcn@latest add dialog drawer sheet
npx shadcn@latest add dropdown-menu context-menu
npx shadcn@latest add table pagination
npx shadcn@latest add tabs separator skeleton
npx shadcn@latest add avatar progress
npx shadcn@latest add tooltip popover
npx shadcn@latest add chart   # usa Recharts por baixo
npx shadcn@latest add command  # para search/combobox
```

### Tailwind Config (tailwind.config.ts)

```typescript
import { fontFamily } from 'tailwindcss/defaultTheme'

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', ...fontFamily.sans],
        mono: ['var(--font-geist-mono)', ...fontFamily.mono],
      },
      colors: {
        brand: {
          50: 'var(--brand-50)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          // ... resto da paleta
        },
      },
      keyframes: {
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        'pulse-green': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.4)' },
          '50%':       { boxShadow: '0 0 0 8px rgba(34,197,94,0)' },
        },
        'fade-up': {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to:   { transform: 'translateY(0)',     opacity: '1' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.35s cubic-bezier(0.16,1,0.3,1)',
        'pulse-green':    'pulse-green 2s ease-in-out infinite',
        'fade-up':        'fade-up 0.4s ease-out',
      },
    },
  },
}
```

---

## 3. Estrutura de Rotas

```
app/
├── (auth)/
│   └── login/
│       └── page.tsx                 # /login
│
├── (admin)/
│   ├── layout.tsx                   # AdminLayout (sidebar + header)
│   ├── dashboard/
│   │   └── page.tsx                 # /dashboard
│   ├── produtos/
│   │   ├── page.tsx                 # /produtos — lista paginada
│   │   ├── novo/page.tsx            # /produtos/novo
│   │   ├── [id]/page.tsx            # /produtos/[id] — detalhe + editar
│   │   └── [id]/tabela-preco/
│   │       └── page.tsx             # /produtos/[id]/tabela-preco
│   ├── categorias/
│   │   └── page.tsx                 # /categorias
│   ├── leads/
│   │   ├── page.tsx                 # /leads — lista com kanban/tabela
│   │   └── [id]/page.tsx            # /leads/[id] — perfil do lead + histórico
│   ├── fluxos/
│   │   ├── page.tsx                 # /fluxos — lista de fluxos
│   │   └── [id]/page.tsx            # /fluxos/[id] — editor de etapas
│   ├── campanhas/
│   │   ├── page.tsx                 # /campanhas
│   │   └── nova/page.tsx            # /campanhas/nova
│   ├── pedidos/
│   │   └── page.tsx                 # /pedidos (admin/operador view)
│   ├── midias/
│   │   └── page.tsx                 # /midias — biblioteca + agendamentos
│   ├── configuracoes/
│   │   ├── page.tsx                 # /configuracoes — parâmetros do bot
│   │   └── whatsapp/page.tsx        # /configuracoes/whatsapp — QR code + status
│   └── usuarios/
│       └── page.tsx                 # /usuarios — ADMIN only
│
└── (vendedor)/
    ├── layout.tsx                   # VendedorLayout (minimal)
    └── painel/
        └── page.tsx                 # /painel — painel do vendedor
```

---

## 4. Autenticação e Guards

### Tokens

```typescript
// lib/auth/tokens.ts
// Access token: localStorage com chave 'wpp_access'
// Refresh token: localStorage com chave 'wpp_refresh'
// Payload decodificado: { sub: string, email: string, role: 'ADMIN'|'OPERADOR'|'VENDEDOR' }
```

### Middleware Next.js

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('wpp_access')?.value
  const { pathname } = request.nextUrl

  if (pathname === '/login') {
    if (token && isValidToken(token)) {
      return redirectByRole(token, request)
    }
    return NextResponse.next()
  }

  if (!token || !isValidToken(token)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Vendedor só acessa /painel/*
  const role = getRole(token)
  if (role === 'VENDEDOR' && !pathname.startsWith('/painel')) {
    return NextResponse.redirect(new URL('/painel', request.url))
  }

  // Operador não acessa /usuarios
  if (role === 'OPERADOR' && pathname.startsWith('/usuarios')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon).*)'],
}
```

### Hook de autenticação

```typescript
// hooks/use-auth.ts
interface AuthStore {
  user: { id: string; nome: string; email: string; role: Role } | null
  accessToken: string | null
  isAuthenticated: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
}
```

### Interceptor Axios — refresh automático

```typescript
// lib/api/interceptors.ts
// 401 → chama POST /auth/refresh com refreshToken
// Sucesso → atualiza access token e reenvia requisição original
// Falha → logout + redirect /login
```

---

## 5. Layout Global

### AdminLayout (`(admin)/layout.tsx`)

```
┌─────────────────────────────────────────────────────────┐
│  SIDEBAR (240px)  │         MAIN CONTENT                │
│                   │  ┌──────────────────────────────┐   │
│  [Logo + nome]    │  │   HEADER (64px)              │   │
│                   │  │   [Breadcrumb] [Notif] [User]│   │
│  Nav items:       │  └──────────────────────────────┘   │
│  ○ Dashboard      │                                      │
│  ○ Leads          │         PAGE CONTENT                 │
│  ○ Produtos       │         (scroll independente)        │
│  ○ Fluxos         │                                      │
│  ○ Campanhas      │                                      │
│  ○ Pedidos        │                                      │
│  ○ Mídias         │                                      │
│  ─────────────    │                                      │
│  ○ Configurações  │                                      │
│  ○ WhatsApp       │                                      │
│  ─────────────    │                                      │
│  ○ Usuários(ADM)  │                                      │
│                   │                                      │
│  [Bot Status]     │                                      │
│  ● Conectado      │                                      │
└─────────────────────────────────────────────────────────┘
```

**Sidebar comportamento:**
- Desktop: fixa, sempre visível
- Mobile/Tablet: drawer deslizante via Sheet do shadcn
- Item ativo: fundo `brand-500/15`, borda esquerda `2px brand-500`, texto `brand-400`
- Hover: fundo `white/5`, transição `200ms ease`
- `Bot Status` no rodapé: indicador pulsante verde (conectado) ou vermelho (desconectado)
  com texto e dot animado (`animate-pulse-green`)

**Header:**
- Breadcrumb dinâmico baseado na rota atual
- Sino de notificações com badge contador (Popover com últimas 5 notificações)
- Avatar do usuário com Dropdown: "Meu perfil", "Sair"
- Indicador de ambiente (`DEV` badge laranja em desenvolvimento)

---

## 6. Página: Login

**Rota:** `/login`

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     [Lado esquerdo — 60%]     │  [Formulário — 40%]    │
│                               │                         │
│  Background: gradiente        │  Card centralizado      │
│  diagonal verde escuro        │  com blur de fundo      │
│  #09090b → #0d2818            │                         │
│                               │  Logo (ícone + nome)    │
│  Texto flutuando:             │                         │
│  "Gerencie seu bot            │  "Bem-vindo de volta"   │
│   WhatsApp com               │  Subtítulo cinza         │
│   precisão."                  │                         │
│                               │  Input: Email           │
│  3 feature cards              │  Input: Senha           │
│  animados com delay:          │  (eye toggle)           │
│  ✓ Fluxos automatizados       │                         │
│  ✓ Métricas em tempo real     │  [Entrar] (brand-500)  │
│  ✓ Disparos inteligentes      │                         │
│                               │  Mensagem de erro       │
│                               │  (shake animation)      │
│                               │                         │
└─────────────────────────────────────────────────────────┘
```

**Comportamento:**
- Formulário validado com Zod + React Hook Form
- Botão exibe spinner durante loading
- Após login bem-sucedido: redireciona por role
  - ADMIN/OPERADOR → `/dashboard`
  - VENDEDOR → `/painel`
- Erro de credenciais: card tremendo (`animate-shake`) + mensagem em vermelho
- `Enter` submete o formulário
- Persiste access/refresh tokens em localStorage

---

## 7. Dashboard Admin

**Rota:** `/dashboard` — ADMIN | OPERADOR

### 7.1 Seção de Métricas (KPI Cards)

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Pedidos Hoje    │ │  Faturamento Dia  │ │  Faturamento 7d  │ │  Faturamento 15d  │
│                  │ │                  │ │                  │ │                  │
│     ●  12        │ │   R$ 2.847,50    │ │   R$ 18.320,00   │ │   R$ 41.650,00   │
│                  │ │                  │ │                  │ │                  │
│  ↑ +3 vs ontem   │ │  ↑ +12% vs ontem │ │  ↑ +8% vs 7d ant │ │  ↑ +15% vs 15d  │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
```

**KPI Card component:**
- Fundo: `bg-zinc-900`, border `border-zinc-800`
- Ícone no canto superior direito (Lucide) com fundo `brand-500/10` e cor `brand-500`
- Valor numérico grande `text-3xl font-bold text-white`
- Delta: seta verde (↑) ou vermelha (↓) com percentual
- Skeleton loader enquanto dados carregam
- Hover: `border-brand-500/30`, transição suave

**Dados (calculados no frontend a partir de `/pedidos` + filtro):**
- Pedidos hoje: `fechado_em` com data de hoje, `status = FECHADO`
- Faturamento: soma dos `total_estimado` dos pedidos fechados no período

### 7.2 Gráfico de Linha — Faturamento (Recharts)

```typescript
// Estilo shadcn chart — usa ResponsiveContainer + LineChart
// Linha principal: brand-500 (#22c55e), área preenchida com gradiente verde
// Pontos (dots): círculo branco borda verde no hover
// Tooltip customizado: card escuro com valor formatado em BRL
// Eixo X: datas em pt-BR abreviadas ("Seg", "Ter", "18/06")
// Grid: linhas horizontais apenas, cor zinc-800
// Animação: `animationDuration={800}` com easing suave

interface ChartDataPoint {
  date: string        // "18/06"
  faturamento: number
  pedidos: number
}
// Toggle entre 7 dias / 15 dias / 30 dias via SegmentedControl acima do gráfico
```

### 7.3 Gráfico de Barras — Produtos Mais Vendidos

```typescript
// BarChart horizontal
// Mostra top 8 produtos com quantidade saída no período selecionado
// Barra cor brand-500, hover brand-600
// Label com nome truncado (max 20 chars) + quantidade à direita
// Calculado de: itens dos pedidos FECHADOS no período → group by nome do produto → sum quantidade
```

### 7.4 Seção de Status do Bot (Cards Secundários)

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Leads Ativos    │ │  Disparos Hoje   │ │  WhatsApp        │
│  (não BLOQUEADO) │ │  (pulse logs)    │ │  ● Conectado     │
│     247          │ │      38          │ │  há 3h 42min     │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### 7.5 Tabela de Últimos Pedidos

```
Título: "Pedidos Recentes"   [Ver todos →]

Colunas: ID truncado | Cliente | Tipo | Itens | Total | Status | Data
Linhas: últimos 10 pedidos ordenados por fechado_em DESC
Badge de status: ABERTO (zinc) | FECHADO (brand-500) | CANCELADO (red)
Linha clicável → abre drawer lateral com detalhes completos do pedido
```

### 7.6 Tabela de Leads por Status

```
Título: "Distribuição de Leads"

Linhas simples:
NOVO          ████████░░   142  (45%)
RESPONDEU     ███░░░░░░░    68  (21%)
ATIVO         ██░░░░░░░░    47  (15%)
INATIVO       ██░░░░░░░░    52  (16%)
BLOQUEADO     ░░░░░░░░░░     8   (3%)

Progress bar: cor brand-500 com fundo zinc-800
```

---

## 8. Módulo: Produtos e SKUs

**Rota:** `/produtos`

### 8.1 Lista de Produtos

```
Header: "Produtos"              [+ Novo Produto]

Filtros: [Categoria ▾] [Status ▾] [🔍 Buscar por nome...]

┌──────────────────────────────────────────────────────────┐
│ Nome         │ Categoria  │ Unidade │ Status │ Ações     │
│─────────────────────────────────────────────────────────│
│ Gelato 110   │ Sobremesas │ g       │ ● Ativo│ [✏️][🗑️] │
│ Gelato 220   │ Sobremesas │ g       │ ● Ativo│ [✏️][🗑️] │
└──────────────────────────────────────────────────────────┘
Paginação: < 1 2 3 ... >
```

- Linha clicável abre Sheet lateral (não redireciona) com detalhes + abas:
  **Geral** | **Tabela de Preços** | **Mídias**
- Soft delete com confirmação via Dialog: "Tem certeza? Esta ação não pode ser desfeita."
- Botão de status (ativo/inativo) toggle inline

### 8.2 Formulário Novo/Editar Produto (Sheet lateral)

```
[Aba: Geral]
  Nome do produto *
  Categoria      [combobox com busca]
  Descrição      [textarea]
  Unidade        [input — "g", "kg", "unidade"]
  Status         [Switch: Ativo/Inativo]

[Aba: Tabela de Preços]
  Tipo de cliente: [A] [B] [C]   ← tabs por tipo

  Por tipo selecionado:
  ┌─────────────────────────────────────────────┐
  │ Qtd Min │ Qtd Máx │ Preço Unit │ Desc Máx % │ [🗑️] │
  │   1     │   4     │  R$120,00  │    10%     │ [🗑️] │
  │   5     │   9     │  R$100,00  │    10%     │ [🗑️] │
  │  10     │   —     │   R$95,00  │    10%     │ [🗑️] │
  └─────────────────────────────────────────────┘
  [+ Adicionar faixa]

  Preview da tabela (como vai aparecer no WhatsApp):
  ┌────────────────────────────────────┐
  │ *Tabela de Preços - Gelato 110*   │
  │                                   │
  │ Tipo A: R$ 120.00 (min: 1g)       │
  │ Tipo A: R$ 100.00 (min: 5g)       │
  │ Tipo A: R$ 95.00 (min: 10g)       │
  └────────────────────────────────────┘

[Aba: Mídias]
  Grid de mídias vinculadas ao produto
  Upload direto com drag & drop
```

### 8.3 Categorias

**Rota:** `/categorias`

Tabela simples: Nome | Status | Ações (criar/editar inline via popover ou row editing)

---

## 9. Módulo: Leads e Contatos

**Rota:** `/leads`

### 9.1 Cabeçalho e Filtros

```
Header: "Leads"    [Importar CSV]  [+ Novo Lead]

Filtros:
[Tipo: A|B|C|Todos ▾]  [Status ▾]  [Sem cooldown ✓]  [🔍 Buscar nome/número]

Views: [≡ Lista] [⬛ Kanban]    Total: 317 leads
```

### 9.2 View: Lista (Tabela)

```
┌──────────────────────────────────────────────────────────────────┐
│  Nome       │ Número    │ Tipo │ Status      │ Último Contato │ Ações │
│─────────────────────────────────────────────────────────────────│
│ João Silva  │ 551199... │  A   │ ● RESPONDEU │ 18/06 14:30    │  [→]  │
│ Maria Souza │ 551188... │  B   │ ○ INATIVO   │ 17/06 09:15    │  [→]  │
│ Pedro Costa │ 551177... │  C   │ ● NOVO      │ —              │  [→]  │
└──────────────────────────────────────────────────────────────────┘
```

**Badges de status:**
- `NOVO` — zinc-600 (cinza neutro)
- `RESPONDEU` — blue-500/20 text-blue-400
- `INATIVO` — amber-500/20 text-amber-400
- `ATIVO` — brand-500/20 text-brand-400
- `BLOQUEADO` — red-500/20 text-red-400

### 9.3 View: Kanban por Status de Engajamento

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│   NOVO   │  │ INATIVO  │  │RESPONDEU │  │  ATIVO   │  │BLOQUEADO │
│  (142)   │  │   (52)   │  │   (68)   │  │   (47)   │  │    (8)   │
│──────────│  │──────────│  │──────────│  │──────────│  │──────────│
│ Lead Card│  │ Lead Card│  │ Lead Card│  │ Lead Card│  │ Lead Card│
│ João S.  │  │ Ana R.   │  │ Pedro C. │  │ Maria L. │  │ Bloq. X  │
│ Tipo A   │  │ Tipo B   │  │ Tipo C   │  │ Tipo A   │  │ Tipo C   │
│ 18/06    │  │ 17/06    │  │ 18/06    │  │ 15/06    │  │ 10/06    │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

Cards arrastáveis (dnd-kit) entre colunas — ao soltar chama `PATCH /contatos/:id/status`.
Cooldown ativo exibe ícone de relógio com tooltip mostrando data de liberação.

### 9.4 Perfil do Lead (`/leads/[id]`)

```
┌──────────────────────────────────────────────────────┐
│  ← Voltar              João Silva                    │
│                                                      │
│  [Avatar com inicial]  Tipo: A  |  Status: RESPONDEU │
│  551199999999                                        │
│  Cadastrado em: 01/06/2026                           │
│  Cooldown até: 19/06 08:00                           │
│                                                      │
│  [Ações rápidas:] [Alterar Tipo ▾] [Alterar Status ▾] [Bloquear] │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [Histórico de Mensagens]                            │
│                                                      │
│  18/06 14:25  → ENVIADA    "Oi João, tudo bem?..."  │
│  18/06 14:27  ← RECEBIDA   "Oi! Me manda a tabela" │
│  18/06 14:28  → ENVIADA    [IMAGEM] Tabela Preços   │
│  17/06 09:15  → ENVIADA    "Salve 👋"               │
│                                                      │
│  (últimas 50 mensagens, scroll infinito)             │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [Pedidos do Lead]                                   │
│  Lista de pedidos vinculados a este contato          │
└──────────────────────────────────────────────────────┘
```

**Timeline de mensagens:**
- Mensagens enviadas: alinhadas à direita com fundo zinc-800 e borda-left brand-500
- Mensagens recebidas: alinhadas à esquerda com fundo zinc-700
- Ícone de status: ✓ ENTREGUE, ✓✓ LIDO (verde)
- Mídias: thumbnail clicável para abrir em fullscreen

### 9.5 Importação CSV

Sheet lateral com:
1. Dropzone para arrastar/soltar CSV
2. Preview de até 5 linhas do arquivo ("Nome | Número | Tipo")
3. Mapeamento de colunas se os headers não batem exatamente
4. Botão [Importar] com progress bar durante upload
5. Resultado: "42 importados, 3 erros" com lista expandível dos erros

---

## 10. Módulo: Fluxos de Conversa

**Rota:** `/fluxos`

### 10.1 Lista de Fluxos

```
Header: "Fluxos de Conversa"    [+ Novo Fluxo]

Cards por tipo de cliente (não tabela):

┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  FLUXO TIPO A       │  │  FLUXO TIPO B       │  │  FLUXO TIPO C       │
│  "Fluxo Cliente A"  │  │  "Fluxo Premium"    │  │  "Fluxo Básico"     │
│                     │  │                     │  │                     │
│  5 etapas           │  │  4 etapas           │  │  3 etapas           │
│  ● ATIVO            │  │  ● ATIVO            │  │  ○ INATIVO          │
│                     │  │                     │  │                     │
│  [Editar] [Testar]  │  │  [Editar] [Testar]  │  │  [Editar] [Ativar]  │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐
│  FLUXO INATIVO      │  │  FLUXO BROADCAST    │
│  "Mensagem Salve"   │  │  "Broadcast Geral"  │
└─────────────────────┘  └─────────────────────┘
```

### 10.2 Editor de Fluxo (`/fluxos/[id]`)

```
Header: "Fluxo Cliente A"  [Tipo: A]  [● Ativo]    [Testar ▾] [Salvar]

┌─────────────────────────────────────────────────────────────────┐
│  Etapas (arrastáveis para reordenar via dnd-kit)               │
│                                                                 │
│  ┌─[1]──────────────────────────────────────────────────────┐  │
│  │ ≡  DELAY  │  3 segundos                              [🗑️] │  │
│  └──────────────────────────────────────────────────────────┘  │
│          ↓                                                      │
│  ┌─[2]──────────────────────────────────────────────────────┐  │
│  │ ≡  TEXTO  │  "Oi {{nome}}, tudo bem? Aqui é o..."   [🗑️] │  │
│  │           │  Preview: "Oi João, tudo bem? Aqui é o..." │  │
│  └──────────────────────────────────────────────────────────┘  │
│          ↓                                                      │
│  ┌─[3]──────────────────────────────────────────────────────┐  │
│  │ ≡  DELAY  │  5 segundos                              [🗑️] │  │
│  └──────────────────────────────────────────────────────────┘  │
│          ↓                                                      │
│  ┌─[4]──────────────────────────────────────────────────────┐  │
│  │ ≡  TABELA_PRECO │ Produto: Gelato 110               [🗑️] │  │
│  │  Preview:                                                │  │
│  │  *Tabela de Preços - Gelato 110*                         │  │
│  │  Tipo A: R$ 120.00 (min: 1g)                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│          ↓                                                      │
│  ┌─[5]──────────────────────────────────────────────────────┐  │
│  │ ≡  MÍDIA  │ [thumbnail] foto-produto.jpg  caption:... [🗑️] │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [+ Adicionar Etapa ▾]                                          │
│     → DELAY | TEXTO | MÍDIA | TABELA DE PREÇO                  │
└─────────────────────────────────────────────────────────────────┘
```

**Edição de etapa:** clicando na etapa ela expande com formulário inline.
- TEXTO: textarea com chips de variáveis clicáveis `{{nome}}` `{{tipoCliente}}` `{{dataHoje}}`
- DELAY: slider + input numérico (segundos)
- MÍDIA: seletor de mídia da biblioteca (modal) ou upload direto
- TABELA_PRECO: combobox de seleção de produto

**Testar fluxo:** dropdown "Selecionar lead para teste" → executa `POST /fluxos/:id/testar/:contatoId`
e exibe modal com log de execução em tempo real (lista animada de resultados).

---

## 11. Módulo: Campanhas

**Rota:** `/campanhas`

### 11.1 Lista de Campanhas

```
Header: "Campanhas"    [+ Nova Campanha]

Filtros: [Status ▾]   [Tipo ▾]

┌────────────────────────────────────────────────────────────────┐
│ Nome          │ Tipo      │ Alvo │ Status        │ Enviados │ Ações │
│───────────────────────────────────────────────────────────────│
│ Promoção Seg  │ AGENDADO  │  A   │ ⏰ AGENDADO   │  0/142  │  [⋯]  │
│ Salve Família │ IMEDIATO  │ ALL  │ ✅ CONCLUIDO  │ 89/89   │  [⋯]  │
│ Rascunho Ver  │ IMEDIATO  │  B   │ 📝 RASCUNHO   │   —     │  [⋯]  │
└────────────────────────────────────────────────────────────────┘
```

### 11.2 Nova Campanha (Page ou Sheet)

```
Seção 1: Informações Básicas
  Nome da campanha *
  Tipo: [○ Imediato] [○ Agendado]
  Se Agendado: DateTimePicker para agendado_para

Seção 2: Mensagem
  Textarea *
  [Ou adicionar mídia] → seletor da biblioteca

Seção 3: Segmentação
  Tipo de cliente alvo: [○ Todos] [○ Apenas A] [○ Apenas B] [○ Apenas C]
  Status alvo: [select múltiplo]

Seção 4: Preview + Estimativa
  Preview da mensagem no estilo bolha do WhatsApp
  "Estimativa: ~142 destinatários"

[Salvar como Rascunho]   [Disparar Agora]
```

### 11.3 Detalhes da Campanha

Drawer lateral com:
- Informações gerais
- Progress bar de envio (enviados / total)
- Lista de entregas com status por lead (paginada)
- Botão Cancelar (se AGENDADO ou EM_ANDAMENTO)

---

## 12. Módulo: Mídia

**Rota:** `/midias`

```
Header: "Biblioteca de Mídias"    [Upload de Arquivo]

Tabs: [Todas] [Imagens] [Vídeos] [Áudios] [Documentos]

Grid 4 colunas:
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ [thumb]  │  │ [thumb]  │  │ [🎵 icon]│  │ [📄 icon]│
│          │  │          │  │          │  │          │
│ foto.jpg │  │ video.mp4│  │ audio.mp3│  │ cat.pdf  │
│ 2.4 MB   │  │ 8.1 MB   │  │ 512 KB   │  │ 1.2 MB   │
│ [🗑️][📅] │  │ [🗑️][📅] │  │ [🗑️][📅] │  │ [🗑️][📅] │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

- [📅] = agendar entrega para um lead → Sheet com campos: lead (combobox), data/hora, caption
- Upload: Dropzone com progress animado, validação de tamanho e tipo

**Entregas Agendadas:** Tab separada na mesma página
```
┌───────────────────────────────────────────────────┐
│ Mídia      │ Contato     │ Agendado Para │ Status  │
│────────────────────────────────────────────────────│
│ foto.jpg   │ João Silva  │ 19/06 10:00   │⏰ PEND │
│ audio.mp3  │ Maria Souza │ 20/06 08:00   │✅ ENV  │
└───────────────────────────────────────────────────┘
```

---

## 13. Módulo: Pedidos (Admin/Operador)

**Rota:** `/pedidos`

```
Header: "Pedidos"

Filtros: [Status ▾] [Tipo Cliente ▾] [Período ▾]

┌───────────────────────────────────────────────────────────────────┐
│ # │ Cliente    │ Tipo │ Itens │ Total     │ Status    │ Fechado em │
│───────────────────────────────────────────────────────────────────│
│ 1 │ João Silva │  A   │   2   │ R$ 340,00 │ ✅ FECHADO│ 18/06 14h │
│ 2 │ Ana Rita   │  B   │   1   │ R$ 120,00 │ 🔵 ABERTO │     —     │
└───────────────────────────────────────────────────────────────────┘
```

Linha clicável → Drawer lateral com:
- Detalhes completos do pedido
- Lista de itens com preço unitário, quantidade, desconto
- Botão [Fechar Pedido] (se ABERTO) → confirmação → `PATCH /pedidos/:id/fechar`
- Botão [Cancelar] (se ABERTO)
- Botão [Renotificar Vendedor] (se FECHADO e notificado_em preenchido)

---

## 14. Configurações do Bot

**Rota:** `/configuracoes`

```
Header: "Configurações do Bot"    [Salvar Alterações]

┌─────────────────────────────────────────────────────────┐
│  PULSE — Disparo Automático                             │
│  ─────────────────────────────────────────────          │
│  Bot ativo:          [Switch ● ON]                      │
│  Intervalo (min):    [────●────]  5   [input]           │
│  Máx contatos/ciclo: [input]      5                     │
│  Cooldown (horas):   [input]     24                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  BROADCAST                                              │
│  ─────────────────────────────────────────────          │
│  Delay entre envios (ms): [input]  3000                 │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  VENDEDOR                                               │
│  ─────────────────────────────────────────────          │
│  Nome do Vendedor:    [input]  Vendedor                 │
│  Número WhatsApp:     [input]  55119...                 │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  UPLOADS                                                │
│  Tamanho máximo (MB): [input]  50                       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  FLUXOS                                                 │
│  Delay padrão (seg):  [input]   3                       │
└─────────────────────────────────────────────────────────┘
```

**Comportamento:**
- Cada parâmetro chama individualmente `PATCH /parametros/:chave` ao sair do campo (onBlur)
  ou ao pressionar Enter, com feedback toast "Parâmetro salvo" ou "Erro ao salvar"
- Switch do bot ativo atualiza imediatamente com optimistic update
- Sliders para intervalos com debounce de 800ms antes de salvar
- Indicador visual de "salvando..." por campo (spinner pequeno ao lado)

---

## 15. Status da Instância WhatsApp

**Rota:** `/configuracoes/whatsapp`

```
Header: "Instância WhatsApp"

┌──────────────────────────────────────────────────────┐
│  Status da Conexão                                   │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  [●] CONECTADO                               │    │
│  │  Instância: minha-instancia                  │    │
│  │  Desde: 18/06/2026 às 10:32                  │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  [Verificar Status]  [Desconectar e Reconectar]      │
│                                                      │
├──────────────────────────────────────────────────────┤
│  QR Code para Reconexão                              │
│                                                      │
│  ┌─────────────────────┐                            │
│  │  [QR Code Image]    │  Escaneie com o WhatsApp   │
│  │   (200x200)         │  para conectar a instância │
│  └─────────────────────┘                            │
│                                                      │
│  [Gerar novo QR Code]   (polling a cada 30s)         │
└──────────────────────────────────────────────────────┘
```

**Comportamento:**
- Status: polling `GET /evolution/status` a cada 30 segundos
- QR Code: exibido via `GET /evolution/qrcode` em tag `<img>` com `src` como base64 ou URL
- Badge pulsante verde quando conectado, vermelho quando desconectado
- Toast alert se status mudar de CONECTADO para DESCONECTADO

---

## 16. Painel do Vendedor

**Rota:** `/painel` — VENDEDOR only

### 16.1 Layout do Vendedor

```
┌────────────────────────────────────────────────────────────────────┐
│  HEADER: Logo + "Painel do Vendedor — Carlos"   [🔔 2]  [Sair]    │
│──────────────────────────────────────────────────────────────────── │
│                                                                    │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  MÉTRICAS DO DIA (simplificado)                               │ │
│  │  [Pedidos Hoje: 4] [Meu Faturamento Hoje: R$ 1.240,00]       │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  CENTRAL DE PEDIDOS — Live                              [🔴]  │ │
│  │                                                               │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐│ │
│  │  │  NOVOS       │  │  EM ABERTO   │  │  CONCLUÍDOS HOJE     ││ │
│  │  │  [BADGE: 1]  │  │  [BADGE: 2]  │  │  [BADGE: 4]          ││ │
│  │  │              │  │              │  │                        ││ │
│  │  │ [OrderCard]  │  │ [OrderCard]  │  │ [OrderCard concluído] ││ │
│  │  │ 🆕 animado   │  │ [OrderCard]  │  │ [OrderCard concluído] ││ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘│ │
│  └───────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### 16.2 Order Card (Componente Central)

```
┌──────────────────────────────────────────────────────┐
│  🛒 Novo Pedido                   18/06 14:30        │
│  ─────────────────────────────────────────────────── │
│  Cliente: João Silva (Tipo A)                        │
│                                                      │
│  Itens:                                              │
│  • Gelato 110 — 10g — R$ 85,50  (10% desc.)         │
│  • Gelato 220 — 5g  — R$ 60,00  (5% desc.)          │
│                                                      │
│  Total estimado: R$ 145,50                           │
│  ─────────────────────────────────────────────────── │
│            [✅ Marcar como Visto]                    │
└──────────────────────────────────────────────────────┘
```

**Regras do card:**
- NUNCA exibe número de telefone do cliente (conforme requisito do backend)
- Exibe apenas: nome do cliente, tipo (A/B/C), itens, preço, total
- Card entra com animação `animate-slide-in-right` + som de notificação (opcional, toggle)
- Borda esquerda verde pulsante nos pedidos novos (`animate-pulse-green`)
- "Marcar como Visto" move o card para coluna "EM ABERTO" (não fecha o pedido, apenas
  indica que o vendedor viu — controle local no frontend via Zustand)

### 16.3 Notificação de Novo Pedido

```
Fluxo de chegada de pedido:
1. Polling GET /pedidos?status=ABERTO a cada 30s
2. Novo pedido detectado (id não estava no set anterior)
3. → Toast no canto inferior direito (Sonner):
   "🛒 Novo pedido! João Silva — R$ 145,50"
   Duração: 8 segundos, clicável para scroll até o card
4. → Card aparece na coluna NOVOS com animação slide-in
5. → Badge no sino incrementa
6. → (Opcional) som de notificação via Web Audio API (ding)
```

### 16.4 Histórico de Pedidos do Vendedor

Abaixo das colunas, tabela colapsável "Pedidos Anteriores":
```
[▼ Pedidos Anteriores] — Últimos 30 dias

Filtros: [Período ▾]  [Status ▾]

Tabela: # | Cliente | Tipo | Total | Status | Data
(sem número de telefone)
```

### 16.5 Recursos Exclusivos do Painel do Vendedor

**Notificação sonora (opt-in):**
- Toggle no header: [🔔 Som: ON/OFF]
- Web Audio API gera beep simples ao detectar novo pedido
- Preference salva em localStorage

**Contador regressivo de inatividade:**
- Se não há novo pedido há mais de 2h, exibe banner:
  `"Nenhum pedido novo nas últimas 2h. Bot ativo e monitorando. ⏱️"`

**Modo foco (full-screen):**
- Botão ⛶ no header → expande coluna NOVOS para tela cheia
- Útil quando o vendedor está com o painel aberto num monitor dedicado

**Estatísticas do vendedor (card no topo):**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Pedidos Hoje │  │  Fat. Hoje   │  │  Fat. 7 dias │
│      4       │  │ R$ 1.240,00  │  │ R$ 8.720,00  │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 17. Camada de API (Cliente HTTP)

```typescript
// lib/api/client.ts
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: injeta Authorization header
// Response interceptor: desempacota { success, data } → retorna data diretamente
// Error interceptor: 401 → refresh ou logout
```

```typescript
// lib/api/endpoints/
//   auth.ts        — login, refresh, me
//   contacts.ts    — CRUD + importar-csv + historico
//   products.ts    — CRUD produtos + categorias + tabela-preco
//   flows.ts       — CRUD fluxos + etapas + testar
//   campaigns.ts   — CRUD campanhas + disparar + parametros
//   orders.ts      — CRUD pedidos + fechar + cancelar + renotificar
//   media.ts       — upload + entregas-agendadas
//   evolution.ts   — status + connect + qrcode
```

```typescript
// Exemplo: contacts.ts
export const contactsApi = {
  list: (params: QueryContactsDto) =>
    apiClient.get<PaginatedResponse<Contato>>('/contatos', { params }),
  create: (dto: CreateContactDto) =>
    apiClient.post<Contato>('/contatos', dto),
  update: (id: string, dto: UpdateContactDto) =>
    apiClient.patch<Contato>(`/contatos/${id}`, dto),
  remove: (id: string) =>
    apiClient.delete(`/contatos/${id}`),
  importCsv: (file: File) => {
    const form = new FormData()
    form.append('arquivo', file)
    return apiClient.post('/contatos/importar-csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  historico: (id: string) =>
    apiClient.get(`/contatos/${id}/historico`),
}
```

---

## 18. Gerenciamento de Estado

### Zustand Stores

```typescript
// store/auth.store.ts
interface AuthState {
  user: User | null
  accessToken: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

// store/notifications.store.ts
interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  add: (n: Notification) => void
  markAllRead: () => void
}

// store/orders.store.ts (vendedor)
interface OrderState {
  seenOrderIds: Set<string>   // persisted in localStorage
  markSeen: (id: string) => void
  isNew: (id: string) => boolean
}

// store/bot-status.store.ts
interface BotStatusState {
  connected: boolean
  lastChecked: Date | null
  setStatus: (connected: boolean) => void
}
```

### TanStack Query

```typescript
// Queries reutilizáveis com cache keys padronizadas
// hooks/queries/use-contacts.ts
export function useContacts(params: QueryContactsDto) {
  return useQuery({
    queryKey: ['contacts', params],
    queryFn: () => contactsApi.list(params),
    staleTime: 30_000,
  })
}

// hooks/queries/use-orders.ts
export function useOrders(params?: QueryOrdersDto) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => ordersApi.list(params),
    refetchInterval: 30_000,  // polling para painel do vendedor
  })
}
```

---

## 19. Notificações em Tempo Real

**Estratégia:** Polling com `refetchInterval` via TanStack Query.
O backend atual não implementa WebSocket/SSE — polling é suficiente para o volume do sistema.

```typescript
// Polling por domínio
// Pedidos (painel vendedor): a cada 30s
// Status WhatsApp: a cada 30s
// Parâmetros: sem polling (dados estáticos até edição)
// Leads: sem polling (lista gerenciada ativamente)

// Detecção de novidade (painel vendedor)
const { data: orders } = useOrders({ status: 'ABERTO' })

useEffect(() => {
  if (!orders?.data) return
  const newOrders = orders.data.filter(o => !seenOrderIds.has(o.id))
  if (newOrders.length > 0) {
    newOrders.forEach(o => {
      toast(`🛒 Novo pedido! ${o.contato?.nome} — R$ ${o.totalEstimado}`, {
        duration: 8000,
        action: { label: 'Ver', onClick: () => scrollToCard(o.id) }
      })
      if (soundEnabled) playNotificationSound()
    })
  }
}, [orders])
```

```typescript
// Web Audio API — som de notificação
function playNotificationSound() {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = 880
  gain.gain.setValueAtTime(0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
  osc.start()
  osc.stop(ctx.currentTime + 0.4)
}
```

**Notification Center (sino no header):**
- Popover com últimas 10 notificações persistidas no `notifications.store.ts`
- Tipos: `ORDER_NEW`, `BOT_DISCONNECTED`, `CAMPAIGN_DONE`, `PARAM_SAVED`
- Badge vermelho com contagem de não lidas
- "Marcar todas como lidas" no rodapé do popover

---

## 20. Componentes Globais Reutilizáveis

### `<DataTable>` — Tabela com paginação e ordenação

```typescript
interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  isLoading?: boolean
  onRowClick?: (row: T) => void
}
// Skeleton rows durante loading (5 linhas com shimmer)
// Linha hover: bg-zinc-800/50
```

### `<StatusBadge>` — Badge de status reutilizável

```typescript
interface StatusBadgeProps {
  status: 'NOVO' | 'RESPONDEU' | 'INATIVO' | 'ATIVO' | 'BLOQUEADO'
         | 'ABERTO' | 'FECHADO' | 'CANCELADO'
         | 'RASCUNHO' | 'AGENDADO' | 'EM_ANDAMENTO' | 'CONCLUIDO'
         | 'ATIVO_GERAL' | 'INATIVO_GERAL'  // para produtos/categorias
}
// Mapa de status → { bg, text, dot, label }
```

### `<KpiCard>` — Card de métrica

```typescript
interface KpiCardProps {
  title: string
  value: string | number
  delta?: { value: number; label: string }  // ex: { value: 12, label: 'vs ontem' }
  icon: LucideIcon
  isLoading?: boolean
  format?: 'number' | 'currency' | 'percent'
}
```

### `<PageHeader>` — Cabeçalho de página

```typescript
interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumb?: { label: string; href?: string }[]
}
```

### `<ConfirmDialog>` — Dialog de confirmação destrutiva

```typescript
interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string  // padrão "Confirmar"
  variant?: 'destructive' | 'default'
  onConfirm: () => void | Promise<void>
}
```

### `<EmptyState>` — Estado vazio

```typescript
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}
```

### `<WhatsAppBubble>` — Preview de mensagem WhatsApp

```typescript
// Renderiza o preview de como a mensagem vai aparecer no WhatsApp
// Fundo verde claro (#dcf8c6), cantos arredondados, fonte similar
// Suporta: texto, imagem thumbnail, áudio (barra de progresso decorativa)
interface WhatsAppBubbleProps {
  direction: 'sent' | 'received'
  content: string
  mediaUrl?: string
  mediaType?: 'IMAGEM' | 'VIDEO' | 'AUDIO'
  timestamp?: string
  status?: 'ENTREGUE' | 'LIDO'
}
```

---

## 21. Animações e Microinterações

### Princípios

- Rápidas (100ms–400ms) — nunca bloquear interação
- Significativas — refletem hierarquia e estado
- Respeitam `prefers-reduced-motion` via `motion.div` do Framer Motion

### Catálogo de animações

```typescript
// variants para Framer Motion
export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
}

export const slideInRight = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

export const staggerChildren = {
  animate: { transition: { staggerChildren: 0.05 } },
}
```

### Uso por componente

| Componente | Animação |
|---|---|
| KPI Cards ao carregar | `fadeUp` com stagger de 0.05s por card |
| Novo order card (vendedor) | `slideInRight` + border pulse |
| Drawer/Sheet abrindo | shadcn padrão (slide from right) |
| Toast notification | Sonner padrão (slide up from bottom) |
| Etapas do fluxo ao reordenar | dnd-kit com transform CSS nativo |
| Skeleton → conteúdo | opacity 0→1 `fadeIn` 200ms |
| Linha da tabela hover | `bg` transition 150ms |
| Botão clicado | `scale(0.97)` 100ms + revert |
| Switch do bot | thumb slide + cor background 200ms |
| Badge de status | sem animação (estático, legibilidade) |

---

## 22. Responsividade

### Breakpoints (Tailwind)

```
sm:  640px   — smartphones landscape
md:  768px   — tablets
lg:  1024px  — notebooks / tablets grandes
xl:  1280px  — desktops
2xl: 1536px  — monitores largos
```

### Comportamento por tamanho de tela

| Componente | Mobile (<768) | Tablet (768–1024) | Desktop (>1024) |
|---|---|---|---|
| Sidebar | Drawer (Sheet) | Colapsável (icons) | Fixa 240px |
| KPI Cards | 1 coluna | 2 colunas | 4 colunas |
| Tabelas | Scroll horizontal + cards | Scroll horizontal | Tabela completa |
| Kanban Leads | 1 coluna scroll | 2–3 colunas | 5 colunas |
| Fluxo editor | Stack vertical | Stack vertical | Layout atual |
| Painel vendedor | Colunas empilhadas | 2 colunas | 3 colunas |
| Charts | Altura reduzida (200px) | Altura normal (280px) | 350px |

### Mobile-first no painel do vendedor

O painel do vendedor deve funcionar excepcionalmente bem em smartphones, pois o vendedor
pode usar pelo celular. Prioridades mobile:
- Cards grandes e fáceis de tocar (min 48px de altura de toque)
- Notificação como Push Web (PWA opcional) ou Toast proeminente
- Scroll vertical simples: NOVOS → EM ABERTO → CONCLUÍDOS
- Botão "Marcar como Visto" grande e com cor de destaque

---

## 23. Guia de Inicialização

### Estrutura de diretórios

```
frontend/                    (ou wpp-autoflow-panel/)
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (admin)/layout.tsx
│   │   ├── (admin)/dashboard/page.tsx
│   │   ├── (admin)/produtos/...
│   │   ├── (admin)/leads/...
│   │   ├── (admin)/fluxos/...
│   │   ├── (admin)/campanhas/...
│   │   ├── (admin)/pedidos/page.tsx
│   │   ├── (admin)/midias/page.tsx
│   │   ├── (admin)/configuracoes/page.tsx
│   │   ├── (admin)/configuracoes/whatsapp/page.tsx
│   │   ├── (admin)/usuarios/page.tsx
│   │   └── (vendedor)/painel/page.tsx
│   │
│   ├── components/
│   │   ├── ui/              ← shadcn/ui (auto-gerado)
│   │   ├── layout/
│   │   │   ├── admin-sidebar.tsx
│   │   │   ├── admin-header.tsx
│   │   │   └── vendedor-header.tsx
│   │   ├── shared/
│   │   │   ├── data-table.tsx
│   │   │   ├── status-badge.tsx
│   │   │   ├── kpi-card.tsx
│   │   │   ├── page-header.tsx
│   │   │   ├── confirm-dialog.tsx
│   │   │   ├── empty-state.tsx
│   │   │   └── whatsapp-bubble.tsx
│   │   ├── dashboard/
│   │   ├── leads/
│   │   ├── produtos/
│   │   ├── fluxos/
│   │   ├── campanhas/
│   │   ├── pedidos/
│   │   ├── midias/
│   │   └── vendedor/
│   │       ├── order-card.tsx
│   │       ├── order-columns.tsx
│   │       └── notification-sound.tsx
│   │
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-notification-sound.ts
│   │   └── queries/
│   │       ├── use-contacts.ts
│   │       ├── use-orders.ts
│   │       ├── use-products.ts
│   │       └── ...
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   └── endpoints/
│   │   ├── auth/
│   │   │   └── tokens.ts
│   │   └── utils/
│   │       ├── format-currency.ts
│   │       ├── format-date.ts
│   │       └── cn.ts          ← clsx + tailwind-merge
│   │
│   ├── store/
│   │   ├── auth.store.ts
│   │   ├── notifications.store.ts
│   │   ├── orders.store.ts
│   │   └── bot-status.store.ts
│   │
│   └── middleware.ts
│
├── public/
├── next.config.ts
├── tailwind.config.ts
├── components.json          ← shadcn config
└── .env.local
```

### Passos de inicialização

```bash
# 1. Criar projeto
npx create-next-app@latest wpp-autoflow-panel \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd wpp-autoflow-panel

# 2. Instalar dependências
npm install \
  axios \
  @tanstack/react-query \
  zustand \
  framer-motion \
  recharts \
  sonner \
  date-fns \
  react-hook-form \
  zod \
  @hookform/resolvers \
  react-dropzone \
  @dnd-kit/core \
  @dnd-kit/sortable \
  @dnd-kit/utilities \
  lucide-react \
  clsx \
  tailwind-merge \
  geist

# 3. Configurar shadcn/ui
npx shadcn@latest init
# → style: default, base color: zinc, CSS variables: yes

# Instalar componentes shadcn
npx shadcn@latest add button card badge input label select \
  checkbox switch textarea dialog drawer sheet dropdown-menu \
  context-menu table tabs separator skeleton avatar progress \
  tooltip popover chart command pagination

# 4. Configurar variáveis de ambiente
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=wpp-autoflow
EOF

# 5. Iniciar desenvolvimento
npm run dev -- --port 4000
```

### Ordem de implementação sugerida

| Prioridade | Módulo | Razão |
|---|---|---|
| 1 | Auth (login + middleware) | Base de tudo |
| 2 | Layout Admin (sidebar + header) | Shell necessário |
| 3 | Dashboard (KPIs + gráficos) | Alto impacto visual |
| 4 | Leads/Contatos | Módulo mais usado |
| 5 | Painel do Vendedor | Valor imediato para usuário final |
| 6 | Configurações do Bot | Crítico para operação |
| 7 | Produtos e SKUs | Frequente, mas menos urgente |
| 8 | Fluxos de Conversa | Complexo, mas importante |
| 9 | Campanhas | Disparo manual |
| 10 | Mídias | Suporte |
| 11 | WhatsApp Status | Admin técnico |
| 12 | Usuários (admin) | Raramente acessado |

---

*Slice frontend gerado em 2026-06-18 — consome a API descrita em TECHNICAL_DOCS.md.*
*Design pensado para operação desktop-first com suporte mobile completo no painel do vendedor.*
