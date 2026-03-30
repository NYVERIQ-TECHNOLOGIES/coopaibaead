import { motion } from "framer-motion";
import { Award, Download, QrCode, Search, Eye, CheckCircle } from "lucide-react";
import { useState } from "react";

const certificates = [
  { id: "CERT-2024-001", student: "Maria Silva", course: "Cooperativismo Básico", type: "cooperado", date: "15/03/2024", status: "emitido" },
  { id: "CERT-2024-002", student: "João Santos", course: "Gestão Cooperativa", type: "aluno", date: "12/03/2024", status: "emitido" },
  { id: "CERT-2024-003", student: "Ana Costa", course: "Finanças Solidárias", type: "cooperado", date: "10/03/2024", status: "emitido" },
  { id: "CERT-2024-004", student: "Carlos Lima", course: "Liderança Comunitária", type: "aluno", date: "08/03/2024", status: "pendente" },
  { id: "CERT-2024-005", student: "Paula Ferreira", course: "Direito Cooperativo", type: "cooperado", date: "05/03/2024", status: "emitido" },
];

export default function Certificates() {
  const [search, setSearch] = useState("");
  const filtered = certificates.filter((c) => c.student.toLowerCase().includes(search.toLowerCase()) || c.course.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Certificados</h1>
        <p className="text-muted-foreground mt-1">Gerencie certificados emitidos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Emitidos", value: "892", icon: Award, gradient: "gradient-primary" },
          { label: "Este Mês", value: "47", icon: CheckCircle, gradient: "gradient-secondary" },
          { label: "Pendentes", value: "12", icon: QrCode, gradient: "gradient-accent" },
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

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Código</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Aluno</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Curso</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Data</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cert, i) => (
                <motion.tr key={cert.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 text-sm font-mono text-primary font-medium">{cert.id}</td>
                  <td className="py-3 px-4 text-sm text-card-foreground">{cert.student}</td>
                  <td className="py-3 px-4 text-sm text-card-foreground">{cert.course}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${cert.type === "cooperado" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"}`}>
                      {cert.type === "cooperado" ? "Cooperado" : "Aluno"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{cert.date}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium ${cert.status === "emitido" ? "text-success" : "text-warning"}`}>
                      {cert.status === "emitido" ? "Emitido" : "Pendente"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button className="text-muted-foreground hover:text-primary transition-colors"><Eye className="w-4 h-4" /></button>
                      <button className="text-muted-foreground hover:text-primary transition-colors"><Download className="w-4 h-4" /></button>
                      <button className="text-muted-foreground hover:text-primary transition-colors"><QrCode className="w-4 h-4" /></button>
                    </div>
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
