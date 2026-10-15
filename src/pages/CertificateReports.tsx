import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { FileSpreadsheet, FileText, ArrowLeft, Award, ClipboardCheck, Clock, XCircle, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CERT_STATUS_LABEL } from "@/lib/certificates";
import { exportSpreadsheet } from "@/lib/spreadsheet";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function CertificateReports() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterCourse, setFilterCourse] = useState("todos");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["certificate-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("*, courses(title), profiles!certificates_user_id_profiles_fkey(full_name, cpf, enrollment_number, cooperativa)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-for-reports"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").order("title");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return certificates.filter((c: any) => {
      if (filterStatus !== "todos" && c.status !== filterStatus) return false;
      if (filterCourse !== "todos" && c.course_id !== filterCourse) return false;
      const ref = new Date(c.issued_at || c.created_at);
      if (filterDateFrom && ref < new Date(filterDateFrom)) return false;
      if (filterDateTo) {
        const end = new Date(filterDateTo); end.setHours(23, 59, 59, 999);
        if (ref > end) return false;
      }
      return true;
    });
  }, [certificates, filterStatus, filterCourse, filterDateFrom, filterDateTo]);

  const stats = useMemo(() => ({
    total: filtered.length,
    emitidos: filtered.filter((c: any) => c.status === "emitido" || c.status === "disponivel_retirada").length,
    retirados: filtered.filter((c: any) => c.status === "retirado").length,
    pendentes: filtered.filter((c: any) => c.status === "disponivel_retirada").length,
    cancelados: filtered.filter((c: any) => c.status === "cancelado").length,
  }), [filtered]);

  const buildRows = () => filtered.map((c: any) => ({
    Código: c.code,
    Cooperado: c.profiles?.full_name || c.student_name_snapshot || "-",
    CPF: c.profiles?.cpf || c.student_cpf_snapshot || "-",
    Matrícula: c.profiles?.enrollment_number || "-",
    Cooperativa: c.profiles?.cooperativa || "-",
    Curso: c.courses?.title || c.course_title_snapshot || "-",
    Status: CERT_STATUS_LABEL[c.status] || c.status,
    "Emitido em": c.issued_at ? new Date(c.issued_at).toLocaleDateString("pt-BR") : "-",
    "Retirado em": c.pickup_registered_at ? new Date(c.pickup_registered_at).toLocaleDateString("pt-BR") : "-",
    "Atendente retirada": c.pickup_attendant_name || "-",
    "Documento apresentado": c.pickup_document_presented || "-",
    "Cancelado em": c.cancelled_at ? new Date(c.cancelled_at).toLocaleDateString("pt-BR") : "-",
    "Motivo cancelamento": c.cancellation_reason || "-",
  }));

  const exportExcel = async () => {
    const rows = buildRows();
    if (rows.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }
    await exportSpreadsheet(rows, "Certificados", `relatorio-certificados-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Excel exportado", description: `${rows.length} registro(s)` });
  };

  const exportPDF = () => {
    const rows = buildRows();
    if (rows.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Relatório de Certificados — Coopaíba", 14, 14);
    doc.setFontSize(9);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}  ·  ${rows.length} registro(s)`, 14, 20);

    const headers = ["Código", "Cooperado", "CPF", "Curso", "Status", "Emitido", "Retirado"];
    autoTable(doc, {
      startY: 26,
      head: [headers],
      body: rows.map((r: any) => [
        r.Código, r.Cooperado, r.CPF, r.Curso, r.Status, r["Emitido em"], r["Retirado em"]
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    doc.save(`relatorio-certificados-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: "PDF exportado" });
  };

  const downloadAllZip = async () => {
    const eligible = filtered.filter((c: any) => c.pdf_path && c.status !== "cancelado");
    if (eligible.length === 0) {
      toast({ title: "Nenhum certificado disponível para download", description: "Aplique os filtros desejados ou aguarde a emissão dos PDFs.", variant: "destructive" });
      return;
    }
    setDownloadingAll(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const { data: { session } } = await supabase.auth.getSession();
      const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-certificate`;
      let ok = 0, fail = 0, cursor = 0;
      const runOne = async (cert: any) => {
        try {
          const res = await fetch(`${base}?code=${encodeURIComponent(cert.code)}&download=1`, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          if (!res.ok) throw new Error(await res.text());
          const blob = await res.blob();
          const name = ((cert as any).profiles?.full_name || cert.student_name_snapshot || "aluno")
            .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
          zip.file(`${name}-${cert.code}.pdf`, blob);
          ok++;
        } catch (e) {
          console.error("download failed", cert.code, e);
          fail++;
        }
      };
      const workers = Array.from({ length: 3 }, async () => {
        while (cursor < eligible.length) {
          const i = cursor++;
          await runOne(eligible[i]);
        }
      });
      toast({ title: "Preparando ZIP", description: `Baixando ${eligible.length} certificados...` });
      await Promise.all(workers);
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificados-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast({ title: "Download concluído", description: `${ok}/${eligible.length} incluídos (${fail} falhas).` });
    } catch (e: any) {
      toast({ title: "Erro no download em lote", description: e.message, variant: "destructive" });
    } finally {
      setDownloadingAll(false);
    }
  };

  // Aggregated report by course
  const porCurso = useMemo(() => {
    const map = new Map<string, { curso: string; total: number; retirados: number; pendentes: number; cancelados: number }>();
    for (const c of filtered as any[]) {
      const key = c.courses?.title || c.course_title_snapshot || "—";
      const entry = map.get(key) || { curso: key, total: 0, retirados: 0, pendentes: 0, cancelados: 0 };
      entry.total++;
      if (c.status === "retirado") entry.retirados++;
      if (c.status === "disponivel_retirada") entry.pendentes++;
      if (c.status === "cancelado") entry.cancelados++;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to="/certificates"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
          </Button>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Relatórios de Certificados</h1>
          <p className="text-muted-foreground mt-1">Visualize, filtre e exporte certificados emitidos, retirados e pendentes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadAllZip} disabled={downloadingAll} className="gap-2">
            {downloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloadingAll ? "Baixando..." : "Baixar todos (ZIP)"}
          </Button>
          <Button variant="outline" onClick={exportExcel} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
          </Button>
          <Button onClick={exportPDF} className="gap-2">
            <FileText className="w-4 h-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total, icon: Award, gradient: "gradient-primary" },
          { label: "Emitidos", value: stats.emitidos, icon: Award, gradient: "gradient-secondary" },
          { label: "Aguardando retirada", value: stats.pendentes, icon: Clock, gradient: "gradient-accent" },
          { label: "Retirados", value: stats.retirados, icon: ClipboardCheck, gradient: "bg-success" },
          { label: "Cancelados", value: stats.cancelados, icon: XCircle, gradient: "bg-destructive" },
        ].map((stat) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-4 shadow-card border border-border flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${stat.gradient} flex items-center justify-center shrink-0`}>
              <stat.icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-heading font-bold text-card-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Em processamento</SelectItem>
                <SelectItem value="disponivel_retirada">Aguardando retirada</SelectItem>
                <SelectItem value="emitido">Emitido</SelectItem>
                <SelectItem value="retirado">Retirado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Curso</Label>
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-heading font-semibold">Resumo por curso</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Curso</th>
                <th className="text-right p-3">Total</th>
                <th className="text-right p-3">Aguardando</th>
                <th className="text-right p-3">Retirados</th>
                <th className="text-right p-3">Cancelados</th>
              </tr>
            </thead>
            <tbody>
              {porCurso.length === 0 ? (
                <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">Nenhum dado para os filtros aplicados</td></tr>
              ) : porCurso.map((row) => (
                <tr key={row.curso} className="border-t border-border">
                  <td className="p-3">{row.curso}</td>
                  <td className="p-3 text-right font-medium">{row.total}</td>
                  <td className="p-3 text-right">{row.pendentes}</td>
                  <td className="p-3 text-right text-success">{row.retirados}</td>
                  <td className="p-3 text-right text-destructive">{row.cancelados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-heading font-semibold">Detalhamento ({filtered.length})</h2>
        </div>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left p-3">Código</th>
                <th className="text-left p-3">Cooperado</th>
                <th className="text-left p-3">CPF</th>
                <th className="text-left p-3">Curso</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Emitido</th>
                <th className="text-left p-3">Retirado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">Nenhum certificado encontrado</td></tr>
              ) : filtered.map((c: any) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{c.code}</td>
                  <td className="p-3">{c.profiles?.full_name || c.student_name_snapshot || "—"}</td>
                  <td className="p-3 text-xs">{c.profiles?.cpf || c.student_cpf_snapshot || "—"}</td>
                  <td className="p-3">{c.courses?.title || c.course_title_snapshot || "—"}</td>
                  <td className="p-3 text-xs">{CERT_STATUS_LABEL[c.status] || c.status}</td>
                  <td className="p-3 text-xs">{c.issued_at ? new Date(c.issued_at).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="p-3 text-xs">{c.pickup_registered_at ? new Date(c.pickup_registered_at).toLocaleDateString("pt-BR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
