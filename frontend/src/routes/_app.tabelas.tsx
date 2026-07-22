import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Page, Surface } from "@/components/app/page";
import {
  QK,
  useProdutos,
  useCriarEntradaTabelaPreco,
  useAtualizarEntradaTabelaPreco,
  useDeletarEntradaTabelaPreco,
  toNumber,
  type Produto,
  type PrecoProdutoEntry,
  type TipoCliente,
} from "@/lib/queries";
import { apiGet, extractErrorMessage } from "@/lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Package,
  ChevronRight,
  Info,
  TriangleAlert,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { WhatsAppPreview } from "@/components/app/whatsapp-preview";

export const Route = createFileRoute("/_app/tabelas")({
  head: () => ({ meta: [{ title: "Tabelas de Preços — wpp-autoflow" }] }),
  component: TabelasPage,
});

// ── tier config ───────────────────────────────────────────────────────────────

const TIERS: TipoCliente[] = ["C", "B", "A", "TODOS"];
const STAR_TIERS: TipoCliente[] = ["C", "B", "A"]; // tiers with star levels only

const TIER = {
  C: {
    icon: "⭐",
    label: "1 estrela",
    leadLabel: "Leads com 1 estrela",
    color: "border-border",
    bg: "bg-muted/30",
    badge: "bg-muted text-muted-foreground border-border",
  },
  B: {
    icon: "⭐⭐",
    label: "2 estrelas",
    leadLabel: "Leads com 2 estrelas",
    color: "border-info/25",
    bg: "bg-info/5",
    badge: "bg-info/10 text-info border-info/30",
  },
  A: {
    icon: "⭐⭐⭐",
    label: "3 estrelas",
    leadLabel: "Leads com 3 estrelas",
    color: "border-brand/25",
    bg: "bg-brand/5",
    badge: "bg-brand/10 text-brand border-brand/30",
  },
  TODOS: {
    icon: null,
    label: "Todos",
    leadLabel: "Todos os leads",
    color: "border-violet-500/25",
    bg: "bg-violet-500/5",
    badge: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  },
} satisfies Record<
  TipoCliente,
  {
    icon: string | null;
    label: string;
    leadLabel: string;
    color: string;
    bg: string;
    badge: string;
  }
>;

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtRange(min: number | string, max: number | string | null, unit: string) {
  const minN = toNumber(min);
  const maxN = max != null ? toNumber(max) : null;
  if (maxN == null) return `${minN}+ ${unit}`;
  return `${minN}–${maxN} ${unit}`;
}

function buildTierPreviewMessage(
  tier: TipoCliente,
  produtosComPreco: Array<{ produto: Produto; entries: PrecoProdutoEntry[] }>,
): string {
  if (produtosComPreco.length === 0) return "";

  const t = TIER[tier];
  const isTodos = tier === "TODOS";

  const headerIcon = isTodos ? "📋" : (t.icon ?? "📋");
  const headerLabel = isTodos ? "Tabela Geral" : `Condições especiais para clientes ${t.icon}`;

  const lines: string[] = [`*Tabela de Preços*`, `_${headerLabel}_`, ""];

  let hasContent = false;
  for (const { produto, entries } of produtosComPreco) {
    // For specific tiers: show tier-specific entries + TODOS entries merged
    // For TODOS tab: show only TODOS entries
    const tierEntries = entries
      .filter((e) =>
        isTodos ? e.starRating === "TODOS" : e.starRating === tier || e.starRating === "TODOS",
      )
      .sort((a, b) => toNumber(a.minQuantity) - toNumber(b.minQuantity));
    if (tierEntries.length === 0) continue;

    hasContent = true;
    lines.push(`📦 *${produto.name}*`);
    if (produto.description) lines.push(produto.description);

    for (const e of tierEntries) {
      const disc = toNumber(e.maxDiscountPct);
      const discText = disc > 0 ? ` _(desc. até ${disc}%)_` : "";
      lines.push(
        `• ${fmtRange(e.minQuantity, e.maxQuantity, produto.unit)}: R$ ${toNumber(e.unitPrice).toFixed(2)}/${produto.unit}${discText}`,
      );
    }
    lines.push("");
  }

  if (!hasContent) return "";
  lines.push("_Preços válidos hoje. Fale conosco para negociar!_ 💬");
  return lines.join("\n").trimEnd();
}

// ── PriceEntryModal ───────────────────────────────────────────────────────────

const EMPTY_ENTRY = {
  starRating: "C" as TipoCliente,
  minQuantity: "1",
  maxQuantity: "",
  unitPrice: "",
  maxDiscountPct: "0",
};

function PriceEntryModal({
  open,
  onClose,
  produtoId,
  produtoName,
  initial,
  defaultTier,
}: {
  open: boolean;
  onClose: () => void;
  produtoId: string;
  produtoName: string;
  initial?: PrecoProdutoEntry | null;
  defaultTier?: TipoCliente;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState(() =>
    initial
      ? {
          starRating: initial.starRating,
          minQuantity: String(initial.minQuantity),
          maxQuantity: initial.maxQuantity != null ? String(initial.maxQuantity) : "",
          unitPrice: String(toNumber(initial.unitPrice)),
          maxDiscountPct: String(toNumber(initial.maxDiscountPct)),
        }
      : { ...EMPTY_ENTRY, starRating: defaultTier ?? "C" },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const criar = useCriarEntradaTabelaPreco();
  const atualizar = useAtualizarEntradaTabelaPreco();
  const isPending = criar.isPending || atualizar.isPending;

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
  }

  function validate() {
    const e: Record<string, string> = {};
    const min = Number(form.minQuantity);
    const max = form.maxQuantity ? Number(form.maxQuantity) : null;
    if (!form.unitPrice || Number(form.unitPrice) <= 0) e.unitPrice = "Preço obrigatório";
    if (isNaN(min) || min < 0) e.minQuantity = "Quantidade inválida";
    if (max !== null && max <= min) e.maxQuantity = "Máximo deve ser maior que mínimo";
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    try {
      const body = {
        starRating: form.starRating as TipoCliente,
        minQuantity: Number(form.minQuantity),
        maxQuantity: form.maxQuantity ? Number(form.maxQuantity) : null,
        unitPrice: Number(form.unitPrice),
        maxDiscountPct: Number(form.maxDiscountPct),
      };
      if (isEdit) {
        await atualizar.mutateAsync({ produtoId, entryId: initial!.id, ...body });
        toast.success("Faixa atualizada");
      } else {
        await criar.mutateAsync({ produtoId, ...body });
        toast.success("Faixa adicionada");
      }
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar faixa" : "Nova faixa"} — {produtoName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tier do cliente *</label>
            <div className="grid grid-cols-2 gap-2">
              {TIERS.map((t) => {
                const meta = TIER[t];
                const isTodos = t === "TODOS";
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("starRating", t)}
                    className={cn(
                      "rounded-lg border p-2.5 text-sm font-medium transition flex flex-col items-center gap-0.5",
                      form.starRating === t
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border bg-background/40 text-muted-foreground hover:border-brand/40",
                    )}
                  >
                    {isTodos ? (
                      <Users className="h-5 w-5" />
                    ) : (
                      <span className="text-lg">{meta.icon}</span>
                    )}
                    <span className="text-[10px]">{meta.label}</span>
                  </button>
                );
              })}
            </div>
            {form.starRating === "TODOS" && (
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Estas faixas serão enviadas para <strong>todos os leads</strong>, complementando o
                preço do tier específico.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Qtd. mínima *</label>
              <input
                type="number"
                min={0}
                value={form.minQuantity}
                onChange={(e) => set("minQuantity", e.target.value)}
                className={cn(
                  "w-full h-9 rounded-lg border bg-background/40 px-3 text-sm outline-none focus:border-brand transition",
                  errors.minQuantity ? "border-destructive" : "border-border",
                )}
              />
              {errors.minQuantity && (
                <p className="text-[11px] text-destructive">{errors.minQuantity}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Qtd. máxima <span className="text-muted-foreground/60">(vazio = sem limite)</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.maxQuantity}
                placeholder="—"
                onChange={(e) => set("maxQuantity", e.target.value)}
                className={cn(
                  "w-full h-9 rounded-lg border bg-background/40 px-3 text-sm outline-none focus:border-brand transition",
                  errors.maxQuantity ? "border-destructive" : "border-border",
                )}
              />
              {errors.maxQuantity && (
                <p className="text-[11px] text-destructive">{errors.maxQuantity}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Preço unitário (R$) *
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.unitPrice}
                placeholder="0,00"
                onChange={(e) => set("unitPrice", e.target.value)}
                className={cn(
                  "w-full h-9 rounded-lg border bg-background/40 px-3 text-sm outline-none focus:border-brand transition",
                  errors.unitPrice ? "border-destructive" : "border-border",
                )}
              />
              {errors.unitPrice && (
                <p className="text-[11px] text-destructive">{errors.unitPrice}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Desconto máx. (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.maxDiscountPct}
                onChange={(e) => set("maxDiscountPct", e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-accent transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-4 text-sm font-medium text-brand-foreground disabled:opacity-70"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar faixa
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ProductDetailDrawer ───────────────────────────────────────────────────────

function ProductDetailDrawer({
  produto,
  entries,
  tier,
  onClose,
  onAdd,
  onEdit,
}: {
  produto: Produto | null;
  entries: PrecoProdutoEntry[];
  tier: TipoCliente;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (e: PrecoProdutoEntry) => void;
}) {
  if (!produto) return null;

  const tierEntries = entries
    .filter((e) => e.starRating === tier)
    .sort((a, b) => toNumber(a.minQuantity) - toNumber(b.minQuantity));

  const previewMessage = buildTierPreviewMessage(tier, [{ produto, entries }]);

  return (
    <Sheet open={!!produto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand shrink-0">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle>{produto.name}</SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {produto.unit} · {produto.categoryName ?? "Sem categoria"}
                  {" · "}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-px text-[10px] font-medium",
                      TIER[tier].badge,
                    )}
                  >
                    {TIER[tier].icon ?? ""} {TIER[tier].leadLabel}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={onAdd}
              className="shrink-0 inline-flex items-center gap-1.5 h-8 rounded-lg brand-gradient px-3 text-xs font-medium text-brand-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Nova faixa
            </button>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: entry list */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Faixas cadastradas
            </p>
            {tierEntries.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
                <Package className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhuma faixa para este tier.</p>
                <button
                  onClick={onAdd}
                  className="mt-3 text-xs text-brand hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Definir preços
                </button>
              </div>
            ) : (
              tierEntries.map((e, i) => (
                <div key={e.id} className="rounded-xl border border-border bg-background/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Faixa {i + 1}
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {fmtRange(e.minQuantity, e.maxQuantity, produto.unit)}
                      </p>
                      <p className="text-xl font-bold text-brand mt-1">
                        R$ {toNumber(e.unitPrice).toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /{produto.unit}
                        </span>
                      </p>
                      {toNumber(e.maxDiscountPct) > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          desconto máx. {toNumber(e.maxDiscountPct)}%
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onEdit(e)}
                      className="h-7 w-7 grid place-items-center rounded-lg border border-border bg-background text-muted-foreground hover:text-brand hover:border-brand/40 transition shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: WhatsApp preview */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preview — como o lead recebe
            </p>
            <WhatsAppPreview
              message={previewMessage || `Sem faixas cadastradas para ${TIER[tier].leadLabel}.`}
              variant="received"
            />
            <p className="text-[11px] text-muted-foreground text-center">
              {tier === "TODOS"
                ? "Esta tabela complementa o tier específico de cada lead"
                : `Preview para leads ${TIER[tier].icon ?? ""} ${TIER[tier].label} (inclui faixas TODOS)`}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── ProductRow — one product's entry for a tier ───────────────────────────────

function ProductRow({
  produto,
  entries,
  tier,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  onDetail,
}: {
  produto: Produto;
  entries: PrecoProdutoEntry[];
  tier: TipoCliente;
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (e: PrecoProdutoEntry) => void;
  onDelete: (e: PrecoProdutoEntry) => void;
  onDetail: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const tierEntries = entries
    .filter((e) => e.starRating === tier)
    .sort((a, b) => toNumber(a.minQuantity) - toNumber(b.minQuantity));

  const isEmpty = tierEntries.length === 0;

  return (
    <Surface
      className={cn(
        "overflow-hidden transition",
        isEmpty ? "border-dashed opacity-75 hover:opacity-100" : "",
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => !isEmpty && setExpanded((v) => !v)}
      >
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft/50 text-brand shrink-0">
          <Package className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{produto.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {produto.unit}
            {produto.categoryName ? ` · ${produto.categoryName}` : ""}
          </p>
        </div>

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            {isEmpty ? (
              <span className="text-[10px] text-muted-foreground border border-dashed border-border rounded-full px-2 py-0.5">
                sem preços
              </span>
            ) : (
              <span
                className={cn(
                  "text-[10px] font-medium border rounded-full px-2 py-0.5",
                  TIER[tier].badge,
                )}
              >
                {tierEntries.length} {tierEntries.length === 1 ? "faixa" : "faixas"}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="h-7 w-7 grid place-items-center rounded-lg border border-border bg-background/60 text-muted-foreground hover:text-brand hover:border-brand/40 transition"
              title="Nova faixa"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            {!isEmpty && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDetail();
                  }}
                  className="h-7 w-7 grid place-items-center rounded-lg border border-border bg-background/60 text-muted-foreground hover:text-brand hover:border-brand/40 transition"
                  title="Ver detalhes e preview"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    expanded && "rotate-90",
                  )}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Entries */}
      {!isEmpty && expanded && (
        <div className="border-t border-border divide-y divide-border">
          {tierEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 group transition"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">
                  {fmtRange(entry.minQuantity, entry.maxQuantity, produto.unit)}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-sm font-bold text-brand">
                    R$ {toNumber(entry.unitPrice).toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground">
                      /{produto.unit}
                    </span>
                  </p>
                  {toNumber(entry.maxDiscountPct) > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      desc. até {toNumber(entry.maxDiscountPct)}%
                    </span>
                  )}
                </div>
              </div>

              {deleteConfirm === entry.id ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-destructive font-medium">Excluir?</span>
                  <button
                    onClick={() => {
                      onDelete(entry);
                      setDeleteConfirm(null);
                    }}
                    className="h-6 rounded px-2 text-[11px] font-medium bg-destructive text-white hover:bg-destructive/90"
                  >
                    Sim
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="h-6 rounded px-2 text-[11px] border border-border hover:bg-accent"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button
                    onClick={() => onEdit(entry)}
                    className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(entry.id)}
                    className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Empty other tiers hint */}
          <div className="px-4 py-2.5 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              Faixas do{" "}
              <strong>
                {TIER[tier].icon ?? "🌐"} {TIER[tier].label}
              </strong>
              . Gerencie outros tiers na aba correspondente.
            </p>
          </div>
        </div>
      )}

      {/* Empty CTA */}
      {isEmpty && !isLoading && (
        <div
          className="border-t border-dashed border-border px-4 py-5 text-center cursor-pointer hover:bg-accent/20 transition"
          onClick={onAdd}
        >
          <p className="text-xs text-muted-foreground">
            <Plus className="inline h-3.5 w-3.5 mr-1" />
            Definir preços para este tier
          </p>
        </div>
      )}
    </Surface>
  );
}

// ── TabelasPage ───────────────────────────────────────────────────────────────

function TabelasPage() {
  const [activeTier, setActiveTier] = useState<TipoCliente>("C");
  const [entryModal, setEntryModal] = useState<{
    open: boolean;
    produtoId?: string;
    produtoName?: string;
    entry?: PrecoProdutoEntry | null;
    defaultTier?: TipoCliente;
  }>({ open: false });
  const [detailProduto, setDetailProduto] = useState<Produto | null>(null);

  const qc = useQueryClient();

  const { data: produtosData, isLoading: produtosLoading } = useProdutos();
  const produtos: Produto[] = produtosData?.data ?? [];
  const ativos = produtos.filter((p) => p.status === "ATIVO");

  // Fetch price tables for all active products in parallel
  const tabelasQueries = useQueries({
    queries: ativos.map((p) => ({
      queryKey: QK.tabelaPreco(p.id),
      queryFn: () => apiGet<PrecoProdutoEntry[]>(`/produtos/${p.id}/tabela-preco`),
    })),
  });

  const tabelaMap = useMemo(() => {
    const map: Record<string, PrecoProdutoEntry[]> = {};
    ativos.forEach((p, i) => {
      map[p.id] = tabelasQueries[i]?.data ?? [];
    });
    return map;
  }, [ativos, tabelasQueries]);

  const isLoadingTabelas = tabelasQueries.some((q) => q.isLoading);

  const deletar = useDeletarEntradaTabelaPreco();

  async function handleDelete(produtoId: string, entry: PrecoProdutoEntry) {
    try {
      await deletar.mutateAsync({ produtoId, entryId: entry.id });
      toast.success("Faixa removida");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  // Count products that have at least one entry for each tier
  const tierCounts = useMemo(() => {
    const counts: Record<TipoCliente, number> = { C: 0, B: 0, A: 0, TODOS: 0 };
    for (const p of ativos) {
      const entries = tabelaMap[p.id] ?? [];
      for (const t of TIERS) {
        if (entries.some((e) => e.starRating === t)) counts[t]++;
      }
    }
    return counts;
  }, [ativos, tabelaMap]);

  // Products with entries for active tier (sorted: with entries first)
  const produtosSorted = useMemo(() => {
    return [...ativos].sort((a, b) => {
      const hasEntry = (p: Produto) => {
        const entries = tabelaMap[p.id] ?? [];
        return entries.some((e) => e.starRating === activeTier);
      };
      return (hasEntry(a) ? 0 : 1) - (hasEntry(b) ? 0 : 1) || a.name.localeCompare(b.name);
    });
  }, [ativos, tabelaMap, activeTier]);

  // For preview: show products that have entries for activeTier OR (if activeTier != TODOS) for TODOS
  const produtosComPreco = useMemo(() => {
    return ativos
      .filter((p) => {
        const entries = tabelaMap[p.id] ?? [];
        if (activeTier === "TODOS") return entries.some((e) => e.starRating === "TODOS");
        return entries.some((e) => e.starRating === activeTier || e.starRating === "TODOS");
      })
      .map((p) => ({ produto: p, entries: tabelaMap[p.id] ?? [] }));
  }, [ativos, tabelaMap, activeTier]);

  const previewMessage = useMemo(
    () => buildTierPreviewMessage(activeTier, produtosComPreco),
    [activeTier, produtosComPreco],
  );

  const detailEntries = detailProduto ? (tabelaMap[detailProduto.id] ?? []) : [];

  return (
    <Page
      title="Tabelas de Preços"
      description="Configure preços por tier. O bot usa esta tabela para enviar cotações automaticamente ao lead."
    >
      {/* Tier tabs */}
      <Surface className="p-2">
        <div className="flex gap-2">
          {TIERS.map((tier) => {
            const t = TIER[tier];
            const count = tierCounts[tier];
            const isActive = activeTier === tier;
            const isTodos = tier === "TODOS";
            return (
              <button
                key={tier}
                onClick={() => setActiveTier(tier)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 rounded-xl px-3 py-3 transition",
                  isActive
                    ? cn(
                        "border text-foreground",
                        isTodos
                          ? "bg-violet-500/10 border-violet-500/30"
                          : "bg-brand/10 border-brand/30",
                      )
                    : "border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {isTodos ? (
                  <Users className="h-5 w-5" />
                ) : (
                  <span className="text-xl">{t.icon}</span>
                )}
                <span className="text-xs font-semibold">{t.label}</span>
                {produtosLoading || isLoadingTabelas ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span
                    className={cn(
                      "text-[10px] rounded-full px-2 py-px border font-medium",
                      count > 0 ? t.badge : "text-muted-foreground border-border bg-muted/30",
                    )}
                  >
                    {count} {count === 1 ? "produto" : "produtos"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Surface>

      {/* Info bar */}
      <div
        className={cn(
          "rounded-xl border px-4 py-3 text-sm flex items-center gap-3",
          TIER[activeTier].bg,
          TIER[activeTier].color,
        )}
      >
        {activeTier === "TODOS" ? (
          <Users className="h-6 w-6 text-violet-500 shrink-0" />
        ) : (
          <span className="text-2xl shrink-0">{TIER[activeTier].icon}</span>
        )}
        <div>
          <p className="font-medium">{TIER[activeTier].leadLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeTier === "TODOS"
              ? "Preços cadastrados aqui são enviados para todos os leads, independentemente do nível de estrela — complementam o tier específico."
              : `Configure os preços que o bot envia quando um lead com ${TIER[activeTier].label} pede uma cotação via WhatsApp. Os preços do tier TODOS também são incluídos.`}
          </p>
        </div>
      </div>

      {produtosLoading ? (
        <Surface className="p-16 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Surface>
      ) : ativos.length === 0 ? (
        <Surface className="p-12 flex flex-col items-center gap-3 text-center">
          <Package className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum produto ativo cadastrado.</p>
          <p className="text-xs text-muted-foreground">
            Crie produtos ativos primeiro para configurar as tabelas de preços.
          </p>
        </Surface>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* ── Left: product list ── */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Produtos</p>
                <p className="text-[11px] text-muted-foreground">
                  {produtosComPreco.length} de {ativos.length} produto(s) com preço configurado
                </p>
              </div>
              <button
                onClick={() => setEntryModal({ open: true, defaultTier: activeTier })}
                className="inline-flex items-center gap-1.5 h-8 rounded-lg brand-gradient px-3 text-xs font-medium text-brand-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Nova faixa
              </button>
            </div>

            {produtosSorted.map((p) => {
              const qIdx = ativos.findIndex((a) => a.id === p.id);
              const isLoadingThis = tabelasQueries[qIdx]?.isLoading ?? false;
              return (
                <ProductRow
                  key={p.id}
                  produto={p}
                  entries={tabelaMap[p.id] ?? []}
                  tier={activeTier}
                  isLoading={isLoadingThis}
                  onAdd={() =>
                    setEntryModal({
                      open: true,
                      produtoId: p.id,
                      produtoName: p.name,
                      defaultTier: activeTier,
                    })
                  }
                  onEdit={(e) =>
                    setEntryModal({ open: true, produtoId: p.id, produtoName: p.name, entry: e })
                  }
                  onDelete={(e) => handleDelete(p.id, e)}
                  onDetail={() => setDetailProduto(p)}
                />
              );
            })}
          </div>

          {/* ── Right: WhatsApp preview ── */}
          <div className="lg:col-span-2 lg:sticky lg:top-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Preview WhatsApp</p>
              <p className="text-[11px] text-muted-foreground">
                Assim o bot envia a cotação para {TIER[activeTier].leadLabel.toLowerCase()}
              </p>
            </div>

            {produtosComPreco.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border bg-background/30 p-8 text-center space-y-3">
                {activeTier === "TODOS" ? (
                  <Users className="h-8 w-8 mx-auto text-violet-400" />
                ) : (
                  <div className="text-4xl">{TIER[activeTier].icon}</div>
                )}
                <p className="text-sm text-muted-foreground">
                  {activeTier === "TODOS"
                    ? "Nenhuma faixa global cadastrada ainda."
                    : "Nenhum produto configurado para este tier ainda."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Adicione faixas de preço aos produtos ao lado para ver o preview aparecer aqui.
                </p>
              </div>
            ) : (
              <WhatsAppPreview message={previewMessage} variant="received" />
            )}

            {produtosComPreco.length > 0 && (
              <div
                className={cn(
                  "rounded-xl border p-3 space-y-1",
                  TIER[activeTier].bg,
                  TIER[activeTier].color,
                )}
              >
                <p className="text-[11px] font-semibold flex items-center gap-1.5">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  Como funciona
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {activeTier === "TODOS"
                    ? "Estes preços são enviados para todos os leads, independente do nível de estrela, complementando o tier específico."
                    : `Quando um lead com ${TIER[activeTier].icon} pede cotação, o bot monta esta mensagem com preços do tier ${TIER[activeTier].label} + faixas TODOS.`}
                </p>
              </div>
            )}

            {/* Quick stats */}
            {produtosComPreco.length > 0 && (
              <Surface className="p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Resumo do tier
                </p>
                {produtosComPreco.map(({ produto, entries }) => {
                  const tierEntries = entries
                    .filter((e) => e.starRating === activeTier)
                    .sort((a, b) => toNumber(a.minQuantity) - toNumber(b.minQuantity));
                  const minPrice = Math.min(...tierEntries.map((e) => toNumber(e.unitPrice)));
                  return (
                    <div key={produto.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                        <span className="text-xs truncate">{produto.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">a partir de</span>
                        <span className="text-xs font-semibold text-brand">
                          R$ {minPrice.toFixed(2)}
                        </span>
                        <button
                          onClick={() => setDetailProduto(produto)}
                          className="text-muted-foreground hover:text-brand transition"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </Surface>
            )}
          </div>
        </div>
      )}

      {/* Entry modal — product picker when no product is pre-selected */}
      {entryModal.open &&
        (entryModal.produtoId ? (
          <PriceEntryModal
            key={entryModal.entry?.id ?? "new"}
            open={true}
            onClose={() => setEntryModal({ open: false })}
            produtoId={entryModal.produtoId}
            produtoName={entryModal.produtoName ?? ""}
            initial={entryModal.entry}
            defaultTier={entryModal.defaultTier ?? activeTier}
          />
        ) : (
          <ProdutoPickerModal
            open={true}
            onClose={() => setEntryModal({ open: false })}
            produtos={ativos}
            defaultTier={activeTier}
            onSelect={(produtoId, produtoName) =>
              setEntryModal({ open: true, produtoId, produtoName, defaultTier: activeTier })
            }
          />
        ))}

      {/* Product detail drawer */}
      <ProductDetailDrawer
        produto={detailProduto}
        entries={detailEntries}
        tier={activeTier}
        onClose={() => setDetailProduto(null)}
        onAdd={() => {
          if (detailProduto) {
            setDetailProduto(null);
            setEntryModal({
              open: true,
              produtoId: detailProduto.id,
              produtoName: detailProduto.name,
              defaultTier: activeTier,
            });
          }
        }}
        onEdit={(e) => {
          if (detailProduto) {
            setDetailProduto(null);
            setEntryModal({
              open: true,
              produtoId: detailProduto.id,
              produtoName: detailProduto.name,
              entry: e,
            });
          }
        }}
      />
    </Page>
  );
}

// ── ProdutoPickerModal ────────────────────────────────────────────────────────

function ProdutoPickerModal({
  open,
  onClose,
  produtos,
  defaultTier,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  produtos: Produto[];
  defaultTier: TipoCliente;
  onSelect: (id: string, name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<TipoCliente>(defaultTier);

  const filtered = produtos.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Selecionar produto</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-4 gap-2">
            {TIERS.map((t) => {
              const isTodos = t === "TODOS";
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={cn(
                    "rounded-lg border p-2 text-sm transition flex flex-col items-center gap-0.5",
                    tier === t
                      ? cn(
                          "border-brand bg-brand/10 text-brand",
                          isTodos && "border-violet-500 bg-violet-500/10 text-violet-600",
                        )
                      : "border-border bg-background/40 text-muted-foreground hover:border-brand/40",
                  )}
                >
                  {isTodos ? (
                    <Users className="h-4 w-4" />
                  ) : (
                    <span className="text-base">{TIER[t].icon}</span>
                  )}
                  <span className="text-[10px]">{TIER[t].label}</span>
                </button>
              );
            })}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto…"
            className="w-full h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
          />

          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum produto encontrado.
              </p>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id, p.name)}
                className="w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left hover:border-brand/40 hover:bg-accent/40 transition"
              >
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand shrink-0">
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {p.unit}
                    {p.categoryName ? ` · ${p.categoryName}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-accent transition"
          >
            Cancelar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
