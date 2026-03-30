import { motion } from "framer-motion";
import { useState } from "react";
import {
  ArrowLeft, Clock, Users, BookOpen, Star, Play, FileText, CheckCircle,
  Lock, Award, Plus, Trash2, Edit, GripVertical, Video, Headphones,
  Save, X, ChevronDown, ChevronUp, Library, BarChart3
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface Lesson {
  id: number;
  title: string;
  type: "video" | "pdf" | "audio" | "quiz";
  duration: string;
  completed: boolean;
}

interface Module {
  id: number;
  title: string;
  locked: boolean;
  lessons: Lesson[];
}

interface CourseEvaluation {
  id: number;
  title: string;
  type: "prova" | "exercicio" | "simulado";
  duration: number;
  questions: number;
  status: "rascunho" | "publicada" | "encerrada";
}

interface CourseBook {
  id: number;
  title: string;
  type: "pdf" | "video" | "audio" | "link";
  size: string;
  cooperadoOnly: boolean;
}

const typeIcons = { video: Play, pdf: FileText, audio: Headphones, quiz: Award, link: BookOpen };
const typeLabels = { video: "Vídeo", pdf: "PDF", audio: "Áudio", quiz: "Quiz", link: "Link" };
const evalTypeLabels = { prova: "Prova", exercicio: "Exercício", simulado: "Simulado" };
const evalStatusStyles = {
  rascunho: "bg-muted text-muted-foreground",
  publicada: "bg-success/10 text-success",
  encerrada: "bg-destructive/10 text-destructive",
};
const bookTypeIcons = { pdf: FileText, video: Video, audio: Headphones, link: BookOpen };

const initialModules: Module[] = [
  {
    id: 1, title: "Módulo 1: Introdução", locked: false,
    lessons: [
      { id: 1, title: "O que é Cooperativismo?", type: "video", duration: "15min", completed: true },
      { id: 2, title: "História do Movimento", type: "video", duration: "20min", completed: true },
      { id: 3, title: "Material de Apoio", type: "pdf", duration: "10min", completed: false },
    ],
  },
  {
    id: 2, title: "Módulo 2: Princípios Cooperativistas", locked: false,
    lessons: [
      { id: 4, title: "Os 7 Princípios", type: "video", duration: "25min", completed: false },
      { id: 5, title: "Estudo de Caso", type: "pdf", duration: "15min", completed: false },
      { id: 6, title: "Atividade Avaliativa", type: "quiz", duration: "30min", completed: false },
    ],
  },
  {
    id: 3, title: "Módulo 3: Gestão Democrática", locked: true,
    lessons: [
      { id: 7, title: "Assembleias e Votações", type: "video", duration: "20min", completed: false },
      { id: 8, title: "Exercício Prático", type: "pdf", duration: "20min", completed: false },
    ],
  },
];

const initialEvaluations: CourseEvaluation[] = [
  { id: 1, title: "Prova Final - Cooperativismo", type: "prova", duration: 60, questions: 15, status: "publicada" },
  { id: 2, title: "Exercício - Princípios", type: "exercicio", duration: 30, questions: 8, status: "rascunho" },
];

const initialBooks: CourseBook[] = [
  { id: 1, title: "Apostila Complementar - Princípios", type: "pdf", size: "3.4 MB", cooperadoOnly: false },
  { id: 2, title: "Vídeo: Entrevista com Cooperativistas", type: "video", size: "250 MB", cooperadoOnly: false },
  { id: 3, title: "Artigo Exclusivo: Gestão Avançada", type: "pdf", size: "1.2 MB", cooperadoOnly: true },
];

export default function CourseDetail() {
  const { id } = useParams();

  const [modules, setModules] = useState<Module[]>(initialModules);
  const [evaluations, setEvaluations] = useState<CourseEvaluation[]>(initialEvaluations);
  const [books, setBooks] = useState<CourseBook[]>(initialBooks);

  // Collapse state
  const [expandedSections, setExpandedSections] = useState({ modules: true, evaluations: true, books: true });

  // Module dialog
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleLocked, setModuleLocked] = useState(false);

  // Lesson dialog
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [lessonModuleId, setLessonModuleId] = useState<number | null>(null);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState<Lesson["type"]>("video");
  const [lessonDuration, setLessonDuration] = useState("");

  // Evaluation dialog
  const [evalDialogOpen, setEvalDialogOpen] = useState(false);
  const [editEval, setEditEval] = useState<CourseEvaluation | null>(null);
  const [evalTitle, setEvalTitle] = useState("");
  const [evalType, setEvalType] = useState<CourseEvaluation["type"]>("prova");
  const [evalDuration, setEvalDuration] = useState(60);
  const [evalQuestions, setEvalQuestions] = useState(10);

  // Book dialog
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [editBook, setEditBook] = useState<CourseBook | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookType, setBookType] = useState<CourseBook["type"]>("pdf");
  const [bookSize, setBookSize] = useState("");
  const [bookCooperado, setBookCooperado] = useState(false);

  const toggleSection = (key: keyof typeof expandedSections) =>
    setExpandedSections((p) => ({ ...p, [key]: !p[key] }));

  // ---- Module CRUD ----
  function openNewModule() {
    setEditModule(null); setModuleTitle(""); setModuleLocked(false); setModuleDialogOpen(true);
  }
  function openEditModule(mod: Module) {
    setEditModule(mod); setModuleTitle(mod.title); setModuleLocked(mod.locked); setModuleDialogOpen(true);
  }
  function saveModule() {
    if (!moduleTitle.trim()) return;
    if (editModule) {
      setModules((p) => p.map((m) => m.id === editModule.id ? { ...m, title: moduleTitle, locked: moduleLocked } : m));
    } else {
      setModules((p) => [...p, { id: Date.now(), title: moduleTitle, locked: moduleLocked, lessons: [] }]);
    }
    setModuleDialogOpen(false);
  }
  function deleteModule(id: number) {
    setModules((p) => p.filter((m) => m.id !== id));
  }

  // ---- Lesson CRUD ----
  function openNewLesson(moduleId: number) {
    setEditLesson(null); setLessonModuleId(moduleId);
    setLessonTitle(""); setLessonType("video"); setLessonDuration("");
    setLessonDialogOpen(true);
  }
  function openEditLesson(moduleId: number, lesson: Lesson) {
    setEditLesson(lesson); setLessonModuleId(moduleId);
    setLessonTitle(lesson.title); setLessonType(lesson.type); setLessonDuration(lesson.duration);
    setLessonDialogOpen(true);
  }
  function saveLesson() {
    if (!lessonTitle.trim() || !lessonModuleId) return;
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id !== lessonModuleId) return mod;
        if (editLesson) {
          return { ...mod, lessons: mod.lessons.map((l) => l.id === editLesson.id ? { ...l, title: lessonTitle, type: lessonType, duration: lessonDuration } : l) };
        }
        return { ...mod, lessons: [...mod.lessons, { id: Date.now(), title: lessonTitle, type: lessonType, duration: lessonDuration || "10min", completed: false }] };
      })
    );
    setLessonDialogOpen(false);
  }
  function deleteLesson(moduleId: number, lessonId: number) {
    setModules((p) => p.map((m) => m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m));
  }

  // ---- Evaluation CRUD ----
  function openNewEval() {
    setEditEval(null); setEvalTitle(""); setEvalType("prova"); setEvalDuration(60); setEvalQuestions(10);
    setEvalDialogOpen(true);
  }
  function openEditEval(ev: CourseEvaluation) {
    setEditEval(ev); setEvalTitle(ev.title); setEvalType(ev.type); setEvalDuration(ev.duration); setEvalQuestions(ev.questions);
    setEvalDialogOpen(true);
  }
  function saveEval() {
    if (!evalTitle.trim()) return;
    if (editEval) {
      setEvaluations((p) => p.map((e) => e.id === editEval.id ? { ...e, title: evalTitle, type: evalType, duration: evalDuration, questions: evalQuestions } : e));
    } else {
      setEvaluations((p) => [...p, { id: Date.now(), title: evalTitle, type: evalType, duration: evalDuration, questions: evalQuestions, status: "rascunho" }]);
    }
    setEvalDialogOpen(false);
  }
  function deleteEval(id: number) {
    setEvaluations((p) => p.filter((e) => e.id !== id));
  }
  function toggleEvalStatus(ev: CourseEvaluation) {
    const next = ev.status === "rascunho" ? "publicada" : ev.status === "publicada" ? "encerrada" : "rascunho";
    setEvaluations((p) => p.map((e) => e.id === ev.id ? { ...e, status: next } : e));
  }

  // ---- Book CRUD ----
  function openNewBook() {
    setEditBook(null); setBookTitle(""); setBookType("pdf"); setBookSize(""); setBookCooperado(false);
    setBookDialogOpen(true);
  }
  function openEditBook(b: CourseBook) {
    setEditBook(b); setBookTitle(b.title); setBookType(b.type); setBookSize(b.size); setBookCooperado(b.cooperadoOnly);
    setBookDialogOpen(true);
  }
  function saveBook() {
    if (!bookTitle.trim()) return;
    if (editBook) {
      setBooks((p) => p.map((b) => b.id === editBook.id ? { ...b, title: bookTitle, type: bookType, size: bookSize, cooperadoOnly: bookCooperado } : b));
    } else {
      setBooks((p) => [...p, { id: Date.now(), title: bookTitle, type: bookType, size: bookSize || "-", cooperadoOnly: bookCooperado }]);
    }
    setBookDialogOpen(false);
  }
  function deleteBook(id: number) {
    setBooks((p) => p.filter((b) => b.id !== id));
  }

  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const completedLessons = modules.reduce((s, m) => s + m.lessons.filter((l) => l.completed).length, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

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
            <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {modules.length} módulos</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {totalLessons} aulas</span>
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
          <span className="text-sm font-bold text-primary">{progressPct}%</span>
        </div>
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full gradient-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{completedLessons} de {totalLessons} aulas concluídas</p>
      </motion.div>

      {/* ========== MODULES & LESSONS ========== */}
      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <button onClick={() => toggleSection("modules")}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
          <h2 className="font-heading font-bold text-card-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Módulos & Aulas ({totalLessons})
          </h2>
          {expandedSections.modules ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {expandedSections.modules && (
          <div className="border-t border-border">
            <div className="p-3 border-b border-border bg-muted/10">
              <Button size="sm" onClick={openNewModule} className="gradient-primary text-primary-foreground gap-1">
                <Plus className="w-3 h-3" /> Novo Módulo
              </Button>
            </div>

            <div className="divide-y divide-border">
              {modules.map((mod) => (
                <div key={mod.id}>
                  <div className="flex items-center justify-between p-4 bg-muted/5">
                    <h3 className="font-heading font-semibold text-card-foreground flex items-center gap-2 text-sm">
                      {mod.locked && <Lock className="w-4 h-4 text-muted-foreground" />}
                      {mod.title}
                      <Badge variant="outline" className="text-[10px]">{mod.lessons.length} aulas</Badge>
                    </h3>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openNewLesson(mod.id)}>
                        <Plus className="w-3.5 h-3.5 text-primary" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditModule(mod)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteModule(mod.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="divide-y divide-border/50">
                    {mod.lessons.map((lesson) => {
                      const Icon = typeIcons[lesson.type];
                      return (
                        <div key={lesson.id} className="flex items-center gap-3 px-4 py-2.5 pl-8 hover:bg-muted/10 transition-colors group">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${lesson.completed ? "bg-success/10" : "bg-muted"}`}>
                            {lesson.completed ? <CheckCircle className="w-3.5 h-3.5 text-success" /> : <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${lesson.completed ? "text-muted-foreground line-through" : "text-card-foreground"}`}>{lesson.title}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{typeLabels[lesson.type]}</Badge>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{lesson.duration}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEditLesson(mod.id, lesson)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteLesson(mod.id, lesson.id)}>
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {mod.lessons.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">Nenhuma aula — clique em + para adicionar</p>
                    )}
                  </div>
                </div>
              ))}
              {modules.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum módulo criado</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========== EVALUATIONS ========== */}
      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <button onClick={() => toggleSection("evaluations")}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
          <h2 className="font-heading font-bold text-card-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" /> Avaliações ({evaluations.length})
          </h2>
          {expandedSections.evaluations ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {expandedSections.evaluations && (
          <div className="border-t border-border">
            <div className="p-3 border-b border-border bg-muted/10">
              <Button size="sm" onClick={openNewEval} className="gradient-primary text-primary-foreground gap-1">
                <Plus className="w-3 h-3" /> Nova Avaliação
              </Button>
            </div>
            <div className="divide-y divide-border">
              {evaluations.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors group">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <BarChart3 className="w-4 h-4 text-accent flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{ev.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px]">{evalTypeLabels[ev.type]}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${evalStatusStyles[ev.status]}`}>
                          {ev.status === "rascunho" ? "Rascunho" : ev.status === "publicada" ? "Publicada" : "Encerrada"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{ev.duration}min • {ev.questions} questões</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleEvalStatus(ev)}>
                      {ev.status === "publicada" ? <Lock className="w-3.5 h-3.5 text-warning" /> : <CheckCircle className="w-3.5 h-3.5 text-success" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditEval(ev)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteEval(ev.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {evaluations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma avaliação vinculada</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========== BOOKS / LIBRARY ========== */}
      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <button onClick={() => toggleSection("books")}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
          <h2 className="font-heading font-bold text-card-foreground flex items-center gap-2">
            <Library className="w-5 h-5 text-secondary" /> Livros & Materiais ({books.length})
          </h2>
          {expandedSections.books ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {expandedSections.books && (
          <div className="border-t border-border">
            <div className="p-3 border-b border-border bg-muted/10">
              <Button size="sm" onClick={openNewBook} className="gradient-primary text-primary-foreground gap-1">
                <Plus className="w-3 h-3" /> Novo Material
              </Button>
            </div>
            <div className="divide-y divide-border">
              {books.map((b) => {
                const Icon = bookTypeIcons[b.type] || FileText;
                return (
                  <div key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors group">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{b.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{typeLabels[b.type] || b.type}</Badge>
                          <span className="text-[10px] text-muted-foreground">{b.size}</span>
                          {b.cooperadoOnly && <Badge variant="secondary" className="text-[10px]">Cooperado</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditBook(b)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteBook(b.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {books.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum material vinculado</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== DIALOGS ===== */}

      {/* Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editModule ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
            <DialogDescription>Configure o título e acesso do módulo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título do Módulo</Label>
              <Input value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} placeholder="Ex: Módulo 4: Finanças" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={moduleLocked} onCheckedChange={setModuleLocked} />
              <Label>Bloqueado (liberação progressiva)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveModule} className="gradient-primary text-primary-foreground">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editLesson ? "Editar Aula" : "Nova Aula"}</DialogTitle>
            <DialogDescription>Configure o conteúdo da aula</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título da Aula</Label>
              <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="Nome da aula" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={lessonType} onValueChange={(v) => setLessonType(v as Lesson["type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duração</Label>
                <Input value={lessonDuration} onChange={(e) => setLessonDuration(e.target.value)} placeholder="Ex: 15min" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveLesson} className="gradient-primary text-primary-foreground">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evaluation Dialog */}
      <Dialog open={evalDialogOpen} onOpenChange={setEvalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editEval ? "Editar Avaliação" : "Nova Avaliação"}</DialogTitle>
            <DialogDescription>Vincule uma avaliação a este curso</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={evalTitle} onChange={(e) => setEvalTitle(e.target.value)} placeholder="Nome da avaliação" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={evalType} onValueChange={(v) => setEvalType(v as CourseEvaluation["type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prova">Prova</SelectItem>
                    <SelectItem value="exercicio">Exercício</SelectItem>
                    <SelectItem value="simulado">Simulado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input type="number" value={evalDuration} onChange={(e) => setEvalDuration(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Questões</Label>
                <Input type="number" value={evalQuestions} onChange={(e) => setEvalQuestions(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvalDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveEval} className="gradient-primary text-primary-foreground">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Book Dialog */}
      <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editBook ? "Editar Material" : "Novo Material"}</DialogTitle>
            <DialogDescription>Adicione livros e recursos ao curso</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder="Nome do material" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={bookType} onValueChange={(v) => setBookType(v as CourseBook["type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tamanho</Label>
                <Input value={bookSize} onChange={(e) => setBookSize(e.target.value)} placeholder="Ex: 2.4 MB" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={bookCooperado} onCheckedChange={setBookCooperado} />
              <Label>Exclusivo para cooperados</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveBook} className="gradient-primary text-primary-foreground">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
