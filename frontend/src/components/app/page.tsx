import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Page({ title, description, actions, children, className }: PageProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-6 py-8 space-y-6 animate-fade-up", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            {title && <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Surface({
  className,
  children,
  onClick,
  style,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/60 backdrop-blur-sm",
        "shadow-[var(--shadow-elevated)]",
        className,
      )}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
