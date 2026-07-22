import { createFileRoute } from "@tanstack/react-router";
import { Page, Surface } from "@/components/app/page";
import { EmptyState } from "@/components/app/empty-state";
import { TableSkeleton } from "@/components/app/table-skeleton";
import { AnimatedNumber } from "@/components/app/animated-number";
import { OrderStatusBadge, StarLevelBadge } from "@/components/app/badges";
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
import { Download, Search, CheckCircle, XCircle, Send, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  usePedidos,
  useFecharPedido,
  useCancelarPedido,
  useRenotificarPedido,
  useContatos,
  toNumber,
  type Pedido,
  type OrderStatus,
} from "@/lib/queries";
import { extractErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — wpp-autoflow" }] }),
  component: PedidosPage,
});

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTimeBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PedidosPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | OrderStatus>("");
  const [cancelTarget, setCancelTarget] = useState<Pedido | null>(null);
  const { user } = useAuth();
  const isVendedor = user?.role === "VENDEDOR";

  const { data, isLoading, error } = usePedidos({ limite: 100, status: statusFilter });
  const { data: contatosData } = useContatos({ limite: 200 });
  const fechar = useFecharPedido();
  const cancelar = useCancelarPedido();
  const renotificar = useRenotificarPedido();

  const pedidos: Pedido[] = data?.data ?? [];
  const contatoPorId = new Map((contatosData?.data ?? []).map((c) => [c.id, c]));

  const filtered = pedidos.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const nomeContato = p.contactId ? (contatoPorId.get(p.contactId)?.name ?? "") : "";
    return p.id.toLowerCase().includes(q) || nomeContato.toLowerCase().includes(q);
  });

  const total = pedidos.reduce(
    (s, p) => s + (p.status === "FECHADO" ? toNumber(p.estimatedTotal) : 0),
    0,
  );
  const abertos = pedidos.filter((p) => p.status === "ABERTO").length;
  const fechados = pedidos.filter((p) => p.status === "FECHADO").length;

  async function handleFechar(id: string) {
    try {
      await fechar.mutateAsync(id);
      toast.success("Pedido fechado. Vendedor notificado.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  async function handleCancelar(id: string) {
    try {
      await cancelar.mutateAsync(id);
      toast.success("Pedido cancelado.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setCancelTarget(null);
    }
  }

  function handleExportarCSV() {
    if (filtered.length === 0) {
      toast.info("Nenhum pedido para exportar com os filtros atuais.");
      return;
    }
    const header = ["id", "cliente", "itens", "total", "status", "criado_em"];
    const rows = filtered.map((p) => {
      const contato = p.contactId ? contatoPorId.get(p.contactId) : undefined;
      return [
        p.id,
        `"${(contato?.name ?? "").replace(/"/g, '""')}"`,
        String(p.items?.length ?? 0),
        toNumber(p.estimatedTotal).toFixed(2),
        p.status,
        p.createdAt,
      ].join(";");
    });
    const csv = [header.join(";"), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} pedido(s) exportado(s).`);
  }

  async function handleRenotificar(id: string) {
    try {
      await renotificar.mutateAsync(id);
      toast.success("Notificação reenviada ao vendedor.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  if (error) {
    return (
      <Page title="Pedidos" description="Pedidos gerados pelo bot.">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {extractErrorMessage(error)}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Pedidos"
      description="Pedidos gerados pelo bot — abertos, fechados e cancelados."
      actions={
        <button
          onClick={handleExportarCSV}
          className="inline-flex items-center gap-2 h-9 rounded-lg border border-border bg-card px-3 text-sm hover:bg-accent transition"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Surface className="p-4 animate-fade-up">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {isLoading ? "—" : <AnimatedNumber value={pedidos.length} />}
          </div>
        </Surface>
        <Surface className="p-4 animate-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Fechados</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {isLoading ? "—" : <AnimatedNumber value={fechados} />}
          </div>
        </Surface>
        <Surface className="p-4 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Faturamento (fechados)
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums gradient-text">
            {isLoading ? "—" : <AnimatedNumber value={total} format={formatBRL} />}
          </div>
        </Surface>
      </div>

      <Surface className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-1.5 flex-1 min-w-60">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ID ou cliente…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <div className="inline-flex rounded-lg border border-border bg-background/40 p-0.5 text-xs">
            {(["", "ABERTO", "FECHADO", "CANCELADO"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md font-medium transition ${statusFilter === s ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {s || "Todos"}
              </button>
            ))}
          </div>
        </div>
      </Surface>

      {isLoading ? (
        <Surface className="overflow-hidden">
          <TableSkeleton rows={8} />
        </Surface>
      ) : (
        <Surface className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Pedido</th>
                  {!isVendedor && <th className="px-2 py-3 font-medium">Cliente</th>}
                  <th className="px-2 py-3 font-medium">Tipo</th>
                  <th className="px-2 py-3 font-medium">Itens</th>
                  <th className="px-2 py-3 font-medium text-right">Total</th>
                  <th className="px-2 py-3 font-medium">Status</th>
                  <th className="px-2 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={ShoppingCart}
                        title={
                          search || statusFilter
                            ? "Nenhum pedido encontrado"
                            : "Nenhum pedido ainda"
                        }
                        description={
                          search || statusFilter
                            ? "Ajuste a busca ou o filtro de status."
                            : "Os pedidos fechados pelo bot aparecem aqui automaticamente."
                        }
                        action={
                          (search || statusFilter) && (
                            <button
                              onClick={() => {
                                setSearch("");
                                setStatusFilter("");
                              }}
                              className="h-8 rounded-lg border border-border px-3 text-xs hover:bg-accent transition"
                            >
                              Limpar filtros
                            </button>
                          )
                        }
                      />
                    </td>
                  </tr>
                )}
                {filtered.map((p) => {
                  const contato = p.contactId ? contatoPorId.get(p.contactId) : undefined;
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-accent/30 transition">
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                        #{p.id.slice(-6)}
                      </td>
                      {!isVendedor && (
                        <td className="px-2 py-3 font-medium">{contato?.name ?? "—"}</td>
                      )}
                      <td className="px-2 py-3">
                        {contato ? (
                          <StarLevelBadge level={contato.starLevel} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">{p.items?.length ?? 0}</td>
                      <td className="px-2 py-3 text-right tabular-nums font-medium">
                        {formatBRL(toNumber(p.estimatedTotal))}
                      </td>
                      <td className="px-2 py-3">
                        <OrderStatusBadge status={p.status} />
                      </td>
                      <td className="px-2 py-3 text-xs text-muted-foreground">
                        {formatDateTimeBR(p.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {p.status === "ABERTO" && (
                            <>
                              <button
                                onClick={() => handleFechar(p.id)}
                                disabled={fechar.isPending}
                                title="Fechar pedido"
                                className="p-1.5 rounded-md text-muted-foreground hover:text-brand hover:bg-brand-soft transition"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setCancelTarget(p)}
                                disabled={cancelar.isPending}
                                title="Cancelar pedido"
                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {p.status === "FECHADO" && (
                            <button
                              onClick={() => handleRenotificar(p.id)}
                              disabled={renotificar.isPending}
                              title="Renotificar vendedor"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-brand hover:bg-brand-soft transition"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Surface>
      )}

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido{" "}
              <span className="font-mono text-foreground">#{cancelTarget?.id.slice(-6)}</span> de{" "}
              <span className="font-medium text-foreground">
                {(cancelTarget?.contactId && contatoPorId.get(cancelTarget.contactId)?.name) ||
                  "cliente não identificado"}
              </span>{" "}
              será cancelado. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter pedido</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelTarget && handleCancelar(cancelTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
