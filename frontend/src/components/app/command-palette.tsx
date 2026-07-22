import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
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
  TableProperties,
  Plus,
  ArrowRight,
  Loader2,
  CornerDownLeft,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StarLevelBadge, OrderStatusBadge } from "@/components/app/badges";
import { useAuth } from "@/lib/auth";
import { useContatos, useProdutos, usePedidos, toNumber } from "@/lib/queries";

const PAGES = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    keywords: "inicio home visao geral",
  },
  { to: "/leads", label: "Leads", icon: Users, keywords: "contatos clientes" },
  { to: "/produtos", label: "Produtos", icon: Package, keywords: "catalogo itens" },
  { to: "/tabelas", label: "Tabelas de Preços", icon: TableProperties, keywords: "precos valores" },
  { to: "/fluxos", label: "Fluxos", icon: Workflow, keywords: "conversa etapas bot" },
  { to: "/campanhas", label: "Campanhas", icon: Megaphone, keywords: "disparos broadcast" },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart, keywords: "vendas ordens" },
  { to: "/midias", label: "Mídias", icon: ImageIcon, keywords: "imagens videos arquivos" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, keywords: "parametros bot" },
  {
    to: "/configuracoes/whatsapp",
    label: "WhatsApp",
    icon: Smartphone,
    keywords: "instancia evolution conexao",
  },
] as const;

const ADMIN_PAGES = [
  { to: "/usuarios", label: "Usuários", icon: UserCog, keywords: "admin equipe operadores" },
] as const;

// ── Context: qualquer componente pode abrir a paleta ─────────────────────────

const CommandPaletteContext = createContext<{ open: () => void }>({ open: () => {} });

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openPalette = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ open: openPalette }), [openPalette]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  );
}

// ── Debounce simples para a busca remota ─────────────────────────────────────

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Paleta ────────────────────────────────────────────────────────────────────

function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query.trim());
  const searching = debouncedQuery.length >= 2;

  // Busca remota só com a paleta aberta e ≥2 caracteres
  const { data: contatosData, isFetching: contatosFetching } = useContatos(
    { busca: debouncedQuery, limite: 5 },
    { enabled: open && searching },
  );
  const { data: produtosData } = useProdutos({ limite: 100 }, { enabled: open });
  const { data: pedidosData } = usePedidos({ limite: 8 }, { enabled: open });

  const leads = searching ? (contatosData?.data ?? []) : [];
  const produtos = useMemo(() => {
    if (!searching) return [];
    const q = debouncedQuery.toLowerCase();
    return (produtosData?.data ?? []).filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
  }, [searching, debouncedQuery, produtosData]);
  const pedidosRecentes = pedidosData?.data ?? [];

  // Limpa a busca ao fechar (depois da animação de saída)
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setQuery(""), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  function go(to: string, search?: Record<string, unknown>) {
    onOpenChange(false);
    navigate({ to, search: search as never });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[18%] translate-y-0 max-w-xl gap-0 overflow-hidden rounded-2xl border-border bg-popover/95 p-0 shadow-[var(--shadow-elevated)] backdrop-blur-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Busca e comandos</DialogTitle>
        <Command loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar leads, produtos ou navegar…"
          />
          <CommandList className="max-h-[420px] scrollbar-thin">
            <CommandEmpty>
              {contatosFetching ? (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                </span>
              ) : (
                "Nenhum resultado encontrado."
              )}
            </CommandEmpty>

            {searching && leads.length > 0 && (
              <CommandGroup heading="Leads">
                {leads.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`lead-${c.id} ${c.name} ${c.phoneNumber}`}
                    onSelect={() => go("/leads", { busca: c.name })}
                  >
                    <Users className="text-muted-foreground" />
                    <span className="font-medium">{c.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.phoneNumber}</span>
                    <span className="ml-auto">
                      <StarLevelBadge level={c.starLevel} />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searching && produtos.length > 0 && (
              <CommandGroup heading="Produtos">
                {produtos.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`produto-${p.id} ${p.name}`}
                    onSelect={() => go("/produtos")}
                  >
                    <Package className="text-muted-foreground" />
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {p.status === "ATIVO" ? "Ativo" : "Inativo"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!searching && pedidosRecentes.length > 0 && (
              <CommandGroup heading="Pedidos recentes">
                {pedidosRecentes.slice(0, 4).map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`pedido-${p.id.slice(-6)}`}
                    onSelect={() => go("/pedidos")}
                  >
                    <ShoppingCart className="text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">
                      #{p.id.slice(-6)}
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatBRL(toNumber(p.estimatedTotal))}
                    </span>
                    <span className="ml-auto">
                      <OrderStatusBadge status={p.status} />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />

            <CommandGroup heading="Ações rápidas">
              <CommandItem
                value="novo lead criar contato"
                onSelect={() => go("/leads", { novo: true })}
              >
                <Plus className="text-brand" />
                <span>Novo lead</span>
              </CommandItem>
              <CommandItem value="nova campanha disparo" onSelect={() => go("/campanhas")}>
                <Megaphone className="text-brand" />
                <span>Nova campanha</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Navegação">
              {PAGES.map((p) => (
                <CommandItem
                  key={p.to}
                  value={`ir ${p.label} ${p.keywords}`}
                  onSelect={() => go(p.to)}
                >
                  <p.icon className="text-muted-foreground" />
                  <span>{p.label}</span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
                </CommandItem>
              ))}
              {user?.role === "ADMIN" &&
                ADMIN_PAGES.map((p) => (
                  <CommandItem
                    key={p.to}
                    value={`ir ${p.label} ${p.keywords}`}
                    onSelect={() => go(p.to)}
                  >
                    <p.icon className="text-muted-foreground" />
                    <span>{p.label}</span>
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>

          <div className="flex items-center gap-4 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 font-mono">↑↓</kbd>{" "}
              navegar
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 font-mono">
                <CornerDownLeft className="h-2.5 w-2.5" />
              </kbd>{" "}
              abrir
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 font-mono">esc</kbd>{" "}
              fechar
            </span>
            <span className="ml-auto hidden sm:inline">Digite 2+ letras para buscar na base</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
