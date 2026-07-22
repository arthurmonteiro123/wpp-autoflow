/**
 * TanStack Query hooks for all backend domains.
 * Each hook wraps the api() client and handles the server's response envelope.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  apiGet,
  apiPost,
  apiPatch,
  apiPut,
  apiDelete,
  apiUpload,
  type PagedData,
} from "./api";

// ── Shared types ──────────────────────────────────────────────────────────────

export type LeadStatus = "NOVO" | "INATIVO" | "RESPONDEU" | "ATIVO" | "BLOQUEADO";
export type TipoCliente = "A" | "B" | "C" | "TODOS"; // product price tiers; TODOS = applies to all leads
export type StarLevel = 1 | 2 | 3; // lead star level — replaces starRating A/B/C
export type OrderStatus = "ABERTO" | "FECHADO" | "CANCELADO";
export type Role = "ADMIN" | "OPERADOR" | "VENDEDOR";
export type MidiaTipo = "IMAGEM" | "VIDEO" | "AUDIO" | "DOCUMENTO";
export type CampanhaStatus = "RASCUNHO" | "AGENDADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";
export type ProdutoStatus = "ATIVO" | "INATIVO";
export type FluxoTipoCliente = "1" | "2" | "3" | "INATIVO" | "BROADCAST";

// ── Backend entity shapes ─────────────────────────────────────────────────────

export interface Contato {
  id: string;
  name: string;
  phoneNumber: string;
  starLevel: StarLevel;
  totalSpent: string;
  engagementStatus: LeadStatus;
  cooldownUntil: string | null;
  notes?: string | null;
  address?: string | null;
  socialMedia?: string | null;
  owesDebt?: boolean;
  debtAmount?: string | null;
  lastMessageAt?: string | null;
  lastOrderAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PedidoItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
}

export interface Pedido {
  id: string;
  contactId?: string; // omitted for VENDEDOR role
  status: OrderStatus;
  items: PedidoItem[];
  estimatedTotal: string;
  notes?: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface PrecoProduto {
  starRating: TipoCliente;
  minQuantity: number | string; // backend returns decimal string e.g. "1.000"
  maxQuantity: number | string | null;
  unitPrice: string;
  maxDiscountPct: string;
}

export interface PrecoProdutoEntry extends PrecoProduto {
  id: string;
}

export interface Produto {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  unit: string;
  status: ProdutoStatus;
  precos?: PrecoProdutoEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Categoria {
  id: string;
  name: string;
}

export interface ProdutoMidia {
  id: string;
  productId: string;
  starRating: TipoCliente;
  mediaType: MidiaTipo;
  url: string;
  caption: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Local-only draft shape for the step editor UI. The backend's real step
 * model (`/fluxos/:id/etapas`) only supports type TEXTO|MIDIA|TABELA_PRECO|DELAY
 * and is not yet wired up here — steps built in the modal are not persisted.
 */
export interface FluxoEtapaApi {
  id: string;
  tipo: "MENSAGEM" | "AGUARDAR" | "CONDICAO" | "IA" | "ENCERRAR";
  titulo: string;
  conteudo?: string;
  delay?: number;
  ordem: number;
}

export interface Fluxo {
  id: string;
  name: string;
  starRating: FluxoTipoCliente;
  active: boolean;
  etapas?: FluxoEtapaApi[]; // local-only draft, never persisted (see FluxoEtapaApi)
  stepCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type CampanhaTipo = "IMEDIATO" | "AGENDADO" | "RECORRENTE";

export interface Campanha {
  id: string;
  name: string;
  type: CampanhaTipo;
  message: string;
  mediaUrl?: string | null;
  mediaType?: MidiaTipo | null;
  targetStarRating?: "1" | "2" | "3" | null;
  targetStatus?: string | null;
  scheduledFor?: string | null;
  // RECORRENTE only — ver docs/CAMPANHA_RECORRENTE_LISTA_PRODUTOS_SLICE.md
  startAt?: string | null;
  endAt?: string | null;
  repeatIntervalMinutes?: number | null;
  totalCycles?: number | null;
  lastCycleAt?: string | null;
  campaignStatus: CampanhaStatus;
  totalContacts?: number | null;
  totalSent: number;
  totalErrors: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampanhaEntrega {
  id: string;
  campaignId: string;
  contactId: string;
  status: "PENDENTE" | "ENVIADO" | "ERRO";
  errorDetails: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface Midia {
  id: string;
  name: string;
  type: MidiaTipo;
  url: string;
  sizeBytes: number;
  mimeType: string;
  createdBy: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: Role;
  status: "ATIVO" | "INATIVO";
  createdAt: string;
}

export interface Parametro {
  key: string;
  value: string;
  description?: string | null;
}

export interface EvolutionStatus {
  connected: boolean;
  instanceName?: string;
  since?: string;
  state?: string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const QK = {
  contatos: (params?: object) => ["contatos", params] as const,
  pedidos: (params?: object) => ["pedidos", params] as const,
  produtos: (params?: object) => ["produtos", params] as const,
  tabelaPreco: (produtoId: string) => ["produtos", produtoId, "tabela-preco"] as const,
  produtoMidias: (produtoId: string) => ["produtos", produtoId, "midias"] as const,
  categorias: () => ["categorias"] as const,
  fluxos: () => ["fluxos"] as const,
  campanhas: () => ["campanhas"] as const,
  midias: () => ["midias"] as const,
  usuarios: () => ["usuarios"] as const,
  parametros: () => ["parametros"] as const,
  evolution: () => ["evolution"] as const,
};

// ── Contatos ──────────────────────────────────────────────────────────────────

export interface ContatosParams {
  pagina?: number;
  limite?: number;
  starLevel?: StarLevel | "";
  engagementStatus?: LeadStatus | "";
  busca?: string;
  somenteSemCooldown?: boolean;
}

function toQS(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== false) {
      qs.set(k, String(v));
    }
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function useContatos(params: ContatosParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: QK.contatos(params),
    queryFn: () =>
      apiGet<PagedData<Contato>>(
        `/contatos${toQS({ ...params, pagina: params.pagina ?? 1, limite: params.limite ?? 50 })}`,
      ),
    enabled: options.enabled,
  });
}

export function useCriarContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; phoneNumber: string; notes?: string }) =>
      apiPost<Contato>("/contatos", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contatos"] }),
  });
}

export function useAtualizarStatusContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      apiPatch<Contato>(`/contatos/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contatos"] }),
  });
}

export function useAtualizarNivelEstrela() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, starLevel }: { id: string; starLevel: StarLevel }) =>
      apiPatch<Contato>(`/contatos/${id}/nivel-estrela`, { starLevel }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contatos"] }),
  });
}

export interface AtualizarContatoBody {
  notes?: string;
  address?: string;
  socialMedia?: string;
  owesDebt?: boolean;
  debtAmount?: string;
}

export function useAtualizarContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: AtualizarContatoBody & { id: string }) =>
      apiPatch<Contato>(`/contatos/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contatos"] }),
  });
}

export function useImportarCSV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("arquivo", file);
      return apiUpload<{ importados: number; erros: string[] }>("/contatos/importar-csv", fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contatos"] }),
  });
}

// ── Pedidos ───────────────────────────────────────────────────────────────────

export interface PedidosParams {
  pagina?: number;
  limite?: number;
  status?: OrderStatus | "";
}

export function usePedidos(params: PedidosParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: QK.pedidos(params),
    queryFn: () =>
      apiGet<PagedData<Pedido>>(
        `/pedidos${toQS({ ...params, pagina: params.pagina ?? 1, limite: params.limite ?? 50 })}`,
      ),
    enabled: options.enabled,
  });
}

export function useFecharPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<Pedido>(`/pedidos/${id}/fechar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pedidos"] }),
  });
}

export function useCancelarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<Pedido>(`/pedidos/${id}/cancelar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pedidos"] }),
  });
}

export function useRenotificarPedido() {
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/pedidos/${id}/renotificar`, {}),
  });
}

// ── Categorias de produto ─────────────────────────────────────────────────────

export function useCategorias() {
  return useQuery({
    queryKey: QK.categorias(),
    queryFn: () => apiGet<Categoria[]>("/categorias-produto"),
  });
}

export function useCriarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) => apiPost<Categoria>("/categorias-produto", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categorias"] }),
  });
}

// ── Produtos ──────────────────────────────────────────────────────────────────

export function useProdutos(
  params: { pagina?: number; limite?: number } = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: QK.produtos(params),
    queryFn: () =>
      apiGet<PagedData<Produto>>(
        `/produtos${toQS({ pagina: params.pagina ?? 1, limite: params.limite ?? 100 })}`,
      ),
    enabled: options.enabled,
  });
}

export function useCriarProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; unit: string; description?: string; categoryId?: string }) =>
      apiPost<Produto>("/produtos", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
  });
}

export function useAtualizarProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      unit?: string;
      description?: string;
      categoryId?: string;
      status?: ProdutoStatus;
    }) => apiPatch<Produto>(`/produtos/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
  });
}

export function useDeletarProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/produtos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
  });
}

// ── Mídias do produto ─────────────────────────────────────────────────────────

export function useProdutoMidias(produtoId: string | undefined) {
  return useQuery({
    queryKey: produtoId ? QK.produtoMidias(produtoId) : ["produto-midias-disabled"],
    queryFn: () => apiGet<ProdutoMidia[]>(`/produtos/${produtoId}/midias`),
    enabled: !!produtoId,
  });
}

export function useAtrelarMidiaProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      produtoId,
      mediaId,
      caption,
    }: {
      produtoId: string;
      mediaId: string;
      caption?: string;
    }) => apiPost<ProdutoMidia>(`/produtos/${produtoId}/midias`, { mediaId, caption }),
    onSuccess: (_, { produtoId }) =>
      qc.invalidateQueries({ queryKey: QK.produtoMidias(produtoId) }),
  });
}

export function useRemoverMidiaProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ produtoId, mediaEntryId }: { produtoId: string; mediaEntryId: string }) =>
      apiDelete(`/produtos/${produtoId}/midias/${mediaEntryId}`),
    onSuccess: (_, { produtoId }) =>
      qc.invalidateQueries({ queryKey: QK.produtoMidias(produtoId) }),
  });
}

// ── Tabela de preços ──────────────────────────────────────────────────────────

export function useTabelaPreco(produtoId: string | undefined) {
  return useQuery({
    queryKey: produtoId ? QK.tabelaPreco(produtoId) : ["tabela-preco-disabled"],
    queryFn: () => apiGet<PrecoProdutoEntry[]>(`/produtos/${produtoId}/tabela-preco`),
    enabled: !!produtoId,
  });
}

export function useCriarEntradaTabelaPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      produtoId,
      ...body
    }: {
      produtoId: string;
      starRating: TipoCliente;
      minQuantity: number;
      maxQuantity?: number | null;
      unitPrice: number;
      maxDiscountPct: number;
    }) => apiPost<PrecoProdutoEntry>(`/produtos/${produtoId}/tabela-preco`, body),
    onSuccess: (_, { produtoId }) => qc.invalidateQueries({ queryKey: QK.tabelaPreco(produtoId) }),
  });
}

export function useAtualizarEntradaTabelaPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      produtoId,
      entryId,
      ...body
    }: {
      produtoId: string;
      entryId: string;
      starRating?: TipoCliente;
      minQuantity?: number;
      maxQuantity?: number | null;
      unitPrice?: number;
      maxDiscountPct?: number;
    }) => apiPatch<PrecoProdutoEntry>(`/produtos/${produtoId}/tabela-preco/${entryId}`, body),
    onSuccess: (_, { produtoId }) => qc.invalidateQueries({ queryKey: QK.tabelaPreco(produtoId) }),
  });
}

export function useDeletarEntradaTabelaPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ produtoId, entryId }: { produtoId: string; entryId: string }) =>
      apiDelete(`/produtos/${produtoId}/tabela-preco/${entryId}`),
    onSuccess: (_, { produtoId }) => qc.invalidateQueries({ queryKey: QK.tabelaPreco(produtoId) }),
  });
}

// ── Fluxos ────────────────────────────────────────────────────────────────────

export function useFluxos() {
  return useQuery({
    queryKey: QK.fluxos(),
    queryFn: () => apiGet<PagedData<Fluxo>>("/fluxos"),
  });
}

export function useCriarFluxo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; starRating: FluxoTipoCliente }) =>
      apiPost<Fluxo>("/fluxos", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fluxos"] }),
  });
}

export function useAtualizarFluxo() {
  const qc = useQueryClient();
  return useMutation({
    // Backend only accepts name/starRating on PATCH /fluxos/:id — there is no
    // endpoint to toggle `active` yet.
    mutationFn: ({
      id,
      ...body
    }: Partial<{ name: string; starRating: FluxoTipoCliente }> & { id: string }) =>
      apiPatch<Fluxo>(`/fluxos/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fluxos"] }),
  });
}

export function useDeletarFluxo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/fluxos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fluxos"] }),
  });
}

// ── Campanhas ─────────────────────────────────────────────────────────────────

export function useCampanhas() {
  return useQuery({
    queryKey: QK.campanhas(),
    queryFn: () => apiGet<PagedData<Campanha>>("/campanhas"),
  });
}

export function useCriarCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      type: CampanhaTipo;
      message?: string;
      mediaUrl?: string;
      mediaType?: MidiaTipo;
      targetStarRating?: "1" | "2" | "3";
      targetStatus?: string;
      scheduledFor?: string;
      rascunho?: boolean;
      // RECORRENTE only
      startAt?: string;
      endAt?: string | null;
      repeatIntervalMinutes?: number;
    }) => apiPost<Campanha>("/campanhas", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanhas"] }),
  });
}

export function useAtualizarCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      type?: CampanhaTipo;
      message?: string;
      mediaUrl?: string;
      mediaType?: MidiaTipo;
      targetStarRating?: "1" | "2" | "3";
      targetStatus?: string;
      scheduledFor?: string;
      // RECORRENTE only
      startAt?: string;
      endAt?: string | null;
      repeatIntervalMinutes?: number;
    }) => apiPatch<Campanha>(`/campanhas/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanhas"] }),
  });
}

export function useEntregasCampanha(id: string | null) {
  return useQuery({
    queryKey: ["campanhas", id, "entregas"],
    queryFn: () => apiGet<PagedData<CampanhaEntrega>>(`/campanhas/${id}/entregas`),
    enabled: !!id,
  });
}

export function useDispararCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/campanhas/${id}/disparar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanhas"] }),
  });
}

export function useCancelarCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/campanhas/${id}/cancelar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanhas"] }),
  });
}

export function useDeletarCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/campanhas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanhas"] }),
  });
}

// ── Mídias ────────────────────────────────────────────────────────────────────

export function useMidias() {
  return useQuery({
    queryKey: QK.midias(),
    queryFn: () => apiGet<Midia[]>("/midias"),
  });
}

export function useUploadMidia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, nome }: { file: File; nome: string }) => {
      const fd = new FormData();
      fd.append("arquivo", file);
      fd.append("nome", nome);
      return apiUpload<Midia>("/midias/upload", fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["midias"] }),
  });
}

export function useDeletarMidia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/midias/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["midias"] }),
  });
}

// ── Usuários (ADMIN) ──────────────────────────────────────────────────────────

export function useUsuarios() {
  return useQuery({
    queryKey: QK.usuarios(),
    queryFn: () => apiGet<PagedData<Usuario>>("/admin/users"),
  });
}

export function useCriarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { nome: string; email: string; senha: string; role: Role }) =>
      apiPost<Usuario>("/admin/users", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

export function useAtualizarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      nome?: string;
      senha?: string;
      role?: Role;
      status?: "ATIVO" | "INATIVO";
    }) => apiPatch<Usuario>(`/admin/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

// ── Parâmetros do sistema ─────────────────────────────────────────────────────

export function useParametros() {
  return useQuery({
    queryKey: QK.parametros(),
    queryFn: () => apiGet<Parametro[]>("/parametros"),
  });
}

export function useAtualizarParametro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chave, valor }: { chave: string; valor: string }) =>
      apiPatch<Parametro>(`/parametros/${chave}`, { value: valor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parametros"] }),
  });
}

// ── Evolution / WhatsApp ──────────────────────────────────────────────────────

export function useEvolutionStatus() {
  return useQuery({
    queryKey: QK.evolution(),
    queryFn: () => apiGet<EvolutionStatus>("/evolution/status"),
    refetchInterval: 30_000,
    retry: false,
  });
}

export function useEvolutionConectar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<void>("/evolution/connect", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evolution"] }),
  });
}

export function useEvolutionQRCode() {
  return useQuery({
    queryKey: ["evolution", "qrcode"],
    queryFn: () => apiGet<{ qrcode: string }>("/evolution/qrcode"),
    enabled: false,
    retry: false,
  });
}

// ── Instance mapping (roteamento por nível de estrela) ───────────────────────
// Quem dispara cada mensagem é resolvido POR LEAD, na hora do envio, pelo
// starLevel dele: papel ativo mapeado em instance_star_mapping → nome real da
// instância no .env do backend. Sem mapeamento ativo → fallback Shelby.

export type InstanceRole = "shelby" | "moritz" | "cobrador" | "prospectador";

export interface InstanceMapping {
  id: string;
  instanceRole: InstanceRole;
  starRatings: string[]; // níveis de estrela do lead: "1" | "2" | "3"
  active: boolean;
  updatedAt: string;
}

/** GET /evolution/instances — papel → { name, role (label), connected }. */
export interface EvolutionInstanceInfo {
  name: string;
  role: string;
  base64: string | null;
  connected: boolean;
}

export function useInstanceMappings() {
  return useQuery({
    queryKey: ["instance-mapping"],
    queryFn: () => apiGet<InstanceMapping[]>("/instance-mapping"),
    retry: false,
  });
}

export function useEvolutionInstances() {
  return useQuery({
    queryKey: ["evolution", "instances"],
    queryFn: () =>
      apiGet<Partial<Record<InstanceRole, EvolutionInstanceInfo>>>("/evolution/instances"),
    refetchInterval: 30_000,
    retry: false,
  });
}

export function useUpsertInstanceMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { instanceRole: InstanceRole; starRatings: string[] }) =>
      apiPut<InstanceMapping>("/instance-mapping", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instance-mapping"] }),
  });
}

export function useSetInstanceMappingActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ role, active }: { role: InstanceRole; active: boolean }) =>
      apiPatch<InstanceMapping>(`/instance-mapping/${role}/active`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instance-mapping"] }),
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Convert decimal string fields from Drizzle to number */
export function toNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  return typeof value === "number" ? value : parseFloat(value) || 0;
}
