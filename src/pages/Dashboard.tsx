import { motion } from "framer-motion";
import { Users, BookOpen, Award, TrendingUp, UserCheck, AlertTriangle, Clock, IdCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import StatCard from "@/components/StatCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardWelcomeVideo from "@/components/DashboardWelcomeVideo";

const COLORS = ["hsl(var(--primary))", "hsl(var(--primary-glow))", "hsl(var(--warning))", "hsl(var(--info))"];


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
      const [courses, profiles, cooperados, certificates, enrollments] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "cooperado"),
        supabase.from("certificates").select("id", { count: "exact", head: true }).in("status", ["emitido", "disponivel_retirada", "retirado"]),
        supabase.from("enrollments").select("id", { count: "exact", head: true }),
      ]);
      return {
        courses: courses.count ?? 0,
        students: profiles.count ?? 0,
        cooperados: cooperados.count ?? 0,
        certificates: certificates.count ?? 0,
        enrollments: enrollments.count ?? 0,
      };
    },
  });

  const { data: recentProfiles } = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, avatar_url, created_at").order("created_at", { ascending: false }).limit(5);
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
    <div className="space-y-8">
      <DashboardWelcomeVideo />
      <section className="relative overflow-hidden rounded-[1.5rem] gradient-hero px-6 py-8 sm:px-10 sm:py-10 shadow-elevated">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-foreground/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-24 h-56 w-56 rounded-full bg-brand-foreground/5 blur-2xl" />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-foreground/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-foreground/90 backdrop-blur">
              Coopaiba EAD
            </span>
            <h1 className="mt-4 text-3xl lg:text-4xl font-heading font-extrabold tracking-tight text-brand-foreground">Dashboard</h1>
            <p className="text-brand-foreground/75 mt-2 text-[15px] leading-relaxed">
              Visão geral do ecossistema de aprendizagem — cursos, cooperados e certificados em um só lugar.
            </p>
          </div>
          {enrollmentNumber && (
            <div className="inline-flex items-center gap-3 rounded-2xl border border-brand-foreground/20 bg-brand-foreground/10 px-4 py-3 backdrop-blur">
              <div className="w-10 h-10 rounded-xl bg-brand-foreground/15 flex items-center justify-center">
                <IdCard className="w-4 h-4 text-brand-foreground" />
              </div>
              <div className="leading-tight">
                <p className="text-[11px] uppercase tracking-wide text-brand-foreground/70 font-medium">Matrícula</p>
                <p className="font-mono font-semibold text-sm text-brand-foreground">{enrollmentNumber}</p>
              </div>
            </div>
          )}
        </div>
      </section>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total de Alunos" value={String(counts?.students ?? 0)} icon={Users} gradient="primary" />
        <StatCard title="Cooperados" value={String(counts?.cooperados ?? 0)} icon={UserCheck} gradient="secondary" />
        <StatCard title="Cursos Ativos" value={String(counts?.courses ?? 0)} icon={BookOpen} gradient="accent" />
        <StatCard title="Certificados" value={String(counts?.certificates ?? 0)} icon={Award} gradient="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl p-6 shadow-card border border-border/70">
          <h3 className="font-heading font-bold text-card-foreground mb-5">Distribuição</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={courseDistribution.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {courseDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--card-foreground))", fontSize: "13px" }} />
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
          className="bg-card rounded-2xl p-6 shadow-card border border-border/70 lg:col-span-2">
          <h3 className="font-heading font-bold text-card-foreground mb-5">Últimos Cadastros</h3>
          {recentProfiles && recentProfiles.length > 0 ? (
            <div className="space-y-3">
              {recentProfiles.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  {(p as any).avatar_url ? (
                    <img
                      src={(p as any).avatar_url}
                      alt={p.full_name || "Avatar"}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-border"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary-foreground">{p.full_name?.charAt(0) || "U"}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-card-foreground">{p.full_name || "Usuário"}</p>
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
        className="bg-card rounded-2xl p-6 shadow-card border border-border/70">
        <h3 className="font-heading font-bold text-card-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" /> Resumo Rápido
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Matrículas Ativas", count: counts?.enrollments ?? 0, color: "text-primary" },
            { label: "Cursos Disponíveis", count: counts?.courses ?? 0, color: "text-success" },
            { label: "Certificados Emitidos", count: counts?.certificates ?? 0, color: "text-accent" },
          ].map((alert) => (
            <div key={alert.label} className="rounded-2xl border border-border/60 bg-secondary/60 p-4">
              <p className={`text-xl font-heading font-bold ${alert.color}`}>{alert.count}</p>
              <p className="text-sm text-muted-foreground">{alert.label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
