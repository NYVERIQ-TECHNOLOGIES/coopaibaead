import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CalendarClock, Copy, Edit, Plus, Radio, Search, Square, Trash2, Users, Video, Film,
} from "lucide-react";
import GoogleConnectCard, { useGoogleStatus } from "@/components/live/GoogleConnectCard";
import LiveClassDialog, { LiveClassRow } from "@/components/live/LiveClassDialog";
import PublishRecordingDialog, { RecordingRow } from "@/components/live/PublishRecordingDialog";
import LiveAttendanceReport from "@/components/live/LiveAttendanceReport";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  agendada: { label: "Agendada", variant: "secondary" },
  ao_vivo: { label: "Ao vivo", variant: "default" },
  encerrada: { label: "Encerrada", variant: "outline" },
  processando: { label: "Processando", variant: "outline" },
  pronta: { label: "Gravação pronta", variant: "secondary" },
  publicada: { label: "Publicada", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function AttendanceRuleCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["live-attendance-rule"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value")
        .eq("key", "live_attendance_min_percent").maybeSingle();
      return Number(data?.value ?? 75);
    },
  });
  const [value, setValue] = useState<number | null>(null);
  const current = value ?? data ?? 75;

  async function save() {
    const pct = Math.min(100, Math.max(1, Math.round(current)));
    const { error } = await supabase.from("app_settings")
      .upsert({ key: "live_attendance_min_percent", value: pct as unknown as never }, { onConflict: "key" });
    if (error) return toast.error(error.message);
    toast.success("Critério de presença atualizado.");
    void qc.invalidateQueries({ queryKey: ["live-attendance-rule"] });
  }

  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="text-sm font-medium">Critério de presença nas aulas ao vivo</p>
          <p className="text-xs text-muted-foreground">
            Percentual mínimo da duração da aula para a presença ser considerada válida.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" min={1} max={100} className="w-24"
            value={current} onChange={(e) => setValue(Number(e.target.value))} />
          <span className="text-sm text-muted-foreground">%</span>
          <Button size="sm" variant="outline" onClick={save}>Salvar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LiveClasses() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isProfessor = role === "professor";
  const isAdmin = role === "admin" || isProfessor;
  const { status: googleStatus, loading: googleLoading, refresh: refreshGoogle } = useGoogleStatus();

  const [filter, setFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LiveClassRow | null>(null);
  const [publishRec, setPublishRec] = useState<RecordingRow | null>(null);
  const [attendanceFor, setAttendanceFor] = useState<LiveClassRow | null>(null);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["live-classes-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_classes")
        .select("*, courses(title)")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recordings = [] } = useQuery({
    queryKey: ["live-recordings-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("live_recordings").select("*");
      return (data ?? []) as RecordingRow[];
    },
  });




  const recByClass = useMemo(() => {
    const m = new Map<string, RecordingRow>();
    recordings.forEach((r) => m.set(r.live_class_id, r));
    return m;
  }, [recordings]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (classes as (LiveClassRow & { courses?: { title: string } })[]).filter((c) => {
      if (isProfessor && (c as any).teacher_id !== user?.id) return false;
      if (filter === "agendadas" && c.status !== "agendada") return false;
      if (filter === "ao-vivo" && c.status !== "ao_vivo") return false;
      if (filter === "gravacoes" && !["encerrada", "processando", "pronta", "publicada"].includes(c.status)) return false;
      if (!term) return true;
      return c.title.toLowerCase().includes(term) || (c.courses?.title ?? "").toLowerCase().includes(term);
    });
  }, [classes, filter, search]);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["live-classes-admin"] });
    void qc.invalidateQueries({ queryKey: ["live-recordings-admin"] });
  }

  async function startNow(lc: LiveClassRow) {
    if (lc.provider === "nativo") {
      await supabase.from("live_classes").update({
        status: "ao_vivo", started_at: new Date().toISOString(),
      }).eq("id", lc.id);
      refresh();
      window.location.assign(`/live/${lc.id}`);
      return;
    }
    if (!lc.meet_url) {
      const { data, error } = await supabase.functions.invoke("live-class-create-meet", {
        body: { liveClassId: lc.id },
      });
      if (error || data?.error) return toast.error("Crie ou informe o link da sala antes de iniciar.");
    }
    await supabase.from("live_classes").update({
      status: "ao_vivo", started_at: new Date().toISOString(),
    }).eq("id", lc.id);
    toast.success("Aula iniciada.");
    refresh();
  }

  async function endClass(lc: LiveClassRow) {
    if (lc.provider === "nativo") {
      const { error } = await supabase.rpc("live_end_class", { _live_class_id: lc.id });
      if (error) return toast.error(error.message);
      toast.success("Aula encerrada e presença consolidada.");
      refresh();
      return;
    }
    toast.info("Encerrando a aula e buscando a gravação…");
    await supabase.from("live_classes").update({
      status: "encerrada", ended_at: new Date().toISOString(),
    }).eq("id", lc.id);
    const { data } = await supabase.functions.invoke("live-class-recording", {
      body: { liveClassId: lc.id },
    });
    if (data?.status === "pronta") toast.success("Gravação disponível para revisão.");
    else toast.warning(data?.message ?? "Aula encerrada. Envie a gravação manualmente quando quiser.");
    refresh();
  }

  async function removeClass(lc: LiveClassRow) {
    if (!confirm(`Excluir a aula "${lc.title}"?`)) return;
    const { error } = await supabase.from("live_classes").delete().eq("id", lc.id);
    if (error) return toast.error(error.message);
    toast.success("Aula excluída.");
    refresh();
  }

  async function openRecording(lc: LiveClassRow) {
    let rec = recByClass.get(lc.id);
    if (!rec) {
      const { data, error } = await supabase.from("live_recordings").insert({
        live_class_id: lc.id,
        course_id: lc.course_id,
        module_id: lc.module_id,
        title: lc.title,
        description: lc.description,
        status: "aguardando_upload",
        source: lc.provider,
      }).select("*").single();
      if (error) return toast.error(error.message);
      rec = data as RecordingRow;
      refresh();
    }
    setPublishRec(rec);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" /> Aulas ao Vivo
          </h2>
          <p className="text-sm text-muted-foreground">
            Transmita ao vivo dentro da plataforma, com chat, presença automática e gravação.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova aula ao vivo
        </Button>
      </div>

      {role === "admin" && <AttendanceRuleCard />}

      <GoogleConnectCard status={googleStatus} loading={googleLoading} onChanged={refreshGoogle} />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="agendadas">Agendadas</TabsTrigger>
            <TabsTrigger value="ao-vivo">Ao vivo</TabsTrigger>
            <TabsTrigger value="gravacoes">Gravações</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por aula ou curso"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : visible.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          Nenhuma aula ao vivo por aqui ainda.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {visible.map((lc) => {
            const st = STATUS_LABEL[lc.status] ?? STATUS_LABEL.agendada;
            const rec = recByClass.get(lc.id);
            const canManage = isAdmin || lc.teacher_id === user?.id;
            return (
              <Card key={lc.id} className="overflow-hidden">
                <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold truncate">{lc.title}</h3>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {rec?.status === "publicada" && <Badge variant="outline">Aula publicada</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {(lc as LiveClassRow & { courses?: { title: string } }).courses?.title}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <CalendarClock className="h-3.5 w-3.5" /> {fmtDate(lc.scheduled_at)} · {lc.duration_minutes} min
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {lc.provider === "nativo" && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/live/${lc.id}`}>
                          <Video className="h-4 w-4 mr-1" /> Sala da aula
                        </Link>
                      </Button>
                    )}
                    {lc.meet_url && (
                      <>
                        <Button size="sm" variant="outline" asChild>
                          <a href={lc.meet_url} target="_blank" rel="noopener noreferrer">
                            <Video className="h-4 w-4 mr-1" /> Entrar
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          void navigator.clipboard.writeText(lc.meet_url!);
                          toast.success("Link copiado.");
                        }} aria-label="Copiar link">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {canManage && lc.status === "agendada" && (
                      <Button size="sm" onClick={() => startNow(lc)}>
                        <Radio className="h-4 w-4 mr-1" /> Iniciar
                      </Button>
                    )}
                    {canManage && lc.status === "ao_vivo" && (
                      <Button size="sm" variant="destructive" onClick={() => endClass(lc)}>
                        <Square className="h-4 w-4 mr-1" /> Encerrar
                      </Button>
                    )}
                    {canManage && ["encerrada", "processando", "pronta", "publicada"].includes(lc.status) && (
                      <Button size="sm" variant="outline" onClick={() => openRecording(lc)}>
                        <Film className="h-4 w-4 mr-1" /> Gravação
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setAttendanceFor(lc)} aria-label="Ver presença">
                      <Users className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost"
                          onClick={() => { setEditing(lc); setDialogOpen(true); }} aria-label="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeClass(lc)} aria-label="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <LiveClassDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        googleConnected={!!googleStatus?.connected}
        onSaved={refresh}
      />

      <PublishRecordingDialog
        open={!!publishRec}
        onOpenChange={(v) => !v && setPublishRec(null)}
        recording={publishRec}
        onDone={refresh}
      />

      <Dialog open={!!attendanceFor} onOpenChange={(v) => !v && setAttendanceFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Presença — {attendanceFor?.title}</DialogTitle></DialogHeader>
          {attendanceFor && (
            <LiveAttendanceReport liveClassId={attendanceFor.id} title={attendanceFor.title} />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
