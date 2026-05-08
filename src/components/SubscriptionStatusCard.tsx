import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Crown, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ManageSubscriptionButton } from "./ManageSubscriptionButton";
import { getStripeEnvironment } from "@/lib/stripe";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function SubscriptionStatusCard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["my-subscription", user?.id],
    queryFn: async () => {
      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("id, status, current_period_end, cancel_at_period_end, plan_id, stripe_customer_id")
        .eq("user_id", user!.id)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub) return { sub: null, plan: null };
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("name, price, interval")
        .eq("id", sub.plan_id)
        .maybeSingle();
      return { sub, plan };
    },
  });

  if (isLoading) return null;
  const sub = data?.sub;
  const plan = data?.plan;

  // No subscription → CTA to upgrade
  if (!sub || (sub.status !== "active" && sub.status !== "trialing" && sub.status !== "past_due")) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Crown className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Assine o Premium</h3>
            <p className="text-sm text-muted-foreground">Acesso a todos os cursos pagos por uma única mensalidade.</p>
          </div>
        </div>
        <Button asChild>
          <Link to="/planos">Ver planos <ArrowRight className="w-4 h-4 ml-1" /></Link>
        </Button>
      </div>
    );
  }

  const statusBadge =
    sub.status === "active" ? <Badge className="bg-success text-success-foreground">Ativa</Badge> :
    sub.status === "trialing" ? <Badge className="bg-primary text-primary-foreground">Período de teste</Badge> :
    sub.status === "past_due" ? <Badge variant="destructive">Pagamento pendente</Badge> :
    <Badge variant="secondary">{sub.status}</Badge>;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Crown className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{plan?.name ?? "Plano"}</h3>
              {statusBadge}
            </div>
            <p className="text-sm text-muted-foreground">
              {sub.cancel_at_period_end
                ? `Cancelamento agendado — acesso até ${fmtDate(sub.current_period_end)}`
                : `Próxima cobrança: ${fmtDate(sub.current_period_end)}`}
            </p>
          </div>
        </div>
        <ManageSubscriptionButton size="sm" />
      </div>
      {sub.status === "past_due" && (
        <div className="text-xs rounded-lg bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2">
          Sua última cobrança falhou. Atualize o cartão pelo portal para evitar a perda de acesso.
        </div>
      )}
    </div>
  );
}
