import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Users, BookOpen, Award, TrendingUp, GraduationCap, Activity } from "lucide-react";
import SEO from "@/components/SEO";
import { toast } from "sonner";

type ReportData = {
  totals: {
    active_students: number;
    active_enrollments: number;
    total_courses: number;
    issued_certificates: number;
    completed_enrollments: number;
    all_enrollments: number;
    avg_progress: number;
  };
  most_accessed: { id: string; title: string; accesses: number; total_enrollments: number }[];
  completion_rate: { id: string; title: string; enrollments: number; completed: number; rate: number }[];
  recent_signups: { day: string; qty: number }[];
};

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_admin_reports");
      if (error) {
        toast.error("Erro ao carregar relatórios: " + error.message);
      } else {
        setData(data as unknown as ReportData);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) return <div className="p-6">Sem dados.</div>;

  const completionPct = data.totals.all_enrollments
    ? Math.round((data.totals.completed_enrollments / data.totals.all_enrollments) * 100)
    : 0;

  const stats = [
    { label: "Alunos ativos", value: data.totals.active_students, icon: Users },
    { label: "Matrículas ativas", value: data.totals.active_enrollments, icon: GraduationCap },
    { label: "Cursos publicados", value: data.totals.total_courses, icon: BookOpen },
    { label: "Certificados emitidos", value: data.totals.issued_certificates, icon: Award },
    { label: "Taxa de conclusão", value: `${completionPct}%`, icon: TrendingUp },
    { label: "Progresso médio", value: `${data.totals.avg_progress}%`, icon: Activity },
  ];

  return (
    <div className="p-6 space-y-6">
      <SEO title="Relatórios - Coopaiba EAD" description="Painel de relatórios administrativos da plataforma." />
      <div>
        <h1 className="text-3xl font-heading font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Visão geral de cursos, alunos e desempenho.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="mt-2 text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cursos mais acessados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead className="text-right">Acessos</TableHead>
                  <TableHead className="text-right">Matrículas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.most_accessed.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                )}
                {data.most_accessed.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell className="text-right">{c.accesses}</TableCell>
                    <TableCell className="text-right">{c.total_enrollments}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxa de conclusão por curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.completion_rate.length === 0 && (
              <p className="text-center text-muted-foreground text-sm">Sem dados</p>
            )}
            {data.completion_rate.map((c) => (
              <div key={c.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium truncate pr-2">{c.title}</span>
                  <span className="text-muted-foreground">{c.completed}/{c.enrollments} ({c.rate}%)</span>
                </div>
                <Progress value={c.rate} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novos cadastros (últimos 30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent_signups.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum cadastro recente.</p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {data.recent_signups.map((d) => {
                const max = Math.max(...data.recent_signups.map((x) => x.qty));
                const h = Math.max(4, (d.qty / max) * 100);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.qty}`}>
                    <div className="w-full bg-primary rounded-t" style={{ height: `${h}%` }} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
