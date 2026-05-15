import { motion } from "framer-motion";
import { BookOpen, Clock, Award, TrendingUp, Play, IdCard, ShoppingBag, Crown, Receipt } from "lucide-react";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import SignedImage from "@/components/SignedImage";
import ContinueWatching from "@/components/ContinueWatching";
import SubscriptionStatusCard from "@/components/SubscriptionStatusCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function StudentDashboard() {
  const { user, profile } = useAuth();

  const { data: enrollmentNumber } = useQuery({
    queryKey: ["my-enrollment-number", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("enrollment_number")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.enrollment_number ?? null;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("*, courses(id, title, description, image, duration, is_paid)")
        .eq("user_id", user!.id)
        .order("last_accessed_at", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["my-purchases", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("id, course_id, amount, currency, status, paid_at, access_expires_at, courses(title)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const purchasedCourseIds = new Set(
    purchases.filter((p: any) => p.status === "paid").map((p: any) => p.course_id),
  );

  const continueEnrollment = enrollments.find((e: any) => e.last_accessed_lesson_id && (e.progress ?? 0) < 100) ?? null;

  const { data: continueLesson } = useQuery({
    queryKey: ["continue-lesson", continueEnrollment?.last_accessed_lesson_id],
    enabled: !!continueEnrollment?.last_accessed_lesson_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("course_lessons")
        .select("id, title")
        .eq("id", continueEnrollment!.last_accessed_lesson_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: certCount = 0 } = useQuery({
    queryKey: ["my-cert-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase.from("certificates").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("status", "emitido");
      return count ?? 0;
    },
  });

  const { data: allCourses = [] } = useQuery({
    queryKey: ["all-courses-student"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title, description, image, duration").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const firstName = profile?.full_name?.split(" ")[0] || "Aluno";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Olá, {firstName}! 👋</h1>
          <p className="text-muted-foreground mt-1">Continue de onde parou</p>
        </div>
        {enrollmentNumber && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-card">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <IdCard className="w-4 h-4 text-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Matrícula</p>
              <p className="font-mono font-semibold text-sm text-foreground">{enrollmentNumber}</p>
            </div>
          </div>
        )}
      </div>

      {continueEnrollment && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link
            to={`/courses/${continueEnrollment.course_id}`}
            className="block rounded-2xl p-5 gradient-primary text-primary-foreground shadow-elevated hover:opacity-95 transition-opacity"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
                <Play className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wide opacity-80 font-medium">Continuar de onde parou</p>
                <p className="font-heading font-semibold truncate">{continueEnrollment.courses?.title}</p>
                {continueLesson && (
                  <p className="text-sm opacity-90 truncate">Última aula: {continueLesson.title}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-32 h-1.5 bg-primary-foreground/20 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-foreground rounded-full" style={{ width: `${continueEnrollment.progress || 0}%` }} />
                  </div>
                  <span className="text-xs opacity-90">{continueEnrollment.progress || 0}%</span>
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      <ContinueWatching />

      <SubscriptionStatusCard />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Cursos Matriculados" value={String(enrollments.length)} icon={BookOpen} gradient="primary" />
        <StatCard title="Cursos Disponíveis" value={String(allCourses.length)} icon={Clock} gradient="secondary" />
        <StatCard title="Certificados" value={String(certCount)} icon={Award} gradient="accent" />
        <StatCard title="Progresso Médio" value={enrollments.length > 0 ? `${Math.round(enrollments.reduce((s, e: any) => s + (e.progress || 0), 0) / enrollments.length)}%` : "0%"} icon={TrendingUp} gradient="primary" />
      </div>

      {(enrollments.length > 0 || purchases.length > 0) && (() => {
        const purchasedEnr = enrollments.filter((e: any) => purchasedCourseIds.has(e.course_id));
        const otherEnr = enrollments.filter((e: any) => !purchasedCourseIds.has(e.course_id));
        const fmtBRL = (v: number, c = "BRL") =>
          v.toLocaleString("pt-BR", { style: "currency", currency: c });
        const renderList = (items: any[], emptyMsg: string) =>
          items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{emptyMsg}</p>
          ) : (
            <div className="space-y-3">
              {items.map((enr: any) => (
                <Link key={enr.id} to={`/courses/${enr.course_id}`} className="flex items-center gap-4 p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                    <Play className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-card-foreground truncate">{enr.courses?.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full gradient-primary rounded-full" style={{ width: `${enr.progress || 0}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{enr.progress || 0}%</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          );
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-5 shadow-card border border-border">
            <h2 className="font-heading font-semibold text-card-foreground mb-4">Meus Cursos</h2>
            <Tabs defaultValue="comprados">
              <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="comprados" className="gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" /> Comprados
                </TabsTrigger>
                <TabsTrigger value="premium" className="gap-1.5">
                  <Crown className="w-3.5 h-3.5" /> Premium/Grátis
                </TabsTrigger>
                <TabsTrigger value="historico" className="gap-1.5">
                  <Receipt className="w-3.5 h-3.5" /> Histórico
                </TabsTrigger>
              </TabsList>
              <TabsContent value="comprados" className="mt-4">
                {renderList(purchasedEnr, "Você ainda não comprou nenhum curso individualmente.")}
              </TabsContent>
              <TabsContent value="premium" className="mt-4">
                {renderList(otherEnr, "Nenhum curso liberado por Premium ou gratuito ainda.")}
              </TabsContent>
              <TabsContent value="historico" className="mt-4">
                {purchases.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Nenhuma compra registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {purchases.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/20">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-card-foreground truncate">{p.courses?.title ?? "Curso"}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.paid_at ? new Date(p.paid_at).toLocaleDateString("pt-BR") : "—"}
                            {p.access_expires_at && (
                              <> · expira {new Date(p.access_expires_at).toLocaleDateString("pt-BR")}</>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold">{fmtBRL(Number(p.amount), p.currency || "BRL")}</span>
                          <Badge variant={p.status === "paid" ? "default" : "secondary"}>
                            {p.status === "paid" ? "pago" : p.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        );
      })()}

      <div>
        <h2 className="font-heading font-semibold text-foreground mb-4">Cursos Disponíveis</h2>
        {allCourses.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum curso disponível ainda.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {allCourses.map((course: any) => (
              <Link key={course.id} to={`/courses/${course.id}`}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-xl shadow-card border border-border hover:shadow-elevated transition-shadow overflow-hidden">
                  {course.image && <SignedImage path={course.image} alt={course.title} className="w-full h-36 object-cover" />}
                  <div className="p-4">
                    <h3 className="font-heading font-semibold text-card-foreground">{course.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{course.description}</p>
                    {course.duration && <p className="text-xs text-primary mt-2">{course.duration}</p>}
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
