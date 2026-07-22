import { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Formata como "YYYY-MM-DDTHH:mm" em horário local (evita o bug comum de usar
// toISOString(), que converte para UTC e desalinha o valor da hora local do usuário).
export function toDateTimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseLocalValue(value: string): { date: Date; time: string } | null {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { date: new Date(y, m - 1, d), time: timePart ?? "09:00" };
}

export function DateTimePicker({
  value,
  onChange,
  min,
  error,
  placeholder = "Selecionar data e hora",
  clearable = false,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  error?: boolean;
  placeholder?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseLocalValue(value);
  const minParsed = min ? parseLocalValue(min) : null;

  function commit(date: Date, time: string) {
    onChange(`${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${time}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-background/40 px-3 text-sm outline-none transition focus:border-brand",
            error ? "border-destructive" : "border-border",
            !value && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
            {value
              ? new Date(value).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : placeholder}
          </span>
          {clearable && value && (
            <X
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed?.date}
          defaultMonth={parsed?.date}
          disabled={minParsed ? { before: minParsed.date } : undefined}
          onSelect={(date) => {
            if (!date) return;
            commit(date, parsed?.time ?? "09:00");
          }}
        />
        <div className="flex items-center gap-2 border-t border-border p-3">
          <label className="text-xs text-muted-foreground">Horário</label>
          <input
            type="time"
            value={parsed?.time ?? "09:00"}
            onChange={(e) => commit(parsed?.date ?? minParsed?.date ?? new Date(), e.target.value)}
            className="h-8 flex-1 rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-brand"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
