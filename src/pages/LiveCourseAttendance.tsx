import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Download, Users } from "lucide-react";
import LiveAttendanceReport from "@/components/live/LiveAttendanceReport";

interface SummaryRow {
  live_class_id: string;
  title: string;
  scheduled_at: string;
  status: string;
  total_alunos: number;
  presentes: number;
  parciais: number;
  media_percent: number;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function LiveCourseAttendance() {
  const [courseId, setCourseId] = useState<string>("");
  const [detail, setDetail] = useState<SummaryRow | null>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ["live-report-courses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_classes")
        .select("course_id, courses(title)")
        .order("scheduled_at", { ascending: false });
      const map = new Map<string, string>();
      (data ?? []).forEach((r) => {
        const t = (r as { courses?: { title: string } }).courses?.title;
        if (r.course_id && t && !map.has(r.course_id)) map.set(r.course_id, t);
      });
      return [...map.entries()].map(([id, title]) => ({ id, title }));
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["live-course-attendance", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("live_course_attendance_summary", { _course_id: courseId });
      if (error) throw error;
      return (data ?? []) as SummaryRow[];
    },
  });

  const totals = useMemo(() => {
    const alunos = new Set<string>();
    const totalAulas = rows.length;
    const somaAlunos = rows.reduce((a, r) => a + Number(r.total_alunos), 0);
    const media = rows.length
      ? rows.reduce((a, r) => a + Number(r.media_percent), 0) / rows.length
      : 0;
    const presentes = rows.reduce((a, r) => a + Number(r.presentes), 0);
    return {
      totalAulas,
      mediaAlunos: totalAulas ? Math.round(somaAlunos / totalAulas) : 0,
      somaAlunos,
      presentes,
      media: Math.round(media * 10) / 10,
      _u: alunos,
    };
  }, [rows]);

  function exportCsv() {
    const head = ["Aula", "Data", "Situação", "Alunos", "Presentes", "Parciais", "% médio"];
    const body = rows.map((r) => [
      r.title, fmt(r.scheduled_at), r.status, r.total_alunos, r.presentes, r.parciais, `${r.media_percent}%`,
    ]);
    const csv = [head, ...body]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "presenca-por-curso.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Presença por curso
          </h1>
          <p className="text-sm text-muted-foreground">
            Total de alunos e percentual médio de participação em cada aula ao vivo do curso.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/live-classes"><ArrowLeft className="h-4 w-4 mr-1" /> Aulas ao vivo</Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="sm:w-96"><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
          <SelectContent>
            {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        {rows.length > 0 && (
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        )}
      </div>

      {!courseId ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          Escolha um curso para ver o relatório.
        </CardContent></Card>
      ) : isLoading ? (
        <Skeleton className="h-56 rounded-2xl" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          Este curso ainda não tem aulas ao vivo registradas.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Aulas ao vivo", value: totals.totalAulas },
              { label: "Participações", value: totals.somaAlunos },
              { label: "Média de alunos por aula", value: totals.mediaAlunos },
              { label: "Percentual médio", value: `${totals.media}%` },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Aula</th>
                    <th className="text-left p-3">Data</th>
                    <th className="text-center p-3">Alunos</th>
                    <th className="text-center p-3">Presentes</th>
                    <th className="text-left p-3 w-56">% médio</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.live_class_id}>
                      <td className="p-3">
                        <p className="font-medium">{r.title}</p>
                        <Badge variant="outline" className="mt-1">{r.status}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{fmt(r.scheduled_at)}</td>
                      <td className="p-3 text-center">{r.total_alunos}</td>
                      <td className="p-3 text-center">{r.presentes}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Progress value={Number(r.media_percent)} className="h-2" />
                          <span className="text-xs tabular-nums w-12 text-right">{r.media_percent}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>Detalhes</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Presença — {detail?.title}</DialogTitle></DialogHeader>
          {detail && <LiveAttendanceReport liveClassId={detail.live_class_id} title={detail.title} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
