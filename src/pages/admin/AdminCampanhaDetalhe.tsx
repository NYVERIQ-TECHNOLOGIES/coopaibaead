import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { maskCPF } from "@/lib/cpf";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function AdminCampanhaDetalhe() {
  const { id } = useParams();
  const [camp, setCamp] = useState<any>(null);
  const [inscritos, setInscritos] = useState<any[]>([]);
  const [cursosAll, setCursosAll] = useState<any[]>([]);
  const [vinculados, setVinculados] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState("");
  const [cancelar, setCancelar] = useState<any>(null);
  const [motivo, setMotivo] = useState("");
  const [progresso, setProgresso] = useState<Map<string, { pct: number; concluido: boolean }>>(new Map());

  const load = async () => {
    if (!id) return;
    const [{ data: c }, { data: ins }, { data: cu }, { data: vinc }] = await Promise.all([
      supabase.from("cooperados_eventuais_campanhas").select("*").eq("id", id).maybeSingle(),
      supabase.from("cooperados_eventuais_inscricoes").select("*").eq("campanha_id", id).order("data_inscricao", { ascending: false }),
      supabase.from("courses").select("id, title").eq("eventual", true).order("title"),
      supabase.from("cooperados_eventuais_cursos").select("curso_id").eq("campanha_id", id),
    ]);
    setCamp(c);
    setInscritos(ins || []);
    setCursosAll(cu || []);
    setVinculados(new Set((vinc || []).map((v: any) => v.curso_id)));

    const cursoIds = (vinc || []).map((v: any) => v.curso_id);
    const userIds = Array.from(new Set((ins || []).map((i: any) => i.usuario_id).filter(Boolean))) as string[];
    if (cursoIds.length && userIds.length) {
      // Progresso real: aulas concluídas + avaliações aprovadas (>=70) + certificado emitido
      const [{ data: mods }, { data: evals }, { data: certs }] = await Promise.all([
        supabase.from("course_modules").select("id, course_id").in("course_id", cursoIds),
        supabase.from("course_evaluations").select("id, course_id").in("course_id", cursoIds).eq("status", "publicada"),
        supabase.from("certificates").select("user_id, course_id, status").in("course_id", cursoIds).in("user_id", userIds),
      ]);
      const modIds = (mods || []).map((m: any) => m.id);
      const { data: lessons } = modIds.length
        ? await supabase.from("course_lessons").select("id, module_id").in("module_id", modIds)
        : { data: [] as any[] };
      const lessonIds = (lessons || []).map((l: any) => l.id);
      const evalIds = (evals || []).map((e: any) => e.id);
      const [{ data: lcs }, { data: atts }] = await Promise.all([
        lessonIds.length
          ? supabase.from("lesson_completions").select("user_id, lesson_id").in("lesson_id", lessonIds).in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
        evalIds.length
          ? supabase.from("exam_attempts").select("user_id, evaluation_id, score").in("evaluation_id", evalIds).in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const modCourse = new Map((mods || []).map((m: any) => [m.id, m.course_id]));
      const lessonCourse = new Map((lessons || []).map((l: any) => [l.id, modCourse.get(l.module_id)]));
      const evalCourse = new Map((evals || []).map((e: any) => [e.id, e.course_id]));
      const unitsPorCurso = new Map<string, number>();
      cursoIds.forEach((cid: string) => {
        const nLessons = (lessons || []).filter((l: any) => lessonCourse.get(l.id) === cid).length;
        const nEvals = (evals || []).filter((e: any) => e.course_id === cid).length;
        unitsPorCurso.set(cid, nLessons + nEvals);
      });

      const m = new Map<string, { pct: number; concluido: boolean }>();
      userIds.forEach((u) => {
        const doneLessons = new Set((lcs || []).filter((x: any) => x.user_id === u).map((x: any) => x.lesson_id));
        const passedEvals = new Set(
          (atts || []).filter((x: any) => x.user_id === u && Number(x.score) >= 70).map((x: any) => x.evaluation_id)
        );
        const userCerts = new Set(
          (certs || [])
            .filter((c: any) => c.user_id === u && c.status !== "cancelado" && c.status !== "erro")
            .map((c: any) => c.course_id)
        );
        let somaPct = 0;
        let cursosConcluidos = 0;
        cursoIds.forEach((cid: string) => {
          const units = unitsPorCurso.get(cid) || 0;
          const done =
            Array.from(doneLessons).filter((lid) => lessonCourse.get(lid) === cid).length +
            Array.from(passedEvals).filter((eid) => evalCourse.get(eid) === cid).length;
          const completo = userCerts.has(cid) || (units > 0 && done >= units);
          const pctCurso = completo ? 100 : units > 0 ? Math.min(100, Math.round((done / units) * 100)) : 0;
          somaPct += pctCurso;
          if (completo) cursosConcluidos++;
        });
        const pct = Math.round(somaPct / cursoIds.length);
        m.set(u, { pct, concluido: cursosConcluidos === cursoIds.length });
      });
      setProgresso(m);
    } else {
      setProgresso(new Map());
    }
  };
  useEffect(() => {
    load();
    if (!id) return;
    const ch = supabase.channel(`adm-camp-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cooperados_eventuais_inscricoes", filter: `campanha_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "enrollments" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [id]);

  const filtered = useMemo(() => {
    const t = filtro.toLowerCase();
    if (!t) return inscritos;
    return inscritos.filter((i) => [i.nome_completo, i.cpf, i.email, i.cidade, i.protocolo]
      .some((v) => (v || "").toLowerCase().includes(t)));
  }, [inscritos, filtro]);

  const toggleCurso = async (curso_id: string, on: boolean) => {
    if (on) {
      await supabase.from("cooperados_eventuais_cursos").insert({ campanha_id: id, curso_id });
    } else {
      await supabase.from("cooperados_eventuais_cursos").delete().eq("campanha_id", id).eq("curso_id", curso_id);
    }
    load();
  };

  const doCancel = async () => {
    if (!cancelar || !motivo.trim()) return toast.error("Informe o motivo");
    const { error } = await supabase.rpc("cancelar_inscricao_eventual", { _id: cancelar.id, _motivo: motivo });
    if (error) return toast.error(error.message);
    toast.success("Inscrição cancelada");
    setCancelar(null); setMotivo("");
    load();
  };

  const exportCSV = () => {
    const headers = ["protocolo","nome","cpf","rg","email","telefone","cidade","estado","status","data_inscricao"];
    const rows = filtered.map(i => [i.protocolo,i.nome_completo,i.cpf,i.rg,i.email,i.telefone,i.cidade,i.estado,i.status,i.data_inscricao]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `inscritos-${camp?.nome || id}.csv`; a.click();
  };
  const exportXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map(i => ({
      Protocolo: i.protocolo, Nome: i.nome_completo, CPF: maskCPF(i.cpf), RG: i.rg, Email: i.email,
      Telefone: i.telefone, Cidade: i.cidade, Estado: i.estado, Status: i.status,
      "Data Inscrição": new Date(i.data_inscricao).toLocaleString("pt-BR"),
    })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inscritos");
    XLSX.writeFile(wb, `inscritos-${camp?.nome || id}.xlsx`);
  };
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Inscritos — ${camp?.nome || ""}`, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Protocolo","Nome","CPF","Cidade/UF","Data"]],
      body: filtered.map(i => [i.protocolo, i.nome_completo, maskCPF(i.cpf), `${i.cidade}/${i.estado}`, new Date(i.data_inscricao).toLocaleString("pt-BR")]),
      styles: { fontSize: 8 },
    });
    doc.save(`inscritos-${camp?.nome || id}.pdf`);
  };

  // Gráficos
  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    inscritos.forEach(i => {
      const d = new Date(i.data_inscricao).toLocaleDateString("pt-BR");
      m.set(d, (m.get(d) || 0) + 1);
    });
    return Array.from(m, ([dia, qtd]) => ({ dia, qtd })).slice(-14);
  }, [inscritos]);
  const porEstado = useMemo(() => {
    const m = new Map<string, number>();
    inscritos.forEach(i => m.set(i.estado, (m.get(i.estado) || 0) + 1));
    return Array.from(m, ([estado, qtd]) => ({ estado, qtd }));
  }, [inscritos]);

  if (!camp) return <div className="container mx-auto p-8">Carregando…</div>;
  const pct = Math.min(100, Math.round((camp.vagas_ocupadas / camp.limite_vagas) * 100));

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Button asChild variant="ghost" className="mb-4">
        <Link to="/admin/cooperados-eventuais"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Link>
      </Button>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">{camp.nome}</h1>
          <p className="text-sm text-muted-foreground">{camp.descricao}</p>
        </div>
        <Badge variant={camp.status === "ativa" ? "default" : "secondary"}>{camp.status}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Vagas</div><div className="text-2xl font-bold">{camp.limite_vagas}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Inscritos</div><div className="text-2xl font-bold">{camp.vagas_ocupadas}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Disponíveis</div><div className="text-2xl font-bold">{camp.limite_vagas - camp.vagas_ocupadas}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Ocupação</div><div className="text-2xl font-bold">{pct}%</div><Progress value={pct} className="mt-2 h-2" /></CardContent></Card>
      </div>

      <Tabs defaultValue="inscritos">
        <TabsList>
          <TabsTrigger value="inscritos">Inscritos</TabsTrigger>
          <TabsTrigger value="cursos">Cursos Vinculados</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="inscritos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <Input placeholder="Buscar por nome, CPF, e-mail…" value={filtro} onChange={(e) => setFiltro(e.target.value)} className="max-w-sm" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-1" />CSV</Button>
                <Button size="sm" variant="outline" onClick={exportXLSX}><FileSpreadsheet className="w-4 h-4 mr-1" />Excel</Button>
                <Button size="sm" variant="outline" onClick={exportPDF}><FileText className="w-4 h-4 mr-1" />PDF</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                    <TableRow>
                      <TableHead>Protocolo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="min-w-[140px]">Progresso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((i) => {
                      const prog = i.usuario_id ? progresso.get(i.usuario_id) : undefined;
                      return (
                        <TableRow key={i.id}>
                          <TableCell className="font-mono text-xs">{i.protocolo}</TableCell>
                          <TableCell>{i.nome_completo}</TableCell>
                          <TableCell>{maskCPF(i.cpf)}</TableCell>
                          <TableCell className="text-xs">{i.telefone}</TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={i.endereco}>{i.endereco}</TableCell>
                          <TableCell className="text-xs">{new Date(i.data_inscricao).toLocaleString("pt-BR")}</TableCell>
                          <TableCell>
                            {prog ? (
                              prog.concluido ? (
                                <Badge className="bg-primary text-primary-foreground">Concluído</Badge>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Progress value={prog.pct} className="h-2 w-20" />
                                  <span className="text-xs text-muted-foreground">{prog.pct}%</span>
                                </div>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell><Badge variant={i.status === "aprovada" ? "default" : i.status === "cancelada" ? "destructive" : "secondary"}>{i.status}</Badge></TableCell>
                          <TableCell>
                            {i.status !== "cancelada" && (
                              <Button size="sm" variant="ghost" onClick={() => setCancelar(i)}>Cancelar</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum inscrito</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cursos">
          <Card>
            <CardHeader><CardTitle>Selecione os cursos liberados aos inscritos</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2">
              {cursosAll.map((c) => (
                <label key={c.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted cursor-pointer">
                  <Checkbox checked={vinculados.has(c.id)} onCheckedChange={(v) => toggleCurso(c.id, !!v)} />
                  <span>{c.title}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Inscrições por dia</CardTitle></CardHeader>
              <CardContent style={{ height: 280 }}>
                <ResponsiveContainer><BarChart data={porDia}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dia" /><YAxis /><Tooltip />
                  <Bar dataKey="qtd" fill="hsl(var(--primary))" />
                </BarChart></ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Inscrições por estado</CardTitle></CardHeader>
              <CardContent style={{ height: 280 }}>
                <ResponsiveContainer><BarChart data={porEstado}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="estado" /><YAxis /><Tooltip />
                  <Bar dataKey="qtd" fill="hsl(var(--primary))" />
                </BarChart></ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!cancelar} onOpenChange={(o) => !o && setCancelar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar inscrição</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Inscrito: <strong>{cancelar?.nome_completo}</strong></p>
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelar(null)}>Voltar</Button>
            <Button variant="destructive" onClick={doCancel}>Cancelar inscrição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
