# wpp-autoflow (monorepo temporário)

Sistema de automação de vendas via WhatsApp: simula atendimento humano, segmenta clientes por perfil (A/B/C), dispara campanhas/mensagens via Evolution API, gerencia fluxos de conversa, produtos, pedidos e mídias, e notifica o vendedor quando um pedido é fechado (sem expor o número do cliente).

> **⚠️ Este monorepo é arranjo temporário, não a arquitetura final.** `backend/` e `frontend/` foram colocados lado a lado apenas para facilitar o agente trabalhar nos dois projetos na mesma sessão. Eles são (e voltarão a ser) dois projetos/repositórios separados — não assumir imports cruzados, deploy conjunto, CI compartilhado ou versionamento único como definitivos. Ao planejar infraestrutura, pipelines ou onde algo "deveria viver", considerar que essa junção será desfeita.

## Estrutura
```
wpp-autoflow/
├── backend/     # API NestJS — ver backend/CLAUDE.md
└── frontend/    # Painel React (TanStack Start) — ver frontend/CLAUDE.md
```

Cada pasta tem seu próprio `CLAUDE.md` (índice enxuto) e `docs/` (documentação profunda por feature). Este arquivo raiz cobre apenas o que é comum às duas stacks.

## Stack resumida
- **Backend**: NestJS 11 + TypeScript + Drizzle ORM + PostgreSQL + BullMQ/Redis + MinIO + Evolution API (WhatsApp) — detalhes em `backend/CLAUDE.md`.
- **Frontend**: React 19 + TanStack Router/Query + Tailwind + shadcn/ui — detalhes em `frontend/CLAUDE.md`.
- Comunicação: frontend consome a API do backend em `http://localhost:3000` (ver `frontend/src/lib/api.ts`).

## Subindo o ambiente local
```
cd backend
docker compose up -d postgres redis minio evolution-api
cp .env.example .env
npm run db:generate && npm run db:migrate && npm run db:seed
npm run start:dev

cd ../frontend
bun install   # ou npm install
bun dev       # ou npm run dev
```

## Convenções gerais
- Não é repositório git ainda. Quando o versionamento for iniciado, avaliar se cada stack volta a ter seu próprio repositório (arranjo original) — não presumir que o monorepo atual é o destino final.
- Documentação de feature deve morar em `docs/` da stack correspondente, não solta na raiz — há arquivos duplicados legados (`CAMPANHAS_AUTOMACAO_SLICE.md`, `CAMPANHA_RECORRENTE_*`, `BREAKING_CHANGES_FRONTEND.md`) tanto na raiz de `backend/` quanto de `frontend/` que ainda precisam ser conciliados/removidos.
- Ao adicionar uma feature nova, atualizar o `CLAUDE.md` da stack correspondente (não este arquivo raiz) com o apontamento para o novo doc em `docs/`.

<!--
ESPAÇO RESERVADO — preencher com o resumo do backend (estrutura de pastas, slices/módulos implementados,
convenções e comandos essenciais), no mesmo formato enxuto usado acima para o frontend.
Ver contexto já levantado em backend/ (BREAKING_CHANGES_FRONTEND.md, docs/, memória de projeto) antes de escrever.
-->

## Backend
_(a preencher)_

## Links úteis
- `backend/CLAUDE.md` — índice do backend
- `frontend/CLAUDE.md` — índice do frontend
