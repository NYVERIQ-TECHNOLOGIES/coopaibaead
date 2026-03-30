import { motion } from "framer-motion";
import { Search, FileText, Video, Headphones, Book, Download, Eye, Lock, Filter } from "lucide-react";
import { useState } from "react";

const resources = [
  { id: 1, title: "Manual do Cooperativismo", type: "pdf", category: "Cooperativismo", size: "2.4 MB", downloads: 342, cooperadoOnly: false },
  { id: 2, title: "Princípios Cooperativistas - Vídeo Aula", type: "video", category: "Cooperativismo", size: "120 MB", downloads: 567, cooperadoOnly: false },
  { id: 3, title: "Podcast: Economia Solidária", type: "audio", category: "Economia", size: "45 MB", downloads: 189, cooperadoOnly: false },
  { id: 4, title: "Guia de Gestão Financeira", type: "pdf", category: "Finanças", size: "1.8 MB", downloads: 423, cooperadoOnly: true },
  { id: 5, title: "E-book: Liderança Cooperativa", type: "pdf", category: "Liderança", size: "3.2 MB", downloads: 256, cooperadoOnly: false },
  { id: 6, title: "Webinar: Assembleia Geral", type: "video", category: "Gestão", size: "95 MB", downloads: 178, cooperadoOnly: true },
  { id: 7, title: "Artigo: Sustentabilidade nas Cooperativas", type: "pdf", category: "Sustentabilidade", size: "890 KB", downloads: 312, cooperadoOnly: false },
  { id: 8, title: "Audiobook: História do Cooperativismo", type: "audio", category: "Cooperativismo", size: "210 MB", downloads: 145, cooperadoOnly: false },
];

const typeIcons = { pdf: FileText, video: Video, audio: Headphones };
const typeColors = { pdf: "text-destructive", video: "text-primary", audio: "text-accent" };

export default function LibraryPage() {
  const [search, setSearch] = useState("");
  const filtered = resources.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Biblioteca Digital</h1>
        <p className="text-muted-foreground mt-1">{resources.length} recursos disponíveis</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Buscar na biblioteca..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((item, i) => {
          const Icon = typeIcons[item.type as keyof typeof typeIcons];
          const color = typeColors[item.type as keyof typeof typeColors];
          return (
            <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-card rounded-xl p-4 shadow-card border border-border hover:shadow-elevated transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {item.cooperadoOnly && (
                  <span className="gradient-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Cooperado
                  </span>
                )}
              </div>
              <h3 className="font-heading font-semibold text-sm text-card-foreground line-clamp-2">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.category} • {item.size}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Download className="w-3 h-3" /> {item.downloads}
                </span>
                <button className="text-xs text-primary font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="w-3 h-3" /> Visualizar
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
