import { Link, useRouterState } from "@tanstack/react-router";
import { Search, Command, Wifi, WifiOff } from "lucide-react";
import { useCommandPalette } from "@/components/app/command-palette";
import { useEvolutionStatus } from "@/lib/queries";
import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/produtos": "Produtos",
  "/tabelas": "Tabelas de Preços",
  "/fluxos": "Fluxos de Conversa",
  "/campanhas": "Campanhas",
  "/pedidos": "Pedidos",
  "/midias": "Biblioteca de Mídias",
  "/configuracoes": "Configurações do Bot",
  "/configuracoes/whatsapp": "Instância WhatsApp",
  "/usuarios": "Usuários",
};

export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = TITLES[pathname] ?? "Painel";
  const { open } = useCommandPalette();
  const { data: evolutionStatus, isLoading: statusLoading } = useEvolutionStatus();
  const connected = evolutionStatus?.connected ?? false;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
      <div className="flex flex-col">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          wpp-autoflow
        </div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={open}
          className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground w-72 transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Buscar leads, pedidos, produtos…</span>
          <kbd className="hidden lg:inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        <button
          onClick={open}
          className="md:hidden rounded-lg border border-border bg-card/60 p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Buscar"
        >
          <Search className="h-4 w-4" />
        </button>

        <Link
          to="/configuracoes/whatsapp"
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            statusLoading
              ? "border-border bg-card/60 text-muted-foreground"
              : connected
                ? "border-brand/30 bg-brand-soft text-brand hover:border-brand/50"
                : "border-destructive/30 bg-destructive/10 text-destructive hover:border-destructive/50",
          )}
          title={
            connected
              ? `Instância conectada${evolutionStatus?.instanceName ? `: ${evolutionStatus.instanceName}` : ""}`
              : "WhatsApp desconectado — clique para reconectar"
          }
        >
          {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          <span className="hidden lg:inline">
            {statusLoading ? "Verificando…" : connected ? "Conectado" : "Desconectado"}
          </span>
        </Link>
      </div>
    </header>
  );
}
