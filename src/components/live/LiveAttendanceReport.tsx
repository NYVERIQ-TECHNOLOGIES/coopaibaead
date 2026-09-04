import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { formatDuration } from "@/components/live/useLiveSession";

interface Row {
  user_id: string;
  full_name: string;
  first_join: string | null;
  last_leave: string | null;
  total_seconds: number;
  percent: number;
  presenca: string;
  online: boolean;
}

const LABEL: Record<string, { text: string; variant: "default" | "secondary" | "outline" }> = {
  presente: { text: "Presente", variant: "default" },
  parcial: { text: "Parcial", variant: "secondary" },
  ausente: { text: "Ausente", variant: "outline" },
};

function hhmm(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
}

export default function LiveAttendanceReport({
  liveClassId,
  title,
}: {
  liveClassId: string;
  title?: string;
}) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["live-attendance-report", liveClassId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("live_attendance_report", { _live_class_id: liveClassId });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 20000,
  });

  const resumo = useMemo(() => {
    const presentes = rows.filter((r) => r.presenca === "presente").length;
    const parciais = rows.filter((r) => r.presenca === "parcial").length;
    const media = rows.length ? rows.reduce((a, r) => a + Number(r.percent), 0) / rows.length : 0;
    return { presentes, parciais, media: Math.round(media * 10) / 10, total: rows.length };
  }, [rows]);

  function exportCsv() {
    const head = ["Aluno", "Entrada", "Saída", "Tempo", "Percentual", "Presença"];
    const body = rows.map((r) => [
      r.full_name, hhmm(r.first_join), hhmm(r.last_leave),
      formatDuration(r.total_seconds), `${r.percent}%`, LABEL[r.presenca]?.text ?? r.presenca,
    ]);
    const csv = [head, ...body].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `presenca-${(title ?? "aula").replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Participantes: {resumo.total}</Badge>
          <Badge>Presentes: {resumo.presentes}</Badge>
          <Badge variant="secondary">Parciais: {resumo.parciais}</Badge>
          <Badge variant="outline">Participação média: {resumo.media}%</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exportar
        </Button>
      </div>

      <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr className="text-left">
              <th className="p-2 font-medium">Aluno</th>
              <th className="p-2 font-medium">Entrada</th>
              <th className="p-2 font-medium">Saída</th>
              <th className="p-2 font-medium">Tempo</th>
              <th className="p-2 font-medium">%</th>
              <th className="p-2 font-medium">Presença</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">
                Nenhum participante registrado.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.user_id}>
                <td className="p-2 truncate max-w-[180px]">{r.full_name}</td>
                <td className="p-2 text-muted-foreground">{hhmm(r.first_join)}</td>
                <td className="p-2 text-muted-foreground">{r.online ? "—" : hhmm(r.last_leave)}</td>
                <td className="p-2">{formatDuration(r.total_seconds)}</td>
                <td className="p-2">{r.percent}%</td>
                <td className="p-2">
                  <Badge variant={LABEL[r.presenca]?.variant ?? "outline"}>
                    {LABEL[r.presenca]?.text ?? r.presenca}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
