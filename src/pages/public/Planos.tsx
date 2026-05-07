import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  interval: string;
  features: string[];
  sort_order: number;
}

export default function Planos() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("id, name, slug, description, price, interval, features, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      setPlans(
        ((data as unknown as Plan[]) || []).map((p) => ({
          ...p,
          features: Array.isArray(p.features) ? p.features : [],
        }))
      );
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("plan_id, status, current_period_end")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .order("current_period_end", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setActivePlanId((data as { plan_id: string }).plan_id);
    })();
  }, [session?.user]);

  const handleSubscribe = (plan: Plan) => {
    if (!session) {
      window.location.href = "/register";
      return;
    }
    if (plan.slug === "cooperado") {
      toast({
        title: "Plano exclusivo",
        description: "Para virar cooperado, faça o cadastro como cooperado e aguarde a aprovação.",
      });
      return;
    }
    toast({
      title: "Pagamentos em breve",
      description: "A cobrança será ativada na próxima etapa. Em seguida você poderá assinar o plano.",
    });
  };

  return (
    <>
      <SEO
        title="Planos — Coopaiba EAD"
        description="Escolha o plano ideal: Gratuito, Premium ou Cooperado. Educação cooperativista com cursos, certificação e validação pública."
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <header className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Planos transparentes
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground">
            Escolha o plano que combina com você
          </h1>
          <p className="mt-3 text-muted-foreground">
            Comece grátis e evolua quando quiser. Cancele a qualquer momento.
          </p>
        </header>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-7 space-y-4">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-10 w-2/3" />
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const highlight = p.slug === "premium";
              const isActive = activePlanId === p.id;
              return (
                <div
                  key={p.id}
                  className={`relative rounded-2xl border p-7 flex flex-col ${
                    highlight
                      ? "border-primary bg-card shadow-elevated md:scale-[1.02]"
                      : "border-border bg-card shadow-card"
                  }`}
                >
                  {highlight && !isActive && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-primary text-primary-foreground text-xs font-semibold">
                      Mais popular
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-success text-success-foreground text-xs font-semibold">
                      Plano atual
                    </span>
                  )}
                  <h2 className="font-heading text-xl font-bold text-foreground">{p.name}</h2>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-heading text-4xl font-bold text-foreground">
                      {p.price > 0 ? `R$ ${Number(p.price).toFixed(0)}` : "R$ 0"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {p.price > 0 ? `/${p.interval === "year" ? "ano" : "mês"}` : "para sempre"}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-sm text-muted-foreground mt-2">{p.description}</p>
                  )}
                  <ul className="mt-6 space-y-3 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => handleSubscribe(p)}
                    disabled={isActive}
                    className={`mt-7 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-medium transition-opacity disabled:opacity-60 ${
                      highlight
                        ? "gradient-primary text-primary-foreground hover:opacity-90"
                        : "border border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {isActive
                      ? "Assinatura ativa"
                      : p.slug === "cooperado"
                      ? "Solicitar acesso"
                      : p.price > 0
                      ? "Assinar"
                      : "Criar conta grátis"}
                    {!isActive && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-10">
          A cobrança será ativada em breve com pagamento seguro. Os planos aqui exibidos já estão configurados no sistema.
        </p>

        {!session && (
          <div className="text-center mt-6">
            <Link to="/register" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              Criar conta agora <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {loading && <Loader2 className="hidden" />}
      </section>
    </>
  );
}
