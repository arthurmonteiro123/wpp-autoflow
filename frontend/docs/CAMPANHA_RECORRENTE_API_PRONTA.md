# Backend pronto — Campanha Recorrente com Lista de Produtos

> Status: ✅ implementado, testado e buildado. Falta só reiniciar o processo em produção
> (ver seção "Atenção antes de integrar" no fim).
> Referência de design: `CAMPANHA_RECORRENTE_LISTA_PRODUTOS_SLICE.md`
> **Evolução pendente**: `SCRIPT_SALVE_SLICE.md` altera 2 comportamentos descritos aqui —
> `message` passa a ser aceita no RECORRENTE (comportamento 4 abaixo deixa de valer) e
> `repeatIntervalMinutes` ganha piso oficial de 10 min.
>
> ⚠️ **Superado em 2026-07-16**: `productIds` foi removido do contrato abaixo. A campanha
> recorrente não guarda mais uma lista curada de produtos — a cada ciclo ela puxa
> automaticamente todos os produtos ativos com preço cadastrado no tier do lead (ver
> `src/jobs/recurring-campaign.repository.ts` `findActiveProductsWithPrices`). O envio de
> fotos automático também foi removido; mídia só sai sob pedido explícito do lead, via bot
> de IA. Restante deste doc mantido como registro histórico do contrato original.

---

## O que foi feito

Nenhuma rota nova — a funcionalidade inteira entra pelos endpoints de campanha que já
existem. O que muda é o `type` aceito e o formato do body quando `type = "RECORRENTE"`.

**Arquivos criados:**
- `drizzle/migrations/0005_nappy_squadron_sinister.sql` — migration aplicada no banco
- `src/jobs/campaign-catalog.util.ts` — monta o texto do catálogo e mapeia estrela do lead → estrela do produto
- `src/jobs/recurring-campaign.repository.ts`
- `src/jobs/recurring-campaign.job.ts` — processor que roda a cada ciclo

**Arquivos alterados:**
- `drizzle/schema/campaigns.schema.ts` — novo valor de enum `RECORRENTE`, colunas novas em `campanha_broadcast`, tabela nova `campanha_produto`
- `src/modules/campaigns/dto/create-campaign.dto.ts`
- `src/modules/campaigns/campaigns.service.ts`
- `src/modules/campaigns/campaigns.repository.ts`
- `src/modules/campaigns/campaigns.module.ts`
- `src/app.module.ts`

---

## Contrato da API

### `POST /campanhas` — criar campanha recorrente

```typescript
{
  name: string                      // obrigatório
  type: "RECORRENTE"                // obrigatório

  targetStarRating?: "1" | "2" | "3"   // omitido = todos os leads
  targetStatus?: string                 // igual já existia (filtro extra opcional)

  startAt: string          // ISO 8601 — obrigatório
  endAt: string             // ISO 8601, deve ser > startAt — obrigatório
  repeatIntervalMinutes: number   // ex: 1440 = reenvia 1x por dia — obrigatório
  productIds: string[]      // UUIDs de produtos já cadastrados — obrigatório, mínimo 1
}
```

**`message`, `mediaUrl`, `mediaType` não devem ser enviados** (são ignorados) — o conteúdo é
gerado automaticamente a cada ciclo a partir dos produtos.

Exemplo real testado:

```bash
curl -X POST http://localhost:3000/campanhas \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "Catálogo semanal — estrela 3",
    "type": "RECORRENTE",
    "targetStarRating": "3",
    "startAt": "2026-07-09T09:00:00.000Z",
    "endAt": "2026-07-16T23:59:00.000Z",
    "repeatIntervalMinutes": 1440,
    "productIds": ["410b49b7-429f-44d1-a479-972d6cd84ef3"]
  }'
```

Resposta (201):

```json
{
  "success": true,
  "data": {
    "id": "bb106beb-317c-4090-8fc6-c4c692d5af26",
    "name": "Catálogo semanal — estrela 3",
    "type": "RECORRENTE",
    "targetStarRating": "3",
    "targetStatus": null,
    "campaignStatus": "EM_ANDAMENTO",
    "startAt": "2026-07-09T09:00:00.000Z",
    "endAt": "2026-07-16T23:59:00.000Z",
    "repeatIntervalMinutes": 1440,
    "totalSent": 0,
    "totalErrors": 0,
    "totalCycles": 0,
    "lastCycleAt": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

`campaignStatus` já vem `EM_ANDAMENTO` se `startAt` for agora/passado, ou `AGENDADO` se for
no futuro — igual ao padrão que já existia para `AGENDADO`.

### `GET /campanhas/:id` — agora retorna `productIds`

Só para campanhas `RECORRENTE`, a resposta ganha um campo extra:

```json
{ "...": "...", "productIds": ["410b49b7-429f-44d1-a479-972d6cd84ef3"] }
```

### `PATCH /campanhas/:id` — editar

Mesmos campos do create (`startAt`, `endAt`, `repeatIntervalMinutes`, `productIds`,
`targetStarRating`, `targetStatus`, `name`) — todos opcionais no PATCH. Só funciona enquanto
`campaignStatus` é `RASCUNHO` ou `AGENDADO` (mesma regra que já existia pros outros tipos).
Editar `productIds` substitui a lista inteira (não é incremental).

### `POST /campanhas/:id/disparar`

Para `RECORRENTE`: força o primeiro ciclo a rodar **agora**, ignorando `startAt` original
(mantém `endAt`). Útil pro botão "Disparar Agora" numa campanha ainda `AGENDADO`.

### `POST /campanhas/:id/cancelar`

Para `RECORRENTE`: remove o agendamento recorrente do Redis — nenhum ciclo novo roda depois
disso. Testado e confirmado (ver seção de testes).

### `GET /campanhas/:id/entregas`

**Não retorna nada relevante para `RECORRENTE`** (não existe log por lead, conforme decisão
do slice). Esconder essa aba no front quando `type === "RECORRENTE"` — use os contadores
agregados que já vêm no detalhe: `totalSent`, `totalErrors`, `totalCycles`, `lastCycleAt`.

---

## Comportamentos importantes pro front saber

1. **Pausa automática por resposta.** Um lead que responder qualquer mensagem no WhatsApp
   sai do próximo ciclo automaticamente (fica de fora até voltar pro fluxo normal via
   `POST /contatos/:id/reiniciar-bot`, se for o caso). Não existe campo pra isso no
   payload — é sempre ativo, sem configuração.
2. **Mapeamento de estrela**: lead nível `1` recebe preços do produto tipo `C`, nível `2` →
   `B`, nível `3` → `A` (mesma regra do bot de cotação individual e da tela de Tabelas de
   Preços). Se a campanha não tiver `targetStarRating` (todos), cada lead recebe
   a faixa de preço correspondente ao **seu próprio** nível — não existe um catálogo único
   pra "todos".
3. **Produto sem preço para aquele nível de estrela é omitido do catálogo daquele ciclo**
   silenciosamente (não gera erro) — se um produto da lista não tiver faixa cadastrada pra
   um nível, ele simplesmente não aparece pros leads daquele nível.
4. **Formato do texto** é gerado automaticamente batendo com o que você mandou de exemplo —
   não é editável via API neste momento (sem campo de "mensagem customizada" pra RECORRENTE).

---

## Testes realizados

Rodei a aplicação numa porta separada (não mexi na instância em produção) e testei contra o
Postgres/Redis reais:

- ✅ `npx tsc --noEmit` e `npm run build` — sem erros
- ✅ Boot completo da aplicação sem erro de injeção de dependência
- ✅ `POST /campanhas` criando uma campanha `RECORRENTE` de verdade
- ✅ Ciclo do BullMQ disparando automaticamente no intervalo configurado (validei 10+ ciclos)
- ✅ Texto do catálogo gerado bate exatamente com o formato do seu exemplo (`📦 nome`,
  descrição opcional, faixas `•`, rodapé) — testado isoladamente com os dados reais do
  produto "PANCAQUE 73" já cadastrado
- ✅ `POST /campanhas/:id/cancelar` remove o agendamento do Redis (confirmado direto no
  Redis, sem chaves de scheduler ativas restantes)
- ✅ Validação: `IMEDIATO` sem `message` → 400; `RECORRENTE` sem `productIds` → 400;
  `RECORRENTE` com `endAt <= startAt` → 400
- ✅ Nenhuma mensagem real foi enviada a nenhum lead — o único contato de teste no banco
  já estava com status que o exclui do ciclo, e há um redirecionamento de dev
  (`DEV_REDIRECT_PHONE`) ativo no `.env` que protegeria contra isso de qualquer forma
- ✅ Dados de teste (campanha, produtos vinculados, chaves do Redis) removidos ao final —
  banco fica exatamente como estava antes dos testes

**Corrigido durante o teste**: os jobs do BullMQ não estavam configurados para se
auto-limpar do Redis após completar (`removeOnComplete`/`removeOnFail`). Ajustado nos 3
pontos que registram o agendamento (`create`, `update`, `disparar`).

---

## ⚠️ Atenção antes de integrar

O processo Node que serve a API em produção (porta 3000) **está rodando com o build
anterior a essa mudança** — eu não tenho permissão (não é meu processo, roda como root) pra
reiniciá-lo. O código novo já está compilado em `dist/`, mas só entra em vigor depois que
alguém reiniciar esse processo (`pm2 restart`, systemd, docker restart, ou o que for usado
para gerenciá-lo).

**Antes do front testar contra o ambiente real, confirme que o processo foi reiniciado** —
caso contrário `type: "RECORRENTE"` vai voltar `400` (enum não reconhecido pelo Nest antigo
em memória, mesmo com a coluna já existindo no banco).
