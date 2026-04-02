import { motion } from "framer-motion";
import { useState } from "react";
import { Plus, Search, FileText, Video, Headphones, Trash2, Edit, BookOpen, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const typeIcons: Record<string, typeof FileText> = { pdf: FileText, video: Video, video_aula: Video, audio: Headphones };
const typeLabels: Record<string, string> = { pdf: "PDF", video: "Vídeo", video_aula: "Vídeo Aula", audio: "Áudio" };
const typeColors: Record<string, string> = {
  pdf: "text-destructive bg-destructive/10",
  video: "text-primary bg-primary/10",
  video_aula: "text-accent bg-accent/10",
  audio: "text-secondary bg-secondary/10",
};

const emptyForm = { title: "", description: "", file_type: "pdf", file_url: "", file_size: "", course_id: "", module_name: "", cooperado_only: false };

export default function SupplementaryMaterials() {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["media-materials"],
    queryFn: async () => {
      const { data } = await supabase.from("media_files").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-select"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").order("title");
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof emptyForm) => {
      const payload = {
        title: values.title, description: values.description || null, file_type: values.file_type,
        file_url: values.file_url || "", file_size: values.file_size || null,
        course_id: values.course_id || null, module_name: values.module_name || null,
        cooperado_only: values.cooperado_only,
      };
      if (editingId) {
        const { error } = await supabase.from("media_files").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("media_files").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-materials"] });
      setDialogOpen(false);
      toast({ title: "Material salvo com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("media_files").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-materials"] });
      setDeleteId(null);
      toast({ title: "Material removido" });
    },
  });

  const filtered = materials.filter((m: any) => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || m.file_type === filterType;
    return matchSearch && matchType;
  });

  const typeCounts: Record<string, number> = {
    all: materials.length,
    pdf: materials.filter((m: any) => m.file_type === "pdf").length,
    video: materials.filter((m: any) => m.file_type === "video").length,
    video_aula: materials.filter((m: any) => m.file_type === "video_aula").length,
  };

  function openNew() { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(mat: any) {
    setEditingId(mat.id);
    setForm({ title: mat.title, description: mat.description || "", file_type: mat.file_type, file_url: mat.file_url, file_size: mat.file_size || "", course_id: mat.course_id || "", module_name: mat.module_name || "", cooperado_only: mat.cooperado_only });
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Materiais Complementares</h1>
          <p className="text-muted-foreground mt-1">Recursos adicionais vinculados aos cursos</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="gradient-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Novo Material
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pdf", "video", "video_aula"] as const).map((t) => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {t === "all" ? "Todos" : typeLabels[t] || t} ({typeCounts[t] || 0})
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por título..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mat: any, i: number) => {
            const Icon = typeIcons[mat.file_type] ?? FileText;
            const color = typeColors[mat.file_type] ?? "text-muted-foreground bg-muted";
            return (
              <motion.div key={mat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-card rounded-xl shadow-card border border-border hover:shadow-elevated transition-shadow group">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1">
                      {mat.cooperado_only && <Badge variant="secondary" className="text-[10px]">Cooperado</Badge>}
                      <Badge variant="outline" className="text-[10px]">{typeLabels[mat.file_type] || mat.file_type}</Badge>
                    </div>
                  </div>
                  <h3 className="font-heading font-semibold text-sm text-card-foreground line-clamp-2">{mat.title}</h3>
                  {mat.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mat.description}</p>}
                  {mat.module_name && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-2">
                      <BookOpen className="w-3 h-3" /> {mat.module_name}
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center justify-end px-4 py-2.5 border-t border-border gap-0.5">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(mat)}><Edit className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDeleteId(mat.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </div>
                )}
              </motion.div>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum material encontrado</div>}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Material" : "Novo Material"}</DialogTitle>
            <DialogDescription>Vincule recursos aos cursos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.file_type} onValueChange={(v) => setForm({ ...form, file_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="video_aula">Vídeo Aula</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Tamanho</Label><Input value={form.file_size} onChange={(e) => setForm({ ...form, file_size: e.target.value })} placeholder="Ex: 2.4 MB" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Curso</Label>
                <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Módulo</Label><Input value={form.module_name} onChange={(e) => setForm({ ...form, module_name: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>URL do Arquivo</Label><Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.cooperado_only} onCheckedChange={(v) => setForm({ ...form, cooperado_only: v })} /><Label>Exclusivo para cooperados</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gradient-primary text-primary-foreground">
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
