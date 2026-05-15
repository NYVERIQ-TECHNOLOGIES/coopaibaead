import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BarChart3, Calendar, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function PresencaRelatorios() {
  const { data } = useQuery({
    queryKey: ["presenca_relatorios"],
    queryFn: async () => {
      const [eventosRes, assinaturasRes] = await Promise.all([
        supabase.from("presenca_eventos").select("id, nome, data, tipo, status"),
        supabase.from("presenca_assinaturas").select("id, evento_id, nome, cpf, horario"),
      ]);
      const eventos = eventosRes.data ?? [];
      const assinaturas = assinaturasRes.data ?? [];
      const porEvento: Record<string, number> = {};
      assinaturas.forEach((a) => { porEvento[a.evento_id] = (porEvento[a.evento_id] || 0) + 1; });
      const ranking = eventos
        .map((e) => ({ ...e, total: porEvento[e.id] || 0 }))
        .sort((a, b) => b.total - a.total);
      const freqByCpf: Record<string, { nome: string; count: number }> = {};
      assinaturas.forEach((a) => {
        const k = a.cpf || a.nome;
        if (!freqByCpf[k]) freqByCpf[k] = { nome: a.nome, count: 0 };
        freqByCpf[k].count++;
      });
      const topCooperados = Object.values(freqByCpf).sort((a, b) => b.count - a.count).slice(0, 10);
      return { eventos, assinaturas, ranking, topCooperados };
    },
  });

  const stats = [
    { label: "Eventos", value: data?.eventos.length ?? 0, icon: Calendar },
    { label: "Total de Presenças", value: data?.assinaturas.length ?? 0, icon: Users },
    { label: "Eventos Ativos", value: data?.eventos.filter((e) => e.status === "aberto").length ?? 0, icon: TrendingUp },
    { label: "Média por Evento", value: data && data.eventos.length ? Math.round(data.assinaturas.length / data.eventos.length) : 0, icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <Link to="/presenca" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Relatórios de Presença</h1>
        <p className="text-muted-foreground mt-1">Histórico, frequência e eventos mais participados.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-heading font-bold text-card-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-heading font-semibold text-card-foreground mb-4">Eventos mais participados</h2>
          <div className="space-y-2">
            {data?.ranking.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span className="text-card-foreground truncate mr-2">{e.nome}</span>
                <span className="font-semibold text-primary">{e.total}</span>
              </div>
            ))}
            {!data?.ranking.length && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-heading font-semibold text-card-foreground mb-4">Top participantes</h2>
          <div className="space-y-2">
            {data?.topCooperados.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span className="text-card-foreground truncate mr-2">{c.nome}</span>
                <span className="font-semibold text-primary">{c.count}</span>
              </div>
            ))}
            {!data?.topCooperados.length && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
