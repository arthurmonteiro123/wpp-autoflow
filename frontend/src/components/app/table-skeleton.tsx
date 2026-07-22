import { Skeleton } from "@/components/ui/skeleton";
import { Surface } from "@/components/app/page";
import { cn } from "@/lib/utils";

/** Placeholder de tabela: linhas shimmer com larguras variadas para parecer conteúdo real. */
export function TableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-0", className)}>
      <div className="flex items-center gap-4 border-b border-border px-5 py-3">
        {[24, 16, 12, 14, 10].map((w, i) => (
          <Skeleton key={i} className="h-3" style={{ width: `${w}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-border/50 px-5 py-3.5"
          style={{ opacity: 1 - r * 0.1 }}
        >
          <Skeleton className="h-4" style={{ width: `${20 + ((r * 7) % 12)}%` }} />
          <Skeleton className="h-4" style={{ width: `${12 + ((r * 5) % 8)}%` }} />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4" style={{ width: `${10 + ((r * 3) % 6)}%` }} />
          <Skeleton className="ml-auto h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder de grid de cards: usado nas páginas de mídias, fluxos e produtos. */
export function CardGridSkeleton({
  cards = 6,
  className,
  withThumbnail = false,
}: {
  cards?: number;
  className?: string;
  withThumbnail?: boolean;
}) {
  return (
    <div className={className}>
      {Array.from({ length: cards }).map((_, i) => (
        <Surface key={i} className="overflow-hidden" style={{ opacity: 1 - i * 0.08 }}>
          {withThumbnail && <Skeleton className="aspect-video w-full rounded-none" />}
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-3">
              {!withThumbnail && <Skeleton className="h-11 w-11 rounded-lg" />}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4" style={{ width: `${50 + ((i * 13) % 30)}%` }} />
                <Skeleton className="h-3" style={{ width: `${30 + ((i * 9) % 20)}%` }} />
              </div>
            </div>
            {!withThumbnail && <Skeleton className="h-3 w-full" />}
          </div>
        </Surface>
      ))}
    </div>
  );
}
