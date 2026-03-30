import { motion } from "framer-motion";
import { Search, Calendar, CheckCircle, XCircle, Clock, QrCode } from "lucide-react";
import { useState } from "react";

const records = [
  { student: "Maria Silva", course: "Cooperativismo Básico", date: "25/03/2024", type: "online", status: "presente", time: "45min" },
  { student: "João Santos", course: "Gestão Cooperativa", date: "25/03/2024", type: "online", status: "presente", time: "30min" },
  { student: "Ana Costa", course: "Finanças Solidárias", date: "25/03/2024", type: "presencial", status: "presente", time: "2h" },
  { student: "Carlos Lima", course: "Liderança Comunitária", date: "25/03/2024", type: "online", status: "ausente", time: "0min" },
  { student: "Paula Ferreira", course: "Direito Cooperativo", date: "24/03/2024", type: "online", status: "presente", time: "1h" },
  { student: "Ricardo Alves", course: "Marketing Social", date: "24/03/2024", type: "presencial", status: "ausente", time: "0min" },
];

export default function Attendance() {
  const [search, setSearch] = useState("");
  const filtered = records.filter((r) => r.student.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Controle de Presença</h1>
          <p className="text-muted-foreground mt-1">Registro de frequência dos alunos</p>
        </div>
        <button className="gradient-accent text-accent-foreground px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity w-fit">
          <QrCode className="w-4 h-4" /> Gerar QR Code
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Taxa de Presença", value: "87%", icon: CheckCircle, color: "text-success" },
          { label: "Presenças Hoje", value: "156", icon: Calendar, color: "text-primary" },
          { label: "Tempo Médio", value: "1h 20min", icon: Clock, color: "text-accent" },
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
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Tempo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 text-sm text-card-foreground font-medium">{r.student}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{r.course}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{r.date}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${r.type === "presencial" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{r.time}</td>
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
    </div>
  );
}
