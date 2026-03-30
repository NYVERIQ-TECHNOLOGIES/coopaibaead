import { motion } from "framer-motion";
import { Users, BookOpen, Award, TrendingUp, UserCheck, AlertTriangle, GraduationCap, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import StatCard from "@/components/StatCard";

const enrollmentData = [
  { month: "Jan", alunos: 45, cooperados: 20 },
  { month: "Fev", alunos: 52, cooperados: 28 },
  { month: "Mar", alunos: 61, cooperados: 35 },
  { month: "Abr", alunos: 58, cooperados: 42 },
  { month: "Mai", alunos: 75, cooperados: 48 },
  { month: "Jun", alunos: 82, cooperados: 55 },
];

const completionData = [
  { month: "Jan", taxa: 72 },
  { month: "Fev", taxa: 68 },
  { month: "Mar", taxa: 78 },
  { month: "Abr", taxa: 82 },
  { month: "Mai", taxa: 85 },
  { month: "Jun", taxa: 88 },
];

const courseDistribution = [
  { name: "Cooperativismo", value: 35 },
  { name: "Gestão", value: 25 },
  { name: "Finanças", value: 20 },
  { name: "Liderança", value: 20 },
];

const COLORS = ["hsl(220, 70%, 45%)", "hsl(170, 50%, 40%)", "hsl(35, 90%, 55%)", "hsl(280, 60%, 50%)"];

const recentActivity = [
  { user: "Maria Silva", action: "Concluiu o módulo 3", course: "Cooperativismo Básico", time: "2 min" },
  { user: "João Santos", action: "Enviou atividade", course: "Gestão Cooperativa", time: "15 min" },
  { user: "Ana Costa", action: "Obteve certificado", course: "Finanças Solidárias", time: "1h" },
  { user: "Carlos Lima", action: "Iniciou novo curso", course: "Liderança Comunitária", time: "2h" },
  { user: "Paula Ferreira", action: "Completou avaliação", course: "Direito Cooperativo", time: "3h" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral da plataforma CoopEdu</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Alunos" value="1.248" change="+12% este mês" changeType="positive" icon={Users} gradient="primary" />
        <StatCard title="Cooperados" value="456" change="+18% este mês" changeType="positive" icon={UserCheck} gradient="secondary" />
        <StatCard title="Cursos Ativos" value="32" change="3 novos este mês" changeType="positive" icon={BookOpen} gradient="accent" />
        <StatCard title="Certificados" value="892" change="+25% este mês" changeType="positive" icon={Award} gradient="primary" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollment chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-5 shadow-card border border-border">
          <h3 className="font-heading font-semibold text-card-foreground mb-4">Matrículas por Mês</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={enrollmentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(220, 10%, 45%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(220, 10%, 45%)" }} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220, 15%, 90%)", fontSize: "13px" }} />
              <Bar dataKey="alunos" fill="hsl(220, 70%, 45%)" radius={[4, 4, 0, 0]} name="Alunos" />
              <Bar dataKey="cooperados" fill="hsl(170, 50%, 40%)" radius={[4, 4, 0, 0]} name="Cooperados" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Completion chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card rounded-xl p-5 shadow-card border border-border">
          <h3 className="font-heading font-semibold text-card-foreground mb-4">Taxa de Conclusão (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={completionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(220, 10%, 45%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(220, 10%, 45%)" }} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220, 15%, 90%)", fontSize: "13px" }} />
              <Line type="monotone" dataKey="taxa" stroke="hsl(220, 70%, 45%)" strokeWidth={3} dot={{ fill: "hsl(220, 70%, 45%)", r: 5 }} name="Taxa %" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-card rounded-xl p-5 shadow-card border border-border">
          <h3 className="font-heading font-semibold text-card-foreground mb-4">Cursos por Categoria</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={courseDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {courseDistribution.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220, 15%, 90%)", fontSize: "13px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {courseDistribution.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                {item.name} ({item.value}%)
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-card rounded-xl p-5 shadow-card border border-border lg:col-span-2">
          <h3 className="font-heading font-semibold text-card-foreground mb-4">Atividade Recente</h3>
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary-foreground">{item.user.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-card-foreground"><span className="font-medium">{item.user}</span> {item.action}</p>
                  <p className="text-xs text-muted-foreground">{item.course}</p>
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-3 h-3" /> {item.time}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Alerts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="bg-card rounded-xl p-5 shadow-card border border-border">
        <h3 className="font-heading font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" /> Alertas de Evasão
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Sem acesso há 7+ dias", count: 23, color: "text-warning" },
            { label: "Progresso estagnado", count: 15, color: "text-destructive" },
            { label: "Frequência abaixo de 50%", count: 8, color: "text-destructive" },
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
