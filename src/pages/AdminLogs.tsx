import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Download, Calendar, KeyRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function AdminLogs() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-logs", from, to],
    queryFn: async () => {
      const { data: rawLogs } = await supabase
        .from("admin_access_logs")
        .select("id, user_id, accessed_at, user_agent")
        .gte("accessed_at", `${from}T00:00:00`)
        .lte("accessed_at", `${to}T23:59:59`)
        .order("accessed_at", { ascending: false })
        .limit(1000);
      if (!rawLogs) return [];
      const userIds = Array.from(new Set(rawLogs.map((l) => l.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const nameMap = new Map(
        (profiles ?? []).map((p) => [p.user_id, p.full_name])
      );
      return rawLogs.map((l) => ({
        ...l,
        full_name: nameMap.get(l.user_id) || "Admin",
      }));
    },
  });

  const { data: pwdLogs = [], isLoading: loadingPwd } = useQuery({
    queryKey: ["password-reset-logs", from, to],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("password_reset_logs")
        .select("id, admin_user_id, target_user_id, target_email, performed_at, user_agent")
        .gte("performed_at", `${from}T00:00:00`)
        .lte("performed_at", `${to}T23:59:59`)
        .order("performed_at", { ascending: false })
        .limit(1000);
      if (!rows) return [];
      const ids = Array.from(new Set(rows.flatMap((r) => [r.admin_user_id, r.target_user_id])));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));
      return rows.map((r) => ({
        ...r,
        admin_name: nameMap.get(r.admin_user_id) || "Admin",
        target_name: nameMap.get(r.target_user_id) || "—",
      }));
    },
  });

  const { data: courseLogs = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["course-audit-log", from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_audit_log")
        .select("id, action, course_title, preserved_history, actor_name, details, created_at")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(1000);
      return (data ?? []) as any[];
    },
  });




  const exportCSV = () => {
    const header = ["Data/Hora", "Administrador", "User Agent"];
    const rows = logs.map((l) => [
      new Date(l.accessed_at).toLocaleString("pt-BR"),
      (l.full_name || "").replace(/"/g, '""'),
      (l.user_agent || "").replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-admin-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            Logs de Acesso
          </h1>
          <p className="text-muted-foreground mt-1">
            Histórico de acessos de administradores ({logs.length} registros)
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <Label className="text-xs">De</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex-1 w-full">
          <Label className="text-xs">Até</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Filtrar período</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-card rounded-xl shadow-card border border-border overflow-hidden"
      >
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum acesso registrado neste período</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Data/Hora
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Administrador
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    User Agent
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <motion.tr
                    key={l.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.01 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >
                    <td className="py-3 px-4 text-sm text-foreground font-mono">
                      {new Date(l.accessed_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-card-foreground">
                      {l.full_name}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-md hidden md:table-cell">
                      {l.user_agent || "—"}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <div>
        <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-amber-600" />
          Redefinições de Senha
        </h2>
        <p className="text-muted-foreground text-sm mt-1 mb-3">
          Registros de senhas redefinidas por administradores ({pwdLogs.length})
        </p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl shadow-card border border-border overflow-hidden"
        >
          {loadingPwd ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : pwdLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <KeyRound className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhuma redefinição de senha neste período</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data/Hora</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Administrador</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aluno</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">E-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {pwdLogs.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="py-3 px-4 text-sm text-foreground font-mono">
                        {new Date(r.performed_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-card-foreground">{r.admin_name}</td>
                      <td className="py-3 px-4 text-sm text-card-foreground">{r.target_name}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground hidden md:table-cell">{r.target_email || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      <div>
        <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
          <BookX className="w-5 h-5 text-destructive" />
          Cursos Excluídos e Restaurados
        </h2>
        <p className="text-muted-foreground text-sm mt-1 mb-3">
          Auditoria de exclusões e restaurações de cursos ({courseLogs.length})
        </p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl shadow-card border border-border overflow-hidden"
        >
          {loadingCourses ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : courseLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookX className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhuma exclusão ou restauração neste período</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data/Hora</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ação</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Curso</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Administrador</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {courseLogs.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="py-3 px-4 text-sm text-foreground font-mono whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.action === "restaurado"
                              ? "bg-primary/10 text-primary"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {r.action === "restaurado" ? "Restaurado" : "Excluído"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-card-foreground">{r.course_title}</td>
                      <td className="py-3 px-4 text-sm text-card-foreground">{r.actor_name || "Admin"}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {r.preserved_history ? "Mantido" : "Não mantido"}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground hidden md:table-cell">
                        {r.action === "restaurado"
                          ? `Certificados: ${r.details?.restored_certificates ?? 0} · Matrículas: ${r.details?.restored_enrollments ?? 0}`
                          : `Conclusões arquivadas: ${r.details?.archived_completions ?? 0} · Certificados preservados: ${r.details?.preserved_certificates ?? 0}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>


  );
}
