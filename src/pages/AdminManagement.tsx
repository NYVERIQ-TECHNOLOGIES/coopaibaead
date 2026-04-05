import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Plus, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function AdminManagement() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (!roles?.length) return [];
      const ids = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, created_at")
        .in("user_id", ids);
      return profiles || [];
    },
  });

  const createAdmin = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await supabase.functions.invoke("create-admin", {
        body: data,
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Administrador criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setOpen(false);
      setForm({ full_name: "", email: "", password: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar administrador", description: err.message, variant: "destructive" });
    },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" /> Administradores
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os administradores da plataforma</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" /> Novo Admin
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))
          : admins.map((admin) => (
              <div key={admin.user_id} className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-primary">
                    {admin.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "A"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{admin.full_name || "Admin"}</p>
                  <p className="text-xs text-muted-foreground">
                    Desde {new Date(admin.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
      </div>

      {!isLoading && admins.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum administrador encontrado</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
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
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={createAdmin.isPending}>
              {createAdmin.isPending ? "Criando..." : "Criar Administrador"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
