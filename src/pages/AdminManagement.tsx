import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, UserPlus, Trash2, ArrowUpCircle, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type AppRole = "admin" | "aluno" | "cooperado" | "moderador";

const roleLabel: Record<AppRole, string> = {
  admin: "Administrador",
  moderador: "Moderador",
  cooperado: "Cooperado",
  aluno: "Aluno",
};

const roleBadgeClass: Record<AppRole, string> = {
  admin: "bg-primary/10 text-primary border-primary/30",
  moderador: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  cooperado: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  aluno: "bg-muted text-muted-foreground border-border",
};

export default function AdminManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [openPromote, setOpenPromote] = useState(false);
  const [promoteSearch, setPromoteSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedNewRole, setSelectedNewRole] = useState<AppRole>("admin");
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });

  // Master admin check (only the master admin can manage admins/moderators)
  const { data: isMasterAdmin = false } = useQuery({
    queryKey: ["is-master-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_master_admin", { _user_id: user!.id });
      return data === true;
    },
  });

  // All users with roles
  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["all-users-with-roles"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, created_at, cooperativa, is_active")
        .order("full_name");
      if (!profiles) return [];
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as AppRole]));
      return profiles.map((p) => ({ ...p, role: (roleMap.get(p.user_id) ?? "aluno") as AppRole }));
    },
  });

  const admins = useMemo(() => allUsers.filter((u) => u.role === "admin"), [allUsers]);
  const moderators = useMemo(
    () => allUsers.filter((u) => u.role === "moderador" && u.is_active !== false),
    [allUsers]
  );
  const nonAdmins = useMemo(
    () => allUsers.filter((u) => u.role !== "admin" && u.is_active !== false),
    [allUsers]
  );

  const filteredNonAdmins = useMemo(() => {
    const q = promoteSearch.toLowerCase().trim();
    if (!q) return nonAdmins;
    return nonAdmins.filter((u) => (u.full_name || "").toLowerCase().includes(q));
  }, [nonAdmins, promoteSearch]);

  const createAdmin = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await supabase.functions.invoke("create-admin", { body: data });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Administrador criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["students-list"] });
      setOpenCreate(false);
      setForm({ full_name: "", email: "", password: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar administrador", description: err.message, variant: "destructive" });
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ user_id, new_role }: { user_id: string; new_role: AppRole }) => {
      const res = await supabase.functions.invoke("manage-user-role", {
        body: { user_id, new_role },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (_d, vars) => {
      toast({ title: `Perfil atualizado para ${roleLabel[vars.new_role]}` });
      queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["students-list"] });
      setOpenPromote(false);
      setSelectedUserId("");
      setPromoteSearch("");
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao alterar perfil", description: err.message, variant: "destructive" });
    },
  });

  const handlePromote = () => {
    if (!selectedUserId) {
      toast({ title: "Selecione um usuário", variant: "destructive" });
      return;
    }
    changeRole.mutate({ user_id: selectedUserId, new_role: selectedNewRole });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" /> Administradores e Moderadores
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie administradores e moderadores, promova alunos a cooperado, moderador ou administrador
          </p>
          {!isMasterAdmin && (
            <p className="text-xs text-amber-600 mt-2">
              Apenas o administrador master pode promover ou rebaixar administradores e moderadores.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setOpenPromote(true)}
            className="gap-2"
            disabled={!isMasterAdmin}
            title={!isMasterAdmin ? "Apenas o administrador master" : undefined}
          >
            <ArrowUpCircle className="w-4 h-4" /> Promover usuário
          </Button>
          <Button
            onClick={() => setOpenCreate(true)}
            className="gap-2"
            disabled={!isMasterAdmin}
            title={!isMasterAdmin ? "Apenas o administrador master" : undefined}
          >
            <UserPlus className="w-4 h-4" /> Novo Admin
          </Button>
        </div>
      </div>

      {/* Admins list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Administradores ({admins.length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loadingUsers
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
              ))
            : admins.map((admin) => {
                const isSelf = admin.user_id === user?.id;
                return (
                  <div
                    key={admin.user_id}
                    className="rounded-xl border border-border bg-card p-5 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {admin.full_name
                          ?.split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || "A"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate flex items-center gap-2">
                        {admin.full_name || "Admin"}
                        {isSelf && (
                          <Badge variant="outline" className="text-[10px]">Você</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Desde {new Date(admin.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {!isSelf && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            title="Remover administrador"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover administrador?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>{admin.full_name}</strong> deixará de ser administrador
                              e voltará a ser aluno comum. Você poderá promovê-lo novamente
                              a qualquer momento.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                changeRole.mutate({
                                  user_id: admin.user_id,
                                  new_role: "aluno",
                                })
                              }
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                );
              })}
        </div>
        {!loadingUsers && admins.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum administrador encontrado</p>
          </div>
        )}
      </div>

      {/* Moderators list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Moderadores ({moderators.length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {moderators.map((mod) => (
            <div
              key={mod.user_id}
              className="rounded-xl border border-border bg-card p-5 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-amber-600">
                  {mod.full_name
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "M"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {mod.full_name || "Moderador"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mod.cooperativa || "Sem cooperativa"}
                </p>
              </div>
              {isMasterAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      title="Remover moderador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover moderador?</AlertDialogTitle>
                      <AlertDialogDescription>
                        <strong>{mod.full_name}</strong> deixará de ser moderador e voltará a ser aluno comum.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          changeRole.mutate({ user_id: mod.user_id, new_role: "aluno" })
                        }
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>
        {!loadingUsers && moderators.length === 0 && (
          <div className="text-sm text-muted-foreground py-4">
            Nenhum moderador cadastrado.
          </div>
        )}
      </div>

      {/* Create admin dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Administrador</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createAdmin.mutate(form);
            }}
            className="space-y-4"
          >
            <div>
              <Label>Nome completo</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={createAdmin.isPending}>
              {createAdmin.isPending ? "Criando..." : "Criar Administrador"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Promote dialog */}
      <Dialog open={openPromote} onOpenChange={setOpenPromote}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-primary" />
              Promover usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Buscar aluno</Label>
              <div className="relative mt-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={promoteSearch}
                  onChange={(e) => setPromoteSearch(e.target.value)}
                  placeholder="Digite o nome..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
              {filteredNonAdmins.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhum usuário encontrado
                </div>
              ) : (
                filteredNonAdmins.map((u) => (
                  <button
                    key={u.user_id}
                    type="button"
                    onClick={() => setSelectedUserId(u.user_id)}
                    className={`w-full flex items-center gap-3 p-3 text-left hover:bg-muted transition-colors border-b border-border last:border-0 ${
                      selectedUserId === u.user_id ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                      {u.full_name
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {u.full_name || "Sem nome"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.cooperativa || "Sem cooperativa"}
                      </p>
                    </div>
                    <Badge variant="outline" className={roleBadgeClass[u.role]}>
                      {roleLabel[u.role]}
                    </Badge>
                  </button>
                ))
              )}
            </div>

            <div>
              <Label>Promover para</Label>
              <Select value={selectedNewRole} onValueChange={(v) => setSelectedNewRole(v as AppRole)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="moderador">Moderador</SelectItem>
                  <SelectItem value="cooperado">Cooperado</SelectItem>
                  <SelectItem value="aluno">Aluno (rebaixar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handlePromote}
              disabled={!selectedUserId || changeRole.isPending}
              className="w-full"
            >
              {changeRole.isPending ? "Aplicando..." : "Confirmar alteração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
