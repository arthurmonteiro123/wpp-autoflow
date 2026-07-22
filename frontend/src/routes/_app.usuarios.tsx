import { createFileRoute } from "@tanstack/react-router";
import { Page, Surface } from "@/components/app/page";
import { EmptyState } from "@/components/app/empty-state";
import {
  useUsuarios,
  useCriarUsuario,
  useAtualizarUsuario,
  type Usuario,
  type Role,
} from "@/lib/queries";
import { Plus, UserCog, Shield, ShieldCheck, Briefcase, Loader2, X } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const ROLE_ICON = { ADMIN: ShieldCheck, OPERADOR: Shield, VENDEDOR: Briefcase } as const;
const ROLE_STYLE: Record<string, string> = {
  ADMIN: "bg-brand/15 text-brand border-brand/30",
  OPERADOR: "bg-info/15 text-info border-info/30",
  VENDEDOR: "bg-warning/15 text-warning border-warning/30",
};

export const Route = createFileRoute("/_app/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — wpp-autoflow" }] }),
  component: UsuariosPage,
});

const EMPTY_FORM = { nome: "", email: "", senha: "", role: "OPERADOR" as Role };

function NovoUsuarioModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const criar = useCriarUsuario();

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.email.trim()) e.email = "Email obrigatório";
    if (!form.senha.trim() || form.senha.length < 6) e.senha = "Senha mínima de 6 caracteres";
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    try {
      await criar.mutateAsync({
        nome: form.nome.trim(),
        email: form.email.trim(),
        senha: form.senha,
        role: form.role,
      });
      toast.success("Usuário criado");
      setForm({ ...EMPTY_FORM });
      setErrors({});
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {(["nome", "email", "senha"] as const).map((field) => (
            <div key={field} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground capitalize">
                {field} *
              </label>
              <input
                type={field === "senha" ? "password" : field === "email" ? "email" : "text"}
                value={form[field]}
                onChange={(e) => set(field, e.target.value)}
                placeholder={field === "senha" ? "Mínimo 6 caracteres" : ""}
                className={cn(
                  "w-full h-9 rounded-lg border bg-background/40 px-3 text-sm outline-none focus:border-brand transition",
                  errors[field] ? "border-destructive" : "border-border",
                )}
              />
              {errors[field] && <p className="text-[11px] text-destructive">{errors[field]}</p>}
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Papel *</label>
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="OPERADOR">OPERADOR</option>
              <option value="VENDEDOR">VENDEDOR</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-accent transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={criar.isPending}
            className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-4 text-sm font-medium text-brand-foreground disabled:opacity-70"
          >
            {criar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Criar usuário
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsuariosPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data, isLoading, error } = useUsuarios();
  const atualizar = useAtualizarUsuario();

  const usuarios: Usuario[] = data?.data ?? [];

  async function toggleAtivo(u: Usuario) {
    const isAtivo = u.status === "ATIVO";
    try {
      await atualizar.mutateAsync({ id: u.id, status: isAtivo ? "INATIVO" : "ATIVO" });
      toast.success(isAtivo ? "Usuário inativado" : "Usuário ativado");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  if (error) {
    return (
      <Page title="Usuários" description="Gerencie quem acessa o painel.">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {extractErrorMessage(error)}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Usuários"
      description="Gerencie quem acessa o painel e seus papéis."
      actions={
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-3 text-sm font-medium text-brand-foreground"
        >
          <Plus className="h-4 w-4" /> Novo Usuário
        </button>
      }
    >
      {isLoading ? (
        <Surface className="p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Surface>
      ) : (
        <Surface className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background/40">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Usuário</th>
                <th className="px-2 py-3 font-medium">Email</th>
                <th className="px-2 py-3 font-medium">Papel</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={UserCog}
                      title="Nenhum usuário cadastrado"
                      description="Convide operadores e vendedores para acompanhar leads e pedidos."
                    />
                  </td>
                </tr>
              )}
              {usuarios.map((u) => {
                const Icon = ROLE_ICON[u.role as keyof typeof ROLE_ICON] ?? UserCog;
                return (
                  <tr key={u.id} className="border-t border-border hover:bg-accent/30 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-semibold">
                          {u.nome.charAt(0)}
                        </div>
                        <span className="font-medium">{u.nome}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLE[u.role] ?? ""}`}
                      >
                        <Icon className="h-3 w-3" /> {u.role}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          u.status === "ATIVO"
                            ? "bg-brand/15 text-brand border-brand/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {u.status === "ATIVO" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => toggleAtivo(u)}
                        disabled={atualizar.isPending}
                        title={u.status === "ATIVO" ? "Inativar" : "Ativar"}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <UserCog className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Surface>
      )}

      <NovoUsuarioModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Page>
  );
}
