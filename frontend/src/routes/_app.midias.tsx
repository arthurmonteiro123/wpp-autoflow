import { createFileRoute } from "@tanstack/react-router";
import { Page, Surface } from "@/components/app/page";
import { EmptyState } from "@/components/app/empty-state";
import { CardGridSkeleton } from "@/components/app/table-skeleton";
import { useMidias, useUploadMidia, useDeletarMidia, type Midia } from "@/lib/queries";
import {
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const ICONS = { IMAGEM: ImageIcon, VIDEO: Video, DOCUMENTO: FileText, AUDIO: Music } as const;

export const Route = createFileRoute("/_app/midias")({
  head: () => ({ meta: [{ title: "Mídias — wpp-autoflow" }] }),
  component: MidiasPage,
});

function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const upload = useUploadMidia();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    if (!nome) setNome(f.name.replace(/\.[^/.]+$/, ""));
  }

  async function handleUpload() {
    if (!file || !nome.trim()) {
      toast.error("Selecione um arquivo e informe um nome");
      return;
    }
    try {
      await upload.mutateAsync({ file, nome: nome.trim() });
      toast.success("Mídia enviada com sucesso");
      setFile(null);
      setNome("");
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Upload de Mídia</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          className={cn(
            "cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition",
            file ? "border-brand bg-brand/5" : "border-border hover:border-brand/40",
          )}
        >
          {file ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">Clique para selecionar · até 50 MB</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Nome amigável *</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Banner Junho, Catálogo..."
            className="w-full h-9 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-brand transition"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-accent transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={upload.isPending || !file}
            className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-4 text-sm font-medium text-brand-foreground disabled:opacity-60"
          >
            {upload.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

function MidiasPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data, isLoading, error } = useMidias();
  const deletar = useDeletarMidia();

  const midias: Midia[] = data ?? [];

  async function handleDeletar(id: string, nome: string) {
    if (!confirm(`Deletar "${nome}"?`)) return;
    try {
      await deletar.mutateAsync(id);
      toast.success("Mídia removida");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  if (error) {
    return (
      <Page title="Mídias" description="Biblioteca de mídias do bot.">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {extractErrorMessage(error)}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Biblioteca de Mídias"
      description="Arquivos utilizados pelo bot em fluxos e campanhas."
      actions={
        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-2 h-9 rounded-lg brand-gradient px-3 text-sm font-medium text-brand-foreground"
        >
          <Upload className="h-4 w-4" /> Upload
        </button>
      }
    >
      <Surface
        className="p-8 border-dashed cursor-pointer hover:border-brand/40 transition"
        onClick={() => setUploadOpen(true)}
      >
        <div className="text-center space-y-2">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Upload className="h-6 w-6" />
          </div>
          <div className="text-sm font-medium">Arraste arquivos aqui</div>
          <div className="text-xs text-muted-foreground">
            ou clique para selecionar · imagens, vídeos, documentos e áudio até 50 MB
          </div>
        </div>
      </Surface>

      {isLoading ? (
        <CardGridSkeleton
          cards={8}
          withThumbnail
          className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {midias.length === 0 && (
            <div className="col-span-2 md:col-span-3 xl:col-span-4">
              <EmptyState
                icon={ImageIcon}
                title="Biblioteca vazia"
                description="Arraste arquivos para a área acima ou clique nela para enviar imagens, vídeos, áudios e documentos."
              />
            </div>
          )}
          {midias.map((m) => {
            const Icon = ICONS[m.type] ?? FileText;
            const isImage = m.type === "IMAGEM";
            return (
              <Surface
                key={m.id}
                className="overflow-hidden hover:border-brand/30 transition cursor-pointer group"
              >
                <div className="aspect-video relative grid place-items-center bg-linear-to-br from-accent/40 to-background overflow-hidden">
                  {isImage && m.url ? (
                    <img
                      src={m.url}
                      alt={m.name}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Icon className="h-12 w-12 text-muted-foreground/60 group-hover:text-brand transition-colors" />
                  )}
                  <div className="absolute top-2 right-2 rounded-md bg-background/80 backdrop-blur px-2 py-0.5 text-[10px] font-medium uppercase">
                    {m.type}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletar(m.id, m.name);
                    }}
                    disabled={deletar.isPending}
                    className="absolute bottom-2 right-2 p-1.5 rounded-md bg-background/80 backdrop-blur text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium truncate">{m.name}</div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{(m.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                    <span>{new Date(m.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </Surface>
            );
          })}
        </div>
      )}

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </Page>
  );
}
