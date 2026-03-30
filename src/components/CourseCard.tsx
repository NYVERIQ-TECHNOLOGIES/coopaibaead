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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-card rounded-xl shadow-card hover:shadow-elevated transition-all border border-border overflow-hidden group"
    >
      <Link to={`/courses/${id}`}>
        <div className="relative h-40 overflow-hidden">
          <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          {cooperadoOnly && (
            <div className="absolute top-3 left-3 gradient-secondary text-secondary-foreground text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Lock className="w-3 h-3" /> Cooperado
            </div>
          )}
          <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm text-card-foreground text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Star className="w-3 h-3 text-accent fill-accent" /> {rating}
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-heading font-semibold text-card-foreground line-clamp-1">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {modules} módulos</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {students}</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {duration}</span>
          </div>
          {progress !== undefined && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-semibold text-primary">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full gradient-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
