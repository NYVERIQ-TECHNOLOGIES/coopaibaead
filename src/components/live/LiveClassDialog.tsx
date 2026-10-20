import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Loader2, RefreshCw, Video } from "lucide-react";

export interface LiveClassRow {
  id: string;
  course_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  provider: string;
  meet_url: string | null;
  recording_enabled: boolean;
  open_minutes_before: number;
  status: string;
  recording_status: string;
  teacher_id: string;
}

export function gerarLinkSala(titulo: string) {
  const base = (titulo || "aula")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "aula";
  const rand = Math.random().toString(36).slice(2, 8);
  return `https://meet.jit.si/coopaiba-${base}-${rand}`;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default function LiveClassDialog({
  open,
  onOpenChange,
  editing,
  googleConnected,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: LiveClassRow | null;
  googleConnected: boolean;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState<string>("later");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState(toLocalInput(new Date(Date.now() + 3600000).toISOString()));
  const [duration, setDuration] = useState(60);
  const [openBefore, setOpenBefore] = useState(15);
  const [recording, setRecording] = useState(true);
  const [provider, setProvider] = useState<"nativo" | "google_meet" | "link_externo" | "sala_instantanea">("google_meet");
  const [meetUrl, setMeetUrl] = useState("");
  const [startNow, setStartNow] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: courses = [] } = useQuery({
    queryKey: ["live-course-options"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").order("title");
      return data ?? [];
    },
  });

  const { data: modules = [] } = useQuery({
    queryKey: ["live-module-options", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await supabase
        .from("course_modules").select("id, title").eq("course_id", courseId).order("sort_order");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCourseId(editing.course_id);
      setModuleId(editing.module_id ?? "later");
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setWhen(toLocalInput(editing.scheduled_at));
      setDuration(editing.duration_minutes);
      setOpenBefore(editing.open_minutes_before);
      setRecording(editing.recording_enabled);
      setProvider(
        editing.provider === "link_externo" || editing.provider === "sala_instantanea" || editing.provider === "google_meet"
          ? (editing.provider as "link_externo" | "sala_instantanea" | "google_meet")
          : "nativo",
      );
      setMeetUrl(editing.meet_url ?? "");
      setStartNow(false);
    } else {
      setCourseId("");
      setModuleId("later");
      setTitle("");
      setDescription("");
      setWhen(toLocalInput(new Date(Date.now() + 3600000).toISOString()));
      setDuration(60);
      setOpenBefore(15);
      setRecording(true);
      setProvider("google_meet");
      setMeetUrl("");
      setStartNow(false);
    }
  }, [open, editing, googleConnected]);

  async function save() {
    if (!courseId) return toast.error("Escolha o curso.");
    if (title.trim().length < 3) return toast.error("Informe um título para a aula.");
    if (provider !== "google_meet" && provider !== "nativo" && !meetUrl.trim()) {
      return toast.error("Informe o link da reunião.");
    }
    setSaving(true);
    try {
      const scheduledAt = startNow ? new Date().toISOString() : new Date(when).toISOString();
      const payload = {
        course_id: courseId,
        module_id: moduleId === "later" ? null : moduleId,
        teacher_id: editing?.teacher_id ?? user!.id,
        title: title.trim(),
        description: description.trim() || null,
        scheduled_at: scheduledAt,
        duration_minutes: duration,
        open_minutes_before: openBefore,
        recording_enabled: recording,
        provider,
        meet_url: provider === "nativo"
          ? null
          : provider !== "google_meet" ? meetUrl.trim()
            : (editing?.meet_url ?? "").startsWith("https://meet.google.com/") ? editing!.meet_url : null,
        status: startNow ? "ao_vivo" : (editing?.status ?? "agendada"),
        started_at: startNow ? new Date().toISOString() : undefined,
      };

      let liveId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("live_classes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("live_classes").insert(payload).select("id").single();
        if (error) throw error;
        liveId = data.id;
      }

      if (provider === "google_meet" && liveId && !payload.meet_url) {
        const { data, error } = await supabase.functions.invoke("live-class-create-meet", {
          body: { liveClassId: liveId },
        });
        if (error || data?.error) {
          toast.warning(
            "A aula foi salva, mas não foi possível criar a sala do Google Meet automaticamente. Conecte a conta Google e use o botão \"Criar sala Google Meet\" na lista da aula para tentar novamente. A aula não será iniciada por outro método automaticamente.",
          );
        } else {
          toast.success("Aula salva e sala do Google Meet criada.");
          onSaved();
          onOpenChange(false);
          setSaving(false);
          return;
        }
      }

      toast.success(editing ? "Aula atualizada." : "Aula ao vivo criada.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message ?? "Não foi possível salvar a aula.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            {editing ? "Editar aula ao vivo" : "Nova aula ao vivo"}
          </DialogTitle>
          <DialogDescription>
            Agende ou inicie agora. A gravação pode virar uma aula do curso depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Curso</Label>
            <Select value={courseId} onValueChange={(v) => { setCourseId(v); setModuleId("later"); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
              <SelectContent>
                {courses.map((c: { id: string; title: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Módulo</Label>
            <Select value={moduleId} onValueChange={setModuleId} disabled={!courseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="later">Decidir depois</SelectItem>
                {modules.map((m: { id: string; title: string }) => (
                  <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Você poderá escolher o módulo na hora de publicar a gravação.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Aula ao vivo — Módulo 2" />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Iniciar agora</p>
              <p className="text-xs text-muted-foreground">A aula fica ao vivo imediatamente.</p>
            </div>
            <Switch checked={startNow} onCheckedChange={setStartNow} />
          </div>

          {!startNow && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Duração (min)</Label>
                <Input type="number" min={10} step={5} value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Abrir a sala antes (min)</Label>
            <Input type="number" min={0} max={120} value={openBefore}
              onChange={(e) => setOpenBefore(Number(e.target.value))} />
          </div>

          <div className="space-y-1.5">
            <Label>Método de realização</Label>
            <Select
              value={provider === "google_meet" ? "google_meet" : "outra"}
              onValueChange={(v) => {
                if (v === "google_meet") setProvider("google_meet");
                else setProvider((prev) => (prev === "google_meet" ? "nativo" : prev));
              }}
            >
              <SelectTrigger aria-label="Método de realização"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google_meet">Google Meet (padrão)</SelectItem>
                <SelectItem value="outra">Outra forma de realização — sem Google Meet (opcional)</SelectItem>
              </SelectContent>
            </Select>

            {provider === "google_meet" ? (
              <div className="space-y-1 rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium flex items-center gap-1">
                  <Video className="h-3.5 w-3.5 text-primary" /> Google Meet — método principal
                </p>
                <p className="text-xs text-muted-foreground">
                  {googleConnected
                    ? "Conta Google conectada. A sala do Google Meet será criada automaticamente ao salvar."
                    : "Conecte sua conta Google (card na página) para que a sala possa ser criada. Sem essa conexão não será possível iniciar a aula pelo Google Meet."}
                </p>
                {editing?.meet_url?.startsWith("https://meet.google.com/") && (
                  <p className="text-xs font-mono break-all text-muted-foreground">{editing.meet_url}</p>
                )}
              </div>
            ) : (
              <>
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    const next = v as typeof provider;
                    setProvider(next);
                    if (next === "sala_instantanea") setMeetUrl(gerarLinkSala(title));
                    if (next === "link_externo" && meetUrl.includes("meet.jit.si")) setMeetUrl("");
                  }}
                >
                  <SelectTrigger aria-label="Alternativa sem Google Meet"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nativo">Transmitir pela plataforma</SelectItem>
                    <SelectItem value="sala_instantanea">Criar link da sala automaticamente</SelectItem>
                    <SelectItem value="link_externo">Colar link de reunião existente</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A aula será realizada sem Google Meet: nenhum link do Meet será exigido ou criado.
                </p>
              </>
            )}
          </div>

          {provider === "nativo" && (
            <p className="text-xs text-muted-foreground rounded-xl border border-border p-3">
              A aula acontece dentro da própria plataforma: câmera, microfone, compartilhamento de tela,
              chat e presença automática, sem instalar nada.
            </p>
          )}

          {provider === "sala_instantanea" && (
            <div className="space-y-1.5">
              <Label>Link gerado</Label>
              <div className="flex gap-2">
                <Input value={meetUrl} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon"
                  title="Gerar outro link"
                  onClick={() => setMeetUrl(gerarLinkSala(title))}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon"
                  title="Copiar link"
                  onClick={() => { navigator.clipboard.writeText(meetUrl); toast.success("Link copiado."); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sala criada na hora, sem precisar de conta Google. Basta compartilhar com os alunos.
              </p>
            </div>
          )}

          {provider === "link_externo" && (
            <div className="space-y-1.5">
              <Label>Link da reunião</Label>
              <Input value={meetUrl} onChange={(e) => setMeetUrl(e.target.value)}
                placeholder="https://meet.google.com/abc-defg-hij" />
            </div>
          )}


          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Gravar a aula</p>
              <p className="text-xs text-muted-foreground">A gravação poderá virar uma aula do curso.</p>
            </div>
            <Switch checked={recording} onCheckedChange={setRecording} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? "Salvar" : "Criar aula"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
