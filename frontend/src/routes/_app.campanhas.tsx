import { createFileRoute } from "@tanstack/react-router";
import { Page, Surface } from "@/components/app/page";
import { EmptyState } from "@/components/app/empty-state";
import { CardGridSkeleton } from "@/components/app/table-skeleton";
import {
  useCampanhas,
  useCriarCampanha,
  useAtualizarCampanha,
  useDispararCampanha,
  useCancelarCampanha,
  useDeletarCampanha,
  useEntregasCampanha,
  useMidias,
  useProdutos,
  useTabelaPreco,
  useProdutoMidias,
  toNumber,
  type Campanha,
  type CampanhaStatus,
  type CampanhaTipo,
  type LeadStatus,
  type MidiaTipo,
  type Produto,
  type TipoCliente,
} from "@/lib/queries";
import {
  Plus,
  Megaphone,
  Calendar,
  Play,
  Image as ImageIcon,
  X,
  Users,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  Copy,
  Repeat,
  Package,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DateTimePicker, toDateTimeLocalValue } from "@/components/app/date-time-picker";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { extractErrorMessage, apiGet } from "@/lib/api";
import type { PagedData } from "@/lib/api";
import { WhatsAppPreview } from "@/components/app/whatsapp-preview";

export const Route = createFileRoute("/_app/campanhas")({
  head: () => ({ meta: [{ title: "Campanhas — wpp-autoflow" }] }),
  component: CampanhasPage,
});

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CampanhaStatus, string> = {
  RASCUNHO: "bg-muted text-muted-foreground border-border",
  AGENDADO: "bg-info/15 text-info border-info/30",
  EM_ANDAMENTO: "bg-warning/15 text-warning border-warning/30",
  CONCLUIDO: "bg-brand/15 text-brand border-brand/30",
  CANCELADO: "bg-destructive/15 text-destructive border-destructive/30",
};

const STATUS_LABELS: Record<CampanhaStatus, string> = {
  RASCUNHO: "Rascunho",
  AGENDADO: "Agendada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluída",
  CANCELADO: "Cancelada",
};

const STATUS_ICONS: Record<CampanhaStatus, React.ElementType> = {
  RASCUNHO: FileText,
  AGENDADO: Clock,
  EM_ANDAMENTO: Send,
  CONCLUIDO: CheckCircle2,
  CANCELADO: XCircle,
};

const LEAD_STATUSES: LeadStatus[] = ["NOVO", "RESPONDEU", "ATIVO", "INATIVO", "BLOQUEADO"];
const NIVEIS_ESTRELA = [
  { value: "1" as const, label: "⭐ 1 estrela" },
  { value: "2" as const, label: "⭐⭐ 2 estrelas" },
  { value: "3" as const, label: "⭐⭐⭐ 3 estrelas" },
];

// Mapeamento starLevel (lead) → starRating (produto): 1→C, 2→B, 3→A — mesma
// regra usada pelo bot de cotação individual e pela tela de Tabelas de Preços
// (frontend-spec-star-level-e-tabela-precos.md). Quando "Todos" é selecionado,
// cada lead recebe a faixa correspondente ao seu próprio nível — não existe um catálogo
// único; o preview abaixo é só uma aproximação (mostra o menor preço entre todos os tiers).
function mapStarLevelToProductRating(level: "TODOS" | "1" | "2" | "3"): TipoCliente | null {
  if (level === "1") return "C";
  if (level === "2") return "B";
  if (level === "3") return "A";
  return null;
}

const REPEAT_INTERVAL_OPTIONS = [
  { value: 10, label: "A cada 10 minutos" },
  { value: 20, label: "A cada 20 minutos" },
  { value: 30, label: "A cada 30 minutos" },
  { value: 60, label: "A cada 1 hora" },
  { value: 360, label: "A cada 6 horas" },
  { value: 720, label: "A cada 12 horas" },
  { value: 1440, label: "A cada 24 horas" },
  { value: 2880, label: "A cada 48 horas" },
];

// Tipos de script de automação (SCRIPT_SALVE_SLICE.md) — só "Salve" existe no
// lançamento; os demais são placeholders visuais para a aba crescer sem redesign.
const SCRIPT_TYPES = [
  { id: "SALVE", emoji: "👋", label: "Salve", available: true },
  { id: "REATIVACAO", emoji: "♻️", label: "Reativação", available: false },
  { id: "ANIVERSARIO", emoji: "🎂", label: "Aniversário", available: false },
] as const;

const EMPTY_FORM = {
  name: "",
  type: "IMEDIATO" as CampanhaTipo,
  message: "",
  mediaUrl: "",
  scheduledFor: "",
  targetStarRating: "TODOS" as "TODOS" | "1" | "2" | "3",
  targetStatus: [] as LeadStatus[],
  startAt: "",
  endAt: "",
  repeatIntervalMinutes: 1440,
};

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CampanhaStatus }) {
  const Icon = STATUS_ICONS[status] ?? FileText;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
        STATUS_STYLES[status] ?? STATUS_STYLES.RASCUNHO,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function MultiSelectStatus({
  value,
  onChange,
}: {
  value: LeadStatus[];
  onChange: (v: LeadStatus[]) => void;
}) {
  function toggle(s: LeadStatus) {
    onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {LEAD_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => toggle(s)}
          className={cn(
            "h-7 rounded-lg border px-2.5 text-xs font-medium transition",
            value.includes(s)
              ? "border-brand bg-brand/15 text-brand"
              : "border-border bg-background/40 text-muted-foreground hover:border-brand/40",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ── contact estimate ──────────────────────────────────────────────────────────

function useContatosEstimativa(targetStarRating: string, targetStatus: LeadStatus[]) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch = useCallback(async (rating: string, statuses: LeadStatus[]) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ pagina: "1", limite: "1" });
      if (rating !== "TODOS") qs.set("tipoCliente", rating);
      if (statuses.length > 0) qs.set("statusEngajamento", statuses[0]);
      const res = await apiGet<PagedData<unknown>>(`/contatos?${qs}`);
      setCount(res.total ?? 0);
    } catch {
      setCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetch(targetStarRating, targetStatus);
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [targetStarRating, targetStatus, fetch]);

  return { count, loading };
}

// ── preview automático de produtos (campanha RECORRENTE) ─────────────────────
// Não é mais um picker: a campanha manda, a cada ciclo, todos os produtos
// ativos com preço cadastrado no tier do lead — esta lista é só um preview
// somente-leitura do que vai sair, direto da tabela de preços de cada produto.

function ProdutoPreviewRow({
  produto,
  starRatingPreview,
}: {
  produto: Produto;
  starRatingPreview: TipoCliente | null;
}) {
  const { data: entries = [] } = useTabelaPreco(produto.id);
  const { data: midias = [] } = useProdutoMidias(produto.id);

  const relevantes = starRatingPreview
    ? entries.filter((e) => e.starRating === starRatingPreview || e.starRating === "TODOS")
    : entries;

  if (relevantes.length === 0) return null;

  const maisBarato = [...relevantes].sort(
    (a, b) => toNumber(a.unitPrice) - toNumber(b.unitPrice),
  )[0];
  const foto = midias[0]?.url;

  return (
    <div className="w-full flex items-center gap-3 rounded-lg border border-border bg-background/40 p-2">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted overflow-hidden">
        {foto ? (
          <img src={foto} alt={produto.name} className="h-full w-full object-cover" />
        ) : (
          <Package className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{produto.name}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {produto.categoryName ?? "Sem categoria"}
          {maisBarato ? ` · a partir de R$ ${toNumber(maisBarato.unitPrice).toFixed(2)}/${produto.unit}` : ""}
        </div>
      </div>
    </div>
  );
}

function ProdutosAutomaticosPreview({
  starRatingPreview,
}: {
  starRatingPreview: TipoCliente | null;
}) {
  const { data, isLoading } = useProdutos({ limite: 100 });
  const produtos: Produto[] = (data?.data ?? []).filter((p) => p.status === "ATIVO");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (produtos.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">Nenhum produto ativo cadastrado ainda.</p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background/30 p-2 max-h-64 overflow-y-auto space-y-1.5">
      {produtos.map((p) => (
        <ProdutoPreviewRow key={p.id} produto={p} starRatingPreview={starRatingPreview} />
      ))}
      <p className="text-[10px] text-muted-foreground px-1 pt-1">
        Automático — qualquer produto ativo com preço cadastrado neste tier entra no próximo ciclo.
      </p>
    </div>
  );
}

// ── preview da sequência do script Salve ─────────────────────────────────────

/**
 * Mostra o que o lead recebe em cada ciclo do script Salve, na ordem real de
 * envio do job: mensagem de salve → catálogo consolidado (SCRIPT_SALVE_SLICE.md,
 * seção 5.2). Sem fotos — mídia só sai sob pedido explícito do lead, via IA.
 */
function SalveSequencePreview({ message }: { message: string }) {
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const bubble = "max-w-[85%] rounded-2xl rounded-tl-sm bg-[#1f2c34] px-3.5 py-2 shadow-md";

  return (
    <div className="rounded-xl border border-border bg-[#0a1929] p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
        Preview do ciclo — o que o lead recebe
      </p>
      <div className="space-y-2">
        <div className="flex justify-start">
          <div className={bubble}>
            <p
              className={cn(
                "text-sm leading-relaxed whitespace-pre-wrap break-words",
                message.trim() ? "text-white" : "text-white/40 italic",
              )}
            >
              {message.trim() || "Sua mensagem de salve aparecerá aqui…"}
            </p>
            <p className="mt-1 text-[10px] text-white/50">{time}</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className={bubble}>
            <p className="text-sm leading-relaxed text-white/70 whitespace-pre-wrap">
              {
                "Tabela de Preços\nCondições especiais para clientes ⭐\n\n📦 …preços do nível do lead"
              }
            </p>
            <p className="mt-1 text-[10px] text-white/50">{time}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── modal ─────────────────────────────────────────────────────────────────────

function CampanhaModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Campanha | null;
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name,
          type: initial.type,
          message: initial.message,
          mediaUrl: initial.mediaUrl ?? "",
          scheduledFor: initial.scheduledFor
            ? new Date(initial.scheduledFor).toISOString().slice(0, 16)
            : "",
          targetStarRating: (initial.targetStarRating ?? "TODOS") as "TODOS" | "1" | "2" | "3",
          targetStatus: initial.targetStatus
            ? (initial.targetStatus.split(",") as LeadStatus[])
            : [],
          startAt: initial.startAt ? new Date(initial.startAt).toISOString().slice(0, 16) : "",
          endAt: initial.endAt ? new Date(initial.endAt).toISOString().slice(0, 16) : "",
          repeatIntervalMinutes: initial.repeatIntervalMinutes ?? 1440,
        }
      : { ...EMPTY_FORM },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagemPickerOpen, setImagemPickerOpen] = useState(false);

  const { data: midiasRaw } = useMidias();
  const imagensMidia = (midiasRaw ?? []).filter((m) => m.type === "IMAGEM");

  const criar = useCriarCampanha();
  const atualizar = useAtualizarCampanha();
  const isPending = criar.isPending || atualizar.isPending;

  const { count: estimativa, loading: loadingEstimativa } = useContatosEstimativa(
    form.targetStarRating,
    form.targetStatus,
  );

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      const n = { ...e };
      delete n[k as string];
      return n;
    });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nome obrigatório";

    if (form.type === "RECORRENTE") {
      if (!form.message.trim()) e.message = "Escreva a mensagem de salve";
      if (!form.startAt) e.startAt = "Início obrigatório";
      if (form.startAt && form.endAt && new Date(form.endAt) <= new Date(form.startAt))
        e.endAt = "Término deve ser depois do início";
      if (!form.repeatIntervalMinutes) e.repeatIntervalMinutes = "Defina o intervalo de reenvio";
      else if (form.repeatIntervalMinutes < 10)
        e.repeatIntervalMinutes = "Intervalo mínimo: 10 minutos";
    } else {
      if (!form.message.trim()) e.message = "Mensagem obrigatória";
      if (form.type === "AGENDADO" && !form.scheduledFor)
        e.scheduledFor = "Data obrigatória para campanhas agendadas";
    }
    return e;
  }

  function buildPayload() {
    if (form.type === "RECORRENTE") {
      return {
        name: form.name.trim(),
        type: form.type,
        message: form.message.trim(),
        ...(form.targetStarRating !== "TODOS"
          ? { targetStarRating: form.targetStarRating as "1" | "2" | "3" }
          : {}),
        ...(form.targetStatus.length > 0 ? { targetStatus: form.targetStatus.join(",") } : {}),
        ...(form.startAt ? { startAt: new Date(form.startAt).toISOString() } : {}),
        // Enviado explicitamente (mesmo null) para permitir limpar um término já definido na edição.
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        ...(form.repeatIntervalMinutes
          ? { repeatIntervalMinutes: form.repeatIntervalMinutes }
          : {}),
      };
    }
    return {
      name: form.name.trim(),
      type: form.type,
      message: form.message.trim(),
      ...(form.mediaUrl ? { mediaUrl: form.mediaUrl, mediaType: "IMAGEM" as MidiaTipo } : {}),
      ...(form.targetStarRating !== "TODOS"
        ? { targetStarRating: form.targetStarRating as "1" | "2" | "3" }
        : {}),
      ...(form.targetStatus.length > 0 ? { targetStatus: form.targetStatus.join(",") } : {}),
      ...(form.type === "AGENDADO" && form.scheduledFor
        ? { scheduledFor: new Date(form.scheduledFor).toISOString() }
        : {}),
    };
  }

  async function handleSave(asDraft = false) {
    const e = validate();
    if (!asDraft && Object.keys(e).length) {
      setErrors(e);
      return;
    }
    try {
      if (isEdit) {
        await atualizar.mutateAsync({ id: initial!.id, ...buildPayload() });
        toast.success("Campanha atualizada");
      } else {
        await criar.mutateAsync({ ...buildPayload(), ...(asDraft ? { rascunho: true } : {}) });
        toast.success(asDraft ? "Rascunho salvo" : "Campanha criada");
      }
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  const imagemSelecionada = form.mediaUrl
    ? imagensMidia.find((m) => m.url === form.mediaUrl || m.name === form.mediaUrl)
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Nome */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nome da campanha *
              </label>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ex: Promo Junho, Reativação Verão…"
                className={cn(
                  "w-full h-9 rounded-lg border bg-background/40 px-3 text-sm outline-none focus:border-brand transition",
                  errors.name ? "border-destructive" : "border-border",
                )}
              />
              {errors.name && <p className="text-[11px] text-destructive">{errors.name}</p>}
            </div>

            {/* O que você quer criar? (SCRIPT_SALVE_SLICE.md, seção 5.1) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                O que você quer criar? *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => form.type === "RECORRENTE" && set("type", "IMEDIATO")}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    form.type !== "RECORRENTE"
                      ? "border-brand bg-brand/10"
                      : "border-border bg-background/30 hover:border-brand/40",
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Megaphone
                      className={cn(
                        "h-3.5 w-3.5",
                        form.type !== "RECORRENTE" ? "text-brand" : "text-muted-foreground",
                      )}
                    />
                    <span className="text-xs font-medium">Disparo avulso</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Uma mensagem única, imediata ou agendada
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => set("type", "RECORRENTE")}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    form.type === "RECORRENTE"
                      ? "border-brand bg-brand/10"
                      : "border-border bg-background/30 hover:border-brand/40",
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Repeat
                      className={cn(
                        "h-3.5 w-3.5",
                        form.type === "RECORRENTE" ? "text-brand" : "text-muted-foreground",
                      )}
                    />
                    <span className="text-xs font-medium">Script de automação</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    O bot trabalha sozinho, em ciclos, até o lead responder
                  </p>
                </button>
              </div>
            </div>

            {form.type !== "RECORRENTE" ? (
              /* Disparo avulso: imediato ou agendado */
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Quando disparar? *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["IMEDIATO", "AGENDADO"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("type", t)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        form.type === t
                          ? "border-brand bg-brand/10"
                          : "border-border bg-background/30 hover:border-brand/40",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        {t === "IMEDIATO" ? (
                          <Play
                            className={cn(
                              "h-3.5 w-3.5",
                              form.type === t ? "text-brand" : "text-muted-foreground",
                            )}
                          />
                        ) : (
                          <Clock
                            className={cn(
                              "h-3.5 w-3.5",
                              form.type === t ? "text-brand" : "text-muted-foreground",
                            )}
                          />
                        )}
                        <span className="text-xs font-medium">
                          {t === "IMEDIATO" ? "Imediato" : "Agendado"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {t === "IMEDIATO"
                          ? "Dispara ao criar a campanha"
                          : "Dispara em data/hora específica"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Script de automação: seletor de tipo — só "Salve" disponível no lançamento */
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Tipo de script *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SCRIPT_TYPES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!s.available}
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        s.available
                          ? "border-brand bg-brand/10"
                          : "border-border bg-background/20 opacity-50 cursor-not-allowed",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm leading-none">{s.emoji}</span>
                        <span className={cn("text-xs font-medium", s.available && "text-brand")}>
                          {s.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {s.available ? "Chama o lead pra fechar venda" : "Em breve"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Data/hora (só AGENDADO) */}
            {form.type === "AGENDADO" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Data e hora do disparo *
                  </label>
                  <button
                    type="button"
                    onClick={() => set("scheduledFor", toDateTimeLocalValue(new Date()))}
                    className="text-[11px] font-medium text-brand hover:underline"
                  >
                    Iniciar agora
                  </button>
                </div>
                <DateTimePicker
                  value={form.scheduledFor}
                  onChange={(v) => set("scheduledFor", v)}
                  min={toDateTimeLocalValue(new Date())}
                  error={!!errors.scheduledFor}
                />
                {errors.scheduledFor && (
                  <p className="text-[11px] text-destructive">{errors.scheduledFor}</p>
                )}
              </div>
            )}

            {form.type === "RECORRENTE" ? (
              <>
                {/* Mensagem de salve */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Mensagem de salve *
                  </label>
                  <textarea
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                    rows={3}
                    placeholder="Ex: Salve! Chegou tabela nova com preço especial pra você 👊"
                    className={cn(
                      "w-full rounded-lg border bg-background/40 px-3 py-2 text-sm outline-none focus:border-brand transition resize-none",
                      errors.message ? "border-destructive" : "border-border",
                    )}
                  />
                  {errors.message && (
                    <p className="text-[11px] text-destructive">{errors.message}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Abre cada ciclo do script, antes da tabela de preços.
                  </p>
                </div>

                <SalveSequencePreview message={form.message} />

                {/* Produtos que serão enviados */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Produtos que serão enviados
                  </label>
                  <ProdutosAutomaticosPreview
                    starRatingPreview={mapStarLevelToProductRating(form.targetStarRating)}
                  />
                </div>

                {/* Tipo de lead alvo */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Tipo de lead alvo *
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {([{ value: "TODOS", label: "Todos" }, ...NIVEIS_ESTRELA] as const).map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() =>
                          set("targetStarRating", t.value as "TODOS" | "1" | "2" | "3")
                        }
                        className={cn(
                          "h-7 rounded-lg border px-3 text-xs font-medium transition",
                          form.targetStarRating === t.value
                            ? "border-brand bg-brand/15 text-brand"
                            : "border-border bg-background/40 text-muted-foreground hover:border-brand/40",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status dos leads (filtro extra opcional) */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Status dos leads (opcional)
                  </label>
                  <MultiSelectStatus
                    value={form.targetStatus}
                    onChange={(v) => set("targetStatus", v)}
                  />
                </div>

                {/* Janela de tempo */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Início *
                      </label>
                      <button
                        type="button"
                        onClick={() => set("startAt", toDateTimeLocalValue(new Date()))}
                        className="text-[11px] font-medium text-brand hover:underline"
                      >
                        Iniciar agora
                      </button>
                    </div>
                    <DateTimePicker
                      value={form.startAt}
                      onChange={(v) => set("startAt", v)}
                      min={toDateTimeLocalValue(new Date())}
                      error={!!errors.startAt}
                    />
                    {errors.startAt && (
                      <p className="text-[11px] text-destructive">{errors.startAt}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Se for agora, o 1º ciclo dispara ao salvar.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Término
                    </label>
                    <DateTimePicker
                      value={form.endAt}
                      onChange={(v) => set("endAt", v)}
                      min={form.startAt || toDateTimeLocalValue(new Date())}
                      error={!!errors.endAt}
                      placeholder="Sem término (indeterminado)"
                      clearable
                    />
                    {errors.endAt && <p className="text-[11px] text-destructive">{errors.endAt}</p>}
                    <p className="text-[10px] text-muted-foreground">
                      Deixe em branco para rodar por tempo indeterminado.
                    </p>
                  </div>
                </div>

                {/* Intervalo de reenvio */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Repeat className="h-3 w-3" /> Reenviar a cada *
                  </label>
                  <select
                    value={form.repeatIntervalMinutes}
                    onChange={(e) => set("repeatIntervalMinutes", Number(e.target.value))}
                    className="w-full h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
                  >
                    {REPEAT_INTERVAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {errors.repeatIntervalMinutes && (
                    <p className="text-[11px] text-destructive">{errors.repeatIntervalMinutes}</p>
                  )}
                </div>

                {form.repeatIntervalMinutes < 60 && (
                  <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Intervalos curtos aumentam o risco de bloqueio do número pelo WhatsApp.
                      Recomendado apenas com término no mesmo dia.
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
                  <Users className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Leads que responderem ou já tiverem comprado ficam de fora dos próximos envios
                    automaticamente — sem configuração.
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Mensagem */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Mensagem *</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                    rows={4}
                    placeholder="Escreva a mensagem de abertura…"
                    className={cn(
                      "w-full rounded-lg border bg-background/40 px-3 py-2 text-sm outline-none focus:border-brand transition resize-none",
                      errors.message ? "border-destructive" : "border-border",
                    )}
                  />
                  {errors.message && (
                    <p className="text-[11px] text-destructive">{errors.message}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {["{{nome}}", "{{starRating}}", "{{today}}"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set("message", form.message + v)}
                        className="h-6 rounded-md border border-border bg-background/40 px-2 text-[10px] font-mono text-muted-foreground hover:border-brand/40 hover:text-brand transition"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* WhatsApp Preview */}
                <WhatsAppPreview message={form.message} mediaUrl={form.mediaUrl || undefined} />

                {/* Mídia */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Imagem (opcional)
                  </label>
                  {imagemSelecionada ? (
                    <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{imagemSelecionada.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {(imagemSelecionada.sizeBytes / 1024 / 1024).toFixed(1)} MB
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => set("mediaUrl", "")}
                        className="p-1 text-muted-foreground hover:text-destructive transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setImagemPickerOpen(true)}
                      className="w-full h-9 rounded-lg border border-dashed border-border bg-background/20 px-3 text-sm text-muted-foreground/70 flex items-center gap-2 hover:border-brand/40 hover:text-foreground transition"
                    >
                      <ImageIcon className="h-4 w-4 shrink-0" />
                      Selecionar imagem da biblioteca…
                    </button>
                  )}
                </div>

                {/* Segmentação */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Segmentação
                  </label>
                  <div className="rounded-xl border border-border bg-background/30 p-3 space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Tipo de cliente
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {([{ value: "TODOS", label: "Todos" }, ...NIVEIS_ESTRELA] as const).map(
                          (t) => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() =>
                                set("targetStarRating", t.value as "TODOS" | "1" | "2" | "3")
                              }
                              className={cn(
                                "h-7 rounded-lg border px-3 text-xs font-medium transition",
                                form.targetStarRating === t.value
                                  ? "border-brand bg-brand/15 text-brand"
                                  : "border-border bg-background/40 text-muted-foreground hover:border-brand/40",
                              )}
                            >
                              {t.label}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Status dos leads
                      </label>
                      <MultiSelectStatus
                        value={form.targetStatus}
                        onChange={(v) => set("targetStatus", v)}
                      />
                    </div>

                    {/* Estimativa */}
                    <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {loadingEstimativa ? (
                        <span className="text-xs text-muted-foreground">Calculando…</span>
                      ) : estimativa !== null ? (
                        <span className="text-xs text-muted-foreground">
                          Estimativa: <strong className="text-foreground">~{estimativa}</strong>{" "}
                          contatos receberão esta mensagem
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Não foi possível calcular estimativa
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={onClose}
              className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-accent transition"
            >
              Cancelar
            </button>
            {/* RECORRENTE nunca fica em RASCUNHO após criada — campaignStatus já nasce
                EM_ANDAMENTO ou AGENDADO (CAMPANHA_RECORRENTE_API_PRONTA.md), então não
                existe rascunho pra esse tipo. */}
            {!isEdit && form.type !== "RECORRENTE" && (
              <button
                onClick={() => handleSave(true)}
                disabled={isPending}
                className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-accent transition disabled:opacity-60"
              >
                Salvar rascunho
              </button>
            )}
            <button
              onClick={() => handleSave(false)}
              disabled={isPending}
              className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-4 text-sm font-medium text-brand-foreground disabled:opacity-70"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar campanha"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image picker */}
      <Dialog open={imagemPickerOpen} onOpenChange={setImagemPickerOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Selecionar imagem</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto py-2">
            {imagensMidia.map((m) => {
              const url = m.url;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    set("mediaUrl", url);
                    setImagemPickerOpen(false);
                  }}
                  className={cn(
                    "relative rounded-xl border-2 p-3 text-left hover:border-brand/60 transition",
                    form.mediaUrl === url
                      ? "border-brand bg-brand/10"
                      : "border-border bg-background/40",
                  )}
                >
                  <div className="aspect-video rounded-lg bg-linear-to-br from-accent/40 to-background grid place-items-center mb-2 overflow-hidden">
                    <img
                      src={m.url}
                      alt={m.name}
                      className="absolute inset-0 h-full w-full object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                  <div className="text-xs font-medium truncate">{m.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {(m.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  </div>
                  {form.mediaUrl === url && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full brand-gradient grid place-items-center">
                      <CheckCircle2 className="h-3 w-3 text-brand-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
            {imagensMidia.length === 0 && (
              <div className="col-span-3 py-12 text-center text-sm text-muted-foreground">
                Nenhuma imagem disponível.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── detail drawer ─────────────────────────────────────────────────────────────

function DetalheDrawer({
  campanha,
  onClose,
  onEdit,
  onDisparar,
  onCancelar,
  onDeletar,
}: {
  campanha: Campanha | null;
  onClose: () => void;
  onEdit: (c: Campanha) => void;
  onDisparar: (id: string) => void;
  onCancelar: (id: string) => void;
  onDeletar: (c: Campanha) => void;
}) {
  const isRecorrente = campanha?.type === "RECORRENTE";
  // GET /campanhas/:id/entregas não se aplica a campanhas RECORRENTE (sem log por lead).
  const { data: entregasData } = useEntregasCampanha(isRecorrente ? null : (campanha?.id ?? null));
  const entregas = entregasData?.data ?? [];
  const total = entregasData?.total ?? 0;

  const sent = campanha?.totalSent ?? 0;
  const contacts = campanha?.totalContacts ?? 0;
  const pct = contacts > 0 ? Math.round((sent / contacts) * 100) : 0;

  // RECORRENTE segue a mesma regra dos outros tipos: editável em RASCUNHO ou AGENDADO
  // (CAMPANHA_RECORRENTE_API_PRONTA.md) — PATCH reagenda o job repetível no backend.
  const canEdit =
    campanha?.campaignStatus === "RASCUNHO" || campanha?.campaignStatus === "AGENDADO";
  const canDisparar =
    campanha?.campaignStatus === "RASCUNHO" || campanha?.campaignStatus === "AGENDADO";
  const canCancelar =
    campanha?.campaignStatus === "RASCUNHO" ||
    campanha?.campaignStatus === "AGENDADO" ||
    campanha?.campaignStatus === "EM_ANDAMENTO";
  const showProgress =
    campanha?.campaignStatus === "EM_ANDAMENTO" || campanha?.campaignStatus === "CONCLUIDO";

  return (
    <Sheet open={!!campanha} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {campanha && (
          <>
            <SheetHeader className="mb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-lg">{campanha.name}</SheetTitle>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={campanha.campaignStatus} />
                    <span className="text-xs text-muted-foreground">
                      {campanha.type === "IMEDIATO"
                        ? "Imediato"
                        : campanha.type === "AGENDADO"
                          ? "Agendado"
                          : "👋 Script · Salve"}
                    </span>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {isRecorrente ? (
                  <>
                    {campanha.startAt && campanha.endAt && (
                      <div className="col-span-2 rounded-lg border border-border bg-background/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Janela de envio
                        </p>
                        <p className="text-sm font-medium">
                          {formatDate(campanha.startAt)} → {formatDate(campanha.endAt)}
                        </p>
                      </div>
                    )}
                    {campanha.repeatIntervalMinutes && (
                      <div className="rounded-lg border border-border bg-background/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Reenvio
                        </p>
                        <p className="text-sm font-medium">
                          {REPEAT_INTERVAL_OPTIONS.find(
                            (o) => o.value === campanha.repeatIntervalMinutes,
                          )?.label ?? `a cada ${campanha.repeatIntervalMinutes}min`}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  campanha.scheduledFor && (
                    <div className="rounded-lg border border-border bg-background/40 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Agendado para
                      </p>
                      <p className="text-sm font-medium">{formatDate(campanha.scheduledFor)}</p>
                    </div>
                  )
                )}
                <div className="rounded-lg border border-border bg-background/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Público-alvo
                  </p>
                  <p className="text-sm font-medium">
                    {campanha.targetStarRating
                      ? `${"⭐".repeat(Number(campanha.targetStarRating))} ${campanha.targetStarRating} estrela(s)`
                      : "Todos"}
                    {campanha.targetStatus ? ` · ${campanha.targetStatus}` : ""}
                  </p>
                </div>
                {isRecorrente ? (
                  <div className="col-span-2 rounded-lg border border-border bg-background/40 p-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Ciclos disparados</span>
                      <span className="font-medium">{campanha.totalCycles ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Enviados / erros (total)</span>
                      <span className="font-medium">
                        {campanha.totalSent} / {campanha.totalErrors}
                      </span>
                    </div>
                    {campanha.lastCycleAt && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Último ciclo</span>
                        <span className="font-medium">{formatDate(campanha.lastCycleAt)}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Catálogo automático — produtos ativos do
                      tier acima
                    </p>
                  </div>
                ) : (
                  showProgress && (
                    <div className="col-span-2 rounded-lg border border-border bg-background/40 p-3">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground">Enviados</span>
                        <span className="font-medium">
                          {sent}/{contacts} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full brand-gradient rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {campanha.totalErrors > 0 && (
                        <p className="text-[10px] text-destructive mt-1">
                          {campanha.totalErrors} erro(s) de envio
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Message preview — para RECORRENTE mostra a mensagem de salve que abre cada ciclo */}
              {!isRecorrente ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Mensagem</p>
                  <WhatsAppPreview
                    message={campanha.message}
                    mediaUrl={campanha.mediaUrl ?? undefined}
                  />
                </div>
              ) : (
                campanha.message?.trim() && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Mensagem de salve (abre cada ciclo)
                    </p>
                    <WhatsAppPreview message={campanha.message} variant="received" />
                  </div>
                )
              )}

              {/* Actions */}
              {
                <div className="flex flex-wrap gap-2 pt-1">
                  {canEdit && (
                    <button
                      onClick={() => {
                        onClose();
                        onEdit(campanha);
                      }}
                      className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-accent transition"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                  )}
                  {canDisparar && (
                    <button
                      onClick={() => onDisparar(campanha.id)}
                      className="inline-flex items-center gap-1.5 h-8 rounded-md border border-brand/40 bg-brand-soft px-3 text-xs font-medium text-brand transition"
                    >
                      <Play className="h-3 w-3" /> Disparar agora
                    </button>
                  )}
                  {canCancelar && (
                    <button
                      onClick={() => onCancelar(campanha.id)}
                      className="inline-flex items-center gap-1.5 h-8 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-xs font-medium text-destructive transition"
                    >
                      <X className="h-3 w-3" /> Cancelar
                    </button>
                  )}
                  <button
                    onClick={() => onDeletar(campanha)}
                    className="inline-flex items-center gap-1.5 h-8 rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 transition"
                  >
                    <Trash2 className="h-3 w-3" /> Remover
                  </button>
                </div>
              }

              {/* Entregas log — não se aplica a RECORRENTE (sem tabela de auditoria por lead) */}
              {!isRecorrente && (showProgress || campanha.campaignStatus === "CANCELADO") && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Log de entregas ({total})
                  </p>
                  {entregas.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Nenhuma entrega registrada.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-52 overflow-y-auto">
                      {entregas.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2"
                        >
                          <span className="text-xs text-muted-foreground font-mono truncate">
                            {e.contactId.slice(0, 8)}…
                          </span>
                          <div className="flex items-center gap-2">
                            {e.sentAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatDate(e.sentAt)}
                              </span>
                            )}
                            <span
                              className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                e.status === "ENVIADO"
                                  ? "bg-brand/10 text-brand"
                                  : e.status === "ERRO"
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-muted text-muted-foreground",
                              )}
                            >
                              {e.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

function CampanhasPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Campanha | null>(null);
  const [detalhe, setDetalhe] = useState<Campanha | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campanha | null>(null);
  const [filterStatus, setFilterStatus] = useState<CampanhaStatus | "TODOS">("TODOS");
  const [filterType, setFilterType] = useState<CampanhaTipo | "TODOS">("TODOS");

  const { data, isLoading, error } = useCampanhas();
  const disparar = useDispararCampanha();
  const cancelar = useCancelarCampanha();
  const deletar = useDeletarCampanha();
  const criar = useCriarCampanha();

  const campanhas: Campanha[] = (data?.data ?? []).filter((c) => {
    if (filterStatus !== "TODOS" && c.campaignStatus !== filterStatus) return false;
    if (filterType !== "TODOS" && c.type !== filterType) return false;
    return true;
  });

  async function handleDisparar(id: string) {
    try {
      await disparar.mutateAsync(id);
      toast.success("Campanha disparada");
      setDetalhe(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  async function handleCancelar(id: string) {
    try {
      await cancelar.mutateAsync(id);
      toast.success("Campanha cancelada");
      setDetalhe(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  async function handleDeletar(c: Campanha) {
    try {
      // EM_ANDAMENTO/AGENDADO: o backend exige cancelar antes de remover —
      // faz os dois passos em sequência para o usuário não precisar saber disso
      if (c.campaignStatus === "EM_ANDAMENTO" || c.campaignStatus === "AGENDADO") {
        await cancelar.mutateAsync(c.id);
      }
      await deletar.mutateAsync(c.id);
      toast.success("Campanha removida");
      setDetalhe(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleDuplicar(c: Campanha) {
    try {
      if (c.type === "RECORRENTE") {
        // Desloca a janela pra começar agora, mantendo a mesma duração, em vez de
        // duplicar com datas potencialmente no passado (o que ativaria a campanha
        // imediatamente sem o admin revisar).
        const now = new Date();
        const durationMs =
          c.startAt && c.endAt
            ? new Date(c.endAt).getTime() - new Date(c.startAt).getTime()
            : 24 * 60 * 60 * 1000;
        const endAt = new Date(now.getTime() + Math.max(durationMs, 60 * 60 * 1000));

        await criar.mutateAsync({
          name: `${c.name} (cópia)`,
          type: c.type,
          ...(c.message?.trim() ? { message: c.message } : {}),
          ...(c.targetStarRating ? { targetStarRating: c.targetStarRating } : {}),
          ...(c.targetStatus ? { targetStatus: c.targetStatus } : {}),
          startAt: now.toISOString(),
          endAt: endAt.toISOString(),
          repeatIntervalMinutes: c.repeatIntervalMinutes ?? 1440,
        });
        toast.success("Campanha duplicada — revise a janela de datas na tela de detalhes.");
      } else {
        await criar.mutateAsync({
          name: `${c.name} (cópia)`,
          type: c.type,
          message: c.message,
          ...(c.mediaUrl ? { mediaUrl: c.mediaUrl, mediaType: c.mediaType ?? undefined } : {}),
          ...(c.targetStarRating ? { targetStarRating: c.targetStarRating } : {}),
          ...(c.targetStatus ? { targetStatus: c.targetStatus } : {}),
          rascunho: true,
        });
        toast.success("Campanha duplicada como rascunho");
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  function openEdit(c: Campanha) {
    setEditTarget(c);
    setModalOpen(true);
  }

  function openNew() {
    setEditTarget(null);
    setModalOpen(true);
  }

  if (error) {
    return (
      <Page title="Campanhas" description="Disparos em massa segmentados.">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {extractErrorMessage(error)}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Campanhas"
      description="Disparos em massa segmentados com rastreio em tempo real."
      actions={
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-3 text-sm font-medium text-brand-foreground"
        >
          <Plus className="h-4 w-4" /> Nova Campanha
        </button>
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Status:</span>
          {(
            ["TODOS", "RASCUNHO", "AGENDADO", "EM_ANDAMENTO", "CONCLUIDO", "CANCELADO"] as const
          ).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={cn(
                "h-7 rounded-lg border px-2.5 text-xs font-medium transition",
                filterStatus === s
                  ? "border-brand bg-brand/15 text-brand"
                  : "border-border bg-background/40 text-muted-foreground hover:border-brand/40",
              )}
            >
              {s === "TODOS" ? "Todos" : STATUS_LABELS[s as CampanhaStatus]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 border-l border-border pl-2">
          <span className="text-xs text-muted-foreground">Tipo:</span>
          {(["TODOS", "IMEDIATO", "AGENDADO", "RECORRENTE"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={cn(
                "h-7 rounded-lg border px-2.5 text-xs font-medium transition",
                filterType === t
                  ? "border-brand bg-brand/15 text-brand"
                  : "border-border bg-background/40 text-muted-foreground hover:border-brand/40",
              )}
            >
              {t === "TODOS"
                ? "Todos"
                : t === "IMEDIATO"
                  ? "Imediato"
                  : t === "AGENDADO"
                    ? "Agendado"
                    : "Script · Salve"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <CardGridSkeleton cards={3} className="space-y-3" />
      ) : campanhas.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={
            filterStatus !== "TODOS" || filterType !== "TODOS"
              ? "Nenhuma campanha corresponde ao filtro"
              : "Nenhuma campanha ainda"
          }
          description={
            filterStatus !== "TODOS" || filterType !== "TODOS"
              ? "Ajuste os filtros de status e tipo para ver outras campanhas."
              : "Dispare mensagens avulsas ou crie um script de Salve: o bot chama seus leads em ciclos, com catálogo e preços do nível de cada um, até responderem."
          }
          action={
            filterStatus === "TODOS" &&
            filterType === "TODOS" && (
              <button
                onClick={openNew}
                className="inline-flex items-center gap-2 h-8 rounded-lg brand-gradient px-3 text-xs font-medium text-brand-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Criar primeira campanha
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {campanhas.map((c) => {
            const pct =
              (c.totalContacts ?? 0) > 0
                ? Math.round((c.totalSent / (c.totalContacts ?? 1)) * 100)
                : 0;
            const canDisparar = c.campaignStatus === "RASCUNHO" || c.campaignStatus === "AGENDADO";
            // Máquina de estados do slice: qualquer estado exceto CONCLUIDO/CANCELADO
            // pode ser cancelado — inclusive EM_ANDAMENTO (para o scheduler recorrente)
            const canCancelar =
              c.campaignStatus === "RASCUNHO" ||
              c.campaignStatus === "AGENDADO" ||
              c.campaignStatus === "EM_ANDAMENTO";
            // RECORRENTE segue a mesma regra dos outros tipos (CAMPANHA_RECORRENTE_API_PRONTA.md)
            const canEdit = c.campaignStatus === "RASCUNHO" || c.campaignStatus === "AGENDADO";

            return (
              <Surface
                key={c.id}
                className="p-5 cursor-pointer hover:border-brand/30 transition"
                onClick={() => setDetalhe(c)}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-soft text-brand shrink-0">
                      {c.type === "RECORRENTE" ? (
                        <Repeat className="h-5 w-5" />
                      ) : c.mediaUrl ? (
                        <ImageIcon className="h-5 w-5" />
                      ) : (
                        <Megaphone className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold">{c.name}</h3>
                        <StatusBadge status={c.campaignStatus} />
                        <span
                          className={cn(
                            "text-[10px] rounded-full px-2 py-0.5 border",
                            c.type === "RECORRENTE"
                              ? "border-brand/30 bg-brand/10 text-brand"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {c.type === "IMEDIATO"
                            ? "Imediato"
                            : c.type === "AGENDADO"
                              ? "Agendado"
                              : "👋 Script · Salve"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                        {c.targetStarRating && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {"⭐".repeat(Number(c.targetStarRating))} {c.targetStarRating}{" "}
                            estrela(s)
                            {c.targetStatus ? ` · ${c.targetStatus}` : ""}
                          </span>
                        )}
                        {c.type === "RECORRENTE" ? (
                          <>
                            {c.startAt && c.endAt && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(c.startAt)} → {formatDate(c.endAt)}
                              </span>
                            )}
                            {c.repeatIntervalMinutes && (
                              <span className="inline-flex items-center gap-1">
                                <Repeat className="h-3 w-3" />
                                {REPEAT_INTERVAL_OPTIONS.find(
                                  (o) => o.value === c.repeatIntervalMinutes,
                                )?.label ?? `a cada ${c.repeatIntervalMinutes}min`}
                              </span>
                            )}
                          </>
                        ) : (
                          c.scheduledFor && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(c.scheduledFor)}
                            </span>
                          )
                        )}
                      </div>
                      {c.type === "RECORRENTE"
                        ? (
                            <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                              <Package className="h-3 w-3" /> Catálogo automático por tier
                            </p>
                          )
                        : c.message && (
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-2 max-w-md italic">
                              "{c.message}"
                            </p>
                          )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="text-right tabular-nums mr-2">
                      {c.type === "RECORRENTE" ? (
                        <>
                          <div className="text-lg font-semibold">{c.totalCycles ?? 0}</div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            ciclos
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-lg font-semibold">
                            {c.totalSent}
                            <span className="text-muted-foreground text-sm">
                              /{c.totalContacts ?? 0}
                            </span>
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            enviados
                          </div>
                        </>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 w-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setDetalhe(c)}>
                          <Eye className="h-3.5 w-3.5 mr-2" /> Ver detalhes
                        </DropdownMenuItem>
                        {canEdit && (
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                        )}
                        {canDisparar && (
                          <DropdownMenuItem
                            onClick={() => handleDisparar(c.id)}
                            className="text-brand focus:text-brand"
                          >
                            <Play className="h-3.5 w-3.5 mr-2" /> Disparar agora
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDuplicar(c)}>
                          <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        {canCancelar && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleCancelar(c.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-2" /> Cancelar
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(c)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {c.type === "RECORRENTE"
                  ? c.lastCycleAt && (
                      <p className="mt-3 text-[10px] text-muted-foreground">
                        Último ciclo: {formatDate(c.lastCycleAt)} · {c.totalSent} enviados /{" "}
                        {c.totalErrors} erros no total
                      </p>
                    )
                  : (c.campaignStatus === "EM_ANDAMENTO" || c.campaignStatus === "CONCLUIDO") && (
                      <div className="mt-4">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Progresso de envio</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full brand-gradient rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
              </Surface>
            );
          })}
        </div>
      )}

      <CampanhaModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        initial={editTarget}
      />

      <DetalheDrawer
        campanha={detalhe}
        onClose={() => setDetalhe(null)}
        onEdit={openEdit}
        onDisparar={handleDisparar}
        onCancelar={handleCancelar}
        onDeletar={(c) => setDeleteTarget(c)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <span className="font-medium text-foreground">{deleteTarget?.name}</span>{" "}
              será removida definitivamente, junto com o histórico de entregas.
              {(deleteTarget?.campaignStatus === "EM_ANDAMENTO" ||
                deleteTarget?.campaignStatus === "AGENDADO") && (
                <>
                  {" "}
                  Como ela está{" "}
                  {deleteTarget.campaignStatus === "EM_ANDAMENTO" ? "em andamento" : "agendada"}, os
                  disparos serão <span className="font-medium text-foreground">cancelados</span>{" "}
                  antes da remoção.
                </>
              )}{" "}
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter campanha</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDeletar(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
