import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  ClipboardCheck,
  Calendar,
  MapPin,
  Search,
  BarChart3,
  Pencil,
  ExternalLink,
  BookOpen,
  Users,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

export default function PresencaList() {
  const [q, setQ] = useState("");
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const isAdminOrMod = isAdmin || role === "moderador";

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["presenca_eventos"],
    queryFn: async () => {
      if (isAdminOrMod) {
        await supabase.rpc("encerrar_eventos_vencidos" as any);
      }
      const query = isAdminOrMod
        ? supabase
            .from("presenca_eventos")
            .select(
              "*, presenca_assinaturas(count), presenca_evento_cursos(curso_id, courses:curso_id(id, title))",
            )
        : supabase
            .from("presenca_eventos")
            .select(
              "*, presenca_evento_cursos(curso_id, courses:curso_id(id, title))",
            );
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const filtered = eventos.filter(
    (e: any) =>
      e.nome.toLowerCase().includes(q.toLowerCase()) ||
      (e.local || "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Hero */}
      <div className="rounded-2xl gradient-primary p-8 text-primary-foreground shadow-glow mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-8 h-8" />
          <h1 className="font-heading text-3xl font-bold">Dia de Campo</h1>
        </div>
        <p className="text-primary-foreground/90 max-w-3xl">
          {isAdminOrMod
            ? "Gestão inteligente de presença e assinaturas para cooperados. Crie eventos, acompanhe presenças em tempo real e vincule cursos."
            : "Participe dos eventos da Coopaíba registrando sua presença e acesse os cursos vinculados a cada evento."}
        </p>

        {isAdminOrMod && (
          <div className="flex flex-wrap gap-2 mt-5">
            <Link to="/presenca/relatorios">
              <Button variant="secondary" className="bg-background/15 text-primary-foreground border border-primary-foreground/20 hover:bg-background/25">
                <BarChart3 className="w-4 h-4 mr-2" /> Relatórios
              </Button>
            </Link>
            {isAdmin && (
              <Link to="/presenca/novo">
                <Button variant="secondary" className="bg-background text-primary hover:bg-background/90">
                  <Plus className="w-4 h-4 mr-2" /> Novo Evento
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar evento..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-60" />
            {isAdmin ? "Nenhum evento criado ainda." : "Nenhum evento disponível no momento."}
            {isAdmin && (
              <div className="mt-4">
                <Link to="/presenca/novo">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" /> Criar primeiro evento
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filtered.map((e: any, i) => {
            const count = e.presenca_assinaturas?.[0]?.count ?? 0;
            const expected = e.expected_count ?? 0;
            const pct = expected > 0 ? Math.min(100, Math.round((count / expected) * 100)) : 0;
            const encerrado = e.status !== "aberto";
            const cursos = (e.presenca_evento_cursos ?? [])
              .map((r: any) => r.courses)
              .filter(Boolean);

            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="relative shadow-card hover:shadow-elevated transition-shadow h-full">
                  {isAdmin && (
                    <Link
                      to={`/presenca/${e.id}/editar`}
                      className="absolute top-3 right-3 z-10 p-1.5 rounded-md bg-background/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Editar evento"
                      aria-label="Editar evento"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  <CardHeader>
                    <div className="flex items-start justify-between gap-2 pr-8">
                      <div className="min-w-0">
                        <CardTitle className="font-heading text-xl truncate">{e.nome}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">{e.tipo}</p>
                      </div>
                      <Badge variant={encerrado ? "secondary" : "default"}>
                        {encerrado ? "Encerrado" : "Aberto"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(e.data).toLocaleDateString("pt-BR")}
                        {e.horario ? ` · ${e.horario.slice(0, 5)}` : ""}
                      </span>
                      {e.local && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" /> {e.local}
                        </span>
                      )}
                      {isAdminOrMod && (
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {count}
                          {expected ? `/${expected}` : ""}
                        </span>
                      )}
                    </div>

                    {isAdminOrMod && expected > 0 && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{pct}% de presença</span>
                          <span>{Math.max(0, expected - count)} restantes</span>
                        </div>
                        <Progress value={pct} />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground">Código</span>
                      <span className="font-mono font-bold text-primary">{e.codigo}</span>
                    </div>

                    {cursos.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" /> Cursos vinculados
                        </p>
                        <div className="space-y-1.5">
                          {cursos.map((c: any) => (
                            <Link
                              key={c.id}
                              to={`/courses/${c.id}`}
                              className="flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-md bg-muted/40 hover:bg-primary/10 hover:text-primary text-card-foreground transition-colors"
                            >
                              <span className="truncate">{c.title}</span>
                              <span className="text-primary font-medium shrink-0">Acessar →</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {isAdminOrMod ? (
                      <Button asChild className="w-full" variant="outline">
                        <Link to={`/presenca/${e.id}`}>Gerenciar evento</Link>
                      </Button>
                    ) : e.status === "aberto" ? (
                      <Button asChild className="w-full">
                        <Link to={`/p/${e.codigo}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" /> Participar
                        </Link>
                      </Button>
                    ) : (
                      <Button className="w-full" disabled variant="outline">
                        Evento encerrado
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
