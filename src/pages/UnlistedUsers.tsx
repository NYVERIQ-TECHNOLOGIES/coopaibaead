import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, UserPlus, Users, UserCheck, UserX, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type UnlistedUser = {
  user_id: string;
  full_name: string | null;
  enrollment_number: string | null;
  cooperativa: string | null;
  is_active: boolean;
  created_at: string;
};

export default function UnlistedUsers() {
  const [search, setSearch] = useState("");
  const [pendingUser, setPendingUser] = useState<UnlistedUser | null>(null);
  const [pendingRole, setPendingRole] = useState<"aluno" | "cooperado">("aluno");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: unlisted = [], isLoading } = useQuery({
    queryKey: ["users-without-role"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_users_without_role");
      if (error) throw error;
      return (data ?? []) as UnlistedUser[];
    },
  });

  const { data: totals } = useQuery({
    queryKey: ["users-without-role-totals"],
    queryFn: async () => {
      const [{ count: profilesCount }, { count: rolesCount }] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }),
      ]);
      return {
        totalProfiles: profilesCount ?? 0,
        totalWithRole: rolesCount ?? 0,
      };
    },
  });

  const assignMut = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "aluno" | "cooperado" }) => {
      const { error } = await supabase.rpc("assign_default_role", {
        _user_id: userId,
        _role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-without-role"] });
      qc.invalidateQueries({ queryKey: ["users-without-role-totals"] });
      toast({ title: "Usuário adicionado com sucesso!" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
    onSettled: () => setActionLoading(null),
  });

  const bulkMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("assign_default_role_bulk");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["users-without-role"] });
      qc.invalidateQueries({ queryKey: ["users-without-role-totals"] });
      toast({ title: `${count} usuário(s) adicionados como aluno` });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return unlisted;
    return unlisted.filter(
      (u) =>
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.enrollment_number || "").toLowerCase().includes(q),
    );
  }, [unlisted, search]);

  const totalProfiles = totals?.totalProfiles ?? 0;
  const totalWithRole = totals?.totalWithRole ?? 0;
  const totalUnlisted = unlisted.length;

  const confirmAssign = () => {
    if (!pendingUser) return;
    setActionLoading(pendingUser.user_id);
    assignMut.mutate({ userId: pendingUser.user_id, role: pendingRole });
    setPendingUser(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Usuários não listados</h1>
        <p className="text-muted-foreground mt-1">
          Perfis cadastrados sem tipo definido (não aparecem na página de Alunos)
        </p>
      </div>

      {/* Diagnóstico */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-heading font-bold text-card-foreground">{totalProfiles}</p>
            <p className="text-xs text-muted-foreground">Total de perfis</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/10 text-secondary">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-heading font-bold text-card-foreground">{totalWithRole}</p>
            <p className="text-xs text-muted-foreground">Com tipo definido</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-heading font-bold text-card-foreground">{totalUnlisted}</p>
            <p className="text-xs text-muted-foreground">Fora da base</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
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
        <Button
          onClick={() => setBulkOpen(true)}
          disabled={totalUnlisted === 0 || bulkMut.isPending}
          className="gap-2"
        >
          {bulkMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Adicionar todos como aluno
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Total: <span className="font-semibold text-foreground">{filtered.length}</span> usuário(s) não listado(s)
      </p>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <UserCheck className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-foreground font-medium">Nenhum usuário fora da base</p>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os perfis cadastrados já possuem tipo definido.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl shadow-card border border-border overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Matrícula
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cooperativa
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cadastro
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <motion.tr
                    key={u.user_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                      {u.enrollment_number || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary-foreground">
                            {u.full_name?.charAt(0) || "U"}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-card-foreground">
                          {u.full_name || "Sem nome"}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {u.cooperativa || "—"}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        onClick={() => {
                          setPendingUser(u);
                          setPendingRole("aluno");
                        }}
                        disabled={actionLoading === u.user_id}
                        className="gap-2"
                      >
                        {actionLoading === u.user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        Adicionar
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Confirmação individual */}
      <AlertDialog open={!!pendingUser} onOpenChange={(o) => !o && setPendingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Definir <span className="font-semibold">{pendingUser?.full_name || "este usuário"}</span> como
              qual tipo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={pendingRole} onValueChange={(v) => setPendingRole(v as "aluno" | "cooperado")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aluno">Aluno</SelectItem>
                <SelectItem value="cooperado">Cooperado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAssign}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação em massa */}
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar todos como aluno</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá atribuir o tipo <span className="font-semibold">aluno</span> a todos os{" "}
              {totalUnlisted} usuário(s) sem tipo definido. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkMut.mutate();
                setBulkOpen(false);
              }}
            >
              Adicionar todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
