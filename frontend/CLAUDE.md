# Frontend — wpp-autoflow

Painel web do sistema de automação de vendas via WhatsApp. Consome a API do `../backend` (NestJS) para gerenciar contatos, campanhas, fluxos de conversa, produtos, pedidos e mídias.

## Stack
- React 19 + TypeScript 5 + Vite 8
- TanStack Start / TanStack Router (roteamento file-based) + TanStack Query (data fetching/cache)
- Tailwind CSS 4 + shadcn/ui (Radix primitives em `src/components/ui`)
- React Hook Form + Zod para formulários/validação
- Gerenciador de pacotes: Bun (ver `bun.lock`) — `npm install` também funciona via `package-lock.json`

## Estrutura de pastas
```
src/
├── routes/           # rotas file-based (TanStack Router). Prefixo `_app.*` = páginas autenticadas dentro do layout
│   ├── __root.tsx    # layout raiz
│   ├── _app.tsx      # layout autenticado (sidebar/header)
│   ├── login.tsx, index.tsx, painel.tsx
│   └── _app.{campanhas,dashboard,fluxos,leads,midias,pedidos,produtos,tabelas,usuarios,configuracoes...}.tsx
├── components/
│   ├── app/          # componentes de domínio (sidebar, header, whatsapp-preview, badges)
│   └── ui/           # componentes shadcn/ui (Radix + CVA)
├── lib/
│   ├── api.ts         # cliente HTTP: token JWT em memória, refresh automático com deduplicação de fila
│   ├── auth.tsx        # contexto de autenticação
│   ├── queries.ts       # hooks TanStack Query por recurso
│   ├── mock-data.ts      # dados mock (usados antes da API estar disponível — checar se ainda em uso)
│   └── utils.ts
└── hooks/use-mobile.tsx
```

Pastas `dist/`, `.tanstack/`, `.vite/`, `.lovable/` são geradas/scaffold (Lovable.dev) — não editar manualmente.
`front-wpp/` na raiz é um vault Obsidian solto, não faz parte do código do app.

## Comandos essenciais
```
bun install        # ou npm install
bun dev            # ou npm run dev — vite dev server
npm run build      # build de produção
npm run lint       # eslint .
npm run format     # prettier --write .
```

## Convenções
- Rotas seguem convenção de arquivo do TanStack Router: `_app.<nome>.tsx` vira uma página dentro do layout autenticado; ver `src/routes/README.md` para detalhes da convenção.
- `src/lib/api.ts` é o único ponto de acesso HTTP ao backend — não fazer `fetch` direto nos componentes. Token de acesso fica em memória (não em localStorage) e o refresh é enfileirado para evitar chamadas concorrentes.
- Componentes de UI genéricos vão em `components/ui` (shadcn); componentes específicos do domínio do produto vão em `components/app`.
- Backend roda em `http://localhost:3000` por padrão (ver `BASE_URL` em `lib/api.ts`).

## Docs profundos
Para contexto de features específicas, ver `docs/`:
- `docs/BREAKING_CHANGES_FRONTEND.md` — mudanças de contrato da API que exigem ajuste no front
- `docs/SCRIPT_SALVE_SLICE.md` — **definição vigente** dos scripts de automação (tipo "Salve"): seletor de tipo de script no modal de campanha, mensagem de salve, intervalos de 10 min+ (doc canônico das duas stacks, inclui checklist backend)
- `docs/ROTEAMENTO_INSTANCIAS.md` — regra de qual instância Evolution dispara cada envio (por starLevel do lead, fallback Shelby), tela de roteamento em Configurações → WhatsApp e registro do incidente de 2026-07-15
- `docs/CAMPANHA_RECORRENTE_API_PRONTA.md` — API de campanhas recorrentes pronta para consumo (base do script Salve)
- `docs/CAMPANHA_RECORRENTE_LISTA_PRODUTOS_SLICE.md` — slice original da campanha recorrente (implementado; superado em parte pelo SCRIPT_SALVE_SLICE)
- `docs/frontend-spec-star-level-e-tabela-precos.md` — spec de nível estrela e tabela de preços

Há também `CAMPANHAS_AUTOMACAO_SLICE.md` solto na raiz do frontend — duplicado de um arquivo já presente em `docs/`; considerar remover a cópia da raiz.
