import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function AdminCampanhas() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    nome: "", descricao: "", data_inicio: "", data_fim: "",
    limite_vagas: 100, manter_acesso_cursos: true, aprovacao_automatica: true,
  });

  const load = async () => {
    const { data } = await supabase
      .from("cooperados_eventuais_campanhas").select("*")
      .order("created_at", { ascending: false });
    setList(data || []);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    const hoje = new Date().toISOString().slice(0, 10);
    const fim = new Date(); fim.setMonth(fim.getMonth() + 1);
    setForm({
      nome: "", descricao: "", data_inicio: hoje, data_fim: fim.toISOString().slice(0, 10),
      limite_vagas: 100, manter_acesso_cursos: true, aprovacao_automatica: true,
    });
    setOpen(true);
  };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      nome: c.nome, descricao: c.descricao || "",
      data_inicio: c.data_inicio, data_fim: c.data_fim,
      limite_vagas: c.limite_vagas,
      manter_acesso_cursos: c.manter_acesso_cursos,
      aprovacao_automatica: c.aprovacao_automatica,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome");
    if (editing) {
      const { error } = await supabase.from("cooperados_eventuais_campanhas")
        .update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("cooperados_eventuais_campanhas").insert(form);
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo");
    setOpen(false);
    load();
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from("cooperados_eventuais_campanhas").update({ status }).eq("id", id);
    toast.success("Status atualizado");
    load();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Gestão de Cooperados Eventuais</h1>
            <p className="text-sm text-muted-foreground">Campanhas, vagas e inscritos</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nova Campanha</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Campanhas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Vagas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(c.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")} —{" "}
                    {new Date(c.data_fim + "T00:00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>{c.vagas_ocupadas}/{c.limite_vagas}</TableCell>
                  <TableCell><Badge variant={c.status === "ativa" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/cooperados-eventuais/${c.id}`}><ExternalLink className="w-3 h-3 mr-1" />Abrir</Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>Editar</Button>
                    {c.status === "ativa" && <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, "encerrada")}>Encerrar</Button>}
                    {c.status === "encerrada" && <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, "ativa")}>Reabrir</Button>}
                    {c.status !== "arquivada" && <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, "arquivada")}>Arquivar</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma campanha</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar campanha" : "Nova campanha"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div><Label>Data fim</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            <div><Label>Limite de vagas</Label><Input type="number" min={1} value={form.limite_vagas} onChange={(e) => setForm({ ...form, limite_vagas: parseInt(e.target.value) || 0 })} /></div>
            <div className="flex items-center justify-between"><Label>Aprovação automática</Label>
              <Switch checked={form.aprovacao_automatica} onCheckedChange={(v) => setForm({ ...form, aprovacao_automatica: v })} /></div>
            <div className="flex items-center justify-between"><Label>Manter acesso aos cursos após encerrar</Label>
              <Switch checked={form.manter_acesso_cursos} onCheckedChange={(v) => setForm({ ...form, manter_acesso_cursos: v })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
