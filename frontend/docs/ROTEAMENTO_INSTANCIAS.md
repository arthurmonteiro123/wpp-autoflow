# Roteamento de instâncias Evolution por nível de estrela

> Criado em: 2026-07-15 · Status: ✅ backend já existia; tela no painel implementada em 2026-07-15
> Motivado por: disparo do script Salve falhou silenciosamente porque o papel `prospectador`
> estava ativo para ⭐1 apontando para uma instância desconectada.

---

## 1. A regra (como o sistema decide quem envia)

**A instância nunca fica amarrada à campanha/script.** Todo envio automático (script Salve,
campanha imediata/agendada, Pulse) resolve a instância **por lead, na hora do envio**:

```
starLevel do lead (1/2/3)
  → papel ATIVO em instance_star_mapping que cobre esse nível  (primeiro que casar)
    → nome real da instância no .env do backend (EVOLUTION_INSTANCE_<PAPEL>_NAME)
  → sem papel ativo cobrindo o nível → fallback: SHELBY (sempre)
```

Implementação: `InstanceMappingService.resolveInstanceForStarRating`
(`backend/src/modules/instance-mapping/instance-mapping.service.ts`) — consultada ao vivo a
cada envio; mudanças no mapeamento valem no próximo ciclo **sem reiniciar o backend**.

Consequência importante: uma campanha "Todos" pode sair por instâncias **diferentes no mesmo
ciclo** — cada lead pela instância do seu nível.

## 2. Papéis e nomes (atenção à pegadinha)

Os 4 papéis são fixos: `shelby`, `moritz`, `cobrador`, `prospectador`. O **nome real** da
instância de cada papel vem do `.env` do backend — e pode não coincidir com o nome do papel.
Estado do `.env` em 2026-07-15 (exemplo real que causou confusão):

```
EVOLUTION_INSTANCE_SHELBY_NAME=shelby
EVOLUTION_INSTANCE_MORITZ_NAME=moritz
EVOLUTION_INSTANCE_COBRADOR_NAME=flowzap        ← papel cobrador usa a instância "flowzap"
EVOLUTION_INSTANCE_PROSPECTADOR_NAME=cobrador   ← papel prospectador usa a instância "cobrador"(!)
```

Papel sem nome no `.env` → `getInstanceName` cai na Shelby.

## 3. Incidente de 2026-07-15 (registro)

- Sintoma: erro axios no disparo das 9h para `POST /message/sendText/cobrador`; nada chegou
  ao lead.
- Causa: lead ⭐1 → papel `prospectador` ativo com `star_ratings={1}` → instância `cobrador`,
  que estava em estado `connecting` (sem sessão WhatsApp). Só a `shelby` estava `open`.
- Correção aplicada direto no banco: `shelby` assumiu `{1,2,3}` ativa; `moritz`, `cobrador` e
  `prospectador` desativados.
- Prevenção: a tela de roteamento (seção 4) mostra um alerta quando um papel está **ativo com
  instância desconectada** — exatamente esse cenário.

## 4. Tela no painel — Configurações → WhatsApp → "Roteamento por nível de estrela"

Implementada em `frontend/src/routes/_app.configuracoes.whatsapp.tsx`
(`InstanceRoutingSection` + `EditMappingModal`):

- **Resumo por nível**: chips "⭐N → instância" mostrando quem atende cada nível agora
  (incluindo fallback) e se essa instância está conectada.
- **Card por papel**: nome do papel, instância real do `.env`, status de conexão, níveis
  atribuídos, switch ativa/desativa e botão Editar (modal com os 3 níveis).
- **Alerta de risco**: papel ativo + níveis atribuídos + instância desconectada = banner
  âmbar "envios vão falhar".
- Salvar no modal **reativa o papel** (comportamento do upsert no backend).
- Endpoints (ADMIN only): `GET /instance-mapping`, `PUT /instance-mapping`
  (`{ instanceRole, starRatings }`), `PATCH /instance-mapping/:role/active`,
  `GET /evolution/instances` (papel → nome/estado, polling 30s).
- Hooks: `useInstanceMappings`, `useEvolutionInstances`, `useUpsertInstanceMapping`,
  `useSetInstanceMappingActive` em `src/lib/queries.ts`.

## 5. Limitação conhecida

Quando dois papéis ativos cobrem o mesmo nível, o backend usa o primeiro retornado pela
query (sem `ORDER BY` — indeterminado). A tela replica a mesma lógica na ordem do `GET`,
mas o ideal é **não sobrepor níveis entre papéis ativos**. Melhoria futura: validação de
sobreposição no upsert ou campo de prioridade.
