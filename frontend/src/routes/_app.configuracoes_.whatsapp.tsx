import { createFileRoute } from "@tanstack/react-router";
import { Page, Surface } from "@/components/app/page";
import {
  RefreshCcw,
  Smartphone,
  Wifi,
  WifiOff,
  QrCode,
  Loader2,
  AlertTriangle,
  Route as RouteIcon,
  Pencil,
} from "lucide-react";
import {
  useEvolutionStatus,
  useEvolutionConectar,
  useEvolutionQRCode,
  useInstanceMappings,
  useEvolutionInstances,
  useUpsertInstanceMapping,
  useSetInstanceMappingActive,
  type InstanceRole,
  type InstanceMapping,
} from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/configuracoes_/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp — wpp-autoflow" }] }),
  component: WhatsAppPage,
});

function WhatsAppPage() {
  const qc = useQueryClient();
  const { data: status, isLoading, error, refetch } = useEvolutionStatus();
  const conectar = useEvolutionConectar();
  const { data: qrData, isFetching: qrLoading, refetch: fetchQR } = useEvolutionQRCode();

  const connected = status?.connected ?? false;

  async function handleConectar() {
    try {
      await conectar.mutateAsync();
      toast.success("Reconexão iniciada. Escaneie o QR Code.");
      await fetchQR();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  async function handleVerificar() {
    await refetch();
    toast.info("Status atualizado");
  }

  async function handleGerarQR() {
    try {
      await fetchQR();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  // Show service unavailable when Evolution API is offline
  if (error && !isLoading) {
    return (
      <Page title="Instância WhatsApp" description="Status da conexão com a Evolution API.">
        <Surface className="p-6">
          <div className="flex items-center gap-3 text-warning">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Serviço indisponível</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Não foi possível conectar à Evolution API. Verifique se o serviço está rodando.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="ml-auto inline-flex items-center gap-2 h-8 rounded-lg border border-border bg-card px-3 text-xs hover:bg-accent"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
          </div>
        </Surface>
      </Page>
    );
  }

  return (
    <Page
      title="Instância WhatsApp"
      description="Status da conexão e geração de QR Code para reconectar."
    >
      <Surface className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand relative">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : connected ? (
                <Wifi className="h-6 w-6" />
              ) : (
                <WifiOff className="h-6 w-6" />
              )}
              {connected && !isLoading && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-brand animate-pulse-glow" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">
                  {isLoading ? "Verificando…" : connected ? "Conectado" : "Desconectado"}
                </h3>
                {status?.instanceName && (
                  <span className="text-xs text-muted-foreground">· {status.instanceName}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {status?.since
                  ? `Conectado desde ${new Date(status.since).toLocaleString("pt-BR")}`
                  : connected
                    ? "Conexão ativa"
                    : "Escaneie o QR Code para reconectar"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleVerificar}
              disabled={isLoading}
              className="inline-flex items-center gap-2 h-9 rounded-lg border border-border bg-card px-3 text-sm hover:bg-accent"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Verificar status
            </button>
            <button
              onClick={handleConectar}
              disabled={conectar.isPending}
              className="inline-flex items-center gap-2 h-9 rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-sm text-destructive disabled:opacity-60"
            >
              {conectar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              Reconectar
            </button>
          </div>
        </div>
      </Surface>

      <Surface className="p-6">
        <div className="flex flex-wrap gap-8 items-center">
          <div className="grid h-56 w-56 place-items-center rounded-2xl border border-border bg-background/40 p-3 relative overflow-hidden">
            {qrLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
              </div>
            )}
            {qrData?.qrcode ? (
              <img
                src={qrData.qrcode}
                alt="QR Code WhatsApp"
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              <div className="grid grid-cols-12 gap-0.5 w-full h-full opacity-30">
                {Array.from({ length: 144 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-[1px]"
                    style={{ background: (i * 37) % 7 > 3 ? "var(--foreground)" : "transparent" }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-60 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <QrCode className="h-4 w-4 text-brand" /> Reconectar via QR Code
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Abra o WhatsApp no celular admin</li>
              <li>
                Toque em <strong className="text-foreground">Aparelhos conectados</strong>
              </li>
              <li>
                Toque em <strong className="text-foreground">Conectar aparelho</strong> e escaneie
              </li>
            </ol>
            <div className="pt-2">
              <button
                onClick={handleGerarQR}
                disabled={qrLoading}
                className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-3 text-sm font-medium text-brand-foreground disabled:opacity-60"
              >
                {qrLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Gerar novo QR Code
              </button>
              <span className="ml-3 text-xs text-muted-foreground">
                Status atualizado a cada 30s
              </span>
            </div>
          </div>
        </div>
      </Surface>

      <InstanceRoutingSection />
    </Page>
  );
}

// ── Roteamento por nível de estrela ───────────────────────────────────────────
// Cada envio (script Salve, campanha, Pulse) resolve a instância POR LEAD, pelo
// starLevel dele: papel ativo em instance_star_mapping → nome real no .env do
// backend. Nível sem mapeamento ativo cai na Shelby (fallback fixo).

const ROLE_ORDER: { role: InstanceRole; fallbackLabel: string }[] = [
  { role: "shelby", fallbackLabel: "Vendedor Principal" },
  { role: "moritz", fallbackLabel: "Vendedor" },
  { role: "cobrador", fallbackLabel: "Cobrador" },
  { role: "prospectador", fallbackLabel: "Prospectador" },
];

const STAR_LEVELS = ["1", "2", "3"] as const;

function InstanceRoutingSection() {
  const { data: mappings, isLoading, error } = useInstanceMappings();
  const { data: instances } = useEvolutionInstances();
  const setActive = useSetInstanceMappingActive();
  const [editTarget, setEditTarget] = useState<{
    role: InstanceRole;
    starRatings: string[];
  } | null>(null);

  if (error) {
    return (
      <Surface className="p-5">
        <div className="flex items-center gap-2 text-sm font-semibold mb-1">
          <RouteIcon className="h-4 w-4 text-brand" /> Roteamento por nível de estrela
        </div>
        <p className="text-xs text-muted-foreground">
          Disponível apenas para administradores. ({extractErrorMessage(error)})
        </p>
      </Surface>
    );
  }

  const byRole = new Map<InstanceRole, InstanceMapping>(
    (mappings ?? []).map((m) => [m.instanceRole, m]),
  );

  // Replica a resolução do backend: primeiro papel ativo que cobre o nível;
  // sem cobertura → Shelby
  function resolveLevel(level: string): { role: InstanceRole; fallback: boolean } {
    const match = (mappings ?? []).find((m) => m.active && m.starRatings.includes(level));
    return match
      ? { role: match.instanceRole, fallback: false }
      : { role: "shelby", fallback: true };
  }

  async function handleToggle(role: InstanceRole, active: boolean) {
    try {
      await setActive.mutateAsync({ role, active });
      toast.success(active ? `Papel ${role} ativado` : `Papel ${role} desativado`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  return (
    <Surface className="p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <RouteIcon className="h-4 w-4 text-brand" /> Roteamento por nível de estrela
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Todo envio automático (script Salve, campanhas, Pulse) sai pela instância mapeada para o
          nível de estrela <strong className="text-foreground">do lead</strong>. Níveis sem papel
          ativo caem na Shelby automaticamente.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Quem atende cada nível agora */}
          <div className="flex flex-wrap gap-2">
            {STAR_LEVELS.map((level) => {
              const { role, fallback } = resolveLevel(level);
              const inst = instances?.[role];
              const connected = inst?.connected ?? false;
              return (
                <div
                  key={level}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                    connected ? "border-brand/30 bg-brand-soft" : "border-warning/30 bg-warning/10",
                  )}
                >
                  <span className="font-medium">{"⭐".repeat(Number(level))}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{inst?.name ?? role}</span>
                  {fallback && (
                    <span className="text-[10px] text-muted-foreground">(fallback)</span>
                  )}
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      connected ? "bg-brand" : "bg-warning",
                    )}
                  />
                </div>
              );
            })}
          </div>

          {/* Cards por papel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ROLE_ORDER.map(({ role, fallbackLabel }) => {
              const mapping = byRole.get(role);
              const inst = instances?.[role];
              const connected = inst?.connected ?? false;
              const activeWithDisconnected =
                (mapping?.active ?? false) && (mapping?.starRatings.length ?? 0) > 0 && !connected;
              return (
                <div
                  key={role}
                  className={cn(
                    "rounded-xl border p-4 space-y-3",
                    activeWithDisconnected
                      ? "border-warning/40 bg-warning/5"
                      : "border-border bg-background/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            !inst
                              ? "bg-muted-foreground"
                              : connected
                                ? "bg-brand"
                                : "bg-destructive",
                          )}
                        />
                        <span className="text-sm font-semibold capitalize">{role}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {inst?.role ?? fallbackLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {inst
                          ? `Instância: ${inst.name} · ${connected ? "conectada" : "desconectada"}`
                          : "Instância não configurada no .env do backend"}
                      </p>
                    </div>
                    <Switch
                      checked={mapping?.active ?? false}
                      disabled={!mapping || setActive.isPending}
                      onCheckedChange={(v) => handleToggle(role, v)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {(mapping?.starRatings.length ?? 0) > 0 ? (
                        mapping!.starRatings.map((s) => (
                          <span
                            key={s}
                            className="rounded-md border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand"
                          >
                            {"⭐".repeat(Number(s))} {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          Nenhum nível atribuído
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        setEditTarget({ role, starRatings: mapping?.starRatings ?? [] })
                      }
                      className="inline-flex items-center gap-1 h-7 rounded-lg border border-border px-2 text-[11px] hover:bg-accent transition"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                  </div>

                  {activeWithDisconnected && (
                    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                      <span>
                        Papel ativo com instância desconectada — envios para{" "}
                        {mapping!.starRatings.map((s) => `⭐${s}`).join(", ")} vão falhar. Desative
                        o papel ou reconecte a instância.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <EditMappingModal target={editTarget} onClose={() => setEditTarget(null)} />
    </Surface>
  );
}

function EditMappingModal({
  target,
  onClose,
}: {
  target: { role: InstanceRole; starRatings: string[] } | null;
  onClose: () => void;
}) {
  const upsert = useUpsertInstanceMapping();
  const [levels, setLevels] = useState<string[]>([]);
  const [loadedFor, setLoadedFor] = useState<InstanceRole | null>(null);

  // Sincroniza os checkboxes quando o modal abre para um papel
  if (target && loadedFor !== target.role) {
    setLevels(target.starRatings);
    setLoadedFor(target.role);
  }
  if (!target && loadedFor !== null) {
    setLoadedFor(null);
  }

  function toggleLevel(level: string) {
    setLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level].sort(),
    );
  }

  async function handleSave() {
    if (!target) return;
    try {
      await upsert.mutateAsync({ instanceRole: target.role, starRatings: levels });
      toast.success(`Mapeamento do papel ${target.role} salvo`);
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="capitalize">Níveis do papel {target?.role}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <p className="text-xs text-muted-foreground">
            Marque quais níveis de estrela este papel atende. Salvar{" "}
            <strong className="text-foreground">reativa o papel</strong> automaticamente.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {STAR_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                className={cn(
                  "rounded-xl border p-3 text-center text-sm font-medium transition",
                  levels.includes(level)
                    ? "border-brand bg-brand/15 text-brand"
                    : "border-border bg-background/30 text-muted-foreground hover:border-brand/40",
                )}
              >
                {"⭐".repeat(Number(level))}
                <div className="text-[10px] mt-0.5">Nível {level}</div>
              </button>
            ))}
          </div>
          {levels.length === 0 && (
            <p className="text-[11px] text-warning">
              Sem níveis marcados, o papel fica ativo porém sem receber nenhum envio.
            </p>
          )}
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
            disabled={upsert.isPending}
            className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-4 text-sm font-medium text-brand-foreground disabled:opacity-70"
          >
            {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
