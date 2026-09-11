import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Film, Loader2, PlayCircle } from "lucide-react";
import VideoPlayer from "./VideoPlayer";

interface Rec {
  id: string;
  title: string;
  description: string | null;
  storage_path: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  status: string;
}

export default function CourseRecordings({ courseId }: { courseId: string }) {
  const [playing, setPlaying] = useState<Rec | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: recordings = [] } = useQuery({
    queryKey: ["course-recordings", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_recordings")
        .select("id, title, description, storage_path, video_url, duration_seconds, published_at, status")
        .eq("course_id", courseId)
        .in("status", ["pronta", "publicada"])
        .order("published_at", { ascending: false, nullsFirst: false });
      return (data ?? []) as Rec[];
    },
  });

  async function open(rec: Rec) {
    setPlaying(rec);
    setUrl(null);
    if (rec.video_url) { setUrl(rec.video_url); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("live-recording-url", {
      body: { recordingId: rec.id },
    });
    setLoading(false);
    if (error || !data?.url) {
      toast.error(data?.error ?? "Não foi possível carregar a gravação.");
      return;
    }
    setUrl(data.url);
  }

  if (recordings.length === 0) return null;

  return (
    <section className="bg-card rounded-2xl shadow-card border border-border/70 p-4 sm:p-6 space-y-3"
      aria-label="Gravações das aulas ao vivo">
      <h3 className="font-heading font-bold flex items-center gap-2">
        <Film className="h-5 w-5 text-primary" /> Aulas gravadas
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {recordings.map((r) => (
          <button key={r.id} onClick={() => void open(r)}
            className="text-left rounded-2xl border border-border/70 bg-background p-4 hover:border-primary transition-colors">
            <div className="flex items-start gap-3">
              <PlayCircle className="h-6 w-6 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{r.title}</p>
                {r.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {r.duration_seconds ? (
                    <Badge variant="secondary">{Math.round(r.duration_seconds / 60)} min</Badge>
                  ) : null}
                  {r.published_at && (
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(r.published_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!playing} onOpenChange={(v) => { if (!v) { setPlaying(null); setUrl(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{playing?.title}</DialogTitle></DialogHeader>
          {loading ? (
            <div className="aspect-video flex items-center justify-center rounded-2xl bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : url ? (
            <VideoPlayer src={url} resumeKey={`rec-${playing?.id}`} />
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Vídeo indisponível no momento.
            </p>
          )}
          {playing?.description && (
            <p className="text-sm text-muted-foreground">{playing.description}</p>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => { setPlaying(null); setUrl(null); }}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
