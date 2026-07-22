import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Bell,
  BellOff,
  LogOut,
  Maximize2,
  Sparkles,
  ShoppingCart,
  Check,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Surface } from "@/components/app/page";
import { cn } from "@/lib/utils";
import { usePedidos, useFecharPedido, toNumber, type Pedido } from "@/lib/queries";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/api";

export const Route = createFileRoute("/painel")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const rt = localStorage.getItem("wpp_refresh_token");
    if (!rt) throw redirect({ to: "/login" });
  },
  head: () => ({ meta: [{ title: "Painel — Vendedor" }] }),
  component: VendedorPanel,
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

function VendedorPanel() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [soundOn, setSoundOn] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  const { data, refetch } = usePedidos({ limite: 50 });
  const fechar = useFecharPedido();

  const allPedidos: Pedido[] = data?.data ?? [];

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => refetch(), 30_000);
    return () => clearInterval(id);
  }, [refetch]);

  const today = new Date().toISOString().slice(0, 10);

  const ordersByCol = useMemo(() => {
    const abertos = allPedidos.filter((p) => p.status === "ABERTO");
    const novos = abertos.filter((p) => !seen.has(p.id));
    const vistos = abertos.filter((p) => seen.has(p.id));
    const concluidos = allPedidos
      .filter((p) => p.status === "FECHADO" && p.createdAt?.slice(0, 10) === today)
      .slice(0, 10);
    return { novos, abertos: vistos, concluidos };
  }, [allPedidos, seen, today]);

  const totalDiaVendedor = ordersByCol.concluidos.reduce(
    (s, p) => s + toNumber(p.estimatedTotal),
    0,
  );

  async function handleFechar(id: string) {
    try {
      await fechar.mutateAsync(id);
      toast.success("Pedido fechado.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg brand-gradient shadow-(--shadow-glow)">
            <Sparkles className="h-4.5 w-4.5 text-brand-foreground" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Painel do Vendedor
            </div>
            <div className="text-sm font-semibold">{user?.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundOn((s) => !s)}
            className={cn(
              "inline-flex items-center gap-2 h-9 rounded-lg border px-3 text-xs transition",
              soundOn
                ? "border-brand/30 bg-brand-soft text-brand"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            Som {soundOn ? "ON" : "OFF"}
          </button>
          <button className="inline-flex items-center gap-2 h-9 rounded-lg border border-border bg-card px-3 text-xs">
            <Maximize2 className="h-4 w-4" /> Foco
          </button>
          <button
            onClick={() => {
              logout();
              nav({ to: "/login" });
            }}
            className="inline-flex items-center gap-2 h-9 rounded-lg border border-border bg-card px-3 text-xs"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Surface className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Fechados hoje
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">
              {ordersByCol.concluidos.length}
            </div>
          </Surface>
          <Surface className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Faturamento hoje
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums gradient-text">
              {formatBRL(totalDiaVendedor)}
            </div>
          </Surface>
          <Surface className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Bot</div>
            <div className="mt-1 flex items-center gap-2 text-base font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand opacity-60 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
              </span>
              Ativo e monitorando
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Atualizando a cada 30s</div>
          </Surface>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Column
            title="Novos"
            icon={ShoppingCart}
            color="brand"
            badge={ordersByCol.novos.length}
            pulse
          >
            {ordersByCol.novos.map((p) => (
              <OrderCard
                key={p.id}
                pedido={p}
                variant="new"
                onSeen={() => setSeen((s) => new Set(s).add(p.id))}
                onFechar={() => handleFechar(p.id)}
              />
            ))}
            {ordersByCol.novos.length === 0 && <Empty msg="Nenhum pedido novo no momento." />}
          </Column>

          <Column title="Em aberto" icon={Clock} color="warning" badge={ordersByCol.abertos.length}>
            {ordersByCol.abertos.map((p) => (
              <OrderCard key={p.id} pedido={p} variant="open" onFechar={() => handleFechar(p.id)} />
            ))}
            {ordersByCol.abertos.length === 0 && <Empty msg="Marque um pedido novo como visto." />}
          </Column>

          <Column
            title="Concluídos hoje"
            icon={CheckCircle2}
            color="brand"
            badge={ordersByCol.concluidos.length}
          >
            {ordersByCol.concluidos.map((p) => (
              <OrderCard key={p.id} pedido={p} variant="done" />
            ))}
            {ordersByCol.concluidos.length === 0 && (
              <Empty msg="Nenhum pedido fechado hoje ainda." />
            )}
          </Column>
        </div>
      </main>
    </div>
  );
}

function Column({ title, icon: Icon, color, badge, children, pulse }: any) {
  const colorClass = color === "brand" ? "text-brand bg-brand-soft" : "text-warning bg-warning/10";
  return (
    <Surface className="p-3 flex flex-col min-h-125">
      <div className="flex items-center justify-between px-2 py-2 mb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={cn("grid h-7 w-7 place-items-center rounded-md", colorClass)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-6 h-6 rounded-full px-2 text-xs font-bold tabular-nums",
            colorClass,
            pulse && badge > 0 && "animate-pulse-glow",
          )}
        >
          {badge}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin pr-1">{children}</div>
    </Surface>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="grid place-items-center h-32 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
      {msg}
    </div>
  );
}

function OrderCard({
  pedido,
  variant,
  onSeen,
  onFechar,
}: {
  pedido: Pedido;
  variant: "new" | "open" | "done";
  onSeen?: () => void;
  onFechar?: () => void;
}) {
  const total = toNumber(pedido.estimatedTotal);

  return (
    <div
      className={cn(
        "rounded-xl border bg-background/40 p-3 transition-all",
        variant === "new" &&
          "border-brand/40 shadow-[inset_3px_0_0_0_var(--brand)] animate-slide-in-right",
        variant === "open" && "border-border",
        variant === "done" && "border-border opacity-80",
      )}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-muted-foreground">#{pedido.id.slice(-6)}</span>
        <span className="text-muted-foreground">{formatDateTimeBR(pedido.createdAt)}</span>
      </div>

      {pedido.items && pedido.items.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {pedido.items.slice(0, 3).map((it, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">
                • {it.name} — {it.quantity}
              </span>
              <span className="tabular-nums">
                {(it.unitPrice * it.quantity).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </li>
          ))}
          {pedido.items.length > 3 && (
            <li className="text-[10px] opacity-60">+ {pedido.items.length - 3} item(ns)</li>
          )}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Total estimado
        </span>
        <span className="text-sm font-semibold tabular-nums">{formatBRL(total)}</span>
      </div>

      {variant === "new" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onSeen}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md border border-border text-xs font-medium hover:bg-accent transition"
          >
            <Check className="h-3 w-3" /> Marcar como visto
          </button>
          {onFechar && (
            <button
              onClick={onFechar}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md brand-gradient text-xs font-medium text-brand-foreground"
            >
              Fechar pedido
            </button>
          )}
        </div>
      )}

      {variant === "open" && onFechar && (
        <button
          onClick={onFechar}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md brand-gradient text-xs font-medium text-brand-foreground"
        >
          Fechar pedido
        </button>
      )}
    </div>
  );
}
