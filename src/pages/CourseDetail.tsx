import { motion } from "framer-motion";
import { ArrowLeft, Clock, Users, BookOpen, Star, Play, FileText, CheckCircle, Lock, Award } from "lucide-react";
import { Link, useParams } from "react-router-dom";

const modules = [
  {
    title: "Módulo 1: Introdução",
    lessons: [
      { title: "O que é Cooperativismo?", type: "video", duration: "15min", completed: true },
      { title: "História do Movimento", type: "video", duration: "20min", completed: true },
      { title: "Material de Apoio", type: "pdf", duration: "10min", completed: false },
    ],
  },
  {
    title: "Módulo 2: Princípios Cooperativistas",
    lessons: [
      { title: "Os 7 Princípios", type: "video", duration: "25min", completed: false },
      { title: "Estudo de Caso", type: "pdf", duration: "15min", completed: false },
      { title: "Atividade Avaliativa", type: "quiz", duration: "30min", completed: false },
    ],
  },
  {
    title: "Módulo 3: Gestão Democrática",
    locked: true,
    lessons: [
      { title: "Assembleias e Votações", type: "video", duration: "20min", completed: false },
      { title: "Exercício Prático", type: "pdf", duration: "20min", completed: false },
    ],
  },
];

const typeIcons = { video: Play, pdf: FileText, quiz: Award };

export default function CourseDetail() {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <Link to="/courses" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar aos cursos
      </Link>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden h-48 lg:h-64">
        <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=400&fit=crop" alt="Curso"
          className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6">
          <span className="gradient-secondary text-secondary-foreground text-xs font-bold px-3 py-1 rounded-full mb-3 inline-block">Cooperativismo</span>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-primary-foreground">Cooperativismo Básico</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-primary-foreground/80">
            <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> 8 módulos</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> 12 horas</span>
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> 245 alunos</span>
            <span className="flex items-center gap-1"><Star className="w-4 h-4 fill-accent text-accent" /> 4.8</span>
          </div>
        </div>
      </motion.div>

      {/* Progress */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-card rounded-xl p-5 shadow-card border border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-card-foreground">Seu Progresso</span>
          <span className="text-sm font-bold text-primary">33%</span>
        </div>
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full gradient-primary rounded-full transition-all" style={{ width: "33%" }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">2 de 8 aulas concluídas • Tempo estimado restante: 8h</p>
      </motion.div>

      {/* Modules */}
      <div className="space-y-4">
        {modules.map((mod, mi) => (
          <motion.div key={mi} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + mi * 0.05 }}
            className={`bg-card rounded-xl shadow-card border border-border overflow-hidden ${mod.locked ? "opacity-60" : ""}`}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-heading font-semibold text-card-foreground flex items-center gap-2">
                {mod.locked && <Lock className="w-4 h-4 text-muted-foreground" />}
                {mod.title}
              </h3>
              <span className="text-xs text-muted-foreground">{mod.lessons.length} aulas</span>
            </div>
            <div className="divide-y divide-border">
              {mod.lessons.map((lesson, li) => {
                const Icon = typeIcons[lesson.type as keyof typeof typeIcons];
                return (
                  <div key={li} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${lesson.completed ? "bg-success/10" : "bg-muted"}`}>
                      {lesson.completed ? <CheckCircle className="w-4 h-4 text-success" /> : <Icon className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${lesson.completed ? "text-muted-foreground line-through" : "text-card-foreground"}`}>{lesson.title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{lesson.duration}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
