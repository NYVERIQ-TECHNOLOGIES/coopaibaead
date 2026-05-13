import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Pencil, Trash2, Lock, Upload, Loader2, Image } from "lucide-react";
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
  is_paid: boolean;
  price: number | null;
  promotional_price: number | null;
  created_at: string;
}

const emptyForm = {
  title: "",
  description: "",
  image: "",
  duration: "",
  cooperado_only: false,
  is_paid: false,
  price: "" as string,
  promotional_price: "" as string,
};

export default function Courses() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "cooperado">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const { role } = useAuth();
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
        cooperado_only: values.cooperado_only,
        is_paid: values.is_paid,
        price: values.is_paid && values.price ? Number(values.price) : null,
        promotional_price: values.is_paid && values.promotional_price ? Number(values.promotional_price) : null,
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
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      setDeleteId(null);
      toast({ title: "Curso removido" });
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
      cooperado_only: c.cooperado_only,
      is_paid: c.is_paid ?? false,
      price: c.price != null ? String(c.price) : "",
      promotional_price: c.promotional_price != null ? String(c.promotional_price) : "",
    });
    setDialogOpen(true);
  };

  const filtered = courses.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.cooperado_only;
    return matchSearch && matchFilter;
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
          <Button onClick={openNew} className="gradient-primary text-primary-foreground w-fit">
            <Plus className="w-4 h-4 mr-2" /> Novo Curso
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar cursos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilter("all")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            Todos
          </button>
          <button onClick={() => setFilter("cooperado")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === "cooperado" ? "bg-secondary text-secondary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            Cooperados
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((course, i) => (
          <motion.div key={course.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card hover:shadow-elevated transition-shadow group">
              <Link to={`/courses/${course.id}`}>
                <div className="relative h-40 bg-muted">
                  {course.image ? (
                    <SignedImage path={course.image} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Sem imagem</div>
                  )}
                  {course.cooperado_only && (
                    <span className="absolute top-2 right-2 bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Cooperado
                    </span>
                  )}
                </div>
              </Link>
              <div className="p-4">
                <Link to={`/courses/${course.id}`}>
                  <h3 className="font-heading font-semibold text-foreground line-clamp-1 hover:text-primary transition-colors">{course.title}</h3>
                </Link>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{course.description || "Sem descrição"}</p>
                {course.duration && <p className="text-xs text-muted-foreground mt-2">⏱ {course.duration}</p>}
                {isAdmin && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" onClick={() => openEdit(course)}>
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteId(course.id)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Remover
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

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
        <DialogContent>
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
            <div className="flex items-center gap-2">
              <Switch checked={form.cooperado_only} onCheckedChange={(v) => setForm({ ...form, cooperado_only: v })} />
              <Label>Exclusivo para cooperados</Label>
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
            </div>
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
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover este curso? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
