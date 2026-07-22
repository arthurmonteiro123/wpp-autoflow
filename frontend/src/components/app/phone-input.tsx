import { cn } from "@/lib/utils";

// Poucos códigos de país cobrem o essencial do público-alvo; +55 (Brasil) vem
// pré-selecionado por padrão, igual ao campo de telefone do próprio WhatsApp.
const COUNTRY_CODES = [
  { code: "55", label: "🇧🇷 +55" },
  { code: "1", label: "🇺🇸 +1" },
  { code: "351", label: "🇵🇹 +351" },
  { code: "54", label: "🇦🇷 +54" },
  { code: "598", label: "🇺🇾 +598" },
  { code: "595", label: "🇵🇾 +595" },
  { code: "34", label: "🇪🇸 +34" },
];

export function PhoneInput({
  countryCode,
  onCountryCodeChange,
  value,
  onChange,
  error,
  placeholder = "11999999999",
}: {
  countryCode: string;
  onCountryCodeChange: (v: string) => void;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  placeholder?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-9 w-full items-center gap-1 rounded-lg border bg-background/40 pl-1 pr-3 transition focus-within:border-brand",
        error ? "border-destructive" : "border-border",
      )}
    >
      <select
        value={countryCode}
        onChange={(e) => onCountryCodeChange(e.target.value)}
        className="h-7 shrink-0 rounded-md border-0 bg-transparent pl-1 pr-0.5 text-sm font-mono outline-none"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground/40">|</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder={placeholder}
        inputMode="numeric"
        className="h-full flex-1 bg-transparent text-sm font-mono outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}
