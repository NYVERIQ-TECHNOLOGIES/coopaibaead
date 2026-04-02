import { motion } from "framer-motion";
import { Search, CheckCircle, XCircle, Clock, Calendar } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Attendance() {
  const [search, setSearch] = useState("");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*, courses(title), profiles!attendance_user_id_fkey(full_name)")
        .order("date", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const present = records.filter(r => r.status === "presente").length;
  const rate = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

  const filtered = records.filter((r) => {
    const name = (r as any).profiles?.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Controle de Presença</h1>
        <p className="text-muted-foreground mt-1">Registro de frequência dos alunos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Taxa de Presença", value: `${rate}%`, icon: CheckCircle, color: "text-success" },
          { label: "Total de Registros", value: String(records.length), icon: Calendar, color: "text-primary" },
          { label: "Presentes", value: String(present), icon: Clock, color: "text-accent" },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-4 shadow-card border border-border flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-xl font-heading font-bold text-card-foreground">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Buscar registros..." value={search} onChange={(e) => setSearch(e.target.value)}
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
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Aluno</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Curso</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Data</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Duração</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro de presença encontrado</td></tr>
                ) : filtered.map((r, i) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-sm text-card-foreground font-medium">{(r as any).profiles?.full_name ?? "—"}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{(r as any).courses?.title ?? "—"}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(r.date).toLocaleDateString("pt-BR")}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${r.type === "presencial" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{r.duration_minutes}min</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium flex items-center gap-1 ${r.status === "presente" ? "text-success" : "text-destructive"}`}>
                        {r.status === "presente" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
