import { cn } from "@/lib/utils";

function renderMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*[^*]+\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*"))
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    if (part.startsWith("_") && part.endsWith("_")) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

interface WhatsAppPreviewProps {
  /** The message text. Supports *bold* and _italic_ markdown. */
  message: string;
  /** If provided, shows an image attachment placeholder. */
  mediaUrl?: string;
  /**
   * "sent" (default) → green bubble on the right (lead sending to bot / campaign preview).
   * "received" → gray bubble on the left (bot sending to lead / price table preview).
   */
  variant?: "sent" | "received";
}

export function WhatsAppPreview({ message, mediaUrl, variant = "sent" }: WhatsAppPreviewProps) {
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const isSent = variant === "sent";

  return (
    <div className="rounded-xl border border-border bg-[#0a1929] p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
        Preview WhatsApp
      </p>
      <div className={cn("flex", isSent ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-3.5 py-2 shadow-md",
            isSent ? "rounded-tr-sm bg-[#005c4b]" : "rounded-tl-sm bg-[#1f2c34]",
          )}
        >
          {mediaUrl && (
            <div className="mb-2 rounded-lg bg-black/20 p-2 flex items-center gap-2">
              <span className="text-[11px] text-white/60">📎 imagem.jpg</span>
            </div>
          )}
          <p
            className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap break-words",
              message ? "text-white" : "text-white/40 italic",
            )}
          >
            {message
              ? message.split("\n").map((line, i) => (
                  <span key={i}>
                    {renderMarkdown(line)}
                    {i < message.split("\n").length - 1 && <br />}
                  </span>
                ))
              : "Sua mensagem aparecerá aqui…"}
          </p>
          <p className={cn("mt-1 text-[10px] text-white/50", isSent ? "text-right" : "text-left")}>
            {time} {isSent ? "✓✓" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
