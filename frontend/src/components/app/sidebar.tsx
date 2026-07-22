import { Link, useRouterState } from "@tanstack/react-router";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  Workflow,
  Megaphone,
  ShoppingCart,
  Image as ImageIcon,
  Settings,
  Smartphone,
  UserCog,
  LogOut,
  Sparkles,
  TableProperties,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEvolutionStatus } from "@/lib/queries";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/tabelas", label: "Tabelas de Preços", icon: TableProperties },
  { to: "/fluxos", label: "Fluxos", icon: Workflow },
  { to: "/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { to: "/midias", label: "Mídias", icon: ImageIcon },
] as const;

const CONFIG_NAV = [
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/configuracoes/whatsapp", label: "WhatsApp", icon: Smartphone },
] as const;

const ADMIN_NAV = [{ to: "/usuarios", label: "Usuários", icon: UserCog }] as const;

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: evolutionStatus, isLoading: statusLoading } = useEvolutionStatus();
  const connected = evolutionStatus?.connected ?? false;

  const renderItem = (item: {
    to: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }) => {
    const Icon = item.icon;
    const active = pathname === item.to || pathname.startsWith(item.to + "/");
    return (
      <Link
        key={item.to}
        to={item.to}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
          active
            ? "bg-brand-soft text-foreground shadow-[inset_2px_0_0_0_var(--brand)]"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active && "text-brand")} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg brand-gradient shadow-[var(--shadow-glow)]">
          <Sparkles className="h-4.5 w-4.5 text-brand-foreground" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">wpp-autoflow</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Painel
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
        {NAV.map(renderItem)}
        <div className="my-3 h-px bg-sidebar-border" />
        {CONFIG_NAV.map(renderItem)}
        {user?.role === "ADMIN" && (
          <>
            <div className="my-3 h-px bg-sidebar-border" />
            {ADMIN_NAV.map(renderItem)}
          </>
        )}
      </nav>

      <Link
        to="/configuracoes/whatsapp"
        className={cn(
          "m-3 block rounded-xl border p-3 transition-colors",
          connected
            ? "border-sidebar-border bg-card/50 hover:border-brand/30"
            : "border-destructive/30 bg-destructive/5 hover:border-destructive/50",
        )}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="relative flex h-2 w-2">
            {connected && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-brand opacity-60 animate-ping" />
            )}
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                statusLoading ? "bg-muted-foreground" : connected ? "bg-brand" : "bg-destructive",
              )}
            />
          </span>
          <span className="text-muted-foreground">Bot</span>
          <span className="font-medium text-foreground">
            {statusLoading ? "Verificando…" : connected ? "Conectado" : "Desconectado"}
          </span>
        </div>
        <div className="mt-1 truncate text-[11px] text-muted-foreground">
          {evolutionStatus?.instanceName
            ? `Instância: ${evolutionStatus.instanceName}`
            : connected
              ? "Instância ativa"
              : "Clique para conectar"}
        </div>
      </Link>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-semibold">
            {user?.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-[11px] text-muted-foreground">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
