import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, ClipboardCheck, Calendar, MapPin, Search, BarChart3, Pencil } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PresencaList() {
  const [q, setQ] = useState("");

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["presenca_eventos"],
    queryFn: async () => {
      // auto-encerra eventos cujo horário de término já passou
      await supabase.rpc("encerrar_eventos_vencidos" as any);
      const { data, error } = await supabase
        .from("presenca_eventos")
        .select("*, presenca_assinaturas(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });


  const filtered = eventos.filter((e: any) =>
    e.nome.toLowerCase().includes(q.toLowerCase()) ||
    (e.local || "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Dia de Campo</h1>
          <p className="text-muted-foreground mt-1">Gestão Inteligente de Presença e Assinaturas para Cooperados</p>
        </div>
        <div className="flex gap-2">
          <Link to="/presenca/relatorios">
            <Button variant="outline"><BarChart3 className="w-4 h-4 mr-2" /> Relatórios</Button>
          </Link>
          <Link to="/presenca/novo">
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Evento</Button>
          </Link>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar evento..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum evento criado ainda.</p>
          <Link to="/presenca/novo" className="inline-block mt-4">
            <Button><Plus className="w-4 h-4 mr-2" /> Criar primeiro evento</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((e: any, i) => {
            const count = e.presenca_assinaturas?.[0]?.count ?? 0;
            return (
              <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="relative">
                <Link
                  to={`/presenca/${e.id}/editar`}
                  onClick={(ev) => ev.stopPropagation()}
                  className="absolute top-3 right-3 z-10 p-1.5 rounded-md bg-background/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Editar evento"
                  aria-label="Editar evento"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Link>
                <Link to={`/presenca/${e.id}`} className="block bg-card border border-border rounded-xl p-5 hover:shadow-elevated transition-shadow">
                  <div className="flex items-start justify-between pr-10">
                    <div className="min-w-0">
                      <h3 className="font-heading font-semibold text-card-foreground truncate">{e.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">{e.tipo}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${e.status === "aberto" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {e.status}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {new Date(e.data).toLocaleDateString("pt-BR")} {e.horario ? `· ${e.horario.slice(0,5)}` : ""}</div>
                    {(e.data_fim || e.horario_fim) && (
                      <div className="flex items-center gap-2 pl-5 text-xs">
                        até {e.data_fim ? new Date(e.data_fim).toLocaleDateString("pt-BR") : new Date(e.data).toLocaleDateString("pt-BR")}
                        {e.horario_fim ? ` · ${e.horario_fim.slice(0,5)}` : ""}
                      </div>
                    )}
                    {e.local && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {e.local}</div>}

                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Código</span>
                    <span className="font-mono font-bold text-primary">{e.codigo}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Presenças</span>
                    <span className="font-semibold text-card-foreground">{count}{e.expected_count ? ` / ${e.expected_count}` : ""}</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
