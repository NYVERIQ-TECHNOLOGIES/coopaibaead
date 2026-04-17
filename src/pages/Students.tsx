import { motion } from "framer-motion";
import { Search, Download, Trash2, FileBarChart } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

export default function Students() {
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, cooperativa, created_at, enrollment_number")
        .order("created_at", { ascending: false });
      if (!profiles) return [];
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      return profiles.map((p) => ({ ...p, role: roleMap.get(p.user_id) ?? "aluno" }));
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students-list"] });
      toast({ title: "Aluno excluído" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const filtered = students.filter(
    (s) =>
      (s.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.enrollment_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalAlunos = students.filter((s) => s.role !== "admin").length;
  const totalCooperados = students.filter((s) => s.role === "cooperado").length;
  const totalAdmins = students.filter((s) => s.role === "admin").length;

  const exportCSV = () => {
    const header = ["Matrícula", "Nome", "Tipo", "Cooperativa", "Data de Cadastro"];
    const rows = filtered.map((s) => [
      s.enrollment_number || "",
      (s.full_name || "").replace(/"/g, '""'),
      s.role,
      (s.cooperativa || "").replace(/"/g, '""'),
      new Date(s.created_at).toLocaleDateString("pt-BR"),
    ]);
    const csv =
      [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alunos-coopaiba-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Alunos</h1>
          <p className="text-muted-foreground mt-1">{students.length} usuários cadastrados</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: students.length, color: "bg-primary/10 text-primary" },
          { label: "Alunos", value: totalAlunos, color: "bg-secondary/10 text-secondary" },
          { label: "Cooperados", value: totalCooperados, color: "bg-accent/10 text-accent" },
          { label: "Admins", value: totalAdmins, color: "bg-destructive/10 text-destructive" },
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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome ou matrícula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Matrícula</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aluno</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cooperativa</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cadastro</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <motion.tr
                    key={s.user_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
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
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.role === "cooperado" ? "bg-secondary/10 text-secondary" : s.role === "admin" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                        {s.role === "cooperado" ? "Cooperado" : s.role === "admin" ? "Admin" : "Aluno"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{s.cooperativa || "—"}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {s.user_id !== user?.id && s.role !== "admin" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir aluno?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir <strong>{s.full_name}</strong> ({s.enrollment_number})?
                                Esta ação removerá permanentemente o usuário, perfil e funções.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(s.user_id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </motion.tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum aluno encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
