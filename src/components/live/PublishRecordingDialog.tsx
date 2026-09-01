import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import VideoPlayer from "./VideoPlayer";

export interface RecordingRow {
  id: string;
  live_class_id: string;
  course_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  storage_path: string | null;
  video_url: string | null;
  status: string;
  error_message: string | null;
  published_lesson_id: string | null;
}

export default function PublishRecordingDialog({
  open,
  onOpenChange,
  recording,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recording: RecordingRow | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [moduleId, setModuleId] = useState("keep");
  const [newModule, setNewModule] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: modules = [] } = useQuery({
    queryKey: ["publish-modules", recording?.course_id],
    enabled: !!recording?.course_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("course_modules").select("id, title")
        .eq("course_id", recording!.course_id).order("sort_order");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open || !recording) return;
    setTitle(recording.title);
    setDescription(recording.description ?? "");
    setModuleId(recording.module_id ?? "keep");
    setNewModule("");
    setPreviewUrl(null);
    if (recording.video_url) setPreviewUrl(recording.video_url);
    else if (recording.storage_path) {
      void supabase.functions
        .invoke("live-recording-url", { body: { recordingId: recording.id } })
        .then(({ data }) => setPreviewUrl(data?.url ?? null));
    }
  }, [open, recording]);

  async function uploadFile(file: File) {
    if (!recording) return;
    setUploading(true);
    try {
      const path = `${recording.live_class_id}/${recording.id}.mp4`;
      const { error } = await supabase.storage
        .from("gravacoes").upload(path, file, { upsert: true, contentType: file.type || "video/mp4" });
      if (error) throw error;
      await supabase.from("live_recordings").update({
        storage_path: path, file_size: file.size, status: "pronta", error_message: null,
      }).eq("id", recording.id);
      await supabase.from("live_classes").update({
        recording_status: "pronta", status: "pronta", error_message: null,
      }).eq("id", recording.live_class_id);
      toast.success("Gravação enviada.");
      const { data } = await supabase.functions
        .invoke("live-recording-url", { body: { recordingId: recording.id } });
      setPreviewUrl(data?.url ?? null);
      onDone();
    } catch (e) {
      toast.error((e as Error).message ?? "Falha ao enviar o vídeo.");
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    if (!recording) return;
    setBusy(true);
    const { error } = await supabase.rpc("publicar_gravacao_como_aula", {
      _recording_id: recording.id,
      _module_id: moduleId === "keep" || moduleId === "new" ? null : moduleId,
      _new_module_title: moduleId === "new" ? newModule.trim() : null,
      _title: title.trim() || null,
      _description: description.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Gravação publicada como aula do curso.");
    onDone();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisar e publicar gravação</DialogTitle>
          <DialogDescription>
            Confira o vídeo, ajuste as informações e publique como aula do curso.
          </DialogDescription>
        </DialogHeader>

        {recording?.error_message && !previewUrl && (
          <p className="text-sm text-muted-foreground bg-muted rounded-xl p-3">{recording.error_message}</p>
        )}

        {previewUrl ? (
          <VideoPlayer src={previewUrl} resumeKey={`rec-${recording?.id}`} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Nenhum vídeo disponível ainda. Envie o arquivo da gravação manualmente.
            </p>
            <Label className="inline-flex items-center gap-2 cursor-pointer text-sm text-primary">
              <Upload className="h-4 w-4" />
              {uploading ? "Enviando…" : "Enviar vídeo"}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); }}
              />
            </Label>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título da aula</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Módulo de destino</Label>
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Manter o módulo atual</SelectItem>
                {modules.map((m: { id: string; title: string }) => (
                  <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                ))}
                <SelectItem value="new">Criar novo módulo…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {moduleId === "new" && (
            <div className="space-y-1.5">
              <Label>Nome do novo módulo</Label>
              <Input value={newModule} onChange={(e) => setNewModule(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={publish} disabled={busy || !previewUrl}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Publicar como aula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
