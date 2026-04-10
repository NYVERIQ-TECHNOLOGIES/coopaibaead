import { motion } from "framer-motion";
import { Award, Search, CheckCircle, Clock, Upload, ToggleLeft, ToggleRight, FileImage, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Certificates() {
  const [search, setSearch] = useState("");
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  // Certificates
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

  // Templates
  const { data: templates = [] } = useQuery({
    queryKey: ["certificate-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificate_templates")
        .select("*")
        .order("created_at", { ascending: false });
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
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
      const { error } = await supabase.from("certificate_templates").insert({
        name: templateName.trim(),
        file_url: urlData.publicUrl,
        uploaded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificate-templates"] });
      setUploadOpen(false);
      setTemplateName("");
      setTemplateFile(null);
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

  const emitted = certificates.filter(c => c.status === "emitido").length;
  const pending = certificates.filter(c => c.status === "pendente").length;

  const filtered = certificates.filter((c) => {
    const name = (c as any).profiles?.full_name ?? "";
    const course = (c as any).courses?.title ?? "";
    return name.toLowerCase().includes(search.toLowerCase()) || course.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Certificados</h1>
          <p className="text-muted-foreground mt-1">Gerencie certificados e modelos</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" /> Enviar Modelo
          </Button>
        )}
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

      {isAdmin ? (
        <Tabs defaultValue="certificates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="certificates">Certificados</TabsTrigger>
            <TabsTrigger value="templates">Modelos ({templates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="certificates">
            <CertificatesTable search={search} setSearch={setSearch} filtered={filtered} isLoading={isLoading} />
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
                        <img src={tpl.file_url} alt={tpl.name} className="w-full h-full object-contain" />
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
                      <p className="text-xs text-muted-foreground">
                        Enviado em {new Date(tpl.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant={tpl.active ? "outline" : "default"} className="flex-1 gap-1"
                          onClick={() => toggleActive.mutate({ id: tpl.id, active: !tpl.active })}>
                          {tpl.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {tpl.active ? "Desativar" : "Ativar"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="gap-1">
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
        <CertificatesTable search={search} setSearch={setSearch} filtered={filtered} isLoading={isLoading} />
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Modelo de Certificado</DialogTitle>
            <DialogDescription>Envie uma imagem (PNG, JPG) ou PDF como modelo base para os certificados.</DialogDescription>
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
    </div>
  );
}

function CertificatesTable({ search, setSearch, filtered, isLoading }: {
  search: string; setSearch: (v: string) => void; filtered: any[]; isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
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
                    <td className="py-3 px-4 text-sm text-card-foreground">{cert.profiles?.full_name ?? "—"}</td>
                    <td className="py-3 px-4 text-sm text-card-foreground">{cert.courses?.title ?? "—"}</td>
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
