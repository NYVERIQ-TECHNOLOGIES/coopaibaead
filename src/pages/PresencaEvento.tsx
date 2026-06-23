import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Download, FileSpreadsheet, FileText, Lock, Unlock, Pencil, Search, Users } from "lucide-react";

export default function PresencaEvento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: evento } = useQuery({
    queryKey: ["presenca_evento", id],
    queryFn: async () => {
      await supabase.rpc("encerrar_eventos_vencidos" as any);
      const { data, error } = await supabase.from("presenca_eventos").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchInterval: 60_000,
  });


  const { data: assinaturas = [] } = useQuery({
    queryKey: ["presenca_assinaturas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presenca_assinaturas")
        .select("*")
        .eq("evento_id", id!)
        .order("horario", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`presenca-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "presenca_assinaturas", filter: `evento_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["presenca_assinaturas", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const publicUrl = useMemo(() => evento ? `${window.location.origin}/p/${evento.codigo}` : "", [evento]);

  const filtered = assinaturas.filter((a: any) =>
    a.nome.toLowerCase().includes(q.toLowerCase()) ||
    (a.cpf || "").includes(q) ||
    (a.matricula || "").toLowerCase().includes(q.toLowerCase()),
  );

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link copiado!" });
  };

  const toggleStatus = async () => {
    if (!evento) return;
    const newStatus = evento.status === "aberto" ? "encerrado" : "aberto";
    const { error } = await supabase.from("presenca_eventos").update({ status: newStatus }).eq("id", evento.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["presenca_evento", id] });
    toast({ title: `Evento ${newStatus}` });
  };

  const downloadQR = () => {
    const canvas = document.getElementById("evento-qr") as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${evento?.codigo}.png`;
    a.click();
  };

  const exportExcel = () => {
    if (!evento) return;
    const rows = assinaturas.map((a: any) => ({
      Nome: a.nome,
      CPF: a.cpf || "",
      Matrícula: a.matricula || "",
      "Tipo Assinatura": a.assinatura_tipo,
      Horário: new Date(a.horario).toLocaleString("pt-BR"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presenças");
    XLSX.writeFile(wb, `presencas-${evento.codigo}.xlsx`);
  };

  const exportPDF = () => {
    if (!evento) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Lista de Presença - ${evento.nome}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date(evento.data).toLocaleDateString("pt-BR")}${evento.horario ? ` ${evento.horario.slice(0,5)}` : ""}`, 14, 26);
    if (evento.local) doc.text(`Local: ${evento.local}`, 14, 32);
    doc.text(`Total de presenças: ${assinaturas.length}`, 14, 38);
    autoTable(doc, {
      startY: 44,
      head: [["#", "Nome", "CPF", "Matrícula", "Horário"]],
      body: assinaturas.map((a: any, i) => [
        i + 1,
        a.nome,
        a.cpf || "—",
        a.matricula || "—",
        new Date(a.horario).toLocaleString("pt-BR"),
      ]),
    });
    doc.save(`presencas-${evento.codigo}.pdf`);
  };

  if (!evento) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/presenca")} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">{evento.nome}</h1>
          <p className="text-muted-foreground mt-1 capitalize">{evento.tipo} · {new Date(evento.data).toLocaleDateString("pt-BR")} {evento.horario ? `· ${evento.horario.slice(0,5)}` : ""}</p>
          {evento.local && <p className="text-sm text-muted-foreground">{evento.local}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(`/presenca/${evento.id}/editar`)}>
            <Pencil className="w-4 h-4 mr-2" /> Editar
          </Button>
          <Button variant="outline" onClick={toggleStatus}>
            {evento.status === "aberto" ? <><Lock className="w-4 h-4 mr-2" /> Encerrar</> : <><Unlock className="w-4 h-4 mr-2" /> Reabrir</>}
          </Button>
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
          <Button variant="outline" onClick={exportPDF}><FileText className="w-4 h-4 mr-2" /> PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR + link */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-heading font-semibold text-card-foreground">QR Code de Acesso</h2>
          <div className="bg-white p-4 rounded-lg flex items-center justify-center">
            <QRCodeCanvas id="evento-qr" value={publicUrl} size={200} level="H" includeMargin />
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Código</p>
            <p className="font-mono text-2xl font-bold text-primary">{evento.codigo}</p>
          </div>
          <div className="flex gap-2">
            <Input readOnly value={publicUrl} className="text-xs" />
            <Button size="icon" variant="outline" onClick={copyLink}><Copy className="w-4 h-4" /></Button>
          </div>
          <Button variant="outline" className="w-full" onClick={downloadQR}>
            <Download className="w-4 h-4 mr-2" /> Baixar QR
          </Button>
        </div>

        {/* Lista */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-card-foreground">
              <Users className="w-5 h-5 text-primary" />
              <span className="font-semibold">{assinaturas.length} presença{assinaturas.length === 1 ? "" : "s"}</span>
              {evento.expected_count && <span className="text-sm text-muted-foreground">/ {evento.expected_count} esperadas</span>}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase">
                  <th className="text-left py-2 px-4">Nome</th>
                  <th className="text-left py-2 px-4">CPF</th>
                  <th className="text-left py-2 px-4">Matrícula</th>
                  <th className="text-left py-2 px-4">Horário</th>
                  <th className="text-left py-2 px-4">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma presença ainda</td></tr>
                ) : filtered.map((a: any) => (
                  <tr key={a.id} className="border-b border-border last:border-0 text-sm">
                    <td className="py-2 px-4 font-medium text-card-foreground">{a.nome}</td>
                    <td className="py-2 px-4 text-muted-foreground">{a.cpf || "—"}</td>
                    <td className="py-2 px-4 text-muted-foreground">{a.matricula || "—"}</td>
                    <td className="py-2 px-4 text-muted-foreground">{new Date(a.horario).toLocaleTimeString("pt-BR")}</td>
                    <td className="py-2 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{a.assinatura_tipo}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
