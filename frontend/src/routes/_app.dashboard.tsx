import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Surface } from "@/components/app/page";
import { EmptyState } from "@/components/app/empty-state";
import { TableSkeleton } from "@/components/app/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/app/animated-number";
import {
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Send,
  Wifi,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { OrderStatusBadge, StarLevelBadge } from "@/components/app/badges";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePedidos, useContatos, useEvolutionStatus, toNumber } from "@/lib/queries";
import { faturamentoSerie, topProdutos, leadStatusDistribuicao } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — wpp-autoflow" }] }),
  component: Dashboard,
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

function KpiCard({
  icon: Icon,
  label,
  value,
  format,
  delta,
  deltaLabel,
  deltaPositive = true,
  accent = "brand",
  loading = false,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  format?: (n: number) => string;
  delta: string;
  deltaLabel: string;
  deltaPositive?: boolean;
  accent?: "brand" | "info" | "warning";
  loading?: boolean;
  delay?: number;
}) {
  const accentClass = {
    brand: "text-brand bg-brand-soft",
    info: "text-info bg-info/10",
    warning: "text-warning bg-warning/10",
  }[accent];
  return (
    <Surface
      className="group relative p-5 overflow-hidden transition-all hover:border-brand/30 hover:-translate-y-0.5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-x-0 -top-px h-px bg-linear-to-r from-transparent via-brand/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "grid h-9 w-9 place-items-center rounded-lg transition-transform group-hover:scale-110",
            accentClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
        {loading ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <AnimatedNumber value={value} format={format} />
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        {deltaPositive ? (
          <TrendingUp className="h-3.5 w-3.5 text-brand" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
        )}
        <span className={deltaPositive ? "text-brand" : "text-destructive"}>{delta}</span>
        <span className="text-muted-foreground">{deltaLabel}</span>
      </div>
    </Surface>
  );
}

function Dashboard() {
  const [period, setPeriod] = useState<7 | 15 | 30>(7);

  // Real data sources
  const { data: pedidosData, isLoading: pedidosLoading } = usePedidos({ limite: 50 });
  const { data: contatosData, isLoading: contatosLoading } = useContatos({ limite: 200 });
  const { data: evolutionStatus } = useEvolutionStatus();

  const pedidos = pedidosData?.data ?? [];
  const contatoPorId = new Map((contatosData?.data ?? []).map((c) => [c.id, c]));
  const totalContatos = contatosData?.total ?? 0;
  const totalPedidos = pedidosData?.total ?? 0;

  // Derive metrics from real pedidos
  const today = new Date().toISOString().slice(0, 10);
  const pedidosHoje = pedidos.filter((p) => p.createdAt?.slice(0, 10) === today).length;
  const faturamentoFechados = pedidos
    .filter((p) => p.status === "FECHADO")
    .reduce((s, p) => s + toNumber(p.estimatedTotal), 0);

  const connected = evolutionStatus?.connected ?? false;

  return (
    <Page title="Dashboard" description="Visão geral de pedidos, faturamento e atividade do bot.">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={ShoppingCart}
          label="Pedidos (hoje)"
          loading={pedidosLoading}
          value={pedidosHoje}
          delta={`${totalPedidos} total`}
          deltaLabel="no período"
        />
        <KpiCard
          icon={Wallet}
          label="Faturamento (fechados)"
          loading={pedidosLoading}
          delay={60}
          value={faturamentoFechados}
          format={formatBRL}
          delta="pedidos fechados"
          deltaLabel="no período"
        />
        <KpiCard
          icon={TrendingUp}
          label="Total pedidos"
          loading={pedidosLoading}
          delay={120}
          value={totalPedidos}
          delta={`${pedidos.filter((p) => p.status === "ABERTO").length} em aberto`}
          deltaLabel=""
          accent="info"
        />
        <KpiCard
          icon={Users}
          label="Total leads"
          loading={contatosLoading}
          delay={180}
          value={totalContatos}
          delta="na base"
          deltaLabel=""
          accent="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Surface className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">Faturamento</h3>
              <p className="text-xs text-muted-foreground">
                Receita por dia (dados de referência — analytics em breve).
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
              {[7, 15, 30].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p as 7 | 15 | 30)}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-medium transition",
                    period === p
                      ? "bg-brand text-brand-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={faturamentoSerie}
                margin={{ top: 10, right: 0, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.18 152)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 152)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="oklch(0.68 0.01 240)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="oklch(0.68 0.01 240)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.2 0.012 240)",
                    border: "1px solid oklch(1 0 0 / 0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "oklch(0.68 0.01 240)" }}
                  formatter={(v: number) => [formatBRL(v), "Faturamento"]}
                />
                <Area
                  type="monotone"
                  dataKey="faturamento"
                  stroke="oklch(0.72 0.18 152)"
                  strokeWidth={2}
                  fill="url(#gradFat)"
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Surface>

        <Surface className="p-5">
          <h3 className="text-base font-semibold">Top produtos</h3>
          <p className="text-xs text-muted-foreground mb-4">Mais vendidos nos últimos 7 dias.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProdutos} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="oklch(0.68 0.01 240)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  dataKey="nome"
                  type="category"
                  stroke="oklch(0.68 0.01 240)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.2 0.012 240)",
                    border: "1px solid oklch(1 0 0 / 0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  cursor={{ fill: "oklch(0.72 0.18 152 / 0.08)" }}
                />
                <Bar dataKey="qtd" fill="oklch(0.72 0.18 152)" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Surface>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard
          icon={Users}
          label="Leads na base"
          loading={contatosLoading}
          value={totalContatos}
          delta="total"
          deltaLabel="registrados"
          accent="info"
        />
        <KpiCard
          icon={Send}
          label="Pedidos abertos"
          loading={pedidosLoading}
          delay={60}
          value={pedidos.filter((p) => p.status === "ABERTO").length}
          delta="aguardando"
          deltaLabel="fechamento"
          accent="brand"
        />
        <Surface className="p-5">
          <div className="flex items-start justify-between">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              WhatsApp
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">
              <Wifi className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-base font-semibold">
            {connected ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-brand opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
                </span>
                Conectado
              </>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                </span>
                Desconectado
              </>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {evolutionStatus?.instanceName
              ? `· ${evolutionStatus.instanceName}`
              : "Verifique a instância Evolution"}
          </div>
        </Surface>
      </div>

      {/* Recent orders — real data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Surface className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">Pedidos recentes</h3>
            <Link
              to="/pedidos"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {pedidosLoading ? (
            <TableSkeleton rows={5} className="-mx-5" />
          ) : pedidos.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Nenhum pedido ainda"
              description="Quando o bot fechar a primeira venda, ela aparece aqui em tempo real."
              className="py-8"
            />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Pedido</th>
                    <th className="px-2 py-2 font-medium">Cliente</th>
                    <th className="px-2 py-2 font-medium">Tipo</th>
                    <th className="px-2 py-2 font-medium text-right">Total</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-5 py-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.slice(0, 8).map((p) => {
                    const contato = p.contactId ? contatoPorId.get(p.contactId) : undefined;
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-border hover:bg-accent/30 transition cursor-pointer"
                      >
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                          #{p.id.slice(-6)}
                        </td>
                        <td className="px-2 py-3">{contato?.name ?? "—"}</td>
                        <td className="px-2 py-3">
                          {contato ? (
                            <StarLevelBadge level={contato.starLevel} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums font-medium">
                          {formatBRL(toNumber(p.estimatedTotal))}
                        </td>
                        <td className="px-2 py-3">
                          <OrderStatusBadge status={p.status} />
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          {formatDateTimeBR(p.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Surface>

        <Surface className="p-5">
          <h3 className="text-base font-semibold">Distribuição de leads</h3>
          <p className="text-xs text-muted-foreground mb-4">Por status atual.</p>
          <div className="space-y-3">
            {leadStatusDistribuicao.map((row) => (
              <div key={row.status}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{row.status}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {row.qtd} <span className="opacity-60">({row.pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full brand-gradient rounded-full"
                    style={{ width: `${row.pct * 2}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </Page>
  );
}
