import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, KeyRound, Pencil, BarChart3, Search } from "lucide-react";
import { ProfessorStatsView, useProfessorStats, brl } from "./professor/ProfessorDashboard";

interface ProfessorRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
  is_active: boolean;
  created_at: string;
  total_courses: number;
  total_students: number;
  total_certificates: number;
  total_revenue: number;
}

const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  avatar_url: "",
  area_atuacao: "",
  especialidade: "",
  is_active: true,
};

function ProfessorDetail({ professorId }: { professorId: string }) {
  const { data: stats, isLoading } = useProfessorStats(professorId);
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!stats) return <p className="text-muted-foreground text-sm">Sem dados.</p>;
  return <ProfessorStatsView stats={stats} />;
}

export default function AdminProfessores() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProfessorRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [passwordFor, setPasswordFor] = useState<ProfessorRow | null>(null);
  const [newPassword, setNewPassword] = useState("Coopaiba@2026");
  const [detailFor, setDetailFor] = useState<ProfessorRow | null>(null);

  const { data: professors = [], isLoading } = useQuery({
    queryKey: ["professors"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_professors");
      if (error) throw error;
      return (data ?? []) as ProfessorRow[];
    },
  });

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("create-professor", { body });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return invoke({
          action: "update",
          user_id: editing.user_id,
          full_name: form.full_name,
          phone: form.phone || null,
          avatar_url: form.avatar_url || null,
          area_atuacao: form.area_atuacao || null,
          especialidade: form.especialidade || null,
          is_active: form.is_active,
        });
      }
      return invoke({ action: "create", ...form });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["professors"] });
      setDialogOpen(false);
      toast({ title: editing ? "Professor atualizado" : "Professor criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ p, active }: { p: ProfessorRow; active: boolean }) =>
      invoke({ action: "update", user_id: p.user_id, is_active: active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["professors"] });
      toast({ title: "Status atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const passwordMutation = useMutation({
    mutationFn: async () =>
      invoke({ action: "reset_password", user_id: passwordFor!.user_id, password: newPassword }),
    onSuccess: () => {
      setPasswordFor(null);
      toast({ title: "Senha redefinida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: ProfessorRow) => {
    setEditing(p);
    setForm({
      full_name: p.full_name ?? "",
      email: "",
      password: "",
      phone: p.phone ?? "",
      avatar_url: p.avatar_url ?? "",
      area_atuacao: p.area_atuacao ?? "",
      especialidade: p.especialidade ?? "",
      is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const filtered = professors.filter((p) =>
    (p.full_name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground">Professores</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Crie e acompanhe as contas de professores da plataforma
          </p>
        </div>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" /> Novo Professor
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar professor..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="sticky top-0 bg-card border-b border-border z-10">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-3">Professor</th>
                  <th className="p-3">Cursos</th>
                  <th className="p-3">Alunos</th>
                  <th className="p-3">Certificados</th>
                  <th className="p-3">Receita</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="p-6"><Skeleton className="h-6 w-full" /></td></tr>
                )}
                {!isLoading && filtered.map((p) => (
                  <tr key={p.user_id} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="p-3">
                      <p className="font-medium text-foreground">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[p.area_atuacao, p.especialidade].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="p-3">{p.total_courses}</td>
                    <td className="p-3">{p.total_students}</td>
                    <td className="p-3">{p.total_certificates}</td>
                    <td className="p-3">{brl(Number(p.total_revenue))}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.is_active}
                          onCheckedChange={(v) => statusMutation.mutate({ p, active: v })}
                        />
                        <Badge variant={p.is_active ? "secondary" : "outline"}>
                          {p.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => setDetailFor(p)}>
                          <BarChart3 className="w-3.5 h-3.5 mr-1" /> Relatórios
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setPasswordFor(p); setNewPassword("Coopaiba@2026"); }}>
                          <KeyRound className="w-3.5 h-3.5 mr-1" /> Senha
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Nenhum professor cadastrado. Clique em "Novo Professor".
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Criar / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Professor" : "Novo Professor"}</DialogTitle>
            <DialogDescription>
              {editing ? "Atualize os dados do professor" : "A conta será criada com o perfil Professor"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            {!editing && (
              <>
                <div className="space-y-1.5">
                  <Label>E-mail *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Senha inicial *</Label>
                  <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Foto (URL)</Label>
              <Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Área de atuação</Label>
              <Input value={form.area_atuacao} onChange={(e) => setForm({ ...form, area_atuacao: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Especialidade</Label>
              <Input value={form.especialidade} onChange={(e) => setForm({ ...form, especialidade: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <Label>Conta ativa</Label>
                <p className="text-xs text-muted-foreground">Professores inativos não conseguem acessar</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.full_name}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redefinir senha */}
      <Dialog open={!!passwordFor} onOpenChange={(o) => !o && setPasswordFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>{passwordFor?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordFor(null)}>Cancelar</Button>
            <Button onClick={() => passwordMutation.mutate()} disabled={passwordMutation.isPending}>
              {passwordMutation.isPending ? "Salvando..." : "Redefinir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Relatórios do professor */}
      <Dialog open={!!detailFor} onOpenChange={(o) => !o && setDetailFor(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailFor?.full_name}</DialogTitle>
            <DialogDescription>Cursos, alunos, aulas, certificados e receita</DialogDescription>
          </DialogHeader>
          {detailFor && <ProfessorDetail professorId={detailFor.user_id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
