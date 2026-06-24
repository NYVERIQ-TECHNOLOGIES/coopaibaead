import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const TIPOS = ["dia_de_campo", "reuniao", "assembleia", "curso", "treinamento", "evento", "palestra", "oficina", "acao"];

export default function PresencaNovo() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [form, setForm] = useState({
    nome: "",
    tipo: "dia_de_campo",
    descricao: "",
    data: new Date().toISOString().slice(0, 10),
    horario: "",
    data_fim: "",
    horario_fim: "",
    local: "",
    responsavel: "",
    expected_count: "",
    course_id: "",
  });


  useEffect(() => {
    supabase.from("courses").select("id, title").order("title").then(({ data }) => {
      setCourses((data as any) || []);
    });
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    supabase.from("presenca_eventos").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error || !data) {
        toast({ title: "Erro ao carregar evento", description: error?.message, variant: "destructive" });
        return;
      }
      const d: any = data;
      setForm({
        nome: d.nome ?? "",
        tipo: d.tipo ?? "dia_de_campo",
        descricao: d.descricao ?? "",
        data: d.data ?? new Date().toISOString().slice(0, 10),
        horario: d.horario ? String(d.horario).slice(0, 5) : "",
        data_fim: d.data_fim ?? "",
        horario_fim: d.horario_fim ? String(d.horario_fim).slice(0, 5) : "",
        local: d.local ?? "",
        responsavel: d.responsavel ?? "",
        expected_count: d.expected_count ? String(d.expected_count) : "",
        course_id: d.course_id ?? "",
      });
    });
    supabase.from("presenca_evento_cursos" as any).select("curso_id").eq("evento_id", id).then(({ data }) => {
      setSelectedCourses(((data as any[]) || []).map((r) => r.curso_id));
    });
  }, [id, isEdit]);

  const toggleCourse = (cid: string) => {
    setSelectedCourses((prev) => prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]);
  };

  const syncCourses = async (eventoId: string) => {
    await supabase.from("presenca_evento_cursos" as any).delete().eq("evento_id", eventoId);
    if (selectedCourses.length > 0) {
      const rows = selectedCourses.map((curso_id) => ({ evento_id: eventoId, curso_id }));
      await supabase.from("presenca_evento_cursos" as any).insert(rows);
    }
  };

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setLoading(true);
    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      descricao: form.descricao || null,
      data: form.data,
      horario: form.horario || null,
      data_fim: form.data_fim || null,
      horario_fim: form.horario_fim || null,
      local: form.local || null,
      responsavel: form.responsavel || null,
      expected_count: form.expected_count ? parseInt(form.expected_count) : null,
      course_id: form.course_id || null,
    };

    if (isEdit && id) {
      const { error } = await supabase.from("presenca_eventos").update(payload as any).eq("id", id);
      if (error) {
        setLoading(false);
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return;
      }
      await syncCourses(id);
      setLoading(false);
      toast({ title: "Evento atualizado" });
      navigate(`/presenca/${id}`);
      return;
    }

    const { data, error } = await supabase
      .from("presenca_eventos")
      .insert({ ...payload, created_by: user?.id } as any)
      .select()
      .single();

    if (error) {
      setLoading(false);
      toast({ title: "Erro ao criar evento", description: error.message, variant: "destructive" });
      return;
    }
    await syncCourses(data.id);
    setLoading(false);
    toast({ title: "Evento criado", description: `Código: ${data.codigo}` });
    navigate(`/presenca/${data.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
          {isEdit ? "Editar Evento" : "Novo Dia de Campo"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEdit ? "Atualize os dados do evento." : "Crie um evento, vincule a um curso e gere a lista de presença digital."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <Label>Nome do evento *</Label>
          <Input value={form.nome} onChange={(e) => update("nome", e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Tipo</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm capitalize"
              value={form.tipo} onChange={(e) => update("tipo", e.target.value)}>
              {TIPOS.map((t) => <option key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsavel} onChange={(e) => update("responsavel", e.target.value)} />
          </div>
          <div>
            <Label>Data de início *</Label>
            <Input type="date" value={form.data} onChange={(e) => update("data", e.target.value)} required />
          </div>
          <div>
            <Label>Horário de início</Label>
            <Input type="time" value={form.horario} onChange={(e) => update("horario", e.target.value)} />
          </div>
          <div>
            <Label>Data de término</Label>
            <Input type="date" value={form.data_fim} onChange={(e) => update("data_fim", e.target.value)} />
          </div>
          <div>
            <Label>Horário de término</Label>
            <Input type="time" value={form.horario_fim} onChange={(e) => update("horario_fim", e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">O evento será encerrado automaticamente ao atingir esse horário.</p>
          </div>

          <div className="sm:col-span-2">
            <Label>Local</Label>
            <Input value={form.local} onChange={(e) => update("local", e.target.value)} />
          </div>
          <div>
            <Label>Participantes esperados</Label>
            <Input type="number" min="1" value={form.expected_count} onChange={(e) => update("expected_count", e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Cursos vinculados</Label>
          <p className="text-xs text-muted-foreground mb-2">Selecione um ou mais cursos para liberar aos participantes deste evento.</p>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum curso disponível.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto border border-border rounded-md p-3 space-y-2 bg-background">
              {courses.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={selectedCourses.includes(c.id)}
                    onChange={() => toggleCourse(c.id)}
                  />
                  <span>{c.title}</span>
                </label>
              ))}
            </div>
          )}
          {selectedCourses.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">{selectedCourses.length} curso(s) selecionado(s)</p>
          )}
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea rows={3} value={form.descricao} onChange={(e) => update("descricao", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate("/presenca")}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar evento"}
          </Button>
        </div>
      </form>
    </div>
  );
}
