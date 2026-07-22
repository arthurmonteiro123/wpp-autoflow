import { createFileRoute } from "@tanstack/react-router";
import { Page, Surface } from "@/components/app/page";
import { EmptyState } from "@/components/app/empty-state";
import { CardGridSkeleton } from "@/components/app/table-skeleton";
import {
  Plus,
  GitBranch,
  Edit,
  Copy,
  X,
  GripVertical,
  MessageSquare,
  Clock,
  GitFork,
  Bot,
  CircleStop,
  AlertCircle,
  AlertTriangle,
  Loader2,
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
import { toast } from "sonner";
import {
  useFluxos,
  useCriarFluxo,
  useAtualizarFluxo,
  useDeletarFluxo,
  type Fluxo,
  type FluxoEtapaApi,
  type FluxoTipoCliente,
} from "@/lib/queries";
import { extractErrorMessage } from "@/lib/api";

export const Route = createFileRoute("/_app/fluxos")({
  head: () => ({ meta: [{ title: "Fluxos — wpp-autoflow" }] }),
  component: FluxosPage,
});

type EtapaTipo = "MENSAGEM" | "AGUARDAR" | "CONDICAO" | "IA" | "ENCERRAR";

const ETAPA_TIPOS: { tipo: EtapaTipo; label: string; icon: React.ElementType; color: string }[] = [
  { tipo: "MENSAGEM", label: "Mensagem", icon: MessageSquare, color: "text-brand bg-brand/10" },
  { tipo: "AGUARDAR", label: "Aguardar", icon: Clock, color: "text-warning bg-warning/10" },
  { tipo: "CONDICAO", label: "Condição", icon: GitFork, color: "text-info bg-info/10" },
  { tipo: "IA", label: "IA / ChatGPT", icon: Bot, color: "text-purple-400 bg-purple-400/10" },
  {
    tipo: "ENCERRAR",
    label: "Encerrar",
    icon: CircleStop,
    color: "text-destructive bg-destructive/10",
  },
];

function etapaIcon(tipo: EtapaTipo) {
  return ETAPA_TIPOS.find((e) => e.tipo === tipo) ?? ETAPA_TIPOS[0];
}

function newEtapa(tipo: EtapaTipo, ordem: number): FluxoEtapaApi {
  const labels: Record<EtapaTipo, string> = {
    MENSAGEM: "Nova mensagem",
    AGUARDAR: "Aguardar",
    CONDICAO: "Condição",
    IA: "Resposta da IA",
    ENCERRAR: "Encerrar fluxo",
  };
  return { id: `etapa-${Date.now()}-${Math.random()}`, tipo, titulo: labels[tipo], ordem };
}

function EtapaCard({
  etapa,
  onChange,
  onRemove,
}: {
  etapa: FluxoEtapaApi;
  onChange: (e: FluxoEtapaApi) => void;
  onRemove: () => void;
}) {
  const meta = etapaIcon(etapa.tipo as EtapaTipo);
  const Icon = meta.icon;

  return (
    <div className="flex gap-3 rounded-xl border border-border bg-background/40 p-3 group">
      <div className="mt-0.5 cursor-grab text-muted-foreground/40 hover:text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", meta.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        <input
          value={etapa.titulo}
          onChange={(e) => onChange({ ...etapa, titulo: e.target.value })}
          className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          placeholder="Título da etapa"
        />
        {(etapa.tipo === "MENSAGEM" || etapa.tipo === "IA") && (
          <textarea
            value={etapa.conteudo ?? ""}
            onChange={(e) => onChange({ ...etapa, conteudo: e.target.value })}
            rows={2}
            placeholder={etapa.tipo === "IA" ? "Instrução para a IA…" : "Texto da mensagem…"}
            className="w-full rounded-lg border border-border bg-background/30 px-3 py-2 text-xs outline-none focus:border-brand transition resize-none"
          />
        )}
        {etapa.tipo === "AGUARDAR" && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={etapa.delay ?? 1}
              onChange={(e) => onChange({ ...etapa, delay: Number(e.target.value) })}
              className="w-20 h-7 rounded-lg border border-border bg-background/30 px-2 text-xs outline-none focus:border-brand"
            />
            <span className="text-xs text-muted-foreground">minutos de espera</span>
          </div>
        )}
        {etapa.tipo === "CONDICAO" && (
          <textarea
            value={etapa.conteudo ?? ""}
            onChange={(e) => onChange({ ...etapa, conteudo: e.target.value })}
            rows={2}
            placeholder="Ex: Se lead.tipo == 'A' → continua / Senão → encerra"
            className="w-full rounded-lg border border-border bg-background/30 px-3 py-2 text-xs outline-none focus:border-brand transition resize-none"
          />
        )}
        {etapa.tipo === "ENCERRAR" && (
          <p className="text-xs text-muted-foreground">O fluxo será encerrado neste ponto.</p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="mt-0.5 p-1 rounded-md text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FluxoModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Fluxo | null;
}) {
  const isEdit = !!initial;
  const [nome, setNome] = useState(initial?.name ?? "");
  const [tipoCliente, setTipoCliente] = useState<string>(initial?.starRating ?? "1");
  const [etapas, setEtapas] = useState<FluxoEtapaApi[]>(
    initial?.etapas?.length ? initial.etapas : [newEtapa("MENSAGEM", 1)],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const criar = useCriarFluxo();
  const atualizar = useAtualizarFluxo();
  const isPending = criar.isPending || atualizar.isPending;

  function addEtapa(tipo: EtapaTipo) {
    setEtapas((prev) => [...prev, newEtapa(tipo, prev.length + 1)]);
  }

  async function handleSave() {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "Nome obrigatório";
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    try {
      if (isEdit) {
        await atualizar.mutateAsync({
          id: initial!.id,
          name: nome.trim(),
        });
        toast.success("Fluxo atualizado");
      } else {
        await criar.mutateAsync({
          name: nome.trim(),
          starRating: tipoCliente as FluxoTipoCliente,
        });
        toast.success("Fluxo criado");
      }
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Fluxo" : "Novo Fluxo de Conversa"}</DialogTitle>
        </DialogHeader>

        {isEdit && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Só é possível ter um fluxo ativo por nível de estrela (1, 2 ou 3). Desative o anterior
              antes de ativar este.
            </span>
          </div>
        )}

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome do fluxo *</label>
              <input
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  setErrors({});
                }}
                placeholder="Ex: Boas-vindas, Reativação…"
                className={cn(
                  "w-full h-9 rounded-lg border bg-background/40 px-3 text-sm outline-none focus:border-brand transition",
                  errors.nome ? "border-destructive" : "border-border",
                )}
              />
              {errors.nome && <p className="text-[11px] text-destructive">{errors.nome}</p>}
            </div>
            {!isEdit && (
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Tipo de cliente *
                </label>
                <select
                  value={tipoCliente}
                  onChange={(e) => setTipoCliente(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
                >
                  <option value="1">⭐ 1 estrela</option>
                  <option value="2">⭐⭐ 2 estrelas</option>
                  <option value="3">⭐⭐⭐ 3 estrelas</option>
                  <option value="INATIVO">Inativo</option>
                  <option value="BROADCAST">Broadcast</option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Etapas do fluxo ({etapas.length})
            </label>
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Edição de etapas ainda não está conectada ao backend — as etapas abaixo são só um
                rascunho local e não são salvas.
              </span>
            </div>
            <div className="space-y-2">
              {etapas.map((etapa, i) => (
                <EtapaCard
                  key={etapa.id}
                  etapa={etapa}
                  onChange={(e) => setEtapas((prev) => prev.map((x, idx) => (idx === i ? e : x)))}
                  onRemove={() => setEtapas((prev) => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {ETAPA_TIPOS.map(({ tipo, label, icon: Icon, color }) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => addEtapa(tipo)}
                  className="inline-flex items-center gap-1.5 h-7 rounded-lg border border-border bg-background/40 px-3 text-xs hover:border-brand/40 hover:bg-accent transition"
                >
                  <Icon className={cn("h-3 w-3", color.split(" ")[0])} />
                  {label}
                </button>
              ))}
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
            {isEdit ? "Salvar alterações" : "Criar fluxo"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FluxosPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Fluxo | null>(null);

  const { data, isLoading, error } = useFluxos();
  const deletar = useDeletarFluxo();
  const criar = useCriarFluxo();

  const fluxos: Fluxo[] = data?.data ?? [];

  async function duplicar(f: Fluxo) {
    try {
      await criar.mutateAsync({
        name: `${f.name} (cópia)`,
        starRating: f.starRating ?? "1",
      });
      toast.success("Fluxo duplicado");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  if (error) {
    return (
      <Page title="Fluxos de conversa" description="Sequências automatizadas executadas pelo bot.">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {extractErrorMessage(error)}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Fluxos de conversa"
      description="Sequências automatizadas executadas pelo bot por nível de estrela do cliente."
      actions={
        <button
          onClick={() => {
            setEditTarget(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-3 text-sm font-medium text-brand-foreground"
        >
          <Plus className="h-4 w-4" /> Novo Fluxo
        </button>
      }
    >
      {isLoading ? (
        <CardGridSkeleton cards={4} className="grid grid-cols-1 md:grid-cols-2 gap-4" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fluxos.length === 0 && (
            <div className="col-span-1 md:col-span-2">
              <EmptyState
                icon={GitBranch}
                title="Nenhum fluxo cadastrado"
                description="Crie sequências de mensagens que o bot executa automaticamente por nível de estrela do cliente."
                action={
                  <button
                    onClick={() => {
                      setEditTarget(null);
                      setModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 h-8 rounded-lg brand-gradient px-3 text-xs font-medium text-brand-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Criar primeiro fluxo
                  </button>
                }
              />
            </div>
          )}
          {fluxos.map((f) => (
            <Surface key={f.id} className="p-5 hover:border-brand/30 transition group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-soft text-brand">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{f.name}</h3>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
                    f.active
                      ? "bg-brand/15 text-brand border-brand/30"
                      : "bg-muted text-muted-foreground border-border",
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {f.active ? "Ativo" : "Pausado"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-foreground">
                      {f.stepCount ?? f.etapas?.length ?? 0}
                    </strong>{" "}
                    etapas
                  </span>
                  <span>Atualizado {new Date(f.updatedAt).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditTarget(f);
                      setModalOpen(true);
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                    title="Editar"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => duplicar(f)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                    title="Duplicar"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1.5">
                {Array.from({ length: Math.min(f.stepCount ?? f.etapas?.length ?? 0, 10) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-all",
                        f.active ? "brand-gradient" : "bg-muted",
                      )}
                    />
                  ),
                )}
              </div>
            </Surface>
          ))}
        </div>
      )}

      <FluxoModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        initial={editTarget}
      />
    </Page>
  );
}
