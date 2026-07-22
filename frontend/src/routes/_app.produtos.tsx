import { createFileRoute } from "@tanstack/react-router";
import { Page, Surface } from "@/components/app/page";
import { EmptyState } from "@/components/app/empty-state";
import { CardGridSkeleton } from "@/components/app/table-skeleton";
import {
  useProdutos,
  useCriarProduto,
  useAtualizarProduto,
  useDeletarProduto,
  useCategorias,
  useCriarCategoria,
  useTabelaPreco,
  useCriarEntradaTabelaPreco,
  useAtualizarEntradaTabelaPreco,
  useDeletarEntradaTabelaPreco,
  useMidias,
  useProdutoMidias,
  useAtrelarMidiaProduto,
  useRemoverMidiaProduto,
  toNumber,
  type Produto,
  type PrecoProdutoEntry,
  type TipoCliente,
  type ProdutoStatus,
  type Midia,
} from "@/lib/queries";
import {
  Plus,
  Search,
  Package,
  MoreVertical,
  Edit,
  Power,
  Loader2,
  X,
  Tag,
  TableProperties,
  Pencil,
  Trash2,
  Info,
  Users,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/api";
import { WhatsAppPreview } from "@/components/app/whatsapp-preview";

export const Route = createFileRoute("/_app/produtos")({
  head: () => ({ meta: [{ title: "Produtos — wpp-autoflow" }] }),
  component: ProdutosPage,
});

// ── constants ─────────────────────────────────────────────────────────────────

const UNIDADES = ["un", "g", "kg", "ml", "L", "cx", "pct"];

const TIER_META: Record<
  TipoCliente,
  { icon: string | null; label: string; leadLabel: string; color: string }
> = {
  C: {
    icon: "⭐",
    label: "Tier C",
    leadLabel: "Leads com 1 estrela",
    color: "bg-muted/50 border-border",
  },
  B: {
    icon: "⭐⭐",
    label: "Tier B",
    leadLabel: "Leads com 2 estrelas",
    color: "bg-info/5 border-info/20",
  },
  A: {
    icon: "⭐⭐⭐",
    label: "Tier A",
    leadLabel: "Leads com 3 estrelas",
    color: "bg-brand/5 border-brand/20",
  },
  TODOS: {
    icon: null,
    label: "Todos",
    leadLabel: "Todos os leads",
    color: "bg-violet-500/5 border-violet-500/20",
  },
};

const TIERS: TipoCliente[] = ["C", "B", "A", "TODOS"];

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtRange(min: number | string, max: number | string | null, unit: string) {
  const minN = toNumber(min);
  const maxN = max != null ? toNumber(max) : null;
  if (maxN == null) return `${minN}+ ${unit}`;
  return `${minN} – ${maxN} ${unit}`;
}

function buildPriceTableMessage(produto: Produto, tier: TipoCliente, entries: PrecoProdutoEntry[]) {
  const meta = TIER_META[tier];
  // For star tiers, include TODOS entries too (complement)
  const tierEntries = entries
    .filter((e) => e.starRating === tier || (tier !== "TODOS" && e.starRating === "TODOS"))
    .sort((a, b) => toNumber(a.minQuantity) - toNumber(b.minQuantity));
  if (tierEntries.length === 0) return "";
  const lines = tierEntries.map(
    (e) =>
      `${fmtRange(e.minQuantity, e.maxQuantity, produto.unit)}:\nR$ ${toNumber(e.unitPrice).toFixed(2)}/${produto.unit}`,
  );
  const header = tier === "TODOS" ? "Todos os leads" : meta.leadLabel;
  return `*Tabela de Preços*\n${produto.name}\n${header}\n\n${lines.join("\n\n")}\n\n_Condições válidas hoje_`;
}

// ── ProdutoModal (basics only) ────────────────────────────────────────────────

function ProdutoModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Produto | null;
}) {
  const isEdit = !!initial;

  const [nome, setNome] = useState(initial?.name ?? "");
  const [descricao, setDescricao] = useState(initial?.description ?? "");
  const [unidade, setUnidade] = useState(initial?.unit ?? "un");
  const [categoriaId, setCategoriaId] = useState(initial?.categoryId ?? "");
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [adicionandoCategoria, setAdicionandoCategoria] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Only one photo is allowed per product — single selection, not a set.
  const [pendingMediaId, setPendingMediaId] = useState<string | null>(null);

  const { data: categoriasData } = useCategorias();
  const categorias = categoriasData ?? [];

  const { data: midiasData } = useMidias();
  const midias: Midia[] = (midiasData ?? []).filter((m) => m.type === "IMAGEM");
  const { data: produtoMidias = [] } = useProdutoMidias(initial?.id);
  const attachedByUrl = new Map(produtoMidias.map((pm) => [pm.url, pm]));
  const attachedImages = produtoMidias.filter((pm) => pm.mediaType === "IMAGEM");

  const criar = useCriarProduto();
  const atualizar = useAtualizarProduto();
  const criarCategoria = useCriarCategoria();
  const atrelarMidia = useAtrelarMidiaProduto();
  const removerMidia = useRemoverMidiaProduto();
  const isPending = criar.isPending || atualizar.isPending;
  const isMediaMutating = atrelarMidia.isPending || removerMidia.isPending;

  async function toggleMedia(m: Midia) {
    if (isMediaMutating) return;
    if (isEdit) {
      const existing = attachedByUrl.get(m.url);
      if (existing) {
        await removerMidia.mutateAsync({ produtoId: initial!.id, mediaEntryId: existing.id });
        return;
      }
      // Enforce a single photo: unatrelar any other attached image first.
      for (const pm of attachedImages) {
        await removerMidia.mutateAsync({ produtoId: initial!.id, mediaEntryId: pm.id });
      }
      await atrelarMidia.mutateAsync({ produtoId: initial!.id, mediaId: m.id, caption: m.name });
    } else {
      setPendingMediaId((prev) => (prev === m.id ? null : m.id));
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "Nome obrigatório";
    return e;
  }

  async function handleAdicionarCategoria() {
    if (!novaCategoriaNome.trim()) return;
    try {
      const cat = await criarCategoria.mutateAsync({ name: novaCategoriaNome.trim() });
      setCategoriaId(cat.id);
      setNovaCategoriaNome("");
      setAdicionandoCategoria(false);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    try {
      const body = {
        name: nome.trim(),
        description: descricao.trim() || undefined,
        unit: unidade,
        categoryId: categoriaId || undefined,
      };
      if (isEdit) {
        await atualizar.mutateAsync({ id: initial!.id, ...body });
        toast.success("Produto atualizado");
      } else {
        const novoProduto = await criar.mutateAsync(body);
        if (pendingMediaId) {
          const midia = midias.find((m) => m.id === pendingMediaId);
          await atrelarMidia.mutateAsync({
            produtoId: novoProduto.id,
            mediaId: pendingMediaId,
            caption: midia?.name,
          });
        }
        toast.success("Produto criado");
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
          <DialogTitle>{isEdit ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
            <input
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setErrors((x) => {
                  const n = { ...x };
                  delete n.nome;
                  return n;
                });
              }}
              placeholder="Nome do produto"
              className={cn(
                "w-full h-9 rounded-lg border bg-background/40 px-3 text-sm outline-none focus:border-brand transition",
                errors.nome ? "border-destructive" : "border-border",
              )}
            />
            {errors.nome && <p className="text-[11px] text-destructive">{errors.nome}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              {adicionandoCategoria ? (
                <div className="flex gap-1.5">
                  <input
                    value={novaCategoriaNome}
                    onChange={(e) => setNovaCategoriaNome(e.target.value)}
                    placeholder="Nome da categoria"
                    onKeyDown={(e) => e.key === "Enter" && handleAdicionarCategoria()}
                    autoFocus
                    className="flex-1 h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
                  />
                  <button
                    type="button"
                    onClick={handleAdicionarCategoria}
                    disabled={criarCategoria.isPending}
                    className="h-9 w-9 grid place-items-center rounded-lg brand-gradient text-brand-foreground disabled:opacity-60"
                  >
                    {criarCategoria.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdicionandoCategoria(false)}
                    className="h-9 w-9 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="flex-1 h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
                  >
                    <option value="">Sem categoria</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAdicionandoCategoria(true)}
                    title="Nova categoria"
                    className="h-9 w-9 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-brand hover:border-brand/40 transition"
                  >
                    <Tag className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Unidade</label>
              <select
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Descrição curta do produto…"
              className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-brand transition resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Fotos do produto</label>
            {midias.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Nenhuma foto na biblioteca ainda. Faça upload em <strong>Mídias</strong> e depois
                volte aqui para selecioná-la.
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-2 max-h-44 overflow-y-auto p-1">
                {midias.map((m) => {
                  const isAttached = isEdit ? attachedByUrl.has(m.url) : pendingMediaId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMedia(m)}
                      title={m.name}
                      disabled={isMediaMutating}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition disabled:opacity-60",
                        isAttached ? "border-brand" : "border-border hover:border-brand/40",
                      )}
                    >
                      <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                      {isAttached && (
                        <div className="absolute inset-0 bg-brand/40 grid place-items-center">
                          <Check className="h-5 w-5 text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              {isEdit
                ? "Apenas 1 foto por produto — clique em outra para trocar, ou nela mesma para remover."
                : "Selecione até 1 foto para o produto."}
            </p>
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
            {isEdit ? "Salvar alterações" : "Criar produto"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── PriceEntryModal (create / edit a single price range) ─────────────────────

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
  initial,
  defaultTier,
}: {
  open: boolean;
  onClose: () => void;
  produtoId: string;
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
    if (isNaN(min) || min < 0) e.minQuantity = "Qtd. inválida";
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar faixa de preço" : "Nova faixa de preço"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tier do cliente *</label>
            <div className="grid grid-cols-2 gap-2">
              {TIERS.map((t) => {
                const m = TIER_META[t];
                const isTodos = t === "TODOS";
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("starRating", t)}
                    className={cn(
                      "rounded-lg border p-2.5 text-sm font-medium transition flex flex-col items-center gap-0.5",
                      form.starRating === t
                        ? cn(
                            "border-brand bg-brand/10 text-brand",
                            isTodos && "border-violet-500 bg-violet-500/10 text-violet-600",
                          )
                        : "border-border bg-background/40 text-muted-foreground hover:border-brand/40",
                    )}
                  >
                    {isTodos ? (
                      <Users className="h-5 w-5" />
                    ) : (
                      <span className="text-lg">{m.icon}</span>
                    )}
                    <span className="text-[10px]">{m.label}</span>
                  </button>
                );
              })}
            </div>
            {form.starRating === "TODOS" && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Esta faixa será enviada para <strong>todos os leads</strong>, complementando o tier
                específico.
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
              <label className="text-xs font-medium text-muted-foreground">Qtd. máxima</label>
              <input
                type="number"
                min={0}
                value={form.maxQuantity}
                placeholder="sem limite"
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
              <label className="text-xs font-medium text-muted-foreground">Desc. máx. (%)</label>
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

// ── PriceTierCard ─────────────────────────────────────────────────────────────

function PriceTierCard({
  tier,
  entries,
  unit,
  onAdd,
  onEdit,
  onDelete,
  onDetail,
  disabled,
}: {
  tier: TipoCliente;
  entries: PrecoProdutoEntry[];
  unit: string;
  onAdd: () => void;
  onEdit: (e: PrecoProdutoEntry) => void;
  onDelete: (e: PrecoProdutoEntry) => void;
  onDetail: () => void;
  disabled?: boolean;
}) {
  const meta = TIER_META[tier];
  const sorted = [...entries].sort((a, b) => toNumber(a.minQuantity) - toNumber(b.minQuantity));
  const isEmpty = sorted.length === 0;

  const LEAD_BADGE: Record<TipoCliente, string> = {
    C: "Leads ⭐",
    B: "Leads ⭐⭐",
    A: "Leads ⭐⭐⭐",
    TODOS: "Todos os leads",
  };

  return (
    <div className={cn("rounded-xl border flex flex-col", meta.color)}>
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-inherit cursor-pointer"
        onClick={isEmpty ? undefined : onDetail}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{meta.label}</span>
            {meta.icon ? (
              <span className="text-base">{meta.icon}</span>
            ) : (
              <Users className="h-4 w-4 text-violet-500" />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{meta.leadLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5 bg-background/40">
            {LEAD_BADGE[tier]}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="h-7 w-7 grid place-items-center rounded-lg border border-border bg-background/60 text-muted-foreground hover:text-brand hover:border-brand/40 transition"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-3 space-y-2">
        {isEmpty ? (
          <div
            className={cn(
              "rounded-lg border-2 border-dashed p-6 text-center",
              disabled
                ? "border-border"
                : "border-border hover:border-brand/40 cursor-pointer transition",
            )}
            onClick={disabled ? undefined : onAdd}
          >
            <p className="text-xs text-muted-foreground">
              {disabled ? "Sem faixas cadastradas" : "+ Definir preços para este tier"}
            </p>
          </div>
        ) : (
          sorted.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-border bg-background/50 px-3 py-2.5 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {fmtRange(entry.minQuantity, entry.maxQuantity, unit)}
                  </p>
                  <p className="text-sm font-semibold text-brand mt-0.5">
                    R$ {toNumber(entry.unitPrice).toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground">/{unit}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    desc. máx. {toNumber(entry.maxDiscountPct)}%
                  </p>
                </div>
                {!disabled && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      onClick={onDetail}
                      title="Ver preview"
                      className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      title="Editar"
                      className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(entry)}
                      title="Remover"
                      className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── ProductPriceDrawer ────────────────────────────────────────────────────────

function ProductPriceDrawer({
  produto,
  onClose,
}: {
  produto: Produto | null;
  onClose: () => void;
}) {
  const [entryModal, setEntryModal] = useState<{
    open: boolean;
    entry?: PrecoProdutoEntry | null;
    defaultTier?: TipoCliente;
  }>({ open: false });
  const [detailTier, setDetailTier] = useState<TipoCliente | null>(null);

  const { data: entries = [], isLoading } = useTabelaPreco(produto?.id);

  const deletar = useDeletarEntradaTabelaPreco();

  async function handleDelete(entry: PrecoProdutoEntry) {
    if (!produto) return;
    try {
      await deletar.mutateAsync({ produtoId: produto.id, entryId: entry.id });
      toast.success("Faixa removida");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  if (!produto) return null;

  const previewMsg = detailTier ? buildPriceTableMessage(produto, detailTier, entries) : "";

  const detailEntries = detailTier
    ? entries
        .filter((e) => e.starRating === detailTier)
        .sort((a, b) => toNumber(a.minQuantity) - toNumber(b.minQuantity))
    : [];

  return (
    <>
      <Sheet open={!!produto} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand shrink-0">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-lg">{produto.name}</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {produto.unit} · {produto.categoryName ?? "Sem categoria"}
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tabela de Preços</h3>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground">
              A IA usa esta tabela para enviar preços ao lead automaticamente conforme seu nível de
              estrela.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {TIERS.map((tier) => (
              <PriceTierCard
                key={tier}
                tier={tier}
                entries={entries.filter((e) => e.starRating === tier)}
                unit={produto.unit}
                onAdd={() => setEntryModal({ open: true, defaultTier: tier })}
                onEdit={(e) => setEntryModal({ open: true, entry: e })}
                onDelete={handleDelete}
                onDetail={() => setDetailTier(tier)}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Price entry create/edit modal */}
      <PriceEntryModal
        open={entryModal.open}
        onClose={() => setEntryModal({ open: false })}
        produtoId={produto.id}
        initial={entryModal.entry}
        defaultTier={entryModal.defaultTier}
      />

      {/* Tier detail drawer */}
      <Sheet open={!!detailTier} onOpenChange={(o) => !o && setDetailTier(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {detailTier && (
            <>
              <SheetHeader className="mb-5">
                <SheetTitle>
                  {TIER_META[detailTier].label} {TIER_META[detailTier].icon ?? ""} —{" "}
                  {TIER_META[detailTier].leadLabel}
                </SheetTitle>
              </SheetHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Produto</p>
                    <p className="text-sm font-semibold">{produto.name}</p>
                  </div>
                  {detailEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma faixa cadastrada para este tier.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {detailEntries.map((e, i) => (
                        <div
                          key={e.id}
                          className="rounded-lg border border-border bg-background/40 p-3"
                        >
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Faixa {i + 1}
                          </p>
                          <p className="text-xs text-foreground">
                            {fmtRange(e.minQuantity, e.maxQuantity, produto.unit)}
                          </p>
                          <p className="text-sm font-semibold text-brand">
                            R$ {toNumber(e.unitPrice).toFixed(2)} / {produto.unit}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Desconto máx.: {toNumber(e.maxDiscountPct)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setDetailTier(null);
                      setEntryModal({ open: true, defaultTier: detailTier });
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
                  >
                    <Pencil className="h-3 w-3" /> Adicionar faixa neste tier
                  </button>
                </div>

                <div>
                  <WhatsAppPreview
                    message={
                      previewMsg || `Sem faixas cadastradas para ${TIER_META[detailTier].label}.`
                    }
                    variant="received"
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── ProdutosPage ──────────────────────────────────────────────────────────────

function ProdutosPage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ProdutoStatus>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Produto | null>(null);
  const [priceTarget, setPriceTarget] = useState<Produto | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading, error } = useProdutos();
  const { data: categoriasData } = useCategorias();
  const atualizar = useAtualizarProduto();
  const deletar = useDeletarProduto();

  const produtos: Produto[] = data?.data ?? [];
  const categorias = categoriasData ?? [];

  const filtered = produtos.filter((p) => {
    if (catFilter && p.categoryId !== catFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function toggleStatus(id: string, current: ProdutoStatus) {
    try {
      await atualizar.mutateAsync({ id, status: current === "ATIVO" ? "INATIVO" : "ATIVO" });
      toast.success(current === "ATIVO" ? "Produto inativado" : "Produto ativado");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
    setMenuOpen(null);
  }

  async function handleDeletar(id: string) {
    try {
      await deletar.mutateAsync(id);
      toast.success("Produto removido");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
    setMenuOpen(null);
  }

  if (error) {
    return (
      <Page title="Produtos" description="Catálogo de produtos.">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {extractErrorMessage(error)}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Produtos"
      description="Catálogo com tabelas de preço por tier de cliente."
      actions={
        <button
          onClick={() => {
            setEditTarget(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-3 text-sm font-medium text-brand-foreground"
        >
          <Plus className="h-4 w-4" /> Novo Produto
        </button>
      }
    >
      <Surface className="p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-1.5 flex-1 min-w-60">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none"
        >
          <option value="">Todas categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | ProdutoStatus)}
          className="h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none"
        >
          <option value="">Todos status</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
        </select>
      </Surface>

      {isLoading ? (
        <CardGridSkeleton
          cards={6}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 && (
            <div className="col-span-1 md:col-span-2 xl:col-span-3">
              <EmptyState
                icon={Package}
                title="Nenhum produto encontrado"
                description="Cadastre produtos para que o bot possa ofertá-los nas conversas e campanhas."
              />
            </div>
          )}
          {filtered.map((p) => {
            const isAtivo = p.status === "ATIVO";
            return (
              <Surface
                key={p.id}
                className={cn(
                  "p-5 hover:border-brand/30 transition group relative",
                  menuOpen === p.id && "z-20",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === p.id ? null : p.id);
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpen === p.id && (
                      <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-border bg-card shadow-lg py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTarget(p);
                            setModalOpen(true);
                            setMenuOpen(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition"
                        >
                          <Edit className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPriceTarget(p);
                            setMenuOpen(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition"
                        >
                          <TableProperties className="h-3.5 w-3.5" /> Tabela de preços
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(p.id, p.status);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition"
                        >
                          <Power className="h-3.5 w-3.5" /> {isAtivo ? "Inativar" : "Ativar"}
                        </button>
                        {deleteConfirm === p.id ? (
                          <div className="px-3 py-2 space-y-1.5">
                            <p className="text-[11px] font-medium text-destructive">
                              Confirmar exclusão?
                            </p>
                            <div className="flex gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletar(p.id);
                                  setDeleteConfirm(null);
                                }}
                                className="flex-1 h-6 rounded-md text-[11px] font-medium bg-destructive text-white hover:bg-destructive/90"
                              >
                                Excluir
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm(null);
                                }}
                                className="flex-1 h-6 rounded-md text-[11px] border border-border hover:bg-accent"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(p.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remover
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <h3 className="text-base font-semibold">{p.name}</h3>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
                      isAtivo
                        ? "bg-brand/15 text-brand border-brand/30"
                        : "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {isAtivo ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {p.description || "Sem descrição"}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-border bg-background/30 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Categoria</div>
                    <div className="mt-0.5 text-xs font-medium truncate">
                      {p.categoryName ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background/30 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Unidade</div>
                    <div className="mt-0.5 text-xs font-medium">{p.unit}</div>
                  </div>
                </div>

                <button
                  onClick={() => setPriceTarget(p)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border bg-background/40 text-xs text-muted-foreground hover:text-brand hover:border-brand/40 transition"
                >
                  <TableProperties className="h-3.5 w-3.5" /> Ver tabela de preços
                </button>
              </Surface>
            );
          })}
        </div>
      )}

      <ProdutoModal
        key={editTarget?.id ?? "new"}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        initial={editTarget}
      />

      <ProductPriceDrawer produto={priceTarget} onClose={() => setPriceTarget(null)} />

      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />}
    </Page>
  );
}
