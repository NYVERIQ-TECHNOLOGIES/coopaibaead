import { motion } from "framer-motion";
import { Award, Search, CheckCircle, Clock } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function Certificates() {
  const [search, setSearch] = useState("");
  const { role } = useAuth();

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["certificates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("*, courses(title), profiles!certificates_user_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const emitted = certificates.filter(c => c.status === "emitido").length;
  const pending = certificates.filter(c => c.status === "pendente").length;

  const filtered = certificates.filter((c) => {
    const name = (c as any).profiles?.full_name ?? "";
    const course = (c as any).courses?.title ?? "";
    return name.toLowerCase().includes(search.toLowerCase()) || course.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Certificados</h1>
        <p className="text-muted-foreground mt-1">Gerencie certificados emitidos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total", value: certificates.length, icon: Award, gradient: "gradient-primary" },
          { label: "Emitidos", value: emitted, icon: CheckCircle, gradient: "gradient-secondary" },
          { label: "Pendentes", value: pending, icon: Clock, gradient: "gradient-accent" },
        ].map((stat) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-4 shadow-card border border-border flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${stat.gradient} flex items-center justify-center`}>
              <stat.icon className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-card-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Buscar certificados..." value={search} onChange={(e) => setSearch(e.target.value)}
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
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Código</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Aluno</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Curso</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Data</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum certificado encontrado</td></tr>
                ) : filtered.map((cert, i) => (
                  <motion.tr key={cert.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-sm font-mono text-primary font-medium">{cert.code}</td>
                    <td className="py-3 px-4 text-sm text-card-foreground">{(cert as any).profiles?.full_name ?? "—"}</td>
                    <td className="py-3 px-4 text-sm text-card-foreground">{(cert as any).courses?.title ?? "—"}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(cert.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium ${cert.status === "emitido" ? "text-success" : "text-warning"}`}>
                        {cert.status === "emitido" ? "Emitido" : "Pendente"}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
