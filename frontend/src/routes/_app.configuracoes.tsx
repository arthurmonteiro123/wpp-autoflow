import { createFileRoute } from "@tanstack/react-router";
import { Page, Surface } from "@/components/app/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Clock, Upload, Workflow, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useParametros, useAtualizarParametro, type Parametro } from "@/lib/queries";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/api";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — wpp-autoflow" }] }),
  component: ConfigPage,
});

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-b border-border last:border-b-0">
      <div className="flex-1 min-w-50">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <Surface className="p-6">
      <div className="flex items-start gap-3 mb-2">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div>{children}</div>
    </Surface>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "brand-gradient" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

function NumInput({
  value,
  onChange,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 h-9 rounded-lg border border-border bg-background/40 px-3">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 bg-transparent text-sm outline-none tabular-nums"
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function ParamField({
  params,
  chave,
  label,
  hint,
  type = "number",
  suffix,
  onSave,
}: {
  params: Parametro[];
  chave: string;
  label: string;
  hint?: string;
  type?: "boolean" | "number" | "text";
  suffix?: string;
  onSave: (chave: string, valor: string) => void;
}) {
  const param = params.find((p) => p.key === chave);
  const rawValue = param?.value ?? "";

  if (type === "boolean") {
    const checked = rawValue === "true";
    return (
      <Field label={label} hint={hint}>
        <Toggle checked={checked} onChange={(v) => onSave(chave, v ? "true" : "false")} />
      </Field>
    );
  }

  if (type === "number") {
    return (
      <Field label={label} hint={hint}>
        <SaveableNumInput
          initial={parseFloat(rawValue) || 0}
          suffix={suffix}
          onSave={(v) => onSave(chave, String(v))}
        />
      </Field>
    );
  }

  return (
    <Field label={label} hint={hint}>
      <SaveableTextInput initial={rawValue} onSave={(v) => onSave(chave, v)} />
    </Field>
  );
}

function SaveableNumInput({
  initial,
  suffix,
  onSave,
}: {
  initial: number;
  suffix?: string;
  onSave: (v: number) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);

  return (
    <div className="flex items-center gap-2">
      <NumInput value={value} onChange={setValue} suffix={suffix} />
      {value !== initial && (
        <button
          onClick={() => onSave(value)}
          className="h-7 rounded-md brand-gradient px-3 text-xs font-medium text-brand-foreground"
        >
          Salvar
        </button>
      )}
    </div>
  );
}

function SaveableTextInput({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition min-w-50"
      />
      {value !== initial && (
        <button
          onClick={() => onSave(value)}
          className="h-7 rounded-md brand-gradient px-3 text-xs font-medium text-brand-foreground"
        >
          Salvar
        </button>
      )}
    </div>
  );
}

function ConfigPage() {
  const { data: params, isLoading } = useParametros();
  const atualizar = useAtualizarParametro();

  const paramsList: Parametro[] = Array.isArray(params) ? params : [];

  async function handleSave(chave: string, valor: string) {
    try {
      await atualizar.mutateAsync({ chave, valor });
      toast.success(`Parâmetro "${chave}" atualizado`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  if (isLoading) {
    return (
      <Page title="Configurações do Bot" description="Parâmetros de comportamento do agente.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Surface key={i} className="p-5 space-y-4" style={{ opacity: 1 - i * 0.15 }}>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </Surface>
          ))}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Configurações do Bot"
      description="Parâmetros que controlam o comportamento do agente automatizado."
    >
      <Section icon={Bot} title="Bot" desc="Liga e desliga toda a automação do WhatsApp.">
        <ParamField
          params={paramsList}
          chave="PULSE_ATIVO"
          label="Bot ativo"
          type="boolean"
          hint="Quando desligado, nenhuma mensagem é enviada."
          onSave={handleSave}
        />
      </Section>

      <Section icon={Clock} title="Cadência" desc="Intervalos de disparo do Pulse.">
        <ParamField
          params={paramsList}
          chave="PULSE_INTERVALO_MINUTOS"
          label="Intervalo entre ciclos do Pulse"
          hint="Tempo entre execuções do processo de disparo."
          suffix="min"
          onSave={handleSave}
        />
        <ParamField
          params={paramsList}
          chave="PULSE_MAX_CONTATOS_POR_CICLO"
          label="Máx. contatos por ciclo"
          hint="Limite de disparos em cada execução do Pulse."
          onSave={handleSave}
        />
        <ParamField
          params={paramsList}
          chave="PULSE_COOLDOWN_HORAS"
          label="Cooldown entre disparos"
          hint="Horas de espera antes de disparar para o mesmo lead."
          suffix="h"
          onSave={handleSave}
        />
        <ParamField
          params={paramsList}
          chave="BROADCAST_DELAY_ENTRE_ENVIOS_MS"
          label="Delay entre envios de broadcast"
          hint="Tempo entre mensagens numa campanha em ms."
          suffix="ms"
          onSave={handleSave}
        />
      </Section>

      <Section
        icon={Workflow}
        title="Fluxos"
        desc="Configurações padrão para sequências de conversa."
      >
        <ParamField
          params={paramsList}
          chave="FLUXO_DELAY_PADRAO_SEGUNDOS"
          label="Delay padrão entre etapas"
          hint="Tempo de espera padrão entre etapas de um fluxo."
          suffix="seg"
          onSave={handleSave}
        />
      </Section>

      <Section
        icon={Upload}
        title="Vendedor"
        desc="Dados do vendedor notificado ao fechar pedidos."
      >
        <ParamField
          params={paramsList}
          chave="VENDEDOR_1_NUMERO_WHATSAPP"
          type="text"
          label="Número WhatsApp do vendedor"
          hint="Formato: apenas dígitos com DDI, ex: 5511999990001"
          onSave={handleSave}
        />
        <ParamField
          params={paramsList}
          chave="VENDEDOR_1_NOME"
          type="text"
          label="Nome do vendedor"
          hint="Exibido nas mensagens enviadas pelo bot."
          onSave={handleSave}
        />
      </Section>
    </Page>
  );
}
