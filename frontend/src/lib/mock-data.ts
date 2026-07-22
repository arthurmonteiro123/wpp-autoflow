// Mock dataset for the wpp-autoflow panel.
export type LeadStatus = "NOVO" | "RESPONDEU" | "ATIVO" | "INATIVO" | "BLOQUEADO";
export type LeadTipo = "A" | "B" | "C";
export type OrderStatus = "ABERTO" | "FECHADO" | "CANCELADO";

export interface Lead {
  id: string;
  nome: string;
  numero: string;
  tipo: LeadTipo;
  status: LeadStatus;
  ultimoContato: string | null;
  cooldownAte: string | null;
  notas?: string;
  email?: string;
  categoria?: string;
}

export interface Produto {
  id: string;
  sku: string;
  nome: string;
  categoria: string;
  unidade: string;
  ativo: boolean;
  descricao: string;
  imagemNome?: string;
  precos: { tipo: LeadTipo; qtdMin: number; qtdMax: number | null; preco: number; descMax: number }[];
}

export interface Pedido {
  id: string;
  clienteNome: string;
  clienteTipo: LeadTipo;
  itens: { produto: string; unidade: string; quantidade: number; precoUnit: number; desconto: number }[];
  total: number;
  status: OrderStatus;
  criadoEm: string;
  fechadoEm: string | null;
}

export type GatilhoTipo = "NOVO_LEAD" | "PALAVRA_CHAVE" | "INATIVO_30D" | "ANIVERSARIO" | "PEDIDO_ABERTO";
export type EtapaTipo = "MENSAGEM" | "AGUARDAR" | "CONDICAO" | "IA" | "ENCERRAR";

export interface FluxoEtapa {
  id: string;
  tipo: EtapaTipo;
  titulo: string;
  conteudo?: string;
  delay?: number;
}

export interface Fluxo {
  id: string;
  nome: string;
  ativo: boolean;
  etapas: number;
  ultimaEdicao: string;
  descricao: string;
  gatilho?: GatilhoTipo;
  passos?: FluxoEtapa[];
}

export interface Campanha {
  id: string;
  nome: string;
  status: "RASCUNHO" | "AGENDADA" | "EM_EXECUCAO" | "CONCLUIDA";
  alvo: string;
  enviados: number;
  total: number;
  agendadaPara: string | null;
  mensagem?: string;
  imagemId?: string;
  produtoSkus?: string[];
  inicioEm?: string;
  fimEm?: string;
  categoriaAlvo?: "TODOS" | "A" | "B" | "C";
  statusAlvo?: LeadStatus[];
}

export interface Midia {
  id: string;
  nome: string;
  tipo: "IMAGEM" | "VIDEO" | "DOCUMENTO" | "AUDIO";
  tamanhoKb: number;
  criadoEm: string;
  url: string;
}

const NOMES = [
  "João Silva", "Maria Souza", "Pedro Costa", "Beatriz Lima", "Rafael Almeida",
  "Camila Rocha", "Lucas Pereira", "Mariana Dias", "Felipe Cardoso", "Juliana Mendes",
  "Gustavo Ribeiro", "Larissa Castro", "Thiago Nunes", "Patrícia Moraes", "Eduardo Pinto",
];

export const CATEGORIAS = ["Sobremesas", "Bebidas", "Salgados", "Especiais", "Combos"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Deterministic seed via Math.random replacement
let seed = 42;
function srand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
const _rand = Math.random;
Math.random = srand as any;

export const leads: Lead[] = Array.from({ length: 28 }).map((_, i) => {
  const statuses: LeadStatus[] = ["NOVO", "RESPONDEU", "ATIVO", "INATIVO", "BLOQUEADO"];
  return {
    id: `lead-${i + 1}`,
    nome: rand(NOMES) + " " + (i + 1),
    numero: `55${randInt(11, 99)}9${randInt(10000000, 99999999)}`,
    tipo: rand<LeadTipo>(["A", "B", "C"]),
    status: i < 3 ? "NOVO" : rand(statuses),
    ultimoContato: i < 3 ? null : `2026-06-${String(randInt(10, 18)).padStart(2, "0")}T${String(randInt(8, 20)).padStart(2, "0")}:${String(randInt(0, 59)).padStart(2, "0")}:00`,
    cooldownAte: Math.random() > 0.7 ? "2026-06-20T00:00:00" : null,
  };
});

export const produtos: Produto[] = [
  "Gelato 110", "Gelato 220", "Açaí 300", "Açaí 500", "Brownie", "Cookie Dough",
  "Café Especial", "Combo Família", "Combo Casal", "Trufa Belga", "Milkshake", "Sorvete Pote 1L",
].map((nome, i) => ({
  id: `prod-${i + 1}`,
  sku: `SKU-${String(1000 + i + 1)}`,
  nome,
  categoria: rand(CATEGORIAS),
  unidade: nome.includes("Gelato") || nome.includes("Açaí") ? "g" : "un",
  ativo: i !== 5,
  descricao: `${nome} — produto premium da casa, com receita artesanal.`,
  imagemNome: i < 2 ? `produto-${i + 1}.jpg` : undefined,
  precos: [
    { tipo: "A", qtdMin: 1, qtdMax: 4, preco: 120 + i * 5, descMax: 10 },
    { tipo: "A", qtdMin: 5, qtdMax: 9, preco: 100 + i * 5, descMax: 10 },
    { tipo: "A", qtdMin: 10, qtdMax: null, preco: 95 + i * 5, descMax: 10 },
  ],
}));

export const pedidos: Pedido[] = Array.from({ length: 18 }).map((_, i) => {
  const status: OrderStatus = i < 3 ? "ABERTO" : i < 14 ? "FECHADO" : "CANCELADO";
  const itensQtd = randInt(1, 4);
  const itens = Array.from({ length: itensQtd }).map(() => {
    const p = rand(produtos);
    const qty = randInt(1, 12);
    const unit = randInt(60, 140);
    return { produto: p.nome, unidade: p.unidade, quantidade: qty, precoUnit: unit, desconto: randInt(0, 10) };
  });
  const total = itens.reduce((s, it) => s + it.quantidade * it.precoUnit * (1 - it.desconto / 100), 0);
  const day = randInt(12, 18);
  return {
    id: `ped-${String(1000 + i)}`,
    clienteNome: rand(NOMES),
    clienteTipo: rand<LeadTipo>(["A", "B", "C"]),
    itens,
    total,
    status,
    criadoEm: `2026-06-${String(day).padStart(2, "0")}T${String(randInt(8, 20)).padStart(2, "0")}:${String(randInt(0, 59)).padStart(2, "0")}:00`,
    fechadoEm: status === "FECHADO" ? `2026-06-${String(day).padStart(2, "0")}T${String(randInt(8, 22)).padStart(2, "0")}:30:00` : null,
  };
});

export const fluxos: Fluxo[] = [
  { id: "f-1", nome: "Boas-vindas", ativo: true, etapas: 5, ultimaEdicao: "2026-06-16", descricao: "Saudação automática para leads NOVOS." },
  { id: "f-2", nome: "Reativação Inativos", ativo: true, etapas: 7, ultimaEdicao: "2026-06-14", descricao: "Campanha de retorno para leads sem contato há 30+ dias." },
  { id: "f-3", nome: "Carrinho Abandonado", ativo: false, etapas: 4, ultimaEdicao: "2026-06-10", descricao: "Sequência para pedidos não fechados em 2h." },
  { id: "f-4", nome: "Aniversário", ativo: true, etapas: 3, ultimaEdicao: "2026-06-08", descricao: "Cupom personalizado no aniversário do cliente." },
];

export const campanhas: Campanha[] = [
  { id: "c-1", nome: "Promo Junina", status: "EM_EXECUCAO", alvo: "Tipo A · 120 leads", enviados: 87, total: 120, agendadaPara: null },
  { id: "c-2", nome: "Lançamento Brownie", status: "AGENDADA", alvo: "Todos ativos · 247", enviados: 0, total: 247, agendadaPara: "2026-06-20T10:00:00" },
  { id: "c-3", nome: "Cupom 10%", status: "CONCLUIDA", alvo: "Reativação · 68", enviados: 68, total: 68, agendadaPara: null },
  { id: "c-4", nome: "Pesquisa NPS", status: "RASCUNHO", alvo: "—", enviados: 0, total: 0, agendadaPara: null },
];

export const midias: Midia[] = [
  { id: "m-1", nome: "banner-junho.jpg", tipo: "IMAGEM", tamanhoKb: 248, criadoEm: "2026-06-15", url: "" },
  { id: "m-2", nome: "video-promo.mp4", tipo: "VIDEO", tamanhoKb: 4820, criadoEm: "2026-06-14", url: "" },
  { id: "m-3", nome: "menu.pdf", tipo: "DOCUMENTO", tamanhoKb: 612, criadoEm: "2026-06-12", url: "" },
  { id: "m-4", nome: "saudacao.ogg", tipo: "AUDIO", tamanhoKb: 84, criadoEm: "2026-06-10", url: "" },
  { id: "m-5", nome: "produto-1.jpg", tipo: "IMAGEM", tamanhoKb: 198, criadoEm: "2026-06-09", url: "" },
  { id: "m-6", nome: "produto-2.jpg", tipo: "IMAGEM", tamanhoKb: 220, criadoEm: "2026-06-08", url: "" },
];

// Restore Math.random
Math.random = _rand;

// Derived metrics for dashboard
export const dashboardMetrics = {
  pedidosHoje: 12,
  pedidosOntem: 9,
  faturamentoHoje: 2847.5,
  faturamentoOntem: 2540.1,
  faturamento7d: 18320,
  faturamento7dAnt: 16900,
  faturamento15d: 41650,
  faturamento15dAnt: 36200,
  leadsAtivos: 247,
  disparosHoje: 38,
  whatsappStatus: "CONECTADO" as "CONECTADO" | "DESCONECTADO",
  whatsappDesde: "2026-06-18T10:32:00",
};

export const faturamentoSerie = [
  { date: "Sex", faturamento: 1820, pedidos: 8 },
  { date: "Sab", faturamento: 3420, pedidos: 14 },
  { date: "Dom", faturamento: 2100, pedidos: 9 },
  { date: "Seg", faturamento: 2780, pedidos: 11 },
  { date: "Ter", faturamento: 3150, pedidos: 13 },
  { date: "Qua", faturamento: 3203, pedidos: 12 },
  { date: "Hoje", faturamento: 2847, pedidos: 12 },
];

export const topProdutos = [
  { nome: "Gelato 110", qtd: 142 },
  { nome: "Açaí 300", qtd: 118 },
  { nome: "Combo Família", qtd: 96 },
  { nome: "Brownie", qtd: 84 },
  { nome: "Milkshake", qtd: 72 },
  { nome: "Café Especial", qtd: 61 },
  { nome: "Cookie Dough", qtd: 48 },
  { nome: "Trufa Belga", qtd: 39 },
];

export const leadStatusDistribuicao: { status: LeadStatus; qtd: number; pct: number }[] = [
  { status: "NOVO", qtd: 142, pct: 45 },
  { status: "RESPONDEU", qtd: 68, pct: 21 },
  { status: "ATIVO", qtd: 47, pct: 15 },
  { status: "INATIVO", qtd: 52, pct: 16 },
  { status: "BLOQUEADO", qtd: 8, pct: 3 },
];

export function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateTimeBR(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
