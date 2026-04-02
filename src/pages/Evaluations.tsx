import { motion } from "framer-motion";
import { useState } from "react";
import { Plus, Search, Clock, FileQuestion, BarChart3, Trash2, Edit, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const typeLabels: Record<string, string> = { prova: "Prova", exercicio: "Exercício", simulado: "Simulado" };
const statusStyles: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  publicada: "bg-success/10 text-success",
  encerrada: "bg-destructive/10 text-destructive",
};

const emptyForm = { title: "", course_id: "", type: "prova", duration: 60, questions: 10, status: "rascunho" };

export default function Evaluations() {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: ["evaluations"],
    queryFn: async () => {
      const { data } = await supabase.from("course_evaluations").select("*, courses(title)").order("created_at", { ascending: false });
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
      const payload = { title: values.title, course_id: values.course_id, type: values.type, duration: Number(values.duration), questions: Number(values.questions), status: values.status };
      if (editingId) {
        const { error } = await supabase.from("course_evaluations").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_evaluations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      setDialogOpen(false);
      toast({ title: "Avaliação salva com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_evaluations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      setDeleteId(null);
      toast({ title: "Avaliação removida" });
    },
  });

  const toggleStatus = async (ev: any) => {
    const next = ev.status === "rascunho" ? "publicada" : ev.status === "publicada" ? "encerrada" : "rascunho";
    await supabase.from("course_evaluations").update({ status: next }).eq("id", ev.id);
    queryClient.invalidateQueries({ queryKey: ["evaluations"] });
  };

  const filtered = evaluations.filter((e: any) => e.title.toLowerCase().includes(search.toLowerCase()));

  function openNew() { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(ev: any) {
    setEditingId(ev.id);
    setForm({ title: ev.title, course_id: ev.course_id, type: ev.type, duration: ev.duration, questions: ev.questions, status: ev.status });
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Avaliações</h1>
          <p className="text-muted-foreground mt-1">Gerencie provas, exercícios e simulados</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="gradient-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Nova Avaliação
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Total", value: evaluations.length, icon: FileQuestion, color: "text-primary" },
          { label: "Publicadas", value: evaluations.filter((e: any) => e.status === "publicada").length, icon: CheckCircle, color: "text-success" },
          { label: "Rascunhos", value: evaluations.filter((e: any) => e.status === "rascunho").length, icon: Clock, color: "text-accent" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl p-4 shadow-card border border-border">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <p className="text-2xl font-heading font-bold text-card-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar avaliações..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev: any, i: number) => (
            <motion.div key={ev.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-card rounded-xl p-4 shadow-card border border-border hover:shadow-elevated transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-semibold text-card-foreground">{ev.title}</h3>
                    <Badge variant="outline" className={statusStyles[ev.status] || ""}>{ev.status === "rascunho" ? "Rascunho" : ev.status === "publicada" ? "Publicada" : "Encerrada"}</Badge>
                    <Badge variant="secondary">{typeLabels[ev.type] || ev.type}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span>{(ev as any).courses?.title ?? "—"}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {ev.duration}min</span>
                    <span className="flex items-center gap-1"><FileQuestion className="w-3 h-3" /> {ev.questions} questões</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(ev)}><Edit className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleStatus(ev)}>
                      {ev.status === "publicada" ? <XCircle className="w-4 h-4 text-destructive" /> : <CheckCircle className="w-4 h-4 text-success" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(ev.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">Nenhuma avaliação encontrada</div>}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Avaliação" : "Nova Avaliação"}</DialogTitle>
            <DialogDescription>Preencha os dados da avaliação</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nome da avaliação" />
            </div>
            <div className="space-y-2">
              <Label>Curso</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
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
                <Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Questões</Label>
                <Input type="number" value={form.questions} onChange={(e) => setForm({ ...form, questions: Number(e.target.value) })} />
              </div>
            </div>
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
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
