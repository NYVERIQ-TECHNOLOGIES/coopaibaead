import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PlayCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface Item {
  course_id: string;
  course_title: string;
  course_image: string | null;
  progress: number;
  last_accessed_at: string;
  lesson_title: string | null;
}

export default function ContinueWatching() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["continue_watching", user?.id],
    queryFn: async (): Promise<Item[]> => {
      if (!user) return [];
      const { data: enrolls } = await supabase
        .from("enrollments")
        .select("course_id, progress, last_accessed_at, last_accessed_lesson_id")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .not("last_accessed_at", "is", null)
        .order("last_accessed_at", { ascending: false })
        .limit(3);
      if (!enrolls || enrolls.length === 0) return [];

      const courseIds = enrolls.map((e: any) => e.course_id);
      const lessonIds = enrolls.map((e: any) => e.last_accessed_lesson_id).filter(Boolean);
      const [{ data: courses }, { data: lessons }] = await Promise.all([
        supabase.from("courses").select("id, title, image").in("id", courseIds),
        lessonIds.length
          ? supabase.from("course_lessons").select("id, title").in("id", lessonIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c]));
      const lessonMap = new Map((lessons ?? []).map((l: any) => [l.id, l]));

      return enrolls.map((e: any) => {
        const c = courseMap.get(e.course_id) as any;
        const l = lessonMap.get(e.last_accessed_lesson_id) as any;
        return {
          course_id: e.course_id,
          course_title: c?.title ?? "Curso",
          course_image: c?.image ?? null,
          progress: e.progress ?? 0,
          last_accessed_at: e.last_accessed_at,
          lesson_title: l?.title ?? null,
        };
      });
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-primary" /> Continue assistindo
        </h2>
        <Link to="/courses" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          Ver tudo <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((item) => (
          <Link
            key={item.course_id}
            to={`/courses/${item.course_id}`}
            className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-elevated transition-shadow"
          >
            <div className="aspect-video bg-muted relative overflow-hidden">
              {item.course_image ? (
                <img
                  src={item.course_image}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <PlayCircle className="w-10 h-10" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
                <div className="h-full bg-primary" style={{ width: `${item.progress}%` }} />
              </div>
            </div>
            <div className="p-3">
              <p className="font-medium text-sm text-foreground line-clamp-1">{item.course_title}</p>
              {item.lesson_title && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  Em: {item.lesson_title}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{item.progress}% concluído</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
