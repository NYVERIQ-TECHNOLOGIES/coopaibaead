import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search, UserPlus, Users, UserCheck, UserX, Loader2,
  AlertTriangle, FileWarning, Copy, Hash, Link2, Download, FileText,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type UnlistedUser = {
  user_id: string;
  full_name: string | null;
  enrollment_number: string | null;
  cooperativa: string | null;
  is_active: boolean;
  created_at: string;
};

type InvalidEnrollment = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  enrollment_number: string | null;
  cooperativa: string | null;
  is_active: boolean;
  created_at: string;
  reason: "sem_matricula" | "matricula_invalida" | string;
};

type MissingEnrollment = {
  missing_enrollment_number: string;
  possible_user_id: string | null;
  possible_user_name: string | null;
  possible_user_email: string | null;
  possible_user_created_at: string | null;
};

type DuplicateEnrollment = {
  enrollment_number: string;
  occurrences: number;
  user_ids: string[];
};

type Diagnostics = {
  total_profiles: number;
  total_with_valid_enrollment: number;
  total_without_enrollment: number;
  total_invalid_format: number;
  total_duplicates: number;
  total_missing_gaps: number;
};

type EnrollmentFilter = "todos" | "sem_matricula" | "matricula_invalida";

function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((v) => {
          const s = v == null ? "" : String(v);
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function inferMissingReason(m: MissingEnrollment): string {
  // Quando há sugestão de vínculo (existe um usuário sem matrícula que pode ocupar a lacuna),
  // o motivo real é cadastro incompleto. Quando não há sugestão, a matrícula realmente
  // sumiu do banco — só pode ter ocorrido por exclusão de conta ou edição manual,
  // já que não existe registro histórico dessa matrícula.
  if (m.possible_user_id && m.possible_user_name) {
    return "Cadastro incompleto: usuário existe no sistema porém ficou sem matrícula — pronto para vincular a este número.";
  }
  if (m.possible_user_id) {
    return "Cadastro incompleto sem nome preenchido: o usuário iniciou o registro mas não finalizou o perfil.";
  }
  return "Conta excluída ou matrícula apagada manualmente: o número existiu na sequência mas não há mais nenhum perfil correspondente no sistema.";
}

export default function UnlistedUsers() {
  const [search, setSearch] = useState("");
  const [pendingUser, setPendingUser] = useState<UnlistedUser | null>(null);
  const [pendingRole, setPendingRole] = useState<"aluno" | "cooperado">("aluno");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [enrollmentFilter, setEnrollmentFilter] = useState<EnrollmentFilter>("todos");
  const [linkPending, setLinkPending] = useState<{
    userId: string;
    userName: string | null;
    enrollment: string;
  } | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  // ============ DATA ============
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

  const { data: diagnostics } = useQuery({
    queryKey: ["enrollment-diagnostics"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_enrollment_diagnostics");
      if (error) throw error;
      const row = (data ?? [])[0];
      return (row ?? {
        total_profiles: 0,
        total_with_valid_enrollment: 0,
        total_without_enrollment: 0,
        total_invalid_format: 0,
        total_duplicates: 0,
        total_missing_gaps: 0,
      }) as Diagnostics;
    },
  });

  const { data: invalidEnrollments = [], isLoading: invalidLoading } = useQuery({
    queryKey: ["invalid-enrollments"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_users_with_invalid_enrollment");
      if (error) throw error;
      return (data ?? []) as InvalidEnrollment[];
    },
  });

  const { data: missingEnrollments = [], isLoading: missingLoading } = useQuery({
    queryKey: ["missing-enrollments"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_missing_enrollments_with_users");
      if (error) throw error;
      return (data ?? []) as MissingEnrollment[];
    },
  });

  const { data: duplicates = [] } = useQuery({
    queryKey: ["duplicate-enrollments"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_duplicate_enrollments");
      if (error) throw error;
      return (data ?? []) as DuplicateEnrollment[];
    },
  });

  // ============ MUTATIONS ============
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

  const linkMut = useMutation({
    mutationFn: async ({ userId, enrollment }: { userId: string; enrollment: string }) => {
      const { error } = await (supabase.rpc as any)("link_enrollment_to_user", {
        _user_id: userId,
        _enrollment_number: enrollment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollment-diagnostics"] });
      qc.invalidateQueries({ queryKey: ["invalid-enrollments"] });
      qc.invalidateQueries({ queryKey: ["missing-enrollments"] });
      qc.invalidateQueries({ queryKey: ["duplicate-enrollments"] });
      toast({ title: "Matrícula vinculada com sucesso!" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
    onSettled: () => setActionLoading(null),
  });

  // ============ FILTERS ============
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return unlisted;
    return unlisted.filter(
      (u) =>
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.enrollment_number || "").toLowerCase().includes(q),
    );
  }, [unlisted, search]);

  const filteredInvalid = useMemo(() => {
    const q = search.toLowerCase().trim();
    return invalidEnrollments.filter((u) => {
      if (enrollmentFilter !== "todos" && u.reason !== enrollmentFilter) return false;
      if (!q) return true;
      return (
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
    });
  }, [invalidEnrollments, enrollmentFilter, search]);

  const filteredMissing = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return missingEnrollments;
    return missingEnrollments.filter(
      (m) =>
        m.missing_enrollment_number.toLowerCase().includes(q) ||
        (m.possible_user_name || "").toLowerCase().includes(q) ||
        (m.possible_user_email || "").toLowerCase().includes(q),
    );
  }, [missingEnrollments, search]);

  const totalProfiles = totals?.totalProfiles ?? 0;
  const totalWithRole = totals?.totalWithRole ?? 0;
  const totalUnlisted = unlisted.length;

  const confirmAssign = () => {
    if (!pendingUser) return;
    setActionLoading(pendingUser.user_id);
    assignMut.mutate({ userId: pendingUser.user_id, role: pendingRole });
    setPendingUser(null);
  };

  const handleExportReport = () => {
    const rows: (string | number | null)[][] = [];
    rows.push(["RELATÓRIO DE INCONSISTÊNCIAS — COOPAÍBA"]);
    rows.push([`Gerado em: ${new Date().toLocaleString("pt-BR")}`]);
    rows.push([]);
    rows.push(["RESUMO"]);
    rows.push(["Total de perfis", diagnostics?.total_profiles ?? 0]);
    rows.push(["Com matrícula válida", diagnostics?.total_with_valid_enrollment ?? 0]);
    rows.push(["Sem matrícula", diagnostics?.total_without_enrollment ?? 0]);
    rows.push(["Matrícula inválida", diagnostics?.total_invalid_format ?? 0]);
    rows.push(["Matrículas duplicadas", diagnostics?.total_duplicates ?? 0]);
    rows.push(["Matrículas faltantes (gaps)", diagnostics?.total_missing_gaps ?? 0]);
    rows.push([]);
    rows.push(["USUÁRIOS SEM/COM MATRÍCULA INVÁLIDA"]);
    rows.push(["Nome", "Email", "Matrícula atual", "Motivo", "Cadastro"]);
    invalidEnrollments.forEach((u) =>
      rows.push([
        u.full_name,
        u.email,
        u.enrollment_number,
        u.reason,
        new Date(u.created_at).toLocaleDateString("pt-BR"),
      ]),
    );
    rows.push([]);
    rows.push(["MATRÍCULAS FALTANTES + SUGESTÃO DE VÍNCULO"]);
    rows.push([
      "Matrícula faltante",
      "Possível usuário",
      "Email",
      "Motivo provável",
      "Detectado em",
    ]);
    const detectedAt = new Date().toLocaleString("pt-BR");
    missingEnrollments.forEach((m) =>
      rows.push([
        m.missing_enrollment_number,
        m.possible_user_name,
        m.possible_user_email,
        inferMissingReason(m),
        detectedAt,
      ]),
    );
    rows.push([]);
    rows.push(["MATRÍCULAS DUPLICADAS"]);
    rows.push(["Matrícula", "Ocorrências"]);
    duplicates.forEach((d) => rows.push([d.enrollment_number, d.occurrences]));
    downloadCSV(`relatorio-cadastro-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast({ title: "Relatório baixado" });
  };

  const handleExportMissingCSV = () => {
    const detectedAt = new Date().toLocaleString("pt-BR");
    const rows: (string | number | null)[][] = [];
    rows.push(["RELATÓRIO DE AUDITORIA — MATRÍCULAS FALTANTES (COOPAÍBA)"]);
    rows.push([`Gerado em: ${detectedAt}`]);
    rows.push([`Total de lacunas detectadas: ${filteredMissing.length}`]);
    rows.push([]);
    rows.push([
      "Matrícula faltante",
      "Possível dono",
      "Email",
      "Motivo provável",
      "Detectado em",
    ]);
    filteredMissing.forEach((m) =>
      rows.push([
        m.missing_enrollment_number,
        m.possible_user_name || "—",
        m.possible_user_email || "—",
        inferMissingReason(m),
        detectedAt,
      ]),
    );
    downloadCSV(
      `matriculas-faltantes-${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
    );
    toast({ title: "CSV de auditoria baixado" });
  };

  const handleExportMissingPDF = () => {
    const detectedAt = new Date().toLocaleString("pt-BR");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório de Auditoria — Matrículas Faltantes", 40, 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Coopaíba — EAD", 40, 58);
    doc.text(`Gerado em: ${detectedAt}`, 40, 72);
    doc.text(`Total de lacunas detectadas: ${filteredMissing.length}`, 40, 86);

    autoTable(doc, {
      startY: 105,
      head: [
        ["Matrícula faltante", "Possível dono", "Email", "Motivo provável", "Detectado em"],
      ],
      body: filteredMissing.map((m) => [
        m.missing_enrollment_number,
        m.possible_user_name || "—",
        m.possible_user_email || "—",
        inferMissingReason(m),
        detectedAt,
      ]),
      styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak" },
      headStyles: { fillColor: [88, 28, 135], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 245, 252] },
      columnStyles: {
        0: { cellWidth: 90, font: "courier", fontStyle: "bold" },
        1: { cellWidth: 150 },
        2: { cellWidth: 170 },
        3: { cellWidth: 230 },
        4: { cellWidth: 110 },
      },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ?? pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount} — Documento de auditoria interna`,
          40,
          pageHeight - 20,
        );
      },
    });

    doc.save(`matriculas-faltantes-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: "PDF de auditoria baixado" });
  };


  const totalIssues =
    (diagnostics?.total_without_enrollment ?? 0) +
    (diagnostics?.total_invalid_format ?? 0) +
    (diagnostics?.total_duplicates ?? 0) +
    (diagnostics?.total_missing_gaps ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            Usuários não listados
          </h1>
          <p className="text-muted-foreground mt-1">
            Diagnóstico completo do cadastro: tipos, matrículas e inconsistências
          </p>
        </div>
        <Button variant="outline" onClick={handleExportReport} className="gap-2">
          <Download className="w-4 h-4" /> Puxar relatório
        </Button>
      </div>

      {/* Diagnóstico geral */}
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
            <p className="text-xs text-muted-foreground">Fora da base (sem tipo)</p>
          </div>
        </div>
      </div>

      {/* Problemas de cadastro identificados */}
      <div className="bg-gradient-to-br from-card to-muted/30 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="font-heading font-semibold text-card-foreground">
            Problemas de cadastro identificados automaticamente
          </h2>
          {totalIssues > 0 && (
            <Badge variant="destructive" className="ml-2">
              {totalIssues}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
              <FileWarning className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Sem matrícula</span>
            </div>
            <p className="text-2xl font-heading font-bold text-card-foreground">
              {diagnostics?.total_without_enrollment ?? 0}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Fora do padrão</span>
            </div>
            <p className="text-2xl font-heading font-bold text-card-foreground">
              {diagnostics?.total_invalid_format ?? 0}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
              <Copy className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Duplicadas</span>
            </div>
            <p className="text-2xl font-heading font-bold text-card-foreground">
              {diagnostics?.total_duplicates ?? 0}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-1">
              <Hash className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Faltantes</span>
            </div>
            <p className="text-2xl font-heading font-bold text-card-foreground">
              {diagnostics?.total_missing_gaps ?? 0}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 italic">
          Essa funcionalidade garante a integridade do cadastro dos cooperados e alunos, evitando
          falhas no sistema e fortalecendo a gestão inteligente da Coopaíba.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sem-tipo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sem-tipo">Sem tipo definido</TabsTrigger>
          <TabsTrigger value="matriculas">Matrículas faltando</TabsTrigger>
          <TabsTrigger value="invalidas">Sem matrícula / Inválidas</TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: USUÁRIOS SEM ROLE ===== */}
        <TabsContent value="sem-tipo" className="space-y-4">
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
              {bulkMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Adicionar todos como aluno
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
            usuário(s) não listado(s)
          </p>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <UserCheck className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-foreground font-medium">Nenhum usuário fora da base</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card rounded-xl shadow-card border border-border overflow-hidden"
            >
              <div className="overflow-auto max-h-[calc(100vh-360px)]">
                <table className="w-full min-w-[900px]">
                  <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                    <tr className="border-b border-border">

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
        </TabsContent>

        {/* ===== TAB 2: MATRÍCULAS FALTANDO ===== */}
        <TabsContent value="matriculas" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar matrícula, nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMissingCSV}
                disabled={filteredMissing.length === 0}
                className="gap-2"
              >
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMissingPDF}
                disabled={filteredMissing.length === 0}
                className="gap-2"
              >
                <FileText className="w-4 h-4" /> Exportar PDF
              </Button>
            </div>
          </div>

          {/* Explicação dos motivos */}
          <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-card-foreground">
                  Por que esses números sumiram?
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A sequência de matrículas segue o padrão{" "}
                  <span className="font-mono font-semibold text-foreground">COOP-XXXXXX</span> e
                  deve ser contínua. Quando um número não aparece, normalmente é por um destes
                  motivos:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside ml-1">
                  <li>
                    <span className="font-medium text-foreground">Usuário excluído:</span> a conta
                    foi removida do sistema, mas o número não foi reaproveitado.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Cadastro incompleto:</span> o
                    usuário iniciou o registro, recebeu um número, mas nunca finalizou o perfil.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Matrícula apagada manualmente:</span>{" "}
                    alguém limpou o campo <span className="font-mono">enrollment_number</span> do
                    perfil sem reatribuir.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Matrícula alterada:</span> o
                    número foi trocado por outro, deixando uma lacuna na sequência.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Falha na importação:</span>{" "}
                    cadastros migrados de planilhas podem ter pulado números.
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  As sugestões abaixo são geradas a partir de usuários{" "}
                  <span className="font-medium text-foreground">sem matrícula</span> (mais antigos
                  primeiro), para que você possa vinculá-los aos números faltantes e fechar as
                  lacunas.
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filteredMissing.length}</span>{" "}
            matrícula(s) faltante(s) identificada(s) na sequência.
          </p>

          {missingLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : filteredMissing.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <UserCheck className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-foreground font-medium">Sequência de matrículas íntegra</p>
              <p className="text-sm text-muted-foreground mt-1">
                Não há lacunas no padrão COOP-XXXXXX.
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Matrícula faltante
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Possível usuário
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Motivo provável
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMissing.map((m, i) => (
                      <tr
                        key={`${m.missing_enrollment_number}-${i}`}
                        className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <td className="py-3 px-4 text-xs font-mono font-semibold text-violet-600 dark:text-violet-400">
                          {m.missing_enrollment_number}
                        </td>
                        <td className="py-3 px-4 text-sm text-card-foreground">
                          {m.possible_user_name || (
                            <span className="text-muted-foreground italic">Sem sugestão</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {m.possible_user_email || "—"}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs">
                          {inferMissingReason(m)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!m.possible_user_id || actionLoading === m.possible_user_id}
                            onClick={() =>
                              m.possible_user_id &&
                              setLinkPending({
                                userId: m.possible_user_id,
                                userName: m.possible_user_name,
                                enrollment: m.missing_enrollment_number,
                              })
                            }
                            className="gap-2"
                          >
                            {actionLoading === m.possible_user_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Link2 className="w-4 h-4" />
                            )}
                            Vincular matrícula
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== TAB 3: SEM MATRÍCULA / INVÁLIDAS ===== */}
        <TabsContent value="invalidas" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Select
              value={enrollmentFilter}
              onValueChange={(v) => setEnrollmentFilter(v as EnrollmentFilter)}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sem_matricula">Sem matrícula</SelectItem>
                <SelectItem value="matricula_invalida">Matrícula inválida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filteredInvalid.length}</span>{" "}
            usuário(s) com problema, ordenado por mais antigos primeiro.
          </p>

          {invalidLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : filteredInvalid.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <UserCheck className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-foreground font-medium">Tudo certo por aqui</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Matrícula
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Cadastro
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvalid.map((u) => (
                      <tr
                        key={u.user_id}
                        className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm font-medium text-card-foreground">
                          {u.full_name || "Sem nome"}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {u.email || "—"}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                          {u.enrollment_number || "—"}
                        </td>
                        <td className="py-3 px-4">
                          {u.reason === "sem_matricula" ? (
                            <Badge variant="destructive">Sem matrícula</Badge>
                          ) : (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                              Matrícula inválida
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmação individual: atribuir tipo */}
      <AlertDialog open={!!pendingUser} onOpenChange={(o) => !o && setPendingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Definir{" "}
              <span className="font-semibold">{pendingUser?.full_name || "este usuário"}</span> como
              qual tipo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select
              value={pendingRole}
              onValueChange={(v) => setPendingRole(v as "aluno" | "cooperado")}
            >
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

      {/* Confirmação: vincular matrícula */}
      <AlertDialog open={!!linkPending} onOpenChange={(o) => !o && setLinkPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vincular matrícula</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar atribuição da matrícula{" "}
              <span className="font-mono font-semibold">{linkPending?.enrollment}</span> ao usuário{" "}
              <span className="font-semibold">{linkPending?.userName || "selecionado"}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!linkPending) return;
                setActionLoading(linkPending.userId);
                linkMut.mutate({
                  userId: linkPending.userId,
                  enrollment: linkPending.enrollment,
                });
                setLinkPending(null);
              }}
            >
              Vincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
