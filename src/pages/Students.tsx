import { motion } from "framer-motion";
import { Search, Download, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Students() {
  const [search, setSearch] = useState("");

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url, cooperativa, created_at");
      if (!profiles) return [];
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.role]));
      return profiles.map(p => ({
        ...p,
        role: roleMap.get(p.user_id) ?? "aluno",
      }));
    },
  });

  const filtered = students.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Alunos</h1>
          <p className="text-muted-foreground mt-1">{students.length} usuários cadastrados</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Buscar alunos..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aluno</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cooperativa</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <motion.tr key={s.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary-foreground">{s.full_name?.charAt(0) || "U"}</span>
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
                    <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-BR")}</td>
                  </motion.tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum aluno encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
