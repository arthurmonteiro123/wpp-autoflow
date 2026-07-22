import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Page, Surface } from "@/components/app/page";
import { EmptyState } from "@/components/app/empty-state";
import { TableSkeleton } from "@/components/app/table-skeleton";
import { LeadStatusBadge, StarLevelBadge } from "@/components/app/badges";
import {
  Search,
  Upload,
  Plus,
  ChevronRight,
  LayoutList,
  Columns3,
  Loader2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useContatos,
  useCriarContato,
  useAtualizarStatusContato,
  useAtualizarNivelEstrela,
  useAtualizarContato,
  useImportarCSV,
  type Contato,
  type LeadStatus,
  type StarLevel,
} from "@/lib/queries";
import { extractErrorMessage } from "@/lib/api";
import { PhoneInput } from "@/components/app/phone-input";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/leads")({
  head: () => ({ meta: [{ title: "Leads — wpp-autoflow" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    busca: typeof search.busca === "string" && search.busca ? search.busca : undefined,
    novo: search.novo === true || search.novo === "true" ? (true as const) : undefined,
  }),
  component: LeadsPage,
});

const STATUS_OPTIONS: LeadStatus[] = ["NOVO", "RESPONDEU", "ATIVO", "INATIVO", "BLOQUEADO"];
const STAR_OPTIONS: { value: StarLevel; label: string }[] = [
  { value: 1, label: "⭐ 1 estrela" },
  { value: 2, label: "⭐⭐ 2 estrelas" },
  { value: 3, label: "⭐⭐⭐ 3 estrelas" },
];

const EMPTY_FORM = {
  name: "",
  countryCode: "55",
  phoneNumber: "",
  starLevel: null as StarLevel | null,
};

function NovoLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const criar = useCriarContato();
  const atualizarNivelEstrela = useAtualizarNivelEstrela();

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nome obrigatório";
    if (!form.phoneNumber.trim()) e.phoneNumber = "Número obrigatório";
    else if (!/^\d{10,15}$/.test(form.countryCode + form.phoneNumber))
      e.phoneNumber = "Número inválido (somente dígitos, 10–15 com o código do país)";
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    try {
      const contato = await criar.mutateAsync({
        name: form.name.trim(),
        phoneNumber: form.countryCode + form.phoneNumber,
      });
      // Tipo escolhido manualmente pelo admin já na criação — aplica como override
      // (mesma rota usada na tabela), em vez de deixar só a regra automática decidir.
      if (isAdmin && form.starLevel) {
        await atualizarNivelEstrela.mutateAsync({ id: contato.id, starLevel: form.starLevel });
      }
      toast.success("Lead criado com sucesso");
      setForm({ ...EMPTY_FORM });
      setErrors({});
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      const n = { ...e };
      delete n[k as string];
      return n;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome *</label>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nome completo"
                className={cn(
                  "w-full h-9 rounded-lg border bg-background/40 px-3 text-sm outline-none focus:border-brand transition",
                  errors.name ? "border-destructive" : "border-border",
                )}
              />
              {errors.name && <p className="text-[11px] text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Número WhatsApp *</label>
              <PhoneInput
                countryCode={form.countryCode}
                onCountryCodeChange={(v) => set("countryCode", v)}
                value={form.phoneNumber}
                onChange={(v) => set("phoneNumber", v)}
                error={!!errors.phoneNumber}
              />
              {errors.phoneNumber && (
                <p className="text-[11px] text-destructive">{errors.phoneNumber}</p>
              )}
            </div>

            {isAdmin && (
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo do lead</label>
                <select
                  value={form.starLevel ?? ""}
                  onChange={(e) =>
                    set("starLevel", e.target.value ? (Number(e.target.value) as StarLevel) : null)
                  }
                  className="w-full h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
                >
                  <option value="">Automático (definido pelo sistema conforme o histórico)</option>
                  {STAR_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Deixe em "Automático" para o sistema classificar pelo valor gasto; escolher aqui
                  fixa o tipo manualmente (não é sobrescrito depois).
                </p>
              </div>
            )}
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
            disabled={criar.isPending}
            className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-4 text-sm font-medium text-brand-foreground disabled:opacity-70"
          >
            {criar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar Lead
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY_DETAIL_FORM = {
  notes: "",
  address: "",
  socialMedia: "",
  owesDebt: false,
  debtAmount: "",
};

function LeadDetailModal({ contato, onClose }: { contato: Contato | null; onClose: () => void }) {
  const [form, setForm] = useState({ ...EMPTY_DETAIL_FORM });
  const atualizar = useAtualizarContato();

  useEffect(() => {
    if (!contato) return;
    setForm({
      notes: contato.notes ?? "",
      address: contato.address ?? "",
      socialMedia: contato.socialMedia ?? "",
      owesDebt: contato.owesDebt ?? false,
      debtAmount: contato.debtAmount ?? "",
    });
  }, [contato]);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!contato) return;
    try {
      await atualizar.mutateAsync({
        id: contato.id,
        notes: form.notes.trim(),
        address: form.address.trim(),
        socialMedia: form.socialMedia.trim(),
        owesDebt: form.owesDebt,
        debtAmount: form.owesDebt ? form.debtAmount.trim() || "0" : "0",
      });
      toast.success("Dados do lead atualizados");
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  return (
    <Dialog open={!!contato} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contato?.name}</DialogTitle>
        </DialogHeader>

        {contato && (
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{contato.phoneNumber}</span>
              <StarLevelBadge level={contato.starLevel} />
              <LeadStatusBadge status={contato.engagementStatus} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nota</label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Observações internas sobre este lead…"
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-brand transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Endereço</label>
              <input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Rua, número, cidade…"
                className="w-full h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Rede social</label>
              <input
                value={form.socialMedia}
                onChange={(e) => set("socialMedia", e.target.value)}
                placeholder="@usuario_instagram"
                className="w-full h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
              />
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.owesDebt}
                  onChange={(e) => set("owesDebt", e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-brand"
                />
                Cliente possui dívida em aberto
              </label>
              {form.owesDebt && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                  <input
                    value={form.debtAmount}
                    onChange={(e) => set("debtAmount", e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand transition"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-accent transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={atualizar.isPending}
            className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-4 text-sm font-medium text-brand-foreground disabled:opacity-70"
          >
            {atualizar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeadsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { busca: buscaParam, novo: novoParam } = Route.useSearch();
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState(buscaParam ?? "");
  const [levelFilter, setLevelFilter] = useState<StarLevel | "">("");
  const [modalOpen, setModalOpen] = useState(novoParam ?? false);
  const [detailContato, setDetailContato] = useState<Contato | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Deep-link vindo da paleta de comandos (⌘K): sincroniza busca e modal,
  // depois limpa a URL para não re-disparar em navegações futuras
  useEffect(() => {
    if (buscaParam) setSearch(buscaParam);
    if (novoParam) setModalOpen(true);
    if (buscaParam || novoParam) {
      navigate({ to: "/leads", search: { busca: undefined, novo: undefined }, replace: true });
    }
  }, [buscaParam, novoParam, navigate]);

  const { data, isLoading, error } = useContatos({
    starLevel: levelFilter || undefined,
    limite: 100,
  });

  // Total real de leads cadastrados (sem filtro), independente da listagem paginada acima
  const { data: totalGeralData } = useContatos({ limite: 1 });
  const totalGeral = totalGeralData?.total;

  const importarCSV = useImportarCSV();
  const atualizarStatus = useAtualizarStatusContato();
  const atualizarNivelEstrela = useAtualizarNivelEstrela();

  const filtered = useMemo(() => {
    const contatos: Contato[] = data?.data ?? [];
    return contatos.filter(
      (c) =>
        (!levelFilter || c.starLevel === levelFilter) &&
        (!search ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phoneNumber.includes(search)),
    );
  }, [search, levelFilter, data]);

  const columns: Array<{ status: LeadStatus; label: string }> = [
    { status: "NOVO", label: "Novos" },
    { status: "RESPONDEU", label: "Respondeu" },
    { status: "ATIVO", label: "Ativo" },
    { status: "INATIVO", label: "Inativo" },
    { status: "BLOQUEADO", label: "Bloqueado" },
  ];

  async function handleCsvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const result = await importarCSV.mutateAsync(file);
      const msg = `${result.importados} contato(s) importado(s).`;
      if (result.erros.length > 0) {
        toast.warning(
          `${msg} ${result.erros.length} erro(s): ${result.erros.slice(0, 3).join("; ")}`,
        );
      } else {
        toast.success(msg);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  async function handleStatusChange(contato: Contato, status: LeadStatus) {
    try {
      await atualizarStatus.mutateAsync({ id: contato.id, status });
      toast.success("Status atualizado");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  async function handleStarLevelChange(contato: Contato, starLevel: StarLevel) {
    try {
      await atualizarNivelEstrela.mutateAsync({ id: contato.id, starLevel });
      toast.success("Tipo do lead atualizado manualmente");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  if (error) {
    return (
      <Page title="Leads" description="Contatos capturados e qualificados pelo bot.">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {extractErrorMessage(error)}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Leads"
      description="Contatos capturados e qualificados pelo bot."
      actions={
        <>
          <span
            title="Total de leads cadastrados no sistema"
            className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-border bg-background/40 px-3 text-xs text-muted-foreground"
          >
            <Users className="h-3.5 w-3.5" />
            {totalGeral === undefined ? "…" : totalGeral} leads cadastrados
          </span>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvChange}
          />
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={importarCSV.isPending}
            className="inline-flex items-center gap-2 h-9 rounded-lg border border-border bg-card px-3 text-sm hover:bg-accent transition disabled:opacity-60"
          >
            {importarCSV.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Importar CSV
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-3 text-sm font-medium text-brand-foreground"
          >
            <Plus className="h-4 w-4" /> Novo Lead
          </button>
        </>
      }
    >
      <Surface className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-1.5 flex-1 min-w-60">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou número…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <div className="inline-flex rounded-lg border border-border bg-background/40 p-0.5 text-xs">
            {[
              { v: "" as const, label: "Todos" },
              ...STAR_OPTIONS.map((o) => ({ v: o.value, label: o.label })),
            ].map((opt) => (
              <button
                key={String(opt.v)}
                onClick={() => setLevelFilter(opt.v as StarLevel | "")}
                className={cn(
                  "px-3 py-1.5 rounded-md font-medium transition",
                  levelFilter === opt.v
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <span className="text-xs text-muted-foreground">{filtered.length} leads</span>
            )}
            <div className="inline-flex rounded-lg border border-border bg-background/40 p-0.5">
              <button
                onClick={() => setView("list")}
                className={cn(
                  "p-1.5 rounded-md",
                  view === "list" ? "bg-brand text-brand-foreground" : "text-muted-foreground",
                )}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "p-1.5 rounded-md",
                  view === "kanban" ? "bg-brand text-brand-foreground" : "text-muted-foreground",
                )}
              >
                <Columns3 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Surface>

      {isLoading ? (
        <Surface className="overflow-hidden">
          <TableSkeleton rows={8} />
        </Surface>
      ) : view === "list" ? (
        <Surface className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Nome</th>
                  <th className="px-2 py-3 font-medium">Número</th>
                  <th className="px-2 py-3 font-medium">Tipo</th>
                  <th className="px-2 py-3 font-medium">Status</th>
                  <th className="px-2 py-3 font-medium">Cooldown</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={Search}
                        title={
                          search || levelFilter ? "Nenhum lead encontrado" : "Nenhum lead ainda"
                        }
                        description={
                          search || levelFilter
                            ? "Ajuste a busca ou os filtros para encontrar o que procura."
                            : "Cadastre o primeiro lead ou importe sua base via CSV para começar."
                        }
                        action={
                          search || levelFilter ? (
                            <button
                              onClick={() => {
                                setSearch("");
                                setLevelFilter("");
                              }}
                              className="h-8 rounded-lg border border-border px-3 text-xs hover:bg-accent transition"
                            >
                              Limpar filtros
                            </button>
                          ) : (
                            <button
                              onClick={() => setModalOpen(true)}
                              className="inline-flex items-center gap-2 h-8 rounded-lg brand-gradient px-3 text-xs font-medium text-brand-foreground"
                            >
                              <Plus className="h-3.5 w-3.5" /> Novo Lead
                            </button>
                          )
                        }
                      />
                    </td>
                  </tr>
                )}
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-border hover:bg-accent/30 transition cursor-pointer"
                  >
                    <td className="px-5 py-3 font-medium">{c.name}</td>
                    <td className="px-2 py-3 font-mono text-xs text-muted-foreground">
                      {c.phoneNumber}
                    </td>
                    <td className="px-2 py-3">
                      {isAdmin ? (
                        <select
                          value={c.starLevel}
                          onChange={(e) =>
                            handleStarLevelChange(c, Number(e.target.value) as StarLevel)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 rounded-md border border-border bg-background/40 px-2 text-xs outline-none focus:border-brand transition"
                        >
                          {STAR_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StarLevelBadge level={c.starLevel} />
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <select
                        value={c.engagementStatus}
                        onChange={(e) => handleStatusChange(c, e.target.value as LeadStatus)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 rounded-md border border-border bg-background/40 px-2 text-xs outline-none focus:border-brand transition"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-3 text-xs text-muted-foreground">
                      {c.cooldownUntil ? (
                        new Date(c.cooldownUntil) > new Date() ? (
                          <span className="text-warning">
                            até {new Date(c.cooldownUntil).toLocaleDateString("pt-BR")}
                          </span>
                        ) : (
                          "—"
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailContato(c);
                        }}
                        title="Ver detalhes do lead"
                        className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {columns.map((col) => {
            const items = filtered.filter((c: Contato) => c.engagementStatus === col.status);
            return (
              <Surface key={col.status} className="p-3 flex flex-col min-h-100">
                <div className="flex items-center justify-between mb-3 px-1">
                  <LeadStatusBadge status={col.status} />
                  <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto scrollbar-thin">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setDetailContato(c)}
                      className="rounded-lg border border-border bg-background/40 p-3 hover:border-brand/30 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <StarLevelBadge level={c.starLevel} />
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {c.phoneNumber}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="grid place-items-center h-24 text-[11px] text-muted-foreground">
                      Nenhum lead
                    </div>
                  )}
                </div>
              </Surface>
            );
          })}
        </div>
      )}

      <NovoLeadModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <LeadDetailModal contato={detailContato} onClose={() => setDetailContato(null)} />
    </Page>
  );
}
