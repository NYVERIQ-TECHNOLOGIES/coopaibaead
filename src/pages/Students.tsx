import { motion } from "framer-motion";
import { Search, Download, MoreVertical, UserCheck, UserX, TrendingUp, Clock } from "lucide-react";
import { useState } from "react";

const students = [
  { id: 1, name: "Maria Silva", email: "maria@email.com", type: "cooperado", courses: 4, progress: 78, lastAccess: "Hoje", status: "ativo" },
  { id: 2, name: "João Santos", email: "joao@email.com", type: "aluno", courses: 2, progress: 45, lastAccess: "Ontem", status: "ativo" },
  { id: 3, name: "Ana Costa", email: "ana@email.com", type: "cooperado", courses: 6, progress: 92, lastAccess: "Hoje", status: "ativo" },
  { id: 4, name: "Carlos Lima", email: "carlos@email.com", type: "aluno", courses: 1, progress: 12, lastAccess: "7 dias", status: "inativo" },
  { id: 5, name: "Paula Ferreira", email: "paula@email.com", type: "cooperado", courses: 3, progress: 65, lastAccess: "2 dias", status: "ativo" },
  { id: 6, name: "Ricardo Alves", email: "ricardo@email.com", type: "aluno", courses: 5, progress: 88, lastAccess: "Hoje", status: "ativo" },
  { id: 7, name: "Luciana Gomes", email: "luciana@email.com", type: "cooperado", courses: 2, progress: 33, lastAccess: "14 dias", status: "inativo" },
  { id: 8, name: "Fernando Dias", email: "fernando@email.com", type: "aluno", courses: 3, progress: 56, lastAccess: "3 dias", status: "ativo" },
];

export default function Students() {
  const [search, setSearch] = useState("");
  const filtered = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Alunos</h1>
          <p className="text-muted-foreground mt-1">{students.length} alunos cadastrados</p>
        </div>
        <button className="bg-card border border-border text-foreground px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-muted transition-colors w-fit">
          <Download className="w-4 h-4" /> Exportar
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Buscar alunos..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aluno</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cursos</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progresso</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Último Acesso</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary-foreground">{s.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.type === "cooperado" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"}`}>
                      {s.type === "cooperado" ? "Cooperado" : "Aluno"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-card-foreground">{s.courses}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full gradient-primary rounded-full" style={{ width: `${s.progress}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{s.progress}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{s.lastAccess}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium flex items-center gap-1 ${s.status === "ativo" ? "text-success" : "text-destructive"}`}>
                      {s.status === "ativo" ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      {s.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
