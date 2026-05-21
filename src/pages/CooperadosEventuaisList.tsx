import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Campanha {
  id: string;
  nome: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  limite_vagas: number;
  vagas_ocupadas: number;
  status: string;
}

export default function CooperadosEventuaisList() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("cooperados_eventuais_campanhas")
      .select("*")
      .in("status", ["ativa", "encerrada"])
      .order("created_at", { ascending: false });
    setCampanhas((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("campanhas-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "cooperados_eventuais_campanhas" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="rounded-2xl gradient-primary p-8 text-primary-foreground shadow-glow mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-8 h-8" />
          <h1 className="font-heading text-3xl font-bold">Programa de Cooperados Eventuais</h1>
        </div>
        <p className="text-primary-foreground/90 max-w-3xl">
          Participe dos cursos disponibilizados pela Coopaíba através do Programa de Cooperados Eventuais.
          As vagas são limitadas e controladas por inscrição prévia.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando…</div>
      ) : campanhas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma campanha disponível no momento.
        </CardContent></Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {campanhas.map((c) => {
            const pct = Math.min(100, Math.round((c.vagas_ocupadas / c.limite_vagas) * 100));
            const disponiveis = Math.max(0, c.limite_vagas - c.vagas_ocupadas);
            const encerrada = c.status === "encerrada" || disponiveis === 0;
            return (
              <Card key={c.id} className="shadow-card hover:shadow-elevated transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-heading text-xl">{c.nome}</CardTitle>
                    <Badge variant={encerrada ? "secondary" : "default"}>
                      {encerrada ? "Encerrada" : "Ativa"}
                    </Badge>
                  </div>
                  {c.descricao && <p className="text-sm text-muted-foreground">{c.descricao}</p>}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />
                      até {new Date(c.data_fim + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                    <span className="flex items-center gap-1"><Users className="w-4 h-4" />
                      {c.vagas_ocupadas}/{c.limite_vagas}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{pct}% preenchido</span>
                      <span>{disponiveis} vagas restantes</span>
                    </div>
                    <Progress value={pct} />
                  </div>
                  <Button asChild className="w-full" disabled={encerrada}>
                    <Link to={`/cooperados-eventuais/${c.id}`}>
                      {encerrada ? "Ver detalhes" : "Inscrever-se"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
