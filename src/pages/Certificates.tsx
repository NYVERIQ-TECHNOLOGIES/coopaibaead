import { motion } from "framer-motion";
import { Award, Search, CheckCircle, Clock, Upload, ToggleLeft, ToggleRight, FileImage, Trash2, Download, Loader2, Plus, Printer, RefreshCw, XCircle, ClipboardCheck, Settings, MoreHorizontal, Filter, X, BarChart3, History } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SignedImage from "@/components/SignedImage";
import { SignaturePad, SignaturePadHandle } from "@/components/SignaturePad";
import { CERT_STATUS_LABEL, CERT_STATUS_STYLE } from "@/lib/certificates";
import CertificateAuditDialog from "@/components/CertificateAuditDialog";

type Cert = any;

export default function Certificates() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterCourse, setFilterCourse] = useState<string>("todos");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const isStaff = isAdmin || role === "moderador";
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Pickup / cancel / audit state
  const [pickupCert, setPickupCert] = useState<Cert | null>(null);
  const [cancelCert, setCancelCert] = useState<Cert | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [auditCert, setAuditCert] = useState<Cert | null>(null);

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["certificates", isAdmin, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("certificates")
        .select("*, courses(title), profiles!certificates_user_id_fkey(full_name, cpf)")
        .order("created_at", { ascending: false });
      if (!isStaff && user) {
        query = query.eq("user_id", user.id);
      }
      const { data } = await query;
      return data ?? [];
    },
    enabled: isStaff || !!user,
  });

  // Enrich with requester role labels (issued_by → role)
  const issuerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of certificates as any[]) if (c.issued_by) ids.add(c.issued_by);
    return Array.from(ids);
  }, [certificates]);

  const { data: issuerRoles = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["cert-issuer-roles", issuerIds],
    enabled: issuerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", issuerIds);
      const map: Record<string, string[]> = {};
      for (const r of (data || []) as any[]) {
        if (!map[r.user_id]) map[r.user_id] = [];
        map[r.user_id].push(r.role);
      }
      return map;
    },
  });

  const ROLE_LABEL: Record<string, string> = {
    admin: "Administrador",
    moderador: "Moderador",
    cooperado: "Cooperado",
    cooperado_eventual: "Cooperado eventual",
    aluno: "Aluno",
  };
  const formatIssuerProfile = (cert: any): string => {
    const roles: string[] = (cert.issued_by && (issuerRoles as Record<string, string[]>)[cert.issued_by]) || [];
    if (roles.length === 0) {
      return cert.issued_by && cert.issued_by === cert.user_id ? "Aluno (auto-solicitação)" : "—";
    }
    const priority = ["admin", "moderador", "cooperado", "cooperado_eventual", "aluno"];
    const primary = priority.find((r) => roles.includes(r)) || roles[0];
    const label = ROLE_LABEL[primary] || primary;
    return cert.issued_by === cert.user_id ? `${label} (auto-solicitação)` : label;
  };

  const { data: templates = [] } = useQuery({
    queryKey: ["certificate-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("certificate_templates").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-for-cert"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name").order("full_name");
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-for-cert"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").order("title");
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const uploadTemplate = useMutation({
    mutationFn: async () => {
      if (!templateFile || !templateName.trim()) throw new Error("Preencha todos os campos");
      const ext = templateFile.name.split(".").pop();
      const path = `templates/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, templateFile);
      if (upErr) throw upErr;
      const { error } = await supabase.from("certificate_templates").insert({
        name: templateName.trim(), file_url: path, uploaded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificate-templates"] });
      setUploadOpen(false); setTemplateName(""); setTemplateFile(null);
      toast({ title: "Modelo enviado com sucesso!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("certificate_templates").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["certificate-templates"] }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("certificate_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificate-templates"] });
      toast({ title: "Modelo excluído" });
    },
  });

  const callGenerate = async (payload: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-certificate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Erro ao gerar certificado");
    return json;
  };

  const openPdfSafely = async (code: string, { download = false }: { download?: boolean } = {}) => {
    const filename = `${code}.pdf`;
    const printWindow = !download ? window.open("about:blank", "_blank") : null;
    if (printWindow) {
      printWindow.document.write("<p style='font-family: sans-serif; padding: 24px'>Preparando certificado...</p>");
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-certificate?code=${encodeURIComponent(code)}${download ? "&download=1" : ""}`;
      const response = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || "Não foi possível carregar o PDF");
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      if (printWindow) {
        printWindow.location.href = blobUrl;
      } else {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error: any) {
      printWindow?.close();
      toast({ title: "Erro ao abrir certificado", description: error?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const generateCert = useMutation({
    mutationFn: async () => {
      if (!selectedStudent || !selectedCourse) throw new Error("Selecione aluno e curso");
      return callGenerate({ user_id: selectedStudent, course_id: selectedCourse });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      setGenerateOpen(false); setSelectedStudent(""); setSelectedCourse("");
      toast({ title: "Certificado gerado!", description: `Código: ${data.certificate.code} — disponível para retirada presencial.` });
      if (isAdmin) openPdfSafely(data.certificate.code);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const reissueCert = useMutation({
    mutationFn: async (cert: Cert) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reissue-certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ certificate_id: cert.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao reemitir certificado");
      return json;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      toast({ title: "Certificado reemitido", description: `Código preservado: ${data.certificate.code} (reemissão #${data.certificate.reissue_count})` });
      openPdfSafely(data.certificate.code);
    },
    onError: (e: any) => toast({ title: "Erro ao reemitir", description: e.message, variant: "destructive" }),
  });


  const cancelCertMut = useMutation({
    mutationFn: async () => {
      if (!cancelCert) return;
      if (!cancelReason.trim()) throw new Error("Informe o motivo do cancelamento");
      const { error } = await supabase.rpc("cancel_certificate", {
        _certificate_id: cancelCert.id, _reason: cancelReason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      setCancelCert(null); setCancelReason("");
      toast({ title: "Certificado cancelado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const printCert = async (cert: Cert) => {
    if (!cert.pdf_path) {
      toast({ title: "PDF indisponível", description: "Este certificado não possui PDF arquivado.", variant: "destructive" });
      return;
    }
    openPdfSafely(cert.code);
  };

  const downloadCert = async (cert: Cert) => {
    if (!cert.pdf_path) {
      toast({ title: "PDF indisponível", description: "Este certificado não possui PDF arquivado.", variant: "destructive" });
      return;
    }
    openPdfSafely(cert.code, { download: true });
  };

  const printReceipt = async (cert: Cert, { download = false }: { download?: boolean } = {}) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pickup-receipt?code=${encodeURIComponent(cert.code)}${download ? "&download=1" : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erro ao gerar comprovante");
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement("a");
        a.href = blobUrl; a.download = `comprovante-${cert.code}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        window.open(blobUrl, "_blank", "noopener,noreferrer");
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e: any) {
      toast({ title: "Erro ao gerar comprovante", description: e.message, variant: "destructive" });
    }
  };

  const onLogoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem PNG/JPG", variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    try {
      const path = file.type.includes("png") ? "branding/logo-coopaiba.png" : "branding/logo-coopaiba.jpg";
      const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      toast({ title: "Logo atualizado", description: "Será aplicado nos próximos certificados gerados." });
    } catch (err: any) {
      toast({ title: "Erro ao enviar logo", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };


  const emitted = certificates.filter((c) => c.status === "emitido" || c.status === "disponivel_retirada").length;
  const pending = certificates.filter((c) => c.status === "pendente").length;
  const retirados = certificates.filter((c) => c.status === "retirado").length;

  const filtered = useMemo(() => {
    return certificates.filter((c) => {
      const name = (c as any).profiles?.full_name ?? c.student_name_snapshot ?? "";
      const cpf = (c as any).profiles?.cpf ?? c.student_cpf_snapshot ?? "";
      const course = (c as any).courses?.title ?? c.course_title_snapshot ?? "";
      const q = search.trim().toLowerCase();
      if (q) {
        const cpfDigits = cpf.replace(/\D/g, "");
        const qDigits = q.replace(/\D/g, "");
        const matches =
          name.toLowerCase().includes(q) ||
          course.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (qDigits && cpfDigits.includes(qDigits));
        if (!matches) return false;
      }
      if (filterStatus !== "todos" && c.status !== filterStatus) return false;
      if (filterCourse !== "todos" && c.course_id !== filterCourse) return false;
      if (filterDateFrom) {
        const ref = new Date(c.issued_at || c.created_at);
        if (ref < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const ref = new Date(c.issued_at || c.created_at);
        const end = new Date(filterDateTo); end.setHours(23, 59, 59, 999);
        if (ref > end) return false;
      }
      return true;
    });
  }, [certificates, search, filterStatus, filterCourse, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setSearch(""); setFilterStatus("todos"); setFilterCourse("todos");
    setFilterDateFrom(""); setFilterDateTo("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Certificados</h1>
          <p className="text-muted-foreground mt-1">Gerencie certificados, modelos e retirada presencial</p>
        </div>
        {isStaff && (
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <Button onClick={() => setGenerateOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Gerar Certificado
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" onClick={() => setUploadOpen(true)} className="gap-2">
                <Upload className="w-4 h-4" /> Enviar Modelo
              </Button>
            )}
            {isAdmin && (
              <>
                <input ref={logoRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onLogoSelected} />
                <Button variant="outline" className="gap-2" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}>
                  {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />}
                  {uploadingLogo ? "Enviando..." : "Logo COOPAIBA"}
                </Button>
              </>
            )}
            <Button asChild variant="outline" className="gap-2">
              <Link to="/certificates/relatorios"><BarChart3 className="w-4 h-4" /> Relatórios</Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="outline" className="gap-2">
                <Link to="/certificates/configuracoes"><Settings className="w-4 h-4" /> Retirada</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: certificates.length, icon: Award, gradient: "gradient-primary" },
          { label: "Disponíveis", value: emitted, icon: CheckCircle, gradient: "gradient-secondary" },
          { label: "Retirados", value: retirados, icon: ClipboardCheck, gradient: "bg-success" },
          { label: "Em processamento", value: pending, icon: Clock, gradient: "gradient-accent" },
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

      {isAdmin ? (
        <Tabs defaultValue="certificates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="certificates">Certificados</TabsTrigger>
            <TabsTrigger value="templates">Modelos ({templates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="certificates" className="space-y-4">
            <AdminFilters
              search={search} setSearch={setSearch}
              filterStatus={filterStatus} setFilterStatus={setFilterStatus}
              filterCourse={filterCourse} setFilterCourse={setFilterCourse}
              filterDateFrom={filterDateFrom} setFilterDateFrom={setFilterDateFrom}
              filterDateTo={filterDateTo} setFilterDateTo={setFilterDateTo}
              clearFilters={clearFilters} courses={courses}
            />
            <CertificatesTable
              filtered={filtered}
              isLoading={isLoading}
              isStaff={isStaff}
              isAdmin={isAdmin}
              formatIssuerProfile={formatIssuerProfile}
              onPickup={(c) => setPickupCert(c)}
              onPrint={printCert}
              onReceipt={(c) => printReceipt(c)}
              onReissue={(c) => reissueCert.mutate(c)}
              onCancel={(c) => { setCancelCert(c); setCancelReason(""); }}
              onAudit={(c) => setAuditCert(c)}
            />
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            {templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileImage className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum modelo de certificado enviado</p>
                <Button variant="outline" className="mt-4" onClick={() => setUploadOpen(true)}>Enviar primeiro modelo</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((tpl) => (
                  <motion.div key={tpl.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className={`bg-card rounded-xl border shadow-card overflow-hidden transition-all ${tpl.active ? "border-primary/50" : "border-border opacity-70"}`}>
                    <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
                      {tpl.file_url.match(/\.(png|jpg|jpeg|webp|svg)$/i) ? (
                        <SignedImage path={tpl.file_url} alt={tpl.name} className="w-full h-full object-contain" />
                      ) : (
                        <FileImage className="w-16 h-16 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-card-foreground truncate">{tpl.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tpl.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {tpl.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Enviado em {new Date(tpl.created_at).toLocaleDateString("pt-BR")}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant={tpl.active ? "outline" : "default"} className="flex-1 gap-1"
                          onClick={() => toggleActive.mutate({ id: tpl.id, active: !tpl.active })}>
                          {tpl.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {tpl.active ? "Desativar" : "Ativar"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="gap-1"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteTemplate.mutate(tpl.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <CertificatesTable
          filtered={filtered.filter(() => true)}
          isLoading={isLoading}
          isStaff={isStaff}
          isAdmin={false}
          formatIssuerProfile={formatIssuerProfile}
          onPrint={printCert}
          onDownload={downloadCert}
        />
      )}

      {/* Upload template dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Modelo de Certificado</DialogTitle>
            <DialogDescription>Envie uma imagem (PNG, JPG) ou PDF como modelo base.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do modelo</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ex: Modelo padrão 2026" />
            </div>
            <div>
              <Label>Arquivo do modelo</Label>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)} />
              <Button variant="outline" className="w-full mt-1 gap-2" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4" />
                {templateFile ? templateFile.name : "Selecionar arquivo"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={() => uploadTemplate.mutate()} disabled={uploadTemplate.isPending || !templateFile || !templateName.trim()}>
              {uploadTemplate.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate certificate dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Certificado</DialogTitle>
            <DialogDescription>Selecione o aluno e o curso para gerar o certificado em PDF automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Aluno</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || "Sem nome"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Curso</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancelar</Button>
            <Button onClick={() => generateCert.mutate()} disabled={generateCert.isPending || !selectedStudent || !selectedCourse}>
              {generateCert.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>) : (<><Download className="w-4 h-4 mr-2" /> Gerar PDF</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pickup dialog */}
      <PickupDialog
        cert={pickupCert}
        onClose={() => setPickupCert(null)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["certificates"] });
          setPickupCert(null);
        }}
      />

      {/* Cancel dialog */}
      <AlertDialog open={!!cancelCert} onOpenChange={(open) => !open && setCancelCert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar certificado {cancelCert?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marca o certificado como cancelado. O cooperado verá o status atualizado imediatamente.
              Informe o motivo abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Motivo do cancelamento</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex.: dados incorretos, duplicidade…" rows={3} maxLength={500} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); cancelCertMut.mutate(); }}
              disabled={cancelCertMut.isPending || !cancelReason.trim()}
            >
              {cancelCertMut.isPending ? "Cancelando…" : "Cancelar certificado"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CertificateAuditDialog
        certificateId={auditCert?.id ?? null}
        certificateCode={auditCert?.code}
        onClose={() => setAuditCert(null)}
      />
    </div>
  );
}

function AdminFilters(props: {
  search: string; setSearch: (v: string) => void;
  filterStatus: string; setFilterStatus: (v: string) => void;
  filterCourse: string; setFilterCourse: (v: string) => void;
  filterDateFrom: string; setFilterDateFrom: (v: string) => void;
  filterDateTo: string; setFilterDateTo: (v: string) => void;
  clearFilters: () => void;
  courses: { id: string; title: string }[];
}) {
  const hasFilters = props.search || props.filterStatus !== "todos" || props.filterCourse !== "todos" || props.filterDateFrom || props.filterDateTo;
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="w-4 h-4" /> Filtros
        {hasFilters && (
          <Button size="sm" variant="ghost" className="ml-auto gap-1 h-7" onClick={props.clearFilters}>
            <X className="w-3.5 h-3.5" /> Limpar
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={props.search} onChange={(e) => props.setSearch(e.target.value)}
            placeholder="Nome, CPF, curso ou código…" className="pl-9" />
        </div>
        <Select value={props.filterStatus} onValueChange={props.setFilterStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Em processamento</SelectItem>
            <SelectItem value="emitido">Disponível para download</SelectItem>
            <SelectItem value="disponivel_retirada">Disponível para retirada</SelectItem>
            <SelectItem value="retirado">Retirado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
            <SelectItem value="erro">Erro na emissão</SelectItem>

          </SelectContent>
        </Select>
        <Select value={props.filterCourse} onValueChange={props.setFilterCourse}>
          <SelectTrigger><SelectValue placeholder="Curso" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os cursos</SelectItem>
            {props.courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="date" value={props.filterDateFrom} onChange={(e) => props.setFilterDateFrom(e.target.value)} />
          <Input type="date" value={props.filterDateTo} onChange={(e) => props.setFilterDateTo(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function CertificatesTable({
  filtered, isLoading, isStaff, isAdmin, formatIssuerProfile,
  onPickup, onPrint, onReceipt, onReissue, onCancel, onAudit, onDownload,
}: {
  filtered: any[]; isLoading: boolean; isStaff: boolean; isAdmin: boolean;
  formatIssuerProfile?: (c: any) => string;
  onPickup?: (c: any) => void; onPrint?: (c: any) => void;
  onReceipt?: (c: any) => void;
  onReissue?: (c: any) => void; onCancel?: (c: any) => void;
  onAudit?: (c: any) => void;
  onDownload?: (c: any) => void;
}) {
  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Código</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Cooperado</th>
              {isStaff && <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">CPF</th>}
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Curso</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Emissão</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Solicitado por</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={isStaff ? 8 : 7} className="text-center py-8 text-muted-foreground">Nenhum certificado encontrado</td></tr>
            ) : filtered.map((cert, i) => {
              const name = cert.profiles?.full_name ?? cert.student_name_snapshot ?? "—";
              const cpf = cert.profiles?.cpf ?? cert.student_cpf_snapshot ?? "—";
              const issuedRef = cert.issued_at || cert.created_at;
              const issuedDate = new Date(issuedRef);
              return (
                <motion.tr key={cert.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 text-sm font-mono text-primary font-medium">{cert.code}</td>
                  <td className="py-3 px-4 text-sm text-card-foreground">{name}</td>
                  {isStaff && <td className="py-3 px-4 text-xs text-muted-foreground font-mono">{cpf}</td>}
                  <td className="py-3 px-4 text-sm text-card-foreground">{cert.courses?.title ?? cert.course_title_snapshot ?? "—"}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                    <div>{issuedDate.toLocaleDateString("pt-BR")}</div>
                    <div className="text-xs opacity-70">{issuedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    <div className="text-card-foreground">{cert.issued_by_name ?? "—"}</div>
                    {formatIssuerProfile && (
                      <div className="text-[10px] uppercase tracking-wide opacity-70">{formatIssuerProfile(cert)}</div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${CERT_STATUS_STYLE[cert.status] || "text-muted-foreground"}`}>
                      {CERT_STATUS_LABEL[cert.status] || cert.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isAdmin ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem asChild>
                            <Link to={`/certificates/${cert.code}/retirada`}>Ver informações</Link>
                          </DropdownMenuItem>
                          {cert.status === "disponivel_retirada" && (
                            <DropdownMenuItem onClick={() => onPickup?.(cert)} className="gap-2">
                              <ClipboardCheck className="w-4 h-4" /> Registrar retirada
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onPrint?.(cert)} className="gap-2" disabled={!cert.pdf_path}>
                            <Printer className="w-4 h-4" /> Imprimir PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onReceipt?.(cert)} className="gap-2">
                            <ClipboardCheck className="w-4 h-4" /> Comprovante de retirada
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onAudit?.(cert)} className="gap-2">
                            <History className="w-4 h-4" /> Histórico
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {cert.status !== "cancelado" && (
                            <DropdownMenuItem onClick={() => onReissue?.(cert)} className="gap-2">
                              <RefreshCw className="w-4 h-4" /> Reemitir
                            </DropdownMenuItem>
                          )}
                          {cert.status !== "cancelado" && cert.status !== "retirado" && (
                            <DropdownMenuItem onClick={() => onCancel?.(cert)} className="gap-2 text-destructive focus:text-destructive">
                              <XCircle className="w-4 h-4" /> Cancelar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : cert.delivery_mode === "download" && (cert.status === "emitido" || cert.status === "retirado") ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => onPrint?.(cert)} className="gap-1">
                          <Printer className="w-3.5 h-3.5" /> Visualizar
                        </Button>
                        <Button size="sm" onClick={() => onDownload?.(cert)} className="gap-1">
                          <Download className="w-3.5 h-3.5" /> Baixar PDF
                        </Button>

                      </div>
                    ) : cert.status === "pendente" ? (
                      <span className="text-xs text-warning">Em processamento…</span>
                    ) : cert.status === "erro" ? (
                      <span className="text-xs text-destructive">Erro na emissão</span>
                    ) : (
                      <Link to={`/certificates/${cert.code}/retirada`} className="text-xs text-primary hover:underline">
                        Informações para retirada
                      </Link>
                    )}

                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function PickupDialog({ cert, onClose, onSuccess }: { cert: any | null; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const sigRef = useRef<SignaturePadHandle>(null);
  const [attendant, setAttendant] = useState("");
  const [doc, setDoc] = useState("");
  const [obs, setObs] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset when opening
  useMemo(() => {
    if (cert) { setAttendant(""); setDoc(""); setObs(""); setTimeout(() => sigRef.current?.clear(), 50); }
  }, [cert?.id]);

  const submit = async () => {
    if (!cert) return;
    if (attendant.trim().length < 2) return toast({ title: "Informe o nome do atendente", variant: "destructive" });
    if (doc.trim().length < 2) return toast({ title: "Informe o documento apresentado", variant: "destructive" });
    if (sigRef.current?.isEmpty()) return toast({ title: "Capture a assinatura do cooperado", variant: "destructive" });

    setSubmitting(true);
    try {
      const dataUrl = sigRef.current!.toDataURL();
      const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
      const path = `certificate-pickups/${cert.code}-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, bytes, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;

      const { error } = await supabase.rpc("register_certificate_pickup", {
        _certificate_id: cert.id,
        _attendant_name: attendant.trim(),
        _document_presented: doc.trim(),
        _observations: obs.trim() || null,
        _signature_url: path,
      });
      if (error) throw error;
      toast({ title: "Retirada registrada com sucesso" });
      onSuccess();
    } catch (e: any) {
      toast({ title: "Erro ao registrar retirada", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!cert} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar retirada presencial</DialogTitle>
          <DialogDescription>
            Confirme a identidade do cooperado e capture a assinatura no comprovante de retirada.
          </DialogDescription>
        </DialogHeader>
        {cert && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Certificado:</span> <span className="font-mono">{cert.code}</span></p>
              <p><span className="text-muted-foreground">Cooperado:</span> {cert.profiles?.full_name ?? cert.student_name_snapshot ?? "—"}</p>
              <p><span className="text-muted-foreground">CPF:</span> {cert.profiles?.cpf ?? cert.student_cpf_snapshot ?? "—"}</p>
              <p><span className="text-muted-foreground">Curso:</span> {cert.courses?.title ?? cert.course_title_snapshot ?? "—"}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome do atendente</Label>
                <Input value={attendant} onChange={(e) => setAttendant(e.target.value)} maxLength={120} placeholder="Quem está entregando" />
              </div>
              <div>
                <Label>Documento apresentado</Label>
                <Input value={doc} onChange={(e) => setDoc(e.target.value)} maxLength={120} placeholder="Ex.: RG 12.345.678-9" />
              </div>
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} maxLength={500} />
            </div>
            <div>
              <Label>Assinatura do cooperado</Label>
              <SignaturePad ref={sigRef} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="gap-2">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando…</> : <><ClipboardCheck className="w-4 h-4" /> Confirmar retirada</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
