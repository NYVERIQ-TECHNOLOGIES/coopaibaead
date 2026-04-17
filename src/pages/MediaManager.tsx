import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Video, FileText, MonitorPlay, Trash2, Search, Filter, Shield, Plus, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getSignedUrl } from "@/lib/storage";

type FileType = "video" | "pdf" | "video_aula";

interface MediaFile {
  id: string;
  title: string;
  description: string | null;
  file_type: FileType;
  file_url: string;
  file_size: string | null;
  thumbnail_url: string | null;
  course_id: string | null;
  module_name: string | null;
  cooperado_only: boolean;
  created_at: string;
}

const typeConfig: Record<FileType, { icon: typeof Video; label: string; color: string; accept: string }> = {
  video: { icon: Video, label: "Vídeo", color: "text-blue-500 bg-blue-500/10", accept: "video/*" },
  pdf: { icon: FileText, label: "PDF", color: "text-red-500 bg-red-500/10", accept: ".pdf" },
  video_aula: { icon: MonitorPlay, label: "Videoaula", color: "text-purple-500 bg-purple-500/10", accept: "video/*" },
};

export default function MediaManager() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FileType | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileType, setFileType] = useState<FileType>("video");
  const [courseName, setCourseName] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [cooperadoOnly, setCooperadoOnly] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isAdmin = role === "admin";

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    const { data } = await supabase
      .from("media_files")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setFiles(data as MediaFile[]);
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setFileType("video");
    setCourseName(""); setModuleName(""); setCooperadoOnly(false);
    setSelectedFile(null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !title || !user) return;
    setUploading(true);

    try {
      const ext = selectedFile.name.split(".").pop();
      const path = `${fileType}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, selectedFile);

      if (uploadError) throw uploadError;

      // Store storage path; signed URL is generated when previewing
      const fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(1) + " MB";

      const { error: insertError } = await supabase.from("media_files").insert({
        title,
        description: description || null,
        file_type: fileType,
        file_url: path,
        file_size: fileSizeMB,
        course_id: courseName || null,
        module_name: moduleName || null,
        cooperado_only: cooperadoOnly,
        uploaded_by: user.id,
      });

      if (insertError) throw insertError;

      toast({ title: "Arquivo enviado com sucesso!" });
      setDialogOpen(false);
      resetForm();
      fetchFiles();
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("media_files").delete().eq("id", id);
    if (!error) {
      setFiles(files.filter(f => f.id !== id));
      toast({ title: "Arquivo removido" });
    }
  };

  const filtered = files.filter(f => {
    const matchSearch = f.title.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || f.file_type === filterType;
    return matchSearch && matchType;
  });

  const typeCounts = {
    all: files.length,
    video: files.filter(f => f.file_type === "video").length,
    pdf: files.filter(f => f.file_type === "pdf").length,
    video_aula: files.filter(f => f.file_type === "video_aula").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Mídias & Conteúdos</h1>
          <p className="text-muted-foreground text-sm mt-1">{files.length} arquivos no acervo</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Enviar Arquivo
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "video", "pdf", "video_aula"] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filterType === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
              {t === "all" ? "Todos" : typeConfig[t].label} ({typeCounts[t]})
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map((file, i) => {
            const cfg = typeConfig[file.file_type];
            const Icon = cfg.icon;
            return (
              <motion.div key={file.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-card-foreground text-sm truncate">{file.title}</h3>
                      {file.cooperado_only && <Shield className="w-3.5 h-3.5 text-secondary shrink-0" />}
                    </div>
                    {file.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{file.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-full bg-muted">{cfg.label}</span>
                      {file.file_size && <span>{file.file_size}</span>}
                      {file.course_id && <span>{file.course_id}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs"
                    onClick={async () => setPreviewUrl(await getSignedUrl(file.file_url, "media"))}>
                    <Eye className="w-3 h-3" /> Visualizar
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1 text-xs"
                      onClick={() => handleDelete(file.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Upload className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum arquivo encontrado</p>
          <p className="text-sm mt-1">Envie vídeos, PDFs e videoaulas para começar</p>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar Novo Arquivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Título *</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Descrição</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo *</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(typeConfig) as [FileType, typeof typeConfig["video"]][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button key={key} onClick={() => { setFileType(key); setSelectedFile(null); }}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${fileType === key ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}>
                      <Icon className={`w-5 h-5 mx-auto mb-1 ${fileType === key ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-medium ${fileType === key ? "text-primary" : "text-muted-foreground"}`}>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Arquivo *</label>
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {selectedFile ? selectedFile.name : "Clique para selecionar"}
                </span>
                <input type="file" className="hidden" accept={typeConfig[fileType].accept}
                  onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Curso</label>
                <input value={courseName} onChange={e => setCourseName(e.target.value)}
                  placeholder="Nome do curso"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Módulo</label>
                <input value={moduleName} onChange={e => setModuleName(e.target.value)}
                  placeholder="Nome do módulo"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cooperadoOnly} onChange={e => setCooperadoOnly(e.target.checked)}
                className="rounded border-border" />
              <Shield className="w-4 h-4 text-secondary" />
              <span className="text-muted-foreground">Exclusivo para cooperados</span>
            </label>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button className="flex-1" disabled={!title || !selectedFile || uploading} onClick={handleUpload}>
                {uploading ? "Enviando..." : "Enviar Arquivo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Visualização</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            previewUrl.endsWith(".pdf") ? (
              <iframe src={previewUrl} className="w-full h-[60vh] rounded-lg" />
            ) : (
              <video src={previewUrl} controls className="w-full rounded-lg max-h-[60vh]" />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
