import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Pencil, Trash2, Lock, Upload, Loader2, Image, History, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SignedImage from "@/components/SignedImage";

interface Course {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  duration: string | null;
  cooperado_only: boolean;
  eventual?: boolean;
  is_paid: boolean;
  price: number | null;
  promotional_price: number | null;
  standalone_access_days: number | null;
  premium_enabled: boolean;
  progressive_unlock?: boolean;
  created_at: string;
}

const emptyForm = {
  title: "",
  description: "",
  image: "",
  duration: "",
  intro_video_url: "",
  cooperado_only: false,
  eventual: false,
  is_paid: false,
  price: "" as string,
  promotional_price: "" as string,
  standalone_access_days: "" as string,
  premium_enabled: true,
  progressive_unlock: false,
  is_open: true,
};


export default function Courses() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "cooperado">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [preserveHistory, setPreserveHistory] = useState(true);
  const [trashOpen, setTrashOpen] = useState(false);


  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingIntro, setUploadingIntro] = useState(false);
  const [introProgress, setIntroProgress] = useState(0);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const introFileRef = useRef<HTMLInputElement>(null);
  const { role, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = role === "admin";

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Course[];
    },
  });

  const { data: myEnrollments = [] } = useQuery({
    queryKey: ["my-enrollments-progress", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id, progress")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as { course_id: string; progress: number }[];
    },
  });

  const progressMap: Record<string, number> = {};
  for (const e of myEnrollments) progressMap[e.course_id] = Math.round(Number(e.progress ?? 0));

  const { data: deletedCourses = [] } = useQuery({
    queryKey: ["deleted-courses"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deleted_courses")
        .select("id, course_id, course_title, preserved_history, certificate_ids, deleted_at")
        .is("restored_at", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { data, error } = await supabase.rpc("restore_deleted_course", { _course_id: courseId });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["deleted-courses"] });
      toast({
        title: "Curso restaurado",
        description: `Certificados religados: ${data?.restored_certificates ?? 0} · Matrículas recuperadas: ${data?.restored_enrollments ?? 0}`,
      });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });



  const handleImageUpload = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `courses/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) throw error;
    // Store storage path; signed URL is generated on render
    return path;
  };

  const saveMutation = useMutation({
    mutationFn: async (values: typeof emptyForm) => {
      const payload = {
        title: values.title,
        description: values.description,
        image: values.image,
        duration: values.duration,
        intro_video_url: values.intro_video_url || null,
        cooperado_only: values.cooperado_only,
        eventual: values.eventual,
        is_paid: values.is_paid,
        price: values.is_paid && values.price ? Number(values.price) : null,
        promotional_price: values.is_paid && values.promotional_price ? Number(values.promotional_price) : null,
        standalone_access_days: values.is_paid && values.standalone_access_days
          ? Math.max(1, Math.floor(Number(values.standalone_access_days)))
          : null,
        premium_enabled: values.premium_enabled,
        progressive_unlock: values.progressive_unlock,
        is_open: values.is_open,
      };

      if (editingCourse) {
        const { error } = await supabase.from("courses").update(payload).eq("id", editingCourse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      setDialogOpen(false);
      toast({ title: editingCourse ? "Curso atualizado" : "Curso criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("delete_course_with_options", {
        _course_id: id,
        _preserve_history: preserveHistory,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["deleted-courses"] });

      setDeleteId(null);
      setPreserveHistory(true);
      toast({
        title: "Curso removido",
        description: data?.preserved
          ? `Histórico preservado: ${data.archived_completions ?? 0} conclusão(ões) e ${data.preserved_certificates ?? 0} certificado(s).`
          : "Todos os dados vinculados ao curso foram apagados.",
      });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });


  const openNew = () => { setEditingCourse(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Course) => {
    setEditingCourse(c);
    setForm({
      title: c.title,
      description: c.description || "",
      image: c.image || "",
      duration: c.duration || "",
      intro_video_url: (c as any).intro_video_url || "",
      cooperado_only: c.cooperado_only,
      eventual: (c as any).eventual ?? false,
      is_paid: c.is_paid ?? false,
      price: c.price != null ? String(c.price) : "",
      promotional_price: c.promotional_price != null ? String(c.promotional_price) : "",
      standalone_access_days: c.standalone_access_days != null ? String(c.standalone_access_days) : "",
      premium_enabled: c.premium_enabled ?? true,
      progressive_unlock: (c as any).progressive_unlock ?? false,
      is_open: (c as any).is_open ?? true,
    });

    setDialogOpen(true);
  };

  const filtered = courses.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.cooperado_only;
    const hideEventual = !isAdmin && (c as any).eventual;
    return matchSearch && matchFilter && !hideEventual;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Cursos</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Gerencie os cursos da plataforma" : "Explore os cursos disponíveis"}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
            <Button variant="outline" onClick={() => setTrashOpen(true)}>
              <History className="w-4 h-4 mr-2" /> Excluídos
              {deletedCourses.length > 0 && (
                <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                  {deletedCourses.length}
                </span>
              )}
            </Button>
            <Button onClick={openNew} className="gradient-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Novo Curso
            </Button>
          </div>
        )}
      </div>


      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar cursos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground shadow-[0_1px_2px_hsl(160_20%_15%/0.03)] transition-colors focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div className="flex gap-2 rounded-xl border border-border bg-card p-1">
          <button onClick={() => setFilter("all")} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === "all" ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            Todos
          </button>
          <button onClick={() => setFilter("cooperado")} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === "cooperado" ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            Cooperados
          </button>
        </div>
      </div>

      {/* Featured */}
      {!isLoading && filtered.length > 0 && (() => {
        const feat = filtered[0];
        const featProgress = progressMap[feat.id];
        return (
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Cursos em Destaque</h2>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-elevated"
            >
              <Link to={`/courses/${feat.id}`} className="relative block h-52 sm:h-64 lg:h-full min-h-[13rem] bg-muted group">
                {feat.image ? (
                  <SignedImage path={feat.image} alt={feat.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Sem imagem</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/45 via-transparent to-transparent" />
                <span className="absolute top-4 left-4 rounded-full gradient-primary px-3 py-1 text-[11px] font-bold text-brand-foreground shadow-card">
                  Novo
                </span>
              </Link>
              <div className="flex flex-col justify-center gap-3 p-5 sm:p-7">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                    {(feat as any).eventual ? "Cooperado Eventual" : feat.cooperado_only ? "Formação Cooperada" : "Curso Livre"}
                  </span>
                  {feat.duration && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">⏱ {feat.duration}</span>
                  )}
                </div>
                <h3 className="font-heading text-xl sm:text-2xl font-extrabold leading-snug text-foreground">{feat.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {feat.description || "Sem descrição"}
                </p>
                {typeof featProgress === "number" && (
                  <div className="mt-1">
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-bold text-primary">{featProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full gradient-primary rounded-full transition-all duration-500" style={{ width: `${featProgress}%` }} />
                    </div>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full gradient-primary text-xs font-bold text-brand-foreground">C</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">Equipe Coopaiba</p>
                    <p className="text-[11px] text-muted-foreground">Educação cooperativista</p>
                  </div>
                  <Button asChild size="sm" className="ml-auto gradient-primary text-primary-foreground">
                    <Link to={`/courses/${feat.id}`}>
                      {typeof featProgress === "number" ? (featProgress === 100 ? "Revisar" : "Continuar") : "Começar Agora"}
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </section>
        );
      })()}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-card">
              <div className="h-44 bg-muted shimmer" />
              <div className="p-5 space-y-3">
                <div className="h-4 w-3/4 rounded bg-muted shimmer" />
                <div className="h-3 w-full rounded bg-muted shimmer" />
                <div className="h-3 w-2/3 rounded bg-muted shimmer" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {!isLoading && (
      <div className="space-y-3">
      <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Seus Cursos</h2>
      <div className="rounded-2xl border border-border/70 bg-card/30 max-h-[calc(100vh-280px)] overflow-y-auto sidebar-scroll p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

        {filtered.map((course, i) => {
          const progress = progressMap[course.id];
          const started = typeof progress === "number";
          return (
          <motion.div key={course.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
            <div className="flex h-full flex-col bg-card rounded-2xl border border-border/70 overflow-hidden shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-200 group">
              <Link to={`/courses/${course.id}`} className="block">
                <div className="relative h-44 bg-muted overflow-hidden">
                  {course.image ? (
                    <SignedImage path={course.image} alt={course.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Sem imagem</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-transparent to-transparent opacity-70" />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-card/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-card-foreground shadow-card">
                      {(course as any).eventual ? "Cooperado Eventual" : course.cooperado_only ? "Formação Cooperada" : "Curso Livre"}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                    {course.cooperado_only && (
                      <span className="gradient-secondary text-brand-foreground text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-card">
                        <Lock className="w-3 h-3" /> Cooperado
                      </span>
                    )}
                  </div>
                  {course.duration && (
                    <span className="absolute bottom-3 right-3 rounded-full bg-foreground/70 px-2.5 py-1 text-[11px] font-semibold text-background backdrop-blur">
                      {course.duration}
                    </span>
                  )}
                </div>
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <Link to={`/courses/${course.id}`}>
                  <h3 className="font-heading font-bold text-[15px] text-foreground line-clamp-2 group-hover:text-primary transition-colors">{course.title}</h3>
                </Link>
                <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{course.description || "Sem descrição"}</p>

                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full gradient-primary text-[11px] font-bold text-brand-foreground">C</span>
                  <span className="font-medium text-foreground/80">Equipe Coopaiba</span>
                  <span className="ml-auto flex items-center gap-1 font-semibold">
                    {course.is_paid ? (
                      course.promotional_price != null ? (
                        <>
                          <span className="line-through opacity-60">R$ {Number(course.price).toFixed(2)}</span>
                          <span className="text-primary">R$ {Number(course.promotional_price).toFixed(2)}</span>
                        </>
                      ) : (
                        <span className="text-primary">R$ {Number(course.price ?? 0).toFixed(2)}</span>
                      )
                    ) : (
                      <span className="rounded-full bg-success/12 px-2 py-0.5 text-success">Gratuito</span>
                    )}
                  </span>
                </div>

                {started && (
                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-bold text-primary">{progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full gradient-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                <div className="mt-5 flex gap-2 pt-4 border-t border-border/60">
                  <Button asChild size="sm" className="flex-1">
                    <Link to={`/courses/${course.id}`}>{started ? (progress === 100 ? "Revisar" : "Continuar") : "Começar"}</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link to={`/courses/${course.id}`}>Detalhes</Link>
                  </Button>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60">
                    <Button size="sm" variant="outline" onClick={() => openEdit(course)}>
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setFieldDayCourse({ id: course.id, title: course.title })}>
                      <MapPin className="w-3 h-3 mr-1" /> Dia de Campo
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteId(course.id)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Remover
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          );
        })}
      </div>
      </div>
      </div>
      )}




      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-heading">Nenhum curso encontrado</p>
          <p className="text-sm mt-1">
            {isAdmin ? "Clique em 'Novo Curso' para adicionar" : "Tente ajustar os filtros de busca"}
          </p>
        </div>
      )}

      {/* Save Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCourse ? "Editar Curso" : "Novo Curso"}</DialogTitle>
            <DialogDescription>Preencha as informações do curso</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nome do curso" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição do curso" />
            </div>
            <div className="space-y-2">
              <Label>Imagem do Curso</Label>
              {form.image && (
                <div className="relative w-full h-32 rounded-lg overflow-hidden bg-muted mb-2">
                  <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 h-7 w-7 p-0"
                    onClick={() => setForm({ ...form, image: "" })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="Cole a URL da imagem ou Google Drive"
                  className="flex-1"
                />
              </div>
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                {uploadingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Upload className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  {uploadingImage ? "Enviando imagem..." : "Enviar foto do PC ou smartphone"}
                </span>
                <input
                  ref={imageFileRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingImage(true);
                    try {
                      const url = await handleImageUpload(file);
                      setForm((prev) => ({ ...prev, image: url }));
                      toast({ title: "Imagem enviada!" });
                    } catch (err: any) {
                      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
                    } finally {
                      setUploadingImage(false);
                    }
                  }}
                />
              </label>
            </div>
            <div>
              <Label>Duração</Label>
              <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Ex: 12h" />
            </div>
            <div className="space-y-2">
              <Label>Vídeo de introdução do curso</Label>
              <Input
                value={form.intro_video_url}
                onChange={(e) => setForm({ ...form, intro_video_url: e.target.value })}
                placeholder="Cole link do YouTube, Vimeo ou .mp4 — ou envie um arquivo abaixo"
              />
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                {uploadingIntro ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Upload className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  {uploadingIntro
                    ? `Enviando vídeo... ${introProgress}%`
                    : "Enviar arquivo de vídeo (MP4/WebM, até 500MB)"}
                </span>
                <input
                  ref={introFileRef}
                  type="file"
                  className="hidden"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const maxBytes = 500 * 1024 * 1024;
                    if (file.size > maxBytes) {
                      toast({
                        title: "Arquivo muito grande",
                        description: "O vídeo deve ter no máximo 500MB.",
                        variant: "destructive",
                      });
                      if (introFileRef.current) introFileRef.current.value = "";
                      return;
                    }
                    setUploadingIntro(true);
                    setIntroProgress(0);
                    try {
                      const ext = file.name.split(".").pop() || "mp4";
                      const path = `courses/intro/${Date.now()}_${Math.random()
                        .toString(36)
                        .slice(2)}.${ext}`;
                      const { error } = await supabase.storage
                        .from("media")
                        .upload(path, file, {
                          contentType: file.type || "video/mp4",
                          upsert: false,
                        });
                      if (error) throw error;
                      setIntroProgress(100);
                      setForm((prev) => ({ ...prev, intro_video_url: path }));
                      toast({ title: "Vídeo enviado!" });
                    } catch (err: any) {
                      toast({
                        title: "Erro no upload",
                        description: err.message,
                        variant: "destructive",
                      });
                    } finally {
                      setUploadingIntro(false);
                      if (introFileRef.current) introFileRef.current.value = "";
                    }
                  }}
                />
              </label>
              {form.intro_video_url && (
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
                  <span className="truncate">{form.intro_video_url}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => setForm({ ...form, intro_video_url: "" })}
                  >
                    Remover
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Será exibido automaticamente ao aluno ao abrir o curso pela primeira vez.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.cooperado_only} onCheckedChange={(v) => setForm({ ...form, cooperado_only: v })} />
              <Label>Exclusivo para cooperados</Label>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border p-3">
              <Switch checked={form.is_open} onCheckedChange={(v) => setForm({ ...form, is_open: v })} />
              <div>
                <Label>Curso aberto</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando desativado, o curso fica fechado. Somente administradores podem alterar esta opção.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-border p-3">
              <Switch checked={form.eventual} onCheckedChange={(v) => setForm({ ...form, eventual: v })} />
              <div>
                <Label>Curso eventual</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cursos eventuais ficam ocultos da grade principal e só ficam disponíveis para alunos inscritos em campanhas de Cooperados Eventuais.
                </p>
              </div>
            </div>
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_paid}
                  onCheckedChange={(v) => setForm({ ...form, is_paid: v, price: v ? form.price : "", promotional_price: v ? form.promotional_price : "" })}
                />
                <Label>Curso pago</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {form.is_paid
                  ? "Defina o valor que o aluno pagará para acessar este curso."
                  : "Curso gratuito — qualquer aluno matriculado pode acessar."}
              </p>
              {form.is_paid && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Preço (R$) *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder="Ex: 29.90"
                    />
                  </div>
                  <div>
                    <Label>Preço promocional (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.promotional_price}
                      onChange={(e) => setForm({ ...form, promotional_price: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              )}
              {form.is_paid && (
                <div>
                  <Label>Duração do acesso (dias)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={form.standalone_access_days}
                    onChange={(e) => setForm({ ...form, standalone_access_days: e.target.value })}
                    placeholder="Deixe em branco para acesso vitalício"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Após a compra avulsa, o aluno terá acesso por esta quantidade de dias. Em branco = vitalício.
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.premium_enabled}
                onCheckedChange={(v) => setForm({ ...form, premium_enabled: v })}
              />
              <Label>Incluso no Premium</Label>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Quando ativo, assinantes Premium têm acesso a este curso. Desligue para vender apenas avulso.
            </p>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Switch
                checked={form.progressive_unlock}
                onCheckedChange={(v) => setForm({ ...form, progressive_unlock: v })}
              />
              <Label>Desbloqueio progressivo</Label>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Quando ativo, cada aula só é liberada após a anterior ser concluída, e cada avaliação só é liberada após todas as aulas do módulo (e avaliações anteriores) serem concluídas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.title || (form.is_paid && !form.price) || saveMutation.isPending}
              className="gradient-primary text-primary-foreground"
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover este curso? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-1">
              <Label htmlFor="preserve-history" className="text-sm font-medium">Manter histórico dos alunos</Label>
              <p className="text-xs text-muted-foreground">
                Preserva os registros dos alunos que concluíram o curso e os certificados já solicitados
                (permanecem válidos e verificáveis). Se desativado, esses dados serão apagados definitivamente.
              </p>
            </div>
            <Switch id="preserve-history" checked={preserveHistory} onCheckedChange={setPreserveHistory} />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removendo..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deleted courses / restore */}
      <Dialog open={trashOpen} onOpenChange={setTrashOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cursos excluídos</DialogTitle>
            <DialogDescription>
              Restaure um curso recentemente excluído. O conteúdo (módulos, aulas, avaliações e materiais) é recriado.
              Certificados e matrículas de concluintes só voltam se a exclusão foi feita com a opção de manter o histórico.
            </DialogDescription>
          </DialogHeader>

          {deletedCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum curso excluído disponível para restauração.</p>
          ) : (
            <div className="space-y-3">
              {deletedCourses.map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{d.course_title}</p>
                    <p className="text-xs text-muted-foreground">
                      Excluído em {new Date(d.deleted_at).toLocaleString("pt-BR")}
                    </p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${d.preserved_history ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {d.preserved_history
                        ? `Histórico preservado · ${d.certificate_ids?.length ?? 0} certificado(s)`
                        : "Histórico não preservado"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreMutation.mutate(d.course_id)}
                    disabled={restoreMutation.isPending}
                  >
                    {restoreMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3 mr-1" />
                    )}
                    Restaurar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>



    </div>
  );
}
