import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProfessorStats, brl } from "./ProfessorDashboard";

type Filter = "todos" | "gratuito" | "pago";

export default function ProfessorRelatorios({ professorId }: { professorId?: string | null }) {
  const { data: stats, isLoading } = useProfessorStats(professorId);
  const [courseId, setCourseId] = useState<string>("todos");
  const [tipo, setTipo] = useState<Filter>("todos");
  const [status, setStatus] = useState<"todos" | "ativos" | "rascunho">("todos");
  const [busca, setBusca] = useState("");

  const rows = useMemo(() => {
    const list = stats?.by_course ?? [];
    return list.filter((c) => {
      if (courseId !== "todos" && c.course_id !== courseId) return false;
      if (tipo === "pago" && !c.is_paid) return false;
      if (tipo === "gratuito" && c.is_paid) return false;
      if (status === "ativos" && !c.is_active) return false;
      if (status === "rascunho" && c.is_active) return false;
      if (busca && !c.title.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [stats, courseId, tipo, status, busca]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!stats) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Sem dados disponíveis.</CardContent></Card>;
  }

  const totalCerts = rows.reduce((s, c) => s + Number(c.certificates ?? 0), 0);
  const totalRevenue = rows.reduce((s, c) => s + Number(c.revenue ?? 0), 0);
  const totalSales = rows.reduce((s, c) => s + Number(c.sales ?? 0), 0);
  const totalStudents = rows.reduce((s, c) => s + Number(c.students ?? 0), 0);
  const ticket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const topCourse = [...rows].sort((a, b) => Number(b.revenue) - Number(a.revenue))[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Dados exclusivos dos seus cursos</p>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Curso</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os cursos</SelectItem>
                {(stats.by_course ?? []).map((c) => (
                  <SelectItem key={c.course_id} value={c.course_id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Filter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="gratuito">Gratuito</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Buscar</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do curso" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="certificados">
        <TabsList>
          <TabsTrigger value="certificados">Certificados</TabsTrigger>
          <TabsTrigger value="financeiro">Receita dos Meus Cursos</TabsTrigger>
        </TabsList>

        <TabsContent value="certificados" className="mt-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Certificados por curso</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="p-3">Curso</th>
                      <th className="p-3">Alunos</th>
                      <th className="p-3">Certificados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.course_id} className="border-b border-border/60">
                        <td className="p-3 font-medium">{c.title}</td>
                        <td className="p-3">{c.students}</td>
                        <td className="p-3">{c.certificates}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhum curso encontrado</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="p-3">TOTAL</td>
                      <td className="p-3">{totalStudents}</td>
                      <td className="p-3">{totalCerts}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financeiro" className="mt-3 space-y-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Receita bruta</p><p className="text-lg font-bold">{brl(totalRevenue)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Vendas</p><p className="text-lg font-bold">{totalSales}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ticket médio</p><p className="text-lg font-bold">{brl(ticket)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Maior receita</p><p className="text-sm font-semibold truncate">{topCourse?.title ?? "—"}</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="p-3">Curso</th>
                      <th className="p-3">Alunos pagantes</th>
                      <th className="p-3">Vendas</th>
                      <th className="p-3">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.filter((c) => c.is_paid).map((c) => (
                      <tr key={c.course_id} className="border-b border-border/60">
                        <td className="p-3 font-medium">{c.title}</td>
                        <td className="p-3">{c.sales}</td>
                        <td className="p-3">{c.sales}</td>
                        <td className="p-3">{brl(Number(c.revenue))}</td>
                      </tr>
                    ))}
                    {rows.filter((c) => c.is_paid).length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum curso pago</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
