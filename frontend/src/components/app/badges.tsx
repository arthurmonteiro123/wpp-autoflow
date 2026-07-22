import { cn } from "@/lib/utils";
import type { LeadStatus, LeadTipo, OrderStatus } from "@/lib/mock-data";
import type { StarLevel } from "@/lib/queries";

const LEAD_STYLES: Record<LeadStatus, string> = {
  NOVO: "bg-muted text-muted-foreground border-border",
  RESPONDEU: "bg-info/15 text-info border-info/30",
  ATIVO: "bg-brand/15 text-brand border-brand/30",
  INATIVO: "bg-warning/15 text-warning border-warning/30",
  BLOQUEADO: "bg-destructive/15 text-destructive border-destructive/30",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        LEAD_STYLES[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

const ORDER_STYLES: Record<OrderStatus, string> = {
  ABERTO: "bg-warning/15 text-warning border-warning/30",
  FECHADO: "bg-brand/15 text-brand border-brand/30",
  CANCELADO: "bg-destructive/15 text-destructive border-destructive/30",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ORDER_STYLES[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function TipoBadge({ tipo }: { tipo: LeadTipo }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-border bg-accent text-[10px] font-bold text-foreground/80">
      {tipo}
    </span>
  );
}

const STAR_LABELS: Record<StarLevel, string> = { 1: "⭐", 2: "⭐⭐", 3: "⭐⭐⭐" };
const STAR_STYLES: Record<StarLevel, string> = {
  1: "bg-muted text-muted-foreground border-border",
  2: "bg-info/15 text-info border-info/30",
  3: "bg-brand/15 text-brand border-brand/30",
};

export function StarLevelBadge({ level }: { level: StarLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STAR_STYLES[level],
      )}
    >
      {STAR_LABELS[level]}
    </span>
  );
}
