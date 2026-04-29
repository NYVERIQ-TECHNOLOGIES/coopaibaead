import { motion } from "framer-motion";
import { Search, Download, FileBarChart, Power, FileSpreadsheet, MessageCircle, MoreVertical, Trash2, PowerOff } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Students() {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [hardDeleteFor, setHardDeleteFor] = useState<string | null>(null);
  const [chatLoadingFor, setChatLoadingFor] = useState<string | null>(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      // Paginate to bypass default 1000-row Supabase limit
      const PAGE = 1000;
      const fetchAll = async <T,>(table: "profiles" | "user_roles", columns: string): Promise<T[]> => {
        const all: T[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from(table)
            .select(columns)
            .range(from, from + PAGE - 1);
          if (error) throw error;
          const batch = (data ?? []) as unknown as T[];
          all.push(...batch);
          if (batch.length < PAGE) break;
          from += PAGE;
        }
        return all;
      };

      const profiles = await fetchAll<any>(
        "profiles",
        "user_id, full_name, avatar_url, cooperativa, created_at, enrollment_number, is_active, deactivated_at, cpf"
      );
      const roles = await fetchAll<{ user_id: string; role: string }>("user_roles", "user_id, role");
      const roleMap = new Map(roles.map((r) => [r.user_id, r.role]));
      return profiles
        .map((p) => ({ ...p, role: roleMap.get(p.user_id) ?? "aluno" }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: async ({ userId, reactivate }: { userId: string; reactivate: boolean }) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId, reactivate },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["students-list"] });
      toast({ title: vars.reactivate ? "Aluno reativado" : "Aluno desativado" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const hardDeleteMut = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId, hard_delete: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students-list"] });
      toast({ title: "Usuário excluído permanentemente" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const changeRoleMut = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: "aluno" | "cooperado" | "admin" }) => {
      const { data, error } = await supabase.functions.invoke("manage-user-role", {
        body: { user_id: userId, new_role: newRole },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students-list"] });
      toast({ title: "Tipo de usuário atualizado" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao alterar tipo", description: e.message, variant: "destructive" }),
  });

  const startChatWith = async (targetUserId: string) => {
    if (!user) return;
    setChatLoadingFor(targetUserId);
    try {
      const { data: existing } = await supabase
        .from("support_conversations")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (!existing) {
        const { error } = await supabase
          .from("support_conversations")
          .insert({ user_id: targetUserId, subject: "Mensagem do administrador" });
        if (error) throw error;
      }
      navigate("/support");
    } catch (e: any) {
      toast({ title: "Erro ao abrir chat", description: e.message, variant: "destructive" });
    } finally {
      setChatLoadingFor(null);
    }
  };

  const filtered = students.filter((s) => {
    const matchesSearch =
      (s.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.enrollment_number || "").toLowerCase().includes(search.toLowerCase());
    const matchesActive = showInactive ? true : s.is_active !== false;
    return matchesSearch && matchesActive;
  });

  const totalAlunos = students.filter((s) => s.role === "aluno" && s.is_active !== false).length;
  const totalCooperados = students.filter((s) => s.role === "cooperado" && s.is_active !== false).length;
  const totalAdmins = students.filter((s) => s.role === "admin" && s.is_active !== false).length;
  const totalInativos = students.filter((s) => s.is_active === false).length;

  const formatCpf = (v?: string | null) => {
    if (!v) return "";
    const d = v.replace(/\D/g, "");
    if (d.length !== 11) return v;
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const fetchEmails = async (userIds: string[]): Promise<Record<string, string>> => {
    if (userIds.length === 0) return {};
    const { data, error } = await supabase.functions.invoke("list-user-emails", {
      body: { user_ids: userIds },
    });
    if (error) throw error;
    return ((data as any)?.emails ?? {}) as Record<string, string>;
  };

  // Carrega e-mails de todos os alunos exibidos
  useEffect(() => {
    if (students.length === 0) return;
    const ids = students.map((s: any) => s.user_id);
    fetchEmails(ids)
      .then(setEmailMap)
      .catch(() => {
        // silencioso: a tabela ainda funciona sem e-mails
      });
  }, [students]);

  const exportCSV = async () => {
    try {
      const emails = { ...emailMap, ...(await fetchEmails(filtered.map((s) => s.user_id).filter((id) => !emailMap[id]))) };
      const header = ["Matrícula", "Nome", "E-mail", "CPF", "Tipo", "Cooperativa", "Status", "Data de Cadastro"];
      const rows = filtered.map((s) => [
        s.enrollment_number || "",
        (s.full_name || "").replace(/"/g, '""'),
        emails[s.user_id] || "",
        formatCpf((s as any).cpf),
        s.role,
        (s.cooperativa || "").replace(/"/g, '""'),
        s.is_active === false ? "Inativo" : "Ativo",
        new Date(s.created_at).toLocaleDateString("pt-BR"),
      ]);
      const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alunos-coopaiba-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    }
  };

  const exportFullReport = async () => {
    setGenerating(true);
    try {
      const userIds = filtered.map((s) => s.user_id);
      if (userIds.length === 0) {
        toast({ title: "Nenhum aluno para exportar" });
        setGenerating(false);
        return;
      }

      // Buscar enrollments, certificates, exam_attempts e e-mails em paralelo
      const [enrollRes, certRes, attemptsRes, emailMap] = await Promise.all([
        supabase
          .from("enrollments")
          .select("user_id, progress, courses(title)")
          .in("user_id", userIds),
        supabase
          .from("certificates")
          .select("user_id, status")
          .in("user_id", userIds)
          .eq("status", "emitido"),
        supabase
          .from("exam_attempts")
          .select("user_id, score")
          .in("user_id", userIds),
        fetchEmails(userIds),
      ]);

      const enrollMap = new Map<string, Array<{ title: string; progress: number }>>();
      (enrollRes.data ?? []).forEach((e: any) => {
        const arr = enrollMap.get(e.user_id) ?? [];
        arr.push({ title: e.courses?.title ?? "—", progress: e.progress ?? 0 });
        enrollMap.set(e.user_id, arr);
      });

      const certMap = new Map<string, number>();
      (certRes.data ?? []).forEach((c: any) => {
        certMap.set(c.user_id, (certMap.get(c.user_id) ?? 0) + 1);
      });

      const scoreMap = new Map<string, { sum: number; count: number }>();
      (attemptsRes.data ?? []).forEach((a: any) => {
        const cur = scoreMap.get(a.user_id) ?? { sum: 0, count: 0 };
        cur.sum += Number(a.score) || 0;
        cur.count += 1;
        scoreMap.set(a.user_id, cur);
      });

      const header = [
        "Matrícula",
        "Nome",
        "E-mail",
        "CPF",
        "Tipo",
        "Cooperativa",
        "Status",
        "Data Cadastro",
        "Cursos Matriculados",
        "Progresso Médio (%)",
        "Cursos com Detalhe",
        "Certificados Emitidos",
        "Avaliações Realizadas",
        "Nota Média",
      ];

      const rows = filtered.map((s) => {
        const enrolls = enrollMap.get(s.user_id) ?? [];
        const avgProgress =
          enrolls.length > 0
            ? Math.round(enrolls.reduce((a, b) => a + b.progress, 0) / enrolls.length)
            : 0;
        const courseDetails = enrolls
          .map((e) => `${e.title} (${e.progress}%)`)
          .join(" | ");
        const score = scoreMap.get(s.user_id);
        const avgScore =
          score && score.count > 0 ? (score.sum / score.count).toFixed(1) : "—";
        return [
          s.enrollment_number || "",
          (s.full_name || "").replace(/"/g, '""'),
          emailMap[s.user_id] || "",
          formatCpf((s as any).cpf),
          s.role,
          (s.cooperativa || "").replace(/"/g, '""'),
          s.is_active === false ? "Inativo" : "Ativo",
          new Date(s.created_at).toLocaleDateString("pt-BR"),
          enrolls.length,
          avgProgress,
          courseDetails.replace(/"/g, '""'),
          certMap.get(s.user_id) ?? 0,
          score?.count ?? 0,
          avgScore,
        ];
      });

      const csv = [header, ...rows]
        .map((r) => r.map((v) => `"${v}"`).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-alunos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Relatório completo exportado" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar relatório", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Alunos</h1>
          <p className="text-muted-foreground mt-1">{students.length} usuários cadastrados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={exportCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> CSV Simples
          </Button>
          <Button onClick={exportFullReport} disabled={generating} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {generating ? "Gerando..." : "Relatório Completo"}
          </Button>
        </div>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: students.length, color: "bg-primary/10 text-primary" },
          { label: "Alunos", value: totalAlunos, color: "bg-secondary/10 text-secondary" },
          { label: "Cooperados", value: totalCooperados, color: "bg-accent/10 text-accent" },
          { label: "Admins", value: totalAdmins, color: "bg-destructive/10 text-destructive" },
          { label: "Inativos", value: totalInativos, color: "bg-muted text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
              <FileBarChart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-card-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-border"
          />
          Mostrar inativos
        </label>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-280px)]">
            <table className="w-full min-w-[1100px]">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Matrícula</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Aluno</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">CPF</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">E-mail</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Tipo</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Cooperativa</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Cadastro</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const inactive = s.is_active === false;
                  const isAdmin = s.role === "admin";
                  const isSelf = s.user_id === user?.id;
                  return (
                    <motion.tr
                      key={s.user_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${inactive ? "opacity-60" : ""}`}
                    >
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                        {s.enrollment_number || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary-foreground">
                              {s.full_name?.charAt(0) || "U"}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-card-foreground">{s.full_name || "Sem nome"}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formatCpf((s as any).cpf) || "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground max-w-[240px] truncate" title={emailMap[s.user_id] || ""}>
                        {emailMap[s.user_id] || "—"}
                      </td>
                      <td className="py-3 px-4">
                        {isSelf || isAdmin ? (
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.role === "cooperado" ? "bg-secondary/10 text-secondary" : s.role === "admin" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                            {s.role === "cooperado" ? "Cooperado" : s.role === "admin" ? "Admin" : "Aluno"}
                          </span>
                        ) : (
                          <Select
                            value={s.role}
                            onValueChange={(v) => changeRoleMut.mutate({ userId: s.user_id, newRole: v as any })}
                            disabled={changeRoleMut.isPending}
                          >
                            <SelectTrigger className="h-8 w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aluno">Aluno</SelectItem>
                              <SelectItem value="cooperado">Cooperado</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{s.cooperativa || "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${inactive ? "bg-muted text-muted-foreground" : "bg-success/10 text-success"}`}>
                          {inactive ? "Inativo" : "Ativo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isSelf && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Iniciar conversa"
                              disabled={chatLoadingFor === s.user_id}
                              onClick={() => startChatWith(s.user_id)}
                              className="text-primary hover:bg-primary/10"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {!isSelf && !isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" title="Mais ações">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => toggleActiveMut.mutate({ userId: s.user_id, reactivate: inactive })}
                                  className={inactive ? "text-success focus:text-success" : ""}
                                >
                                  {inactive ? (
                                    <><Power className="w-4 h-4 mr-2" /> Reativar usuário</>
                                  ) : (
                                    <><PowerOff className="w-4 h-4 mr-2" /> Desativar usuário</>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setHardDeleteFor(s.user_id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Excluir permanentemente
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum aluno encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <AlertDialog open={!!hardDeleteFor} onOpenChange={(o) => !o && setHardDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação <strong>não pode ser desfeita</strong>. O usuário será removido do sistema de
              autenticação e seu perfil será apagado. Registros históricos vinculados (matrículas,
              certificados, notas) podem ser perdidos. Considere "Desativar" para preservar o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (hardDeleteFor) hardDeleteMut.mutate(hardDeleteFor);
                setHardDeleteFor(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
