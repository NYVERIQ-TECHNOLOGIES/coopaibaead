import { motion } from "framer-motion";
import { Clock, Users, BookOpen, Star, Lock } from "lucide-react";
import { Link } from "react-router-dom";

interface CourseCardProps {
  id: string;
  title: string;
  description: string;
  image: string;
  modules: number;
  students: number;
  duration: string;
  rating: number;
  progress?: number;
  cooperadoOnly?: boolean;
}

export default function CourseCard({ id, title, description, image, modules, students, duration, rating, progress, cooperadoOnly }: CourseCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
      className="bg-card rounded-2xl shadow-card hover:shadow-elevated transition-shadow duration-200 border border-border/70 overflow-hidden group"
    >
      <Link to={`/courses/${id}`}>
        <div className="relative h-44 overflow-hidden">
          <img src={image} alt={title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/45 via-transparent to-transparent opacity-70" />
          {cooperadoOnly && (
            <div className="absolute top-3 left-3 gradient-secondary text-brand-foreground text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-card">
              <Lock className="w-3 h-3" /> Cooperado
            </div>
          )}
          <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-md text-card-foreground text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-card">
            <Star className="w-3 h-3 text-warning fill-warning" /> {rating}
          </div>
        </div>
        <div className="p-5">
          <h3 className="font-heading font-bold text-[15px] text-card-foreground line-clamp-1 group-hover:text-primary transition-colors">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{description}</p>
          <div className="flex flex-wrap items-center gap-2 mt-4 text-[11px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1"><BookOpen className="w-3.5 h-3.5" /> {modules} módulos</span>
            <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1"><Users className="w-3.5 h-3.5" /> {students}</span>
            <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1"><Clock className="w-3.5 h-3.5" /> {duration}</span>
          </div>
          {progress !== undefined && (
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-bold text-primary">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full gradient-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>

  );
}
