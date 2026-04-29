import { motion } from "framer-motion";
import { Users, BookOpen, Award, TrendingUp, UserCheck, AlertTriangle, Clock, IdCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import StatCard from "@/components/StatCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["hsl(220, 70%, 45%)", "hsl(170, 50%, 40%)", "hsl(35, 90%, 55%)", "hsl(280, 60%, 50%)"];


export default function Dashboard() {
  const { user } = useAuth();

  const { data: enrollmentNumber } = useQuery({
    queryKey: ["admin-enrollment-number", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("enrollment_number")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.enrollment_number ?? null;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const [courses, profiles, alunos, cooperados, certificates, enrollments] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "aluno"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "cooperado"),
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("status", "emitido"),
        supabase.from("enrollments").select("id", { count: "exact", head: true }),
      ]);
      return {
        courses: courses.count ?? 0,
        students: profiles.count ?? 0,
        alunos: alunos.count ?? 0,
        cooperados: cooperados.count ?? 0,
        certificates: certificates.count ?? 0,
        enrollments: enrollments.count ?? 0,
      };
    },
  });

  const { data: recentProfiles } = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, created_at").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const courseDistribution = [
    { name: "Cursos", value: counts?.courses ?? 0 },
    { name: "Alunos", value: (counts?.students ?? 0) - (counts?.cooperados ?? 0) },
    { name: "Cooperados", value: counts?.cooperados ?? 0 },
    { name: "Certificados", value: counts?.certificates ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral da plataforma Coopaiba EAD</p>
        </div>
        {enrollmentNumber && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-card">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <IdCard className="w-4 h-4 text-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Matrícula</p>
              <p className="font-mono font-semibold text-sm text-foreground">{enrollmentNumber}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Alunos" value={String(counts?.students ?? 0)} icon={Users} gradient="primary" />
        <StatCard title="Cooperados" value={String(counts?.cooperados ?? 0)} icon={UserCheck} gradient="secondary" />
        <StatCard title="Cursos Ativos" value={String(counts?.courses ?? 0)} icon={BookOpen} gradient="accent" />
        <StatCard title="Certificados" value={String(counts?.certificates ?? 0)} icon={Award} gradient="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-5 shadow-card border border-border">
          <h3 className="font-heading font-semibold text-card-foreground mb-4">Distribuição</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={courseDistribution.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {courseDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220, 15%, 90%)", fontSize: "13px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {courseDistribution.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {item.name} ({item.value})
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card rounded-xl p-5 shadow-card border border-border lg:col-span-2">
          <h3 className="font-heading font-semibold text-card-foreground mb-4">Últimos Cadastros</h3>
          {recentProfiles && recentProfiles.length > 0 ? (
            <div className="space-y-3">
              {recentProfiles.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary-foreground">{p.full_name?.charAt(0) || "U"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground">{p.full_name || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">Cadastrado em {new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário cadastrado ainda</p>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-card rounded-xl p-5 shadow-card border border-border">
        <h3 className="font-heading font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" /> Resumo Rápido
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Matrículas Ativas", count: counts?.enrollments ?? 0, color: "text-primary" },
            { label: "Cursos Disponíveis", count: counts?.courses ?? 0, color: "text-success" },
            { label: "Certificados Emitidos", count: counts?.certificates ?? 0, color: "text-accent" },
          ].map((alert) => (
            <div key={alert.label} className="bg-muted/50 rounded-lg p-3">
              <p className={`text-xl font-heading font-bold ${alert.color}`}>{alert.count}</p>
              <p className="text-sm text-muted-foreground">{alert.label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
