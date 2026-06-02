import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft, Clock, Users, BookOpen, Star, Play, FileText, CheckCircle,
  Lock, Award, Plus, Trash2, Edit, Video, Headphones,
  ChevronDown, ChevronUp, Library, BarChart3, Loader2, Eye, ExternalLink, Download, Upload, ListChecks, XCircle
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import StudentExamDialog from "@/components/StudentExamDialog";
import SignedImage from "@/components/SignedImage";
import { getSignedUrl } from "@/lib/storage";
import CourseChat from "@/components/CourseChat";
import LessonNotes from "@/components/LessonNotes";
import CoursePurchasePanel from "@/components/CoursePurchasePanel";
import IntroVideoModal from "@/components/IntroVideoModal";

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
  const { role, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = role === "admin";
  const [generatingCert, setGeneratingCert] = useState(false);
  const [replayIntro, setReplayIntro] = useState(false);

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

  // ---- Fetch user lesson completions for this course ----
  const lessonIds = modules.flatMap((m: any) => (m.lessons || []).map((l: any) => l.id));
  const { data: myCompletions = [] } = useQuery({
    queryKey: ["my_lesson_completions", courseId, user?.id, lessonIds.length],
    queryFn: async () => {
      if (!user || lessonIds.length === 0) return [];
      const { data, error } = await supabase
        .from("lesson_completions")
        .select("lesson_id")
        .eq("user_id", user.id)
        .in("lesson_id", lessonIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && lessonIds.length > 0,
  });
  const completedLessonIds = new Set(myCompletions.map((c: any) => c.lesson_id));

  // ---- Fetch user exam attempts for this course's evaluations ----
  const PASS_THRESHOLD = 70;
  const evalIds = evaluations.map((e: any) => e.id);
  const { data: myAttempts = [] } = useQuery({
    queryKey: ["my_exam_attempts", courseId, user?.id, evalIds.length],
    queryFn: async () => {
      if (!user || evalIds.length === 0) return [];
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("evaluation_id, score")
        .eq("user_id", user.id)
        .in("evaluation_id", evalIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && evalIds.length > 0,
  });
  // Best score per evaluation
  const bestScoreByEval = new Map<string, number>();
  for (const a of myAttempts as any[]) {
    const prev = bestScoreByEval.get(a.evaluation_id) ?? 0;
    if (Number(a.score) > prev) bestScoreByEval.set(a.evaluation_id, Number(a.score));
  }
  // An evaluation is "completed" only if the student passed (>= 70%)
  const passedEvalIds = new Set(
    Array.from(bestScoreByEval.entries()).filter(([, s]) => s >= PASS_THRESHOLD).map(([id]) => id)
  );

  // ---- Existing certificate (any status) ----
  const { data: existingCert } = useQuery({
    queryKey: ["my_course_cert", courseId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("certificates")
        .select("id, code, status, issued_at")
        .eq("user_id", user.id)
        .eq("course_id", courseId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!courseId,
  });

  // ---- Paid course access check ----
  const { data: paidAccess } = useQuery({
    enabled: !!user && !!course && !!courseId && !!course?.is_paid && !isAdmin,
    queryKey: ["paid-access", courseId, user?.id],
    queryFn: async () => {
      const [purchased, subscribed] = await Promise.all([
        supabase.rpc("has_purchased_course", { _user_id: user!.id, _course_id: courseId! }),
        supabase.rpc("has_active_subscription", { _user_id: user!.id }),
      ]);
      return {
        purchased: !!purchased.data,
        subscribed: !!subscribed.data,
      };
    },
  });
  const needsPurchase =
    !!course?.is_paid &&
    !isAdmin &&
    !!user &&
    paidAccess !== undefined &&
    !paidAccess.purchased &&
    !paidAccess.subscribed;


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
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentLessonId, setContentLessonId] = useState<string | null>(null);

  const [evalDialogOpen, setEvalDialogOpen] = useState(false);
  const [editEvalId, setEditEvalId] = useState<string | null>(null);
  const [evalTitle, setEvalTitle] = useState("");
  const [evalType, setEvalType] = useState("prova");
  const [evalDuration, setEvalDuration] = useState(60);
  const [evalQuestions, setEvalQuestions] = useState(10);
  const [evalLessonIds, setEvalLessonIds] = useState<string[]>([]);
  const [evalModuleId, setEvalModuleId] = useState<string | null>(null);

  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [editBookId, setEditBookId] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookType, setBookType] = useState("pdf");
  const [bookSize, setBookSize] = useState("");
  const [bookCooperado, setBookCooperado] = useState(false);
  const [bookFileUrl, setBookFileUrl] = useState("");
  const [uploadingLesson, setUploadingLesson] = useState(false);
  const [uploadingBook, setUploadingBook] = useState(false);
  const lessonFileRef = useRef<HTMLInputElement>(null);
  const bookFileRef = useRef<HTMLInputElement>(null);

  // ---- Questions state ----
  const [questionsDialogOpen, setQuestionsDialogOpen] = useState(false);
  const [questionsEvalId, setQuestionsEvalId] = useState<string | null>(null);
  const [questionsEvalTitle, setQuestionsEvalTitle] = useState("");
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editQuestionId, setEditQuestionId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctOption, setCorrectOption] = useState("a");

  // ---- Student exam state ----
  const [examOpen, setExamOpen] = useState(false);
  const [examEvalId, setExamEvalId] = useState<string | null>(null);
  const [examEvalTitle, setExamEvalTitle] = useState("");
  const [examEvalType, setExamEvalType] = useState<string>("exercicio");
  const startExam = (ev: any) => {
    setExamEvalId(ev.id);
    setExamEvalTitle(ev.title);
    setExamEvalType(ev.type);
    setExamOpen(true);
  };

  // ---- Fetch questions for selected evaluation ----
  const { data: questions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ["evaluation_questions", questionsEvalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evaluation_questions")
        .select("*")
        .eq("evaluation_id", questionsEvalId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!questionsEvalId,
  });

  const handleFileUpload = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) throw error;
    return path;
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["course_modules", courseId] });
    qc.invalidateQueries({ queryKey: ["course_evaluations", courseId] });
    qc.invalidateQueries({ queryKey: ["course_books", courseId] });
    qc.invalidateQueries({ queryKey: ["evaluation_lessons", courseId] });
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
      const primaryLessonId = evalLessonIds[0] ?? null;
      const payload = { title: evalTitle, type: evalType, duration: evalDuration, questions: evalQuestions, lesson_id: primaryLessonId, module_id: evalModuleId };
      let evaluationId = editEvalId;
      if (editEvalId) {
        const { error } = await supabase.from("course_evaluations").update(payload).eq("id", editEvalId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("course_evaluations").insert({ course_id: courseId!, ...payload }).select("id").single();
        if (error) throw error;
        evaluationId = data.id;
      }
      // Sync evaluation_lessons join table
      if (evaluationId) {
        await supabase.from("evaluation_lessons").delete().eq("evaluation_id", evaluationId);
        if (evalLessonIds.length > 0) {
          const rows = evalLessonIds.map((lid) => ({ evaluation_id: evaluationId!, lesson_id: lid }));
          const { error: linkErr } = await supabase.from("evaluation_lessons").insert(rows);
          if (linkErr) throw linkErr;
        }
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

  // ---- Question mutations ----
  const saveQuestionMut = useMutation({
    mutationFn: async () => {
      const payload = {
        evaluation_id: questionsEvalId!,
        question_text: questionText,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_option: correctOption,
        sort_order: editQuestionId ? undefined : questions.length,
      };
      if (editQuestionId) {
        const { evaluation_id, sort_order, ...updatePayload } = payload;
        const { error } = await supabase.from("evaluation_questions").update(updatePayload).eq("id", editQuestionId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("evaluation_questions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluation_questions", questionsEvalId] });
      setQuestionDialogOpen(false);
      toast({ title: "Questão salva" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteQuestionMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("evaluation_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluation_questions", questionsEvalId] });
      toast({ title: "Questão removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ---- Helpers ----
  const openNewModule = () => { setEditModuleId(null); setModuleTitle(""); setModuleLocked(false); setModuleDialogOpen(true); };
  const openEditModule = (m: any) => { setEditModuleId(m.id); setModuleTitle(m.title); setModuleLocked(m.locked); setModuleDialogOpen(true); };
  const openNewLesson = (moduleId: string) => { setEditLessonId(null); setLessonModuleId(moduleId); setLessonTitle(""); setLessonType("video"); setLessonDuration(""); setLessonContentUrl(""); setLessonDialogOpen(true); };
  const openEditLesson = (moduleId: string, l: any) => { setEditLessonId(l.id); setLessonModuleId(moduleId); setLessonTitle(l.title); setLessonType(l.type); setLessonDuration(l.duration || ""); setLessonContentUrl(l.content_url || ""); setLessonDialogOpen(true); };
  const openNewEval = (moduleId: string | null = null) => { setEditEvalId(null); setEvalTitle(""); setEvalType("prova"); setEvalDuration(60); setEvalQuestions(10); setEvalLessonIds([]); setEvalModuleId(moduleId); setEvalDialogOpen(true); };
  const openEditEval = async (ev: any) => {
    setEditEvalId(ev.id); setEvalTitle(ev.title); setEvalType(ev.type); setEvalDuration(ev.duration); setEvalQuestions(ev.questions);
    setEvalModuleId(ev.module_id ?? null);
    const { data } = await supabase.from("evaluation_lessons").select("lesson_id").eq("evaluation_id", ev.id);
    const ids = (data ?? []).map((r: any) => r.lesson_id);
    setEvalLessonIds(ids.length > 0 ? ids : (ev.lesson_id ? [ev.lesson_id] : []));
    setEvalDialogOpen(true);
  };
  const openNewBook = () => { setEditBookId(null); setBookTitle(""); setBookType("pdf"); setBookSize(""); setBookCooperado(false); setBookFileUrl(""); setBookDialogOpen(true); };
  const openEditBook = (b: any) => { setEditBookId(b.id); setBookTitle(b.title); setBookType(b.type); setBookSize(b.size || ""); setBookCooperado(b.cooperado_only); setBookFileUrl(b.file_url || ""); setBookDialogOpen(true); };

  const openContent = async (url: string, type: string, lessonId?: string) => {
    setContentType(type);
    setContentLessonId(lessonId ?? null);
    setContentDialogOpen(true);
    setContentError(null);
    if (!url) {
      setContentUrl("");
      setContentError("URL do conteúdo não encontrada.");
      return;
    }
    // External URL (not from our storage): use as-is
    if (url.startsWith("http") && !url.includes("/storage/v1/object/")) {
      setContentUrl(url);
      return;
    }
    setContentLoading(true);
    setContentUrl("");
    try {
      const signed = await getSignedUrl(url, "media", 3600);
      if (!signed) {
        setContentError("Não foi possível gerar a URL do arquivo.");
      } else {
        setContentUrl(signed);
      }
    } catch (e: any) {
      setContentError(e?.message || "Falha ao carregar o conteúdo.");
    } finally {
      setContentLoading(false);
    }
  };

  const openQuestions = (ev: any) => {
    setQuestionsEvalId(ev.id);
    setQuestionsEvalTitle(ev.title);
    setQuestionsDialogOpen(true);
  };

  const openNewQuestion = () => {
    setEditQuestionId(null);
    setQuestionText("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrectOption("a");
    setQuestionDialogOpen(true);
  };

  const openEditQuestion = (q: any) => {
    setEditQuestionId(q.id);
    setQuestionText(q.question_text);
    setOptionA(q.option_a);
    setOptionB(q.option_b);
    setOptionC(q.option_c);
    setOptionD(q.option_d);
    setCorrectOption(q.correct_option);
    setQuestionDialogOpen(true);
  };

  const totalLessons = modules.reduce((s: number, m: any) => s + (m.lessons?.length || 0), 0);
  const allLessons = modules.flatMap((m: any) => (m.lessons || []).map((l: any) => ({ ...l, module_title: m.title })));

  // Fetch all lesson<->evaluation links for this course's evaluations
  const { data: evalLessonLinks = [] } = useQuery({
    queryKey: ["evaluation_lessons", courseId, evalIds.length],
    queryFn: async () => {
      if (evalIds.length === 0) return [];
      const { data, error } = await supabase
        .from("evaluation_lessons")
        .select("evaluation_id, lesson_id")
        .in("evaluation_id", evalIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: evalIds.length > 0,
  });

  // Map of lesson_id -> evaluation attached to that lesson (supports N:N via evaluation_lessons)
  const lessonQuizMap = new Map<string, any>();
  for (const link of evalLessonLinks as any[]) {
    const ev = (evaluations as any[]).find((e) => e.id === link.evaluation_id);
    if (ev && !lessonQuizMap.has(link.lesson_id)) lessonQuizMap.set(link.lesson_id, ev);
  }
  // Backwards compatibility: legacy single lesson_id column
  for (const ev of evaluations as any[]) {
    if (ev.lesson_id && !lessonQuizMap.has(ev.lesson_id)) lessonQuizMap.set(ev.lesson_id, ev);
  }
  const publishedEvals = evaluations.filter((e: any) => e.status === "publicada");

  // Intro modules don't have evaluations/activities
  const isIntroModule = (m: any) => /\bintrodu|^intro\b/i.test((m?.title || "").trim());

  // ---- Progressive unlock helpers ----
  const progressiveUnlock = !!(course as any)?.progressive_unlock;
  const orderedLessons: any[] = modules.flatMap((m: any) => m.lessons || []);
  const isLessonLocked = (lessonId: string): boolean => {
    if (isAdmin || !progressiveUnlock) return false;
    const idx = orderedLessons.findIndex((l) => l.id === lessonId);
    if (idx <= 0) return false;
    for (let i = 0; i < idx; i++) {
      const prev = orderedLessons[i];
      if (!completedLessonIds.has(prev.id)) return true;
      const prevQuiz = lessonQuizMap.get(prev.id);
      if (prevQuiz && prevQuiz.status === "publicada" && !passedEvalIds.has(prevQuiz.id)) return true;
    }
    return false;
  };
  const isEvalLocked = (ev: any): boolean => {
    if (isAdmin || !progressiveUnlock) return false;
    if (ev.module_id) {
      const mod = modules.find((m: any) => m.id === ev.module_id);
      if (mod) {
        for (const l of mod.lessons || []) {
          if (!completedLessonIds.has(l.id)) return true;
        }
      }
      const moduleEvals = (evaluations as any[])
        .filter((e: any) => e.module_id === ev.module_id && e.status === "publicada")
        .sort((a: any, b: any) => (a.created_at || "").localeCompare(b.created_at || ""));
      const evIdx = moduleEvals.findIndex((e: any) => e.id === ev.id);
      for (let i = 0; i < evIdx; i++) {
        if (!passedEvalIds.has(moduleEvals[i].id)) return true;
      }
      return false;
    }
    // Final evaluation
    for (const l of orderedLessons) {
      if (!completedLessonIds.has(l.id)) return true;
    }
    for (const me of (evaluations as any[]).filter((e: any) => e.module_id && e.status === "publicada")) {
      if (!passedEvalIds.has(me.id)) return true;
    }
    return false;
  };

  const totalUnits = totalLessons + publishedEvals.length;
  const completedLessonsCount = isAdmin
    ? modules.reduce((s: number, m: any) => s + (m.lessons?.filter((l: any) => l.completed).length || 0), 0)
    : completedLessonIds.size;
  const completedEvalsCount = isAdmin ? publishedEvals.length : publishedEvals.filter((e: any) => passedEvalIds.has(e.id)).length;
  const completedLessons = completedLessonsCount; // legacy var name kept for the lessons-only count display
  const completedUnits = completedLessonsCount + completedEvalsCount;
  const progressPct = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
  const isCourseComplete = totalUnits > 0 && completedUnits >= totalUnits;

  // ---- Toggle lesson completion (student) ----
  const toggleLessonCompletionMut = useMutation({
    mutationFn: async ({ lessonId, completed }: { lessonId: string; completed: boolean }) => {
      if (!user) throw new Error("Não autenticado");
      if (completed) {
        const { error } = await supabase.from("lesson_completions").delete().eq("user_id", user.id).eq("lesson_id", lessonId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lesson_completions").insert({ user_id: user.id, lesson_id: lessonId });
        if (error) throw error;
      }
    },
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: ["my_lesson_completions", courseId, user?.id] });
      // If student just marked the lesson as completed, auto-open the attached quiz (if any & published)
      if (!vars.completed) {
        const quiz = lessonQuizMap.get(vars.lessonId);
        if (quiz && quiz.status === "publicada") {
          startExam(quiz);
        }
      }
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ---- Mark last accessed lesson (continue where you left off) ----
  const markLessonAccess = async (lessonId: string) => {
    if (!user || isAdmin || !courseId) return;
    try {
      await supabase.rpc("mark_lesson_access", { _course_id: courseId, _lesson_id: lessonId });
      qc.invalidateQueries({ queryKey: ["my-enrollments", user.id] });
    } catch {
      // silent — not critical
    }
  };

  // ---- Generate certificate (student self-issue at 100%) ----
  const handleGenerateCertificate = async () => {
    if (!user || !courseId) return;
    if (existingCert) {
      toast({ title: "Certificado já existente", description: "Este curso já possui um certificado vinculado à sua conta." });
      return;
    }
    setGeneratingCert(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-certificate", {
        body: { course_id: courseId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Certificado gerado!", description: "Veja em 'Certificados'." });
      qc.invalidateQueries({ queryKey: ["my_course_cert", courseId, user.id] });
      qc.invalidateQueries({ queryKey: ["my-cert-count", user.id] });
    } catch (e: any) {
      toast({ title: "Erro ao gerar certificado", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingCert(false);
    }
  };

  // Sync enrollment.progress in background when computed progress changes
  useEffect(() => {
    if (!user || isAdmin || totalUnits === 0) return;
    supabase.from("enrollments").update({ progress: progressPct }).eq("user_id", user.id).eq("course_id", courseId!).then(() => {
      qc.invalidateQueries({ queryKey: ["my-enrollments", user.id] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressPct, totalUnits, user?.id, courseId, isAdmin]);

  // Auto-issue certificate when student reaches 100% completion OR avg score >= 70%
  const autoCertTriedRef = useRef(false);
  useEffect(() => {
    if (!user || isAdmin || !courseId) return;
    if (existingCert || generatingCert || autoCertTriedRef.current) return;
    const pubEvals = (evaluations as any[]).filter((e: any) => e.status === "publicada");
    let avgOk = false;
    if (pubEvals.length > 0) {
      const scores = pubEvals.map((e: any) => bestScoreByEval.get(e.id));
      if (scores.every((s) => typeof s === "number")) {
        const avg = scores.reduce((a: number, b: any) => a + (b as number), 0) / scores.length;
        avgOk = avg >= PASS_THRESHOLD;
      }
    }
    if (isCourseComplete || avgOk) {
      autoCertTriedRef.current = true;
      handleGenerateCertificate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, courseId, existingCert, isCourseComplete, progressPct, myAttempts.length]);

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
          <SignedImage path={course.image} alt={course.title} className="w-full h-full object-cover" />
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

      {course.intro_video_url && !isAdmin && (
        <>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setReplayIntro(true)} className="gap-2">
              <Play className="w-4 h-4" /> Assistir introdução
            </Button>
          </div>
          <IntroVideoModal
            videoUrl={course.intro_video_url}
            storageKey={`intro_seen_course_${course.id}`}
            forceOpen={replayIntro}
            onClose={() => setReplayIntro(false)}
            title={`Bem-vindo ao curso: ${course.title}`}
            description="Assista à introdução para conhecer os objetivos e o que esperar deste curso."
          />
        </>
      )}


      {needsPurchase && (
        <CoursePurchasePanel
          courseId={courseId!}
          title={course.title}
          price={Number(course.price ?? 0)}
          promotionalPrice={course.promotional_price != null ? Number(course.promotional_price) : null}
        />
      )}





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
        <p className="text-xs text-muted-foreground mt-2">
          {completedUnits} de {totalUnits} itens concluídos ({totalLessons} aulas + {publishedEvals.length} avaliações)
        </p>

        {!isAdmin && (() => {
          const pubEvals = (evaluations as any[]).filter((e: any) => e.status === "publicada");
          let avgOk = false;
          if (pubEvals.length > 0) {
            const scores = pubEvals.map((e: any) => bestScoreByEval.get(e.id));
            if (scores.every((s) => typeof s === "number")) {
              const avg = scores.reduce((a: number, b: any) => a + (b as number), 0) / scores.length;
              avgOk = avg >= PASS_THRESHOLD;
            }
          }
          const eligible = isCourseComplete || avgOk;
          const certIssued = existingCert?.status === "emitido";
          const certPending = existingCert && !certIssued;
          return (
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-3">
              {certIssued && (
                <>
                  <Badge className="bg-primary text-primary-foreground gap-1"><Award className="w-3 h-3" /> Certificado gerado</Badge>
                  <Link to="/certificates" className="inline-flex">
                    <Button size="sm" className="gradient-primary text-primary-foreground gap-2">
                      <Award className="w-4 h-4" /> Ver Certificado ({existingCert!.code})
                    </Button>
                  </Link>
                </>
              )}
              {certPending && (
                <>
                  <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Em processamento</Badge>
                  <span className="text-xs text-muted-foreground">Seu certificado está sendo emitido. Atualize a página em instantes.</span>
                </>
              )}
              {!existingCert && (
                <>
                  {eligible ? (
                    <Badge variant="outline" className="border-primary text-primary">Elegível</Badge>
                  ) : (
                    <Badge variant="outline">Não elegível</Badge>
                  )}
                  <Button
                    size="sm"
                    onClick={handleGenerateCertificate}
                    disabled={!eligible || generatingCert}
                    className="gradient-primary text-primary-foreground gap-2 disabled:opacity-50"
                  >
                    {generatingCert ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                    {generatingCert ? "Gerando..." : "Gerar Certificado"}
                  </Button>
                  {!eligible && (
                    <span className="text-xs text-muted-foreground">
                      Conclua 100% do curso ou atinja média mínima de 70% nas avaliações para liberar o certificado.
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })()}
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
          <div className="border-t border-border max-h-[600px] overflow-y-auto">
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
                      const userCompleted = isAdmin ? lesson.completed : completedLessonIds.has(lesson.id);
                      const attachedQuiz = lessonQuizMap.get(lesson.id);
                      const quizPassed = attachedQuiz ? passedEvalIds.has(attachedQuiz.id) : false;
                      const locked = isLessonLocked(lesson.id);
                      return (
                        <div key={lesson.id}>
                          <div
                            className={`flex items-center gap-3 px-4 py-2.5 pl-8 transition-colors group ${locked ? "opacity-60 cursor-not-allowed" : `hover:bg-muted/10 ${lesson.content_url ? "cursor-pointer" : ""}`}`}
                            onClick={() => {
                              if (locked) {
                                toast({ title: "Aula bloqueada", description: "Conclua a aula anterior para desbloquear.", variant: "destructive" });
                                return;
                              }
                              if (lesson.content_url) {
                                openContent(lesson.content_url, lesson.type, lesson.id);
                                markLessonAccess(lesson.id);
                              }
                            }}>
                            {!isAdmin ? (
                              <button
                                type="button"
                                title={locked ? "Bloqueada" : userCompleted ? "Marcar como não concluída" : "Marcar como concluída"}
                                disabled={locked}
                                onClick={(e) => { e.stopPropagation(); if (!locked) toggleLessonCompletionMut.mutate({ lessonId: lesson.id, completed: userCompleted }); }}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${locked ? "bg-muted" : userCompleted ? "bg-success/10 hover:bg-success/20" : "bg-muted hover:bg-muted/70"}`}
                              >
                                {locked ? <Lock className="w-3.5 h-3.5 text-muted-foreground" /> : userCompleted ? <CheckCircle className="w-3.5 h-3.5 text-success" /> : <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
                              </button>
                            ) : (
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${userCompleted ? "bg-success/10" : "bg-muted"}`}>
                                {userCompleted ? <CheckCircle className="w-3.5 h-3.5 text-success" /> : <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${userCompleted ? "text-muted-foreground line-through" : "text-card-foreground"}`}>{lesson.title}</p>
                            </div>
                            {lesson.content_url && !locked && (
                              <Eye className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            )}
                            {locked && <Badge variant="outline" className="text-[10px] gap-1"><Lock className="w-3 h-3" /> Bloqueada</Badge>}
                            <Badge variant="outline" className="text-[10px]">{typeLabels[lesson.type] || lesson.type}</Badge>
                            <span className="text-xs text-muted-foreground flex-shrink-0">{lesson.duration}</span>
                            {isAdmin && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEditLesson(mod.id, lesson)}><Edit className="w-3 h-3" /></Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteLessonMut.mutate(lesson.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                              </div>
                            )}
                          </div>
                          {/* Inline lesson quiz CTA */}
                          {attachedQuiz && attachedQuiz.status === "publicada" && !isAdmin && !locked && (
                            <div className="flex items-center justify-between gap-3 px-4 py-2 pl-16 bg-accent/5 border-t border-border/30">
                              <div className="flex items-center gap-2 min-w-0">
                                <ListChecks className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                                <span className="text-xs text-card-foreground truncate">
                                  Quiz: <strong>{attachedQuiz.title}</strong>
                                </span>
                                {quizPassed && (
                                  <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">Aprovado</Badge>
                                )}
                              </div>
                              <Button size="sm" variant={quizPassed ? "outline" : "default"}
                                className={quizPassed ? "h-7 text-xs" : "h-7 text-xs gradient-primary text-primary-foreground"}
                                onClick={(e) => { e.stopPropagation(); startExam(attachedQuiz); }}>
                                {quizPassed ? "Refazer" : "Iniciar Quiz"}
                              </Button>
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
          <div className="border-t border-border max-h-[600px] overflow-y-auto">
            {isAdmin && (
              <div className="p-3 border-b border-border bg-muted/10 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openNewEval(null)} className="gradient-primary text-primary-foreground gap-1">
                  <Plus className="w-3 h-3" /> Nova Avaliação Final
                </Button>
              </div>
            )}
            {(() => {
              const renderEvalRow = (ev: any) => {
                const userAttempts = (myAttempts as any[]).filter((a) => a.evaluation_id === ev.id);
                const userBest = bestScoreByEval.get(ev.id) ?? 0;
                const userPassed = passedEvalIds.has(ev.id);
                const isFinal = ev.type === "prova";
                const attemptsUsed = userAttempts.length;
                const finalLockedOut = isFinal && !userPassed && attemptsUsed >= 3;
                const evLocked = isEvalLocked(ev);
                return (
                  <div key={ev.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors group">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <BarChart3 className="w-4 h-4 text-accent flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{ev.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">{evalTypeLabels[ev.type] || ev.type}</Badge>
                          <Badge variant="outline" className={`text-[10px] ${evalStatusStyles[ev.status] || ""}`}>
                            {ev.status === "rascunho" ? "Rascunho" : ev.status === "publicada" ? "Publicada" : "Encerrada"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{ev.duration}min • {ev.questions} questões</span>
                          {!isAdmin && userAttempts.length > 0 && (
                            userPassed ? (
                              <Badge className="text-[10px] bg-success/10 text-success hover:bg-success/20 gap-1">
                                <CheckCircle className="w-3 h-3" /> Concluído ({userBest}%)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40 gap-1">
                                <XCircle className="w-3 h-3" /> Não atingiu média ({userBest}%)
                              </Badge>
                            )
                          )}
                          {!isAdmin && isFinal && !userPassed && (
                            <span className="text-[10px] text-muted-foreground">Tentativas: {attemptsUsed}/3</span>
                          )}
                          {!isAdmin && evLocked && (
                            <Badge variant="outline" className="text-[10px] gap-1"><Lock className="w-3 h-3" /> Bloqueada</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {isAdmin ? (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Gerenciar Questões" onClick={() => openQuestions(ev)}>
                          <ListChecks className="w-3.5 h-3.5 text-primary" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleEvalStatusMut.mutate(ev)}>
                          {ev.status === "publicada" ? <Lock className="w-3.5 h-3.5 text-warning" /> : <CheckCircle className="w-3.5 h-3.5 text-success" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditEval(ev)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteEvalMut.mutate(ev.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    ) : (
                      ev.status === "publicada" && (
                        userPassed ? (
                          <Badge className="bg-success/10 text-success gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Concluído
                          </Badge>
                        ) : (
                          <Button size="sm" onClick={() => startExam(ev)} className="gradient-primary text-primary-foreground gap-1" disabled={finalLockedOut || evLocked} title={evLocked ? "Conclua as etapas anteriores para desbloquear" : finalLockedOut ? "Tentativas esgotadas — reinicie o curso" : ""}>
                            {evLocked ? <Lock className="w-3.5 h-3.5" /> : <ListChecks className="w-3.5 h-3.5" />}
                            {evLocked ? "Bloqueada" : attemptsUsed > 0 ? "Refazer" : "Responder"}
                          </Button>
                        )
                      )
                    )}
                  </div>
                );
              };

              const evalsByModule = new Map<string, any[]>();
              const finalEvals: any[] = [];
              for (const ev of evaluations as any[]) {
                if (ev.module_id) {
                  const arr = evalsByModule.get(ev.module_id) || [];
                  arr.push(ev);
                  evalsByModule.set(ev.module_id, arr);
                } else {
                  finalEvals.push(ev);
                }
              }

              return (
                <div>
                  {modules.map((m: any) => {
                    if (isIntroModule(m)) return null;
                    const list = evalsByModule.get(m.id) || [];
                    if (!isAdmin && list.length === 0) return null;
                    return (
                      <div key={m.id} className="border-b border-border">
                        <div className="px-4 py-2 bg-muted/20 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m.title}</p>
                          {isAdmin && (
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => openNewEval(m.id)}>
                              <Plus className="w-3 h-3" /> Adicionar
                            </Button>
                          )}
                        </div>
                        <div className="divide-y divide-border">
                          {list.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma avaliação neste módulo</p>
                          ) : list.map(renderEvalRow)}
                        </div>
                      </div>
                    );
                  })}

                  <div>
                    <div className="px-4 py-2 bg-accent/10 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Avaliação Final do Curso</p>
                    </div>
                    <div className="divide-y divide-border">
                      {finalEvals.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma avaliação final cadastrada</p>
                      ) : finalEvals.map(renderEvalRow)}
                    </div>
                  </div>

                  {evaluations.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma avaliação vinculada</p>
                  )}
                </div>
              );
            })()}
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
          <div className="border-t border-border max-h-[600px] overflow-y-auto">
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

      {/* ========== COURSE CHAT ========== */}
      {course && courseId && (
        <CourseChat courseId={courseId} cooperadoOnly={course.cooperado_only} />
      )}

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
            <div className="space-y-2">
              <Label>Conteúdo da Aula</Label>
              <Input value={lessonContentUrl} onChange={(e) => setLessonContentUrl(e.target.value)} placeholder="Cole a URL ou envie um arquivo abaixo" />
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {uploadingLesson ? "Enviando..." : "Enviar arquivo do dispositivo"}
                </span>
                <input ref={lessonFileRef} type="file" className="hidden" accept="video/*,.pdf,audio/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingLesson(true);
                    try {
                      const url = await handleFileUpload(file, "lessons");
                      setLessonContentUrl(url);
                      toast({ title: "Arquivo enviado!" });
                    } catch (err: any) {
                      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
                    } finally {
                      setUploadingLesson(false);
                    }
                  }} />
              </label>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEvalId ? "Editar Avaliação" : "Nova Avaliação"}</DialogTitle>
            <DialogDescription>Vincule uma avaliação a este curso</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={evalTitle} onChange={(e) => setEvalTitle(e.target.value)} placeholder="Nome da avaliação" />
            </div>
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select value={evalModuleId ?? "__final__"} onValueChange={(v) => setEvalModuleId(v === "__final__" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__final__">Avaliação Final do Curso</SelectItem>
                  {modules.filter((m: any) => !isIntroModule(m)).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Vincule a um módulo específico ou deixe como Avaliação Final do curso.</p>
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
            <div className="space-y-2">
              <Label>Vincular a aulas (opcional, múltiplas)</Label>
              <div className="max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {allLessons.length === 0 && (
                  <p className="text-xs text-muted-foreground p-3">Nenhuma aula cadastrada neste curso.</p>
                )}
                {allLessons.map((l: any) => {
                  const checked = evalLessonIds.includes(l.id);
                  return (
                    <label key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setEvalLessonIds((prev) =>
                            v ? Array.from(new Set([...prev, l.id])) : prev.filter((id) => id !== l.id)
                          );
                        }}
                      />
                      <span className="text-card-foreground">
                        <span className="text-muted-foreground">{l.module_title} →</span> {l.title}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione uma ou mais aulas. O quiz aparecerá em todas elas e abrirá automaticamente quando o aluno concluir qualquer uma das aulas vinculadas.
              </p>
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
            <div className="space-y-2">
              <Label>Arquivo do Material</Label>
              <Input value={bookFileUrl} onChange={(e) => setBookFileUrl(e.target.value)} placeholder="Cole a URL ou envie um arquivo abaixo" />
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {uploadingBook ? "Enviando..." : "Enviar arquivo do dispositivo"}
                </span>
                <input ref={bookFileRef} type="file" className="hidden" accept="video/*,.pdf,audio/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingBook(true);
                    try {
                      const url = await handleFileUpload(file, "books");
                      setBookFileUrl(url);
                      const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + " MB";
                      setBookSize(sizeMB);
                      toast({ title: "Arquivo enviado!" });
                    } catch (err: any) {
                      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
                    } finally {
                      setUploadingBook(false);
                    }
                  }} />
              </label>
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

      {/* Content Viewer Dialog */}
      <Dialog open={contentDialogOpen} onOpenChange={(o) => { if (!o) { setContentLessonId(null); setContentUrl(""); setContentError(null); } setContentDialogOpen(o); }}>
        <DialogContent className="max-w-5xl w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Visualizar Conteúdo</DialogTitle>
            <DialogDescription className="sr-only">Visualização do conteúdo selecionado</DialogDescription>
          </DialogHeader>
          <div className={`grid gap-4 ${contentLessonId && !isAdmin ? "lg:grid-cols-[1fr_320px]" : ""}`}>
            <div>
              {contentLoading && (
                <div className="flex items-center justify-center h-[40vh] rounded-lg bg-muted text-muted-foreground gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
                </div>
              )}
              {!contentLoading && contentError && (
                <div className="flex flex-col items-center justify-center h-[40vh] rounded-lg bg-muted text-center px-4">
                  <XCircle className="w-8 h-8 text-destructive mb-2" />
                  <p className="text-sm text-foreground font-medium">Não foi possível carregar o conteúdo</p>
                  <p className="text-xs text-muted-foreground mt-1">{contentError}</p>
                </div>
              )}
              {!contentLoading && !contentError && contentUrl && (
                contentType === "pdf" || contentUrl.match(/\.pdf($|\?)/i) ? (
                  <div className="w-full h-[60vh] sm:h-[70vh] rounded-lg overflow-hidden border border-border bg-muted">
                    <object data={contentUrl} type="application/pdf" className="w-full h-full">
                      <iframe
                        src={`https://docs.google.com/gview?url=${encodeURIComponent(contentUrl)}&embedded=true`}
                        className="w-full h-full"
                        title="PDF"
                      />
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        Não foi possível renderizar o PDF.{" "}
                        <a href={contentUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          Abrir em nova aba
                        </a>
                      </div>
                    </object>
                  </div>

                ) : contentType === "video" || contentType === "video_aula" || contentUrl.match(/\.(mp4|webm|ogg|mov|m4v)($|\?)/i) ? (
                  <video
                    key={contentUrl}
                    src={contentUrl}
                    controls
                    preload="metadata"
                    playsInline
                    controlsList="nodownload"
                    className="w-full rounded-lg max-h-[60vh] sm:max-h-[70vh] bg-black"
                    onError={() => setContentError("Não foi possível reproduzir o vídeo. Verifique o formato ou tente novamente.")}
                    onEnded={() => {
                      if (!isAdmin && contentLessonId && user && !completedLessonIds.has(contentLessonId)) {
                        toggleLessonCompletionMut.mutate({ lessonId: contentLessonId, completed: false });
                      }
                    }}
                    onTimeUpdate={(e) => {
                      if (isAdmin || !contentLessonId || !user) return;
                      if (completedLessonIds.has(contentLessonId)) return;
                      const v = e.currentTarget;
                      if (v.duration > 0 && v.currentTime / v.duration >= 0.98) {
                        toggleLessonCompletionMut.mutate({ lessonId: contentLessonId, completed: false });
                      }
                    }}
                  >
                    Seu navegador não suporta vídeos.
                  </video>
                ) : contentType === "audio" || contentUrl.match(/\.(mp3|wav|ogg|m4a)($|\?)/i) ? (
                  <audio
                    key={contentUrl}
                    src={contentUrl}
                    controls
                    preload="metadata"
                    className="w-full mt-8"
                    onEnded={() => {
                      if (!isAdmin && contentLessonId && user && !completedLessonIds.has(contentLessonId)) {
                        toggleLessonCompletionMut.mutate({ lessonId: contentLessonId, completed: false });
                      }
                    }}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">Conteúdo externo</p>
                    <Button asChild><a href={contentUrl} target="_blank" rel="noopener noreferrer" className="gap-2"><ExternalLink className="w-4 h-4" /> Abrir em nova aba</a></Button>
                  </div>
                )
              )}
              {!contentLoading && !contentError && contentUrl && (
                <div className="flex justify-end pt-2">
                  <a href={contentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                    Abrir em nova aba ↗
                  </a>
                </div>
              )}
            </div>
            {contentLessonId && !isAdmin && courseId && (
              <LessonNotes lessonId={contentLessonId} courseId={courseId} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== QUESTIONS MANAGER DIALOG ===== */}
      <Dialog open={questionsDialogOpen} onOpenChange={setQuestionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              Questões — {questionsEvalTitle}
            </DialogTitle>
            <DialogDescription>Gerencie as perguntas desta avaliação</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button size="sm" onClick={openNewQuestion} className="gradient-primary text-primary-foreground gap-1">
              <Plus className="w-3 h-3" /> Nova Questão
            </Button>

            {loadingQuestions ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : questions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma questão cadastrada. Clique em "Nova Questão" para começar.</p>
            ) : (
              <div className="space-y-3">
                {questions.map((q: any, idx: number) => (
                  <div key={q.id} className="border border-border rounded-lg p-4 bg-muted/5 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground">
                          <span className="text-primary font-bold">{idx + 1}.</span> {q.question_text}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                          {[
                            { key: "a", text: q.option_a },
                            { key: "b", text: q.option_b },
                            { key: "c", text: q.option_c },
                            { key: "d", text: q.option_d },
                          ].filter(o => o.text).map((opt) => (
                            <div
                              key={opt.key}
                              className={`text-xs px-2.5 py-1.5 rounded-md border ${
                                q.correct_option === opt.key
                                  ? "border-success bg-success/10 text-success font-medium"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              <span className="font-bold uppercase">{opt.key})</span> {opt.text}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditQuestion(q)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteQuestionMut.mutate(q.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== QUESTION FORM DIALOG ===== */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editQuestionId ? "Editar Questão" : "Nova Questão"}</DialogTitle>
            <DialogDescription>Preencha o enunciado e as alternativas</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Enunciado da Questão</Label>
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Digite a pergunta..."
                rows={3}
              />
            </div>
            <div className="space-y-3">
              <Label>Alternativas</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${correctOption === "a" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>A</span>
                  <Input value={optionA} onChange={(e) => setOptionA(e.target.value)} placeholder="Alternativa A" className="flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${correctOption === "b" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>B</span>
                  <Input value={optionB} onChange={(e) => setOptionB(e.target.value)} placeholder="Alternativa B" className="flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${correctOption === "c" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>C</span>
                  <Input value={optionC} onChange={(e) => setOptionC(e.target.value)} placeholder="Alternativa C (opcional)" className="flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${correctOption === "d" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>D</span>
                  <Input value={optionD} onChange={(e) => setOptionD(e.target.value)} placeholder="Alternativa D (opcional)" className="flex-1" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Resposta Correta</Label>
              <Select value={correctOption} onValueChange={setCorrectOption}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">Alternativa A</SelectItem>
                  <SelectItem value="b">Alternativa B</SelectItem>
                  <SelectItem value="c">Alternativa C</SelectItem>
                  <SelectItem value="d">Alternativa D</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveQuestionMut.mutate()}
              disabled={!questionText.trim() || !optionA.trim() || !optionB.trim() || saveQuestionMut.isPending}
              className="gradient-primary text-primary-foreground"
            >
              {saveQuestionMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student exam-taking dialog */}
      <StudentExamDialog
        open={examOpen}
        onOpenChange={(v) => {
          setExamOpen(v);
          if (!v) qc.invalidateQueries({ queryKey: ["my_exam_attempts", courseId, user?.id] });
        }}
        evaluationId={examEvalId}
        evaluationTitle={examEvalTitle}
        evaluationType={examEvalType}
        courseId={courseId ?? null}
      />
    </div>
  );
}
