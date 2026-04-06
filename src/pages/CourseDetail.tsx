import { motion } from "framer-motion";
import { useState } from "react";
import {
  ArrowLeft, Clock, Users, BookOpen, Star, Play, FileText, CheckCircle,
  Lock, Award, Plus, Trash2, Edit, Video, Headphones,
  ChevronDown, ChevronUp, Library, BarChart3, Loader2, Eye, ExternalLink, Download
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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

const typeIcons: Record<string, any> = { video: Play, pdf: FileText, audio: Headphones, quiz: Award, link: BookOpen };
const typeLabels: Record<string, string> = { video: "Vídeo", pdf: "PDF", audio: "Áudio", quiz: "Quiz", link: "Link" };
const evalTypeLabels: Record<string, string> = { prova: "Prova", exercicio: "Exercício", simulado: "Simulado" };
const evalStatusStyles: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  publicada: "bg-success/10 text-success",
  encerrada: "bg-destructive/10 text-destructive",
};
const bookTypeIcons: Record<string, any> = { pdf: FileText, video: Video, audio: Headphones, link: BookOpen };

export default function CourseDetail() {
  const { id: courseId } = useParams<{ id: string }>();
  const { role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = role === "admin";

  const [expandedSections, setExpandedSections] = useState({ modules: true, evaluations: true, books: true });
  const toggleSection = (key: keyof typeof expandedSections) =>
    setExpandedSections((p) => ({ ...p, [key]: !p[key] }));

  // ---- Fetch course ----
  const { data: course, isLoading: loadingCourse } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // ---- Fetch modules with lessons ----
  const { data: modules = [], isLoading: loadingModules } = useQuery({
    queryKey: ["course_modules", courseId],
    queryFn: async () => {
      const { data: mods, error } = await supabase
        .from("course_modules")
        .select("*")
        .eq("course_id", courseId!)
        .order("sort_order");
      if (error) throw error;
      const { data: lessons, error: le } = await supabase
        .from("course_lessons")
        .select("*")
        .in("module_id", mods.map((m: any) => m.id))
        .order("sort_order");
      if (le) throw le;
      return mods.map((m: any) => ({
        ...m,
        lessons: (lessons || []).filter((l: any) => l.module_id === m.id),
      }));
    },
    enabled: !!courseId,
  });

  // ---- Fetch evaluations ----
  const { data: evaluations = [] } = useQuery({
    queryKey: ["course_evaluations", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("course_evaluations").select("*").eq("course_id", courseId!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // ---- Fetch books ----
  const { data: books = [] } = useQuery({
    queryKey: ["course_books", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("course_books").select("*").eq("course_id", courseId!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // ---- Dialog state ----
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editModuleId, setEditModuleId] = useState<string | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleLocked, setModuleLocked] = useState(false);

  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [lessonModuleId, setLessonModuleId] = useState<string | null>(null);
  const [editLessonId, setEditLessonId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState("video");
  const [lessonDuration, setLessonDuration] = useState("");
  const [lessonContentUrl, setLessonContentUrl] = useState("");

  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [contentUrl, setContentUrl] = useState("");
  const [contentType, setContentType] = useState("");

  const [evalDialogOpen, setEvalDialogOpen] = useState(false);
  const [editEvalId, setEditEvalId] = useState<string | null>(null);
  const [evalTitle, setEvalTitle] = useState("");
  const [evalType, setEvalType] = useState("prova");
  const [evalDuration, setEvalDuration] = useState(60);
  const [evalQuestions, setEvalQuestions] = useState(10);

  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [editBookId, setEditBookId] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookType, setBookType] = useState("pdf");
  const [bookSize, setBookSize] = useState("");
  const [bookCooperado, setBookCooperado] = useState(false);
  const [bookFileUrl, setBookFileUrl] = useState("");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["course_modules", courseId] });
    qc.invalidateQueries({ queryKey: ["course_evaluations", courseId] });
    qc.invalidateQueries({ queryKey: ["course_books", courseId] });
  };

  // ---- Module mutations ----
  const saveModuleMut = useMutation({
    mutationFn: async () => {
      if (editModuleId) {
        const { error } = await supabase.from("course_modules").update({ title: moduleTitle, locked: moduleLocked }).eq("id", editModuleId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_modules").insert({ course_id: courseId!, title: moduleTitle, locked: moduleLocked, sort_order: modules.length });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateAll(); setModuleDialogOpen(false); toast({ title: "Módulo salvo" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteModuleMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Módulo removido" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ---- Lesson mutations ----
  const saveLessonMut = useMutation({
    mutationFn: async () => {
      if (editLessonId) {
        const { error } = await supabase.from("course_lessons").update({ title: lessonTitle, type: lessonType, duration: lessonDuration, content_url: lessonContentUrl || null }).eq("id", editLessonId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_lessons").insert({ module_id: lessonModuleId!, title: lessonTitle, type: lessonType, duration: lessonDuration || "10min", content_url: lessonContentUrl || null });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateAll(); setLessonDialogOpen(false); toast({ title: "Aula salva" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteLessonMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Aula removida" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ---- Evaluation mutations ----
  const saveEvalMut = useMutation({
    mutationFn: async () => {
      if (editEvalId) {
        const { error } = await supabase.from("course_evaluations").update({ title: evalTitle, type: evalType, duration: evalDuration, questions: evalQuestions }).eq("id", editEvalId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_evaluations").insert({ course_id: courseId!, title: evalTitle, type: evalType, duration: evalDuration, questions: evalQuestions });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateAll(); setEvalDialogOpen(false); toast({ title: "Avaliação salva" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteEvalMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_evaluations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Avaliação removida" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleEvalStatusMut = useMutation({
    mutationFn: async (ev: any) => {
      const next = ev.status === "rascunho" ? "publicada" : ev.status === "publicada" ? "encerrada" : "rascunho";
      const { error } = await supabase.from("course_evaluations").update({ status: next }).eq("id", ev.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  // ---- Book mutations ----
  const saveBookMut = useMutation({
    mutationFn: async () => {
      if (editBookId) {
        const { error } = await supabase.from("course_books").update({ title: bookTitle, type: bookType, size: bookSize, cooperado_only: bookCooperado, file_url: bookFileUrl || null }).eq("id", editBookId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_books").insert({ course_id: courseId!, title: bookTitle, type: bookType, size: bookSize || "-", cooperado_only: bookCooperado, file_url: bookFileUrl || null });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateAll(); setBookDialogOpen(false); toast({ title: "Material salvo" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteBookMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_books").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Material removido" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ---- Helpers ----
  const openNewModule = () => { setEditModuleId(null); setModuleTitle(""); setModuleLocked(false); setModuleDialogOpen(true); };
  const openEditModule = (m: any) => { setEditModuleId(m.id); setModuleTitle(m.title); setModuleLocked(m.locked); setModuleDialogOpen(true); };
  const openNewLesson = (moduleId: string) => { setEditLessonId(null); setLessonModuleId(moduleId); setLessonTitle(""); setLessonType("video"); setLessonDuration(""); setLessonContentUrl(""); setLessonDialogOpen(true); };
  const openEditLesson = (moduleId: string, l: any) => { setEditLessonId(l.id); setLessonModuleId(moduleId); setLessonTitle(l.title); setLessonType(l.type); setLessonDuration(l.duration || ""); setLessonContentUrl(l.content_url || ""); setLessonDialogOpen(true); };
  const openNewEval = () => { setEditEvalId(null); setEvalTitle(""); setEvalType("prova"); setEvalDuration(60); setEvalQuestions(10); setEvalDialogOpen(true); };
  const openEditEval = (ev: any) => { setEditEvalId(ev.id); setEvalTitle(ev.title); setEvalType(ev.type); setEvalDuration(ev.duration); setEvalQuestions(ev.questions); setEvalDialogOpen(true); };
  const openNewBook = () => { setEditBookId(null); setBookTitle(""); setBookType("pdf"); setBookSize(""); setBookCooperado(false); setBookFileUrl(""); setBookDialogOpen(true); };
  const openEditBook = (b: any) => { setEditBookId(b.id); setBookTitle(b.title); setBookType(b.type); setBookSize(b.size || ""); setBookCooperado(b.cooperado_only); setBookFileUrl(b.file_url || ""); setBookDialogOpen(true); };

  const openContent = (url: string, type: string) => { setContentUrl(url); setContentType(type); setContentDialogOpen(true); };

  const totalLessons = modules.reduce((s: number, m: any) => s + (m.lessons?.length || 0), 0);
  const completedLessons = modules.reduce((s: number, m: any) => s + (m.lessons?.filter((l: any) => l.completed).length || 0), 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  if (loadingCourse || loadingModules) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-muted-foreground">Curso não encontrado</p>
        <Link to="/courses" className="text-primary underline mt-2 inline-block">Voltar aos cursos</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/courses" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar aos cursos
      </Link>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden h-48 lg:h-64">
        {course.image ? (
          <img src={course.image} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">Sem imagem</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6">
          {course.cooperado_only && (
            <span className="gradient-secondary text-secondary-foreground text-xs font-bold px-3 py-1 rounded-full mb-3 inline-block">Cooperado</span>
          )}
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-primary-foreground">{course.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-primary-foreground/80">
            <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {modules.length} módulos</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {totalLessons} aulas</span>
            {course.duration && <span className="flex items-center gap-1">⏱ {course.duration}</span>}
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
            {isAdmin && (
              <div className="p-3 border-b border-border bg-muted/10">
                <Button size="sm" onClick={openNewModule} className="gradient-primary text-primary-foreground gap-1">
                  <Plus className="w-3 h-3" /> Novo Módulo
                </Button>
              </div>
            )}
            <div className="divide-y divide-border">
              {modules.map((mod: any) => (
                <div key={mod.id}>
                  <div className="flex items-center justify-between p-4 bg-muted/5">
                    <h3 className="font-heading font-semibold text-card-foreground flex items-center gap-2 text-sm">
                      {mod.locked && <Lock className="w-4 h-4 text-muted-foreground" />}
                      {mod.title}
                      <Badge variant="outline" className="text-[10px]">{mod.lessons?.length || 0} aulas</Badge>
                    </h3>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openNewLesson(mod.id)}><Plus className="w-3.5 h-3.5 text-primary" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditModule(mod)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteModuleMut.mutate(mod.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    )}
                  </div>
                  <div className="divide-y divide-border/50">
                    {(mod.lessons || []).map((lesson: any) => {
                      const Icon = typeIcons[lesson.type] || FileText;
                      return (
                        <div key={lesson.id}
                          className={`flex items-center gap-3 px-4 py-2.5 pl-8 hover:bg-muted/10 transition-colors group ${lesson.content_url ? "cursor-pointer" : ""}`}
                          onClick={() => lesson.content_url && openContent(lesson.content_url, lesson.type)}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${lesson.completed ? "bg-success/10" : "bg-muted"}`}>
                            {lesson.completed ? <CheckCircle className="w-3.5 h-3.5 text-success" /> : <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${lesson.completed ? "text-muted-foreground line-through" : "text-card-foreground"}`}>{lesson.title}</p>
                          </div>
                          {lesson.content_url && (
                            <Eye className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          )}
                          <Badge variant="outline" className="text-[10px]">{typeLabels[lesson.type] || lesson.type}</Badge>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{lesson.duration}</span>
                          {isAdmin && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEditLesson(mod.id, lesson)}><Edit className="w-3 h-3" /></Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteLessonMut.mutate(lesson.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(!mod.lessons || mod.lessons.length === 0) && (
                      <p className="text-xs text-muted-foreground text-center py-3">Nenhuma aula{isAdmin ? " — clique em + para adicionar" : ""}</p>
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
            {isAdmin && (
              <div className="p-3 border-b border-border bg-muted/10">
                <Button size="sm" onClick={openNewEval} className="gradient-primary text-primary-foreground gap-1">
                  <Plus className="w-3 h-3" /> Nova Avaliação
                </Button>
              </div>
            )}
            <div className="divide-y divide-border">
              {evaluations.map((ev: any) => (
                <div key={ev.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors group">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <BarChart3 className="w-4 h-4 text-accent flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{ev.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px]">{evalTypeLabels[ev.type] || ev.type}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${evalStatusStyles[ev.status] || ""}`}>
                          {ev.status === "rascunho" ? "Rascunho" : ev.status === "publicada" ? "Publicada" : "Encerrada"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{ev.duration}min • {ev.questions} questões</span>
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleEvalStatusMut.mutate(ev)}>
                        {ev.status === "publicada" ? <Lock className="w-3.5 h-3.5 text-warning" /> : <CheckCircle className="w-3.5 h-3.5 text-success" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditEval(ev)}><Edit className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteEvalMut.mutate(ev.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  )}
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
            {isAdmin && (
              <div className="p-3 border-b border-border bg-muted/10">
                <Button size="sm" onClick={openNewBook} className="gradient-primary text-primary-foreground gap-1">
                  <Plus className="w-3 h-3" /> Novo Material
                </Button>
              </div>
            )}
            <div className="divide-y divide-border">
              {books.map((b: any) => {
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
                          {b.size && <span className="text-[10px] text-muted-foreground">{b.size}</span>}
                          {b.cooperado_only && <Badge variant="secondary" className="text-[10px]">Cooperado</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {b.file_url && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openContent(b.file_url, b.type)}>
                            <Eye className="w-3.5 h-3.5 text-primary" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                            <a href={b.file_url} target="_blank" rel="noopener noreferrer"><Download className="w-3.5 h-3.5 text-muted-foreground" /></a>
                          </Button>
                        </>
                      )}
                      {isAdmin && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditBook(b)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteBookMut.mutate(b.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      )}
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
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editModuleId ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
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
            <Button onClick={() => saveModuleMut.mutate()} disabled={!moduleTitle.trim() || saveModuleMut.isPending} className="gradient-primary text-primary-foreground">
              {saveModuleMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editLessonId ? "Editar Aula" : "Nova Aula"}</DialogTitle>
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
                <Select value={lessonType} onValueChange={setLessonType}>
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
            <Button onClick={() => saveLessonMut.mutate()} disabled={!lessonTitle.trim() || saveLessonMut.isPending} className="gradient-primary text-primary-foreground">
              {saveLessonMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={evalDialogOpen} onOpenChange={setEvalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editEvalId ? "Editar Avaliação" : "Nova Avaliação"}</DialogTitle>
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
                <Select value={evalType} onValueChange={setEvalType}>
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
            <Button onClick={() => saveEvalMut.mutate()} disabled={!evalTitle.trim() || saveEvalMut.isPending} className="gradient-primary text-primary-foreground">
              {saveEvalMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editBookId ? "Editar Material" : "Novo Material"}</DialogTitle>
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
                <Select value={bookType} onValueChange={setBookType}>
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
            <Button onClick={() => saveBookMut.mutate()} disabled={!bookTitle.trim() || saveBookMut.isPending} className="gradient-primary text-primary-foreground">
              {saveBookMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
