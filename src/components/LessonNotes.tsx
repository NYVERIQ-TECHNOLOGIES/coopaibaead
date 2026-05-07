import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Save, StickyNote, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface Props {
  lessonId: string;
  courseId: string;
}

interface Note {
  id: string;
  content: string;
  video_timestamp_seconds: number | null;
  created_at: string;
}

function formatTimestamp(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function LessonNotes({ lessonId, courseId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [timestamp, setTimestamp] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["lesson_notes", lessonId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("lesson_notes")
        .select("id, content, video_timestamp_seconds, created_at")
        .eq("lesson_id", lessonId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
    enabled: !!user && !!lessonId,
  });

  const addMut = useMutation({
    mutationFn: async () => {
      if (!user || !content.trim()) return;
      const ts = timestamp.trim();
      let secs: number | null = null;
      if (ts) {
        const parts = ts.split(":").map((n) => parseInt(n, 10));
        if (parts.length === 2 && parts.every((p) => !isNaN(p))) {
          secs = parts[0] * 60 + parts[1];
        } else if (parts.length === 1 && !isNaN(parts[0])) {
          secs = parts[0];
        }
      }
      const { error } = await supabase.from("lesson_notes").insert({
        user_id: user.id,
        lesson_id: lessonId,
        course_id: courseId,
        content: content.trim(),
        video_timestamp_seconds: secs,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      setTimestamp("");
      qc.invalidateQueries({ queryKey: ["lesson_notes", lessonId, user?.id] });
      toast({ title: "Anotação salva" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lesson_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lesson_notes", lessonId, user?.id] }),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <StickyNote className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Minhas anotações</h3>
      </div>

      <div className="space-y-2">
        <Textarea
          rows={3}
          placeholder="Escreva uma anotação sobre esta aula…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            placeholder="mm:ss (opcional)"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            className="max-w-[140px]"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => addMut.mutate()}
            disabled={!content.trim() || addMut.isPending}
            className="ml-auto"
          >
            <Save className="w-4 h-4 mr-1.5" /> Salvar
          </Button>
        </div>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma anotação ainda.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-border p-3 bg-background">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
                <button
                  type="button"
                  onClick={() => delMut.mutate(n.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Remover anotação"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                {n.video_timestamp_seconds !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(n.video_timestamp_seconds)}
                  </span>
                )}
                <span>{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
