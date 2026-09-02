import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  BookOpen, CheckCircle2, FileEdit, Users, PlayCircle, Radio, Award, DollarSign, Plus,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export interface ProfessorStats {
  total_courses: number;
  active_courses: number;
  draft_courses: number;
  total_students: number;
  total_lessons: number;
  total_live_classes: number;
  total_certificates: number;
  total_revenue: number;
  total_sales: number;
  by_course: {
    course_id: string;
    title: string;
    is_active: boolean;
    is_paid: boolean;
    students: number;
    certificates: number;
    sales: number;
    revenue: number;
  }[];
}

export function useProfessorStats(professorId?: string | null) {
  return useQuery({
    queryKey: ["professor-stats", professorId ?? "me"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_professor_stats", {
        _professor_id: professorId ?? undefined,
      } as any);
      if (error) throw error;
      return data as unknown as ProfessorStats;
    },
  });
}

export const brl = (v: number) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function StatTile({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-heading font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfessorStatsView({ stats }: { stats: ProfessorStats }) {
  const chartData = (stats.by_course ?? []).map((c) => ({
    name: c.title.length > 18 ? c.title.slice(0, 18) + "…" : c.title,
    Alunos: c.students,
    Certificados: c.certificates,
    Receita: Number(c.revenue ?? 0),
  }));
  const hasData = chartData.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile icon={BookOpen} label="Meus cursos" value={stats.total_courses} />
        <StatTile icon={CheckCircle2} label="Cursos ativos" value={stats.active_courses} />
        <StatTile icon={FileEdit} label="Em rascunho" value={stats.draft_courses} />
        <StatTile icon={Users} label="Total de alunos" value={stats.total_students} />
        <StatTile icon={PlayCircle} label="Total de aulas" value={stats.total_lessons} />
        <StatTile icon={Radio} label="Aulas ao vivo" value={stats.total_live_classes} />
        <StatTile icon={Award} label="Certificados" value={stats.total_certificates} />
        <StatTile icon={DollarSign} label="Receita" value={brl(stats.total_revenue)} />
      </div>

      {hasData ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Alunos por curso</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Alunos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Certificados por curso</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Certificados" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-base">Receita dos meus cursos pagos</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.filter((c) => c.Receita > 0)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: any) => brl(Number(v))} />
                  <Bar dataKey="Receita" fill="hsl(var(--warning))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <p className="font-heading text-lg">Nenhum dado por enquanto</p>
            <p className="text-sm mt-1">Os gráficos aparecem assim que houver cursos com alunos.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ProfessorDashboard() {
  const { profile } = useAuth();
  const { data: stats, isLoading, error } = useProfessorStats();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground">
        Não foi possível carregar seus indicadores. Tente novamente.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            Olá, {profile?.full_name?.split(" ")[0] ?? "Professor"}
          </h1>
          <p className="text-muted-foreground mt-1">Acompanhe os indicadores dos seus cursos</p>
        </div>
        <Button asChild className="gradient-primary text-primary-foreground">
          <Link to="/courses"><Plus className="w-4 h-4 mr-2" /> Novo Curso</Link>
        </Button>
      </div>

      <ProfessorStatsView stats={stats} />
    </div>
  );
}
