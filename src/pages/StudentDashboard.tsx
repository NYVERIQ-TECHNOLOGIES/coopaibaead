import { motion } from "framer-motion";
import { BookOpen, Clock, Award, TrendingUp, Play } from "lucide-react";
import CourseCard from "@/components/CourseCard";
import StatCard from "@/components/StatCard";

const myCourses = [
  { id: "1", title: "Cooperativismo Básico", description: "Fundamentos do cooperativismo", image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop", modules: 8, students: 245, duration: "12h", rating: 4.8, progress: 78 },
  { id: "2", title: "Gestão Cooperativa", description: "Técnicas de gestão cooperativista", image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop", modules: 12, students: 189, duration: "20h", rating: 4.7, progress: 45 },
  { id: "4", title: "Liderança Comunitária", description: "Habilidades de liderança", image: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=400&h=300&fit=crop", modules: 10, students: 178, duration: "15h", rating: 4.6, progress: 12 },
];

export default function StudentDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Olá, Maria! 👋</h1>
        <p className="text-muted-foreground mt-1">Continue de onde parou</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Cursos Ativos" value="3" icon={BookOpen} gradient="primary" />
        <StatCard title="Horas de Estudo" value="24h" icon={Clock} gradient="secondary" />
        <StatCard title="Certificados" value="2" icon={Award} gradient="accent" />
        <StatCard title="Média Geral" value="8.5" icon={TrendingUp} gradient="primary" />
      </div>

      {/* Continue studying */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-5 shadow-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-card-foreground">Continuar Estudando</h2>
        </div>
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
          <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
            <Play className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-card-foreground">Os 7 Princípios Cooperativistas</p>
            <p className="text-sm text-muted-foreground">Cooperativismo Básico • Módulo 2, Aula 1</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full gradient-primary rounded-full" style={{ width: "65%" }} />
              </div>
              <span className="text-xs text-muted-foreground">65%</span>
            </div>
          </div>
          <button className="gradient-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0">
            Continuar
          </button>
        </div>
      </motion.div>

      {/* My courses */}
      <div>
        <h2 className="font-heading font-semibold text-foreground mb-4">Meus Cursos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {myCourses.map((course) => (
            <CourseCard key={course.id} {...course} />
          ))}
        </div>
      </div>
    </div>
  );
}
