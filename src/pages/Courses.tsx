import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Filter, Grid3X3, List } from "lucide-react";
import CourseCard from "@/components/CourseCard";

const courses = [
  { id: "1", title: "Cooperativismo Básico", description: "Fundamentos do cooperativismo, princípios e valores que norteiam o movimento cooperativista mundial.", image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop", modules: 8, students: 245, duration: "12h", rating: 4.8, cooperadoOnly: false },
  { id: "2", title: "Gestão Cooperativa", description: "Técnicas avançadas de gestão aplicadas ao contexto cooperativista e economia solidária.", image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop", modules: 12, students: 189, duration: "20h", rating: 4.7, cooperadoOnly: false },
  { id: "3", title: "Finanças Solidárias", description: "Educação financeira voltada para cooperativas de crédito e economia solidária.", image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop", modules: 6, students: 312, duration: "8h", rating: 4.9, cooperadoOnly: true },
  { id: "4", title: "Liderança Comunitária", description: "Desenvolvimento de habilidades de liderança para atuação em comunidades e cooperativas.", image: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=400&h=300&fit=crop", modules: 10, students: 178, duration: "15h", rating: 4.6, cooperadoOnly: false },
  { id: "5", title: "Direito Cooperativo", description: "Legislação brasileira sobre cooperativas, estatutos e aspectos jurídicos do cooperativismo.", image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=300&fit=crop", modules: 7, students: 134, duration: "10h", rating: 4.5, cooperadoOnly: true },
  { id: "6", title: "Marketing Social", description: "Estratégias de marketing para cooperativas e organizações do terceiro setor.", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop", modules: 5, students: 201, duration: "6h", rating: 4.7, cooperadoOnly: false },
];

export default function Courses() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "cooperado">("all");

  const filtered = courses.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.cooperadoOnly;
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Cursos</h1>
          <p className="text-muted-foreground mt-1">Gerencie os cursos da plataforma</p>
        </div>
        <button className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity w-fit">
          <Plus className="w-4 h-4" /> Novo Curso
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar cursos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter("cooperado")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === "cooperado" ? "bg-secondary text-secondary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            Cooperados
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((course, i) => (
          <motion.div key={course.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <CourseCard {...course} />
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-heading">Nenhum curso encontrado</p>
          <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
        </div>
      )}
    </div>
  );
}
