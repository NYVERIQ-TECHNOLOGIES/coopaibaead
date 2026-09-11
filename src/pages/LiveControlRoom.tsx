import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, Radio, Square, Users, Video } from "lucide-react";
import LiveChat from "@/components/live/LiveChat";
import { formatDuration } from "@/components/live/useLiveSession";

interface ClassRow {
  id: string;
  title: string;
  status: string;
  teacher_id: string;
  scheduled_at: string;
  started_at: string | null;
  duration_minutes: number;
  provider: string;
  courses?: { title: string } | null;
}

interface Participant {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  joined_at: string | null;
  left_at: string | null;
  total_seconds: number;
  online: boolean;
}

function Elapsed({ startedAt }: { startedAt: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!startedAt) return <span>—</span>;
  const secs = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  return <span className="tabular-nums">{formatDuration(secs)}</span>;
}

export default function LiveControlRoom() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isProfessor = role === "professor";
  const [selected, setSelected] = useState<string | null>(null);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["live-control-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_classes")
        .select("id, title, status, teacher_id, scheduled_at, started_at, duration_minutes, provider, courses(title)")
        .eq("status", "ao_vivo")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClassRow[];
    },
    refetchInterval: 15000,
  });

  const visible = useMemo(
    () => (isProfessor ? classes.filter((c) => c.teacher_id === user?.id) : classes),
    [classes, isProfessor, user?.id],
  );

  useEffect(() => {
    if (visible.length === 0) { setSelected(null); return; }
    if (!selected || !visible.some((c) => c.id === selected)) setSelected(visible[0].id);
  }, [visible, selected]);

  const current = visible.find((c) => c.id === selected) ?? null;

  const { data: participants = [] } = useQuery({
    queryKey: ["live-control-participants", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("live_class_participants", { _live_class_id: selected! });
      if (error) throw error;
      return (data ?? []) as Participant[];
    },
    refetchInterval: 10000,
  });

  const online = participants.filter((p) => p.online).length;

  async function endClass(lc: ClassRow) {
    if (!confirm(`Encerrar a transmissão "${lc.title}"?`)) return;
    const { error } = await supabase.rpc("live_end_class", { _live_class_id: lc.id });
    if (error) return toast.error(error.message);
    toast.success("Aula encerrada e presença consolidada.");
    void qc.invalidateQueries({ queryKey: ["live-control-active"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" /> Central de transmissões
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe as aulas que estão no ar, veja quem está assistindo e responda no chat sem entrar na sala.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/live-classes"><ArrowLeft className="h-4 w-4 mr-1" /> Aulas ao vivo</Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : visible.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          Nenhuma transmissão no ar neste momento.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-3">
            {visible.map((lc) => (
              <Card key={lc.id}
                className={`cursor-pointer transition-colors ${lc.id === selected ? "border-primary" : ""}`}
                onClick={() => setSelected(lc.id)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight">{lc.title}</h3>
                    <Badge className="gap-1 animate-pulse shrink-0">
                      <Radio className="h-3 w-3" /> AO VIVO
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{lc.courses?.title}</p>
                  <p className="text-xs text-muted-foreground">
                    No ar há <Elapsed startedAt={lc.started_at} /> · {lc.duration_minutes} min previstos
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" asChild onClick={(e) => e.stopPropagation()}>
                      <Link to={`/live/${lc.id}`}><Video className="h-4 w-4 mr-1" /> Abrir sala</Link>
                    </Button>
                    <Button size="sm" variant="destructive"
                      onClick={(e) => { e.stopPropagation(); void endClass(lc); }}>
                      <Square className="h-4 w-4 mr-1" /> Encerrar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="lg:col-span-2">
            <CardContent className="p-3 h-[560px] flex flex-col">
              {current ? (
                <Tabs defaultValue="participantes" className="flex flex-col flex-1 min-h-0">
                  <TabsList className="w-full">
                    <TabsTrigger value="participantes" className="flex-1">
                      <Users className="h-3.5 w-3.5 mr-1" /> Participantes ({online})
                    </TabsTrigger>
                    <TabsTrigger value="chat" className="flex-1">
                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> Chat
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="participantes" className="flex-1 min-h-0 mt-3">
                    <ScrollArea className="h-full pr-2">
                      <div className="divide-y divide-border">
                        {participants.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-8">
                            Nenhum participante entrou ainda.
                          </p>
                        )}
                        {participants.map((p) => (
                          <div key={p.user_id} className="py-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm truncate">{p.full_name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                Entrou {p.joined_at
                                  ? new Date(p.joined_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                                  : "—"}
                                {" · "}{formatDuration(p.total_seconds)}
                              </p>
                            </div>
                            <Badge variant={p.online ? "default" : "secondary"}>
                              {p.online ? "Online" : "Saiu"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="chat" className="flex-1 min-h-0 mt-3">
                    <LiveChat liveClassId={current.id} canModerate />
                  </TabsContent>
                </Tabs>
              ) : (
                <p className="text-sm text-muted-foreground m-auto">Selecione uma transmissão.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
