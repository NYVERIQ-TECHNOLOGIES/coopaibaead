import { motion } from "framer-motion";
import { Search, FileText, Video, Headphones, Download, Eye, Lock } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const typeIcons: Record<string, typeof FileText> = { pdf: FileText, video: Video, audio: Headphones };
const typeColors: Record<string, string> = { pdf: "text-destructive", video: "text-primary", audio: "text-accent" };

export default function LibraryPage() {
  const [search, setSearch] = useState("");

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["library-books"],
    queryFn: async () => {
      const { data } = await supabase.from("course_books").select("*, courses(title)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = books.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Biblioteca Digital</h1>
        <p className="text-muted-foreground mt-1">{books.length} recursos disponíveis</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Buscar na biblioteca..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {books.length === 0 ? "Nenhum material na biblioteca. Adicione materiais pela página de detalhes do curso." : "Nenhum resultado encontrado."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item, i) => {
            const Icon = typeIcons[item.type] ?? FileText;
            const color = typeColors[item.type] ?? "text-muted-foreground";
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-card rounded-xl p-4 shadow-card border border-border hover:shadow-elevated transition-shadow group">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {item.cooperado_only && (
                    <span className="gradient-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Cooperado
                    </span>
                  )}
                </div>
                <h3 className="font-heading font-semibold text-sm text-card-foreground line-clamp-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{(item as any).courses?.title ?? "Curso"} • {item.size || item.type.toUpperCase()}</p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
