import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [form, setForm] = useState({
    nome: "",
    tipo: "dia_de_campo",
    descricao: "",
    data: new Date().toISOString().slice(0, 10),
    horario: "",
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

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("presenca_eventos")
      .insert({
        nome: form.nome.trim(),
        tipo: form.tipo,
        descricao: form.descricao || null,
        data: form.data,
        horario: form.horario || null,
        local: form.local || null,
        responsavel: form.responsavel || null,
        expected_count: form.expected_count ? parseInt(form.expected_count) : null,
        course_id: form.course_id || null,
        created_by: user?.id,
      } as any)
      .select()
      .single();
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao criar evento", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Evento criado", description: `Código: ${data.codigo}` });
    navigate(`/presenca/${data.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Novo Dia de Campo</h1>
        <p className="text-muted-foreground mt-1">Crie um evento, vincule a um curso e gere a lista de presença digital.</p>
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
            <Label>Curso vinculado</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.course_id} onChange={(e) => update("course_id", e.target.value)}>
              <option value="">Nenhum</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsavel} onChange={(e) => update("responsavel", e.target.value)} />
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="date" value={form.data} onChange={(e) => update("data", e.target.value)} required />
          </div>
          <div>
            <Label>Horário</Label>
            <Input type="time" value={form.horario} onChange={(e) => update("horario", e.target.value)} />
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
          <Label>Descrição</Label>
          <Textarea rows={3} value={form.descricao} onChange={(e) => update("descricao", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate("/presenca")}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? "Criando..." : "Criar evento"}</Button>
        </div>
      </form>
    </div>
  );
}
