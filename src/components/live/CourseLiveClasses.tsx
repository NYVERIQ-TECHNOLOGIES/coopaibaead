import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CalendarClock, Radio, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  courseId: string;
}

function useCountdown(target: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const diff = new Date(target).getTime() - now;
  const abs = Math.abs(diff);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  const label = d > 0 ? `${d}d ${h}h ${m}min` : h > 0 ? `${h}h ${m}min` : `${m}min ${s}s`;
  return { diff, label };
}

function LiveCard({ lc }: { lc: any }) {
  const { diff, label } = useCountdown(lc.scheduled_at);
  const isLive = lc.status === "ao_vivo";
  const opensAt = new Date(lc.scheduled_at).getTime() - lc.open_minutes_before * 60000;
  const canJoin = isLive || Date.now() >= opensAt;
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function join() {
    if (lc.provider === "nativo") {
      navigate(`/live/${lc.id}`);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("entrar_aula_ao_vivo", { _live_class_id: lc.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    const url = (data as { meet_url?: string })?.meet_url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold truncate">{lc.title}</h4>
          {isLive ? (
            <Badge className="gap-1 animate-pulse"><Radio className="h-3 w-3" /> AO VIVO</Badge>
          ) : (
            <Badge variant="secondary">Agendada</Badge>
          )}
        </div>
        {lc.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lc.description}</p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          <CalendarClock className="h-3.5 w-3.5" />
          {new Date(lc.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          {!isLive && diff > 0 && <span className="text-primary font-medium">· começa em {label}</span>}
        </p>
      </div>
      <Button size="sm" onClick={join} disabled={!canJoin || busy}>
        <Video className="h-4 w-4 mr-1" />
        {isLive ? "Entrar na aula" : canJoin ? "Entrar" : "Em breve"}
      </Button>
    </div>
  );
}

export default function CourseLiveClasses({ courseId }: Props) {
  const { data: classes = [] } = useQuery({
    queryKey: ["course-live-classes", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_classes")
        .select("id, title, description, scheduled_at, status, open_minutes_before, meet_url, provider")
        .eq("course_id", courseId)
        .in("status", ["agendada", "ao_vivo"])
        .gte("scheduled_at", new Date(Date.now() - 4 * 3600000).toISOString())
        .order("scheduled_at");
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  if (classes.length === 0) return null;

  return (
    <section className="bg-card rounded-2xl shadow-card border border-border/70 p-4 sm:p-6 space-y-3"
      aria-label="Aulas ao vivo">
      <h3 className="font-heading font-bold flex items-center gap-2">
        <Radio className="h-5 w-5 text-primary" /> Aulas ao vivo
      </h3>
      <div className="space-y-3">
        {classes.map((lc) => <LiveCard key={lc.id} lc={lc} />)}
      </div>
    </section>
  );
}
