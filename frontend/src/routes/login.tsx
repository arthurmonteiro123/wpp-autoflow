import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Zap,
  BarChart3,
  MessageCircle,
} from "lucide-react";
import { useAuth, DEMO_CREDENTIALS } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — wpp-autoflow" },
      { name: "description", content: "Acesse o painel wpp-autoflow." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  // Campos pré-preenchidos apenas em desenvolvimento — nunca expor credenciais em produção
  const [email, setEmail] = useState(import.meta.env.DEV ? "admin@wpp-autoflow.com" : "");
  const [senha, setSenha] = useState(import.meta.env.DEV ? "admin123" : "");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(email, senha);
      toast.success(`Bem-vindo, ${user.name.split(" ")[0]}`);
      navigate({ to: user.role === "VENDEDOR" ? "/painel" : "/dashboard" });
    } catch (err: any) {
      setError(err.message ?? "Erro");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left — brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-border p-12">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(at 30% 20%, oklch(0.72 0.18 152 / 0.18), transparent 50%), radial-gradient(at 80% 80%, oklch(0.55 0.18 160 / 0.12), transparent 50%)",
          }}
        />
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl brand-gradient shadow-[var(--shadow-glow)]">
            <Sparkles className="h-5 w-5 text-brand-foreground" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight">wpp-autoflow</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Sales OS
            </div>
          </div>
        </div>

        <div className="max-w-lg space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight">
              Conduza cada conversa como uma <span className="gradient-text">venda fechada.</span>
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              Fluxos automatizados, métricas em tempo real e disparos inteligentes — tudo num painel
              pensado para o ritmo do seu time comercial.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: Zap, t: "Fluxos automatizados", d: "Sequências que respondem como humano." },
              {
                icon: BarChart3,
                t: "Métricas em tempo real",
                d: "Faturamento e pedidos atualizados ao vivo.",
              },
              {
                icon: MessageCircle,
                t: "Disparos inteligentes",
                d: "Cooldown e segmentação por tipo de cliente.",
              },
            ].map((f, i) => (
              <div
                key={f.t}
                className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4 animate-fade-up"
                style={{ animationDelay: `${0.15 + i * 0.1}s` }}
              >
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{f.t}</div>
                  <div className="text-xs text-muted-foreground">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">© 2026 wpp-autoflow · Built for sales.</div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <form
          onSubmit={onSubmit}
          className={`w-full max-w-md space-y-6 ${shake ? "animate-[shake_0.5s]" : ""}`}
          style={shake ? ({ ["--tw-shake" as any]: 1 } as any) : undefined}
        >
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
            <p className="text-sm text-muted-foreground">
              Use suas credenciais para acessar o painel.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-card/60 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
                placeholder="voce@empresa.com"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Senha</span>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-card/60 px-3 pr-10 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg brand-gradient text-sm font-semibold text-brand-foreground transition-transform active:scale-[0.99] disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Entrar{" "}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>

          {import.meta.env.DEV && (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-4 space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Credenciais de demo
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_CREDENTIALS.map((c) => (
                  <button
                    key={c.email}
                    type="button"
                    onClick={() => {
                      setEmail(c.email);
                      setSenha(c.senha);
                    }}
                    className="rounded-lg border border-border bg-background/40 px-2.5 py-2 text-left text-xs hover:border-brand/40 hover:bg-brand-soft transition"
                  >
                    <div className="font-semibold">{c.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{c.email}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>

      <style>{`
        @keyframes shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
