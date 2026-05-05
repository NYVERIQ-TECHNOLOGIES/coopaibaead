import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Clock, Lock, ArrowRight, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";

interface PublicCourse {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  duration: string | null;
  cooperado_only: boolean | null;
}

export default function CursosPublic() {
  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title, description, image, duration, cooperado_only")
        .order("created_at", { ascending: false })
        .limit(24);
      setCourses((data as PublicCourse[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <SEO
        title="Cursos — Coopaiba EAD"
        description="Catálogo público de cursos da Coopaiba EAD. Educação cooperativista para cooperados, jovens, mulheres e comunidade."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: courses.map((c, i) => ({
            "@type": "Course",
            position: i + 1,
            name: c.title,
            description: c.description || "",
            provider: { "@type": "Organization", name: "Coopaiba EAD" },
          })),
        }}
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <header className="mb-10">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground">Catálogo de cursos</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Explore nossos cursos. Para se inscrever e acompanhar seu progresso, crie sua conta gratuita.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum curso publicado ainda.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((c) => (
              <article
                key={c.id}
                className="bg-card border border-border rounded-xl overflow-hidden shadow-card hover:shadow-elevated transition-shadow"
              >
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {c.image ? (
                    <img src={c.image} alt={c.title} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center gradient-primary opacity-20">
                      <BookOpen className="w-12 h-12 text-primary" />
                    </div>
                  )}
                  {c.cooperado_only && (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
                      <Lock className="w-3 h-3" /> Cooperado
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h2 className="font-heading font-semibold text-foreground line-clamp-2">{c.title}</h2>
                  {c.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{c.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    {c.duration && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" /> {c.duration}
                      </span>
                    )}
                    <Link
                      to="/register"
                      className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Inscrever-se <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
