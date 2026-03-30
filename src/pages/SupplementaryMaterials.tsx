import { motion } from "framer-motion";
import { useState } from "react";
import {
  Plus, Search, FileText, Video, Headphones, Image, Link as LinkIcon,
  Download, Eye, Trash2, Edit, ExternalLink, BookOpen, Tag, Calendar
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface Material {
  id: number;
  title: string;
  description: string;
  type: "pdf" | "video" | "audio" | "image" | "link";
  course: string;
  module: string;
  url: string;
  size: string;
  downloads: number;
  cooperadoOnly: boolean;
  tags: string[];
  createdAt: string;
}

const initialMaterials: Material[] = [
  {
    id: 1, title: "Apostila Complementar - Princípios Cooperativistas", description: "Material de apoio com exercícios e leituras extras.",
    type: "pdf", course: "Cooperativismo Básico", module: "Módulo 2", url: "#", size: "3.4 MB", downloads: 234, cooperadoOnly: false,
    tags: ["princípios", "cooperativismo"], createdAt: "2026-03-10",
  },
  {
    id: 2, title: "Vídeo: Entrevista com Cooperativistas", description: "Entrevistas com líderes do movimento cooperativista.",
    type: "video", course: "Cooperativismo Básico", module: "Módulo 1", url: "#", size: "250 MB", downloads: 456, cooperadoOnly: false,
    tags: ["entrevista", "vídeo"], createdAt: "2026-03-12",
  },
  {
    id: 3, title: "Infográfico - Estrutura Cooperativa", description: "Infográfico com a organização de uma cooperativa.",
    type: "image", course: "Gestão Cooperativa", module: "Módulo 3", url: "#", size: "1.2 MB", downloads: 189, cooperadoOnly: false,
    tags: ["infográfico", "gestão"], createdAt: "2026-03-15",
  },
  {
    id: 4, title: "Podcast: Economia Solidária na Prática", description: "Episódio sobre experiências de economia solidária.",
    type: "audio", course: "Economia Solidária", module: "Módulo 1", url: "#", size: "45 MB", downloads: 312, cooperadoOnly: true,
    tags: ["podcast", "economia"], createdAt: "2026-03-18",
  },
  {
    id: 5, title: "Artigo: Lei 5.764/71 Comentada", description: "Análise detalhada da legislação cooperativista brasileira.",
    type: "link", course: "Legislação Cooperativista", module: "Módulo 4", url: "https://example.com", size: "-", downloads: 567, cooperadoOnly: true,
    tags: ["legislação", "artigo"], createdAt: "2026-03-20",
  },
  {
    id: 6, title: "Planilha de Cálculos - Sobras", description: "Modelo de planilha para cálculo de distribuição de sobras.",
    type: "pdf", course: "Gestão Financeira", module: "Módulo 5", url: "#", size: "890 KB", downloads: 145, cooperadoOnly: true,
    tags: ["finanças", "planilha"], createdAt: "2026-03-22",
  },
];

const typeIcons = { pdf: FileText, video: Video, audio: Headphones, image: Image, link: LinkIcon };
const typeLabels = { pdf: "PDF", video: "Vídeo", audio: "Áudio", image: "Imagem", link: "Link" };
const typeColors = {
  pdf: "text-destructive bg-destructive/10",
  video: "text-primary bg-primary/10",
  audio: "text-accent bg-accent/10",
  image: "text-secondary bg-secondary/10",
  link: "text-warning bg-warning/10",
};

export default function SupplementaryMaterials() {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentMat, setCurrentMat] = useState<Material | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<Material["type"]>("pdf");
  const [courseName, setCourseName] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [url, setUrl] = useState("");
  const [size, setSize] = useState("");
  const [cooperadoOnly, setCooperadoOnly] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  const filtered = materials.filter((m) => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase()) || m.tags.some((t) => t.includes(search.toLowerCase()));
    const matchType = filterType === "all" || m.type === filterType;
    return matchSearch && matchType;
  });

  function openNew() {
    setCurrentMat(null);
    setTitle(""); setDescription(""); setType("pdf"); setCourseName(""); setModuleName("");
    setUrl(""); setSize(""); setCooperadoOnly(false); setTagsInput("");
    setDialogOpen(true);
  }

  function openEdit(mat: Material) {
    setCurrentMat(mat);
    setTitle(mat.title); setDescription(mat.description); setType(mat.type);
    setCourseName(mat.course); setModuleName(mat.module); setUrl(mat.url);
    setSize(mat.size); setCooperadoOnly(mat.cooperadoOnly); setTagsInput(mat.tags.join(", "));
    setDialogOpen(true);
  }

  function saveMaterial() {
    if (!title.trim() || !courseName.trim()) return;
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    if (currentMat) {
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === currentMat.id
            ? { ...m, title, description, type, course: courseName, module: moduleName, url, size, cooperadoOnly, tags }
            : m
        )
      );
    } else {
      setMaterials((prev) => [
        ...prev,
        {
          id: Date.now(), title, description, type, course: courseName, module: moduleName,
          url, size: size || "-", downloads: 0, cooperadoOnly, tags,
          createdAt: new Date().toISOString().slice(0, 10),
        },
      ]);
    }
    setDialogOpen(false);
  }

  function deleteMaterial(id: number) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }

  const typeCounts = {
    all: materials.length,
    pdf: materials.filter((m) => m.type === "pdf").length,
    video: materials.filter((m) => m.type === "video").length,
    audio: materials.filter((m) => m.type === "audio").length,
    image: materials.filter((m) => m.type === "image").length,
    link: materials.filter((m) => m.type === "link").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Materiais Complementares</h1>
          <p className="text-muted-foreground mt-1">Recursos adicionais vinculados aos cursos</p>
        </div>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" /> Novo Material
        </Button>
      </div>

      {/* Type filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pdf", "video", "audio", "image", "link"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${filterType === t ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {t === "all" ? "Todos" : typeLabels[t]} ({typeCounts[t]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por título ou tag..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((mat, i) => {
          const Icon = typeIcons[mat.type];
          const color = typeColors[mat.type];
          return (
            <motion.div key={mat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-card rounded-xl shadow-card border border-border hover:shadow-elevated transition-shadow group">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    {mat.cooperadoOnly && (
                      <Badge variant="secondary" className="text-[10px]">Cooperado</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">{typeLabels[mat.type]}</Badge>
                  </div>
                </div>
                <h3 className="font-heading font-semibold text-sm text-card-foreground line-clamp-2">{mat.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mat.description}</p>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> {mat.course}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{mat.module}</span>
                </div>

                {mat.tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {mat.tags.map((tag) => (
                      <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" /> {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {mat.downloads}</span>
                  <span>{mat.size}</span>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(mat)}>
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteMaterial(mat.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum material encontrado</div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentMat ? "Editar Material" : "Novo Material Complementar"}</DialogTitle>
            <DialogDescription>Vincule recursos adicionais a módulos e cursos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do material" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição do conteúdo" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as Material["type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="link">Link Externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tamanho</Label>
                <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Ex: 2.4 MB" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Curso</Label>
                <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Curso vinculado" />
              </div>
              <div className="space-y-2">
                <Label>Módulo</Label>
                <Input value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="Ex: Módulo 1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL / Link</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link do recurso" />
            </div>
            <div className="space-y-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="cooperativismo, finanças" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={cooperadoOnly} onCheckedChange={setCooperadoOnly} />
              <Label>Exclusivo para cooperados</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveMaterial} className="gradient-primary text-primary-foreground">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
