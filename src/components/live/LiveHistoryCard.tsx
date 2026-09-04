import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";
import { formatDuration } from "@/components/live/useLiveSession";

interface Row {
  live_class_id: string;
  title: string;
  course_title: string | null;
  scheduled_at: string;
  total_seconds: number;
  percent: number;
  presenca: string;
}

export default function LiveHistoryCard() {
  const { data: rows = [] } = useQuery({
    queryKey: ["live-my-history"],
    queryFn: async () => {
      const { data } = await supabase.rpc("live_my_history");
      return (data ?? []) as Row[];
    },
  });

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Radio className="h-4 w-4 text-primary" /> Aulas ao vivo
      </h3>
      <div className="rounded-2xl border border-border divide-y divide-border">
        {rows.map((r) => (
          <div key={r.live_class_id} className="p-3 flex flex-wrap items-center gap-2 justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{r.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {r.course_title} · {new Date(r.scheduled_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{formatDuration(r.total_seconds)} · {r.percent}%</span>
              <Badge variant={r.presenca === "presente" ? "default" : r.presenca === "parcial" ? "secondary" : "outline"}>
                {r.presenca === "presente" ? "Presente" : r.presenca === "parcial" ? "Parcial" : "Ausente"}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
