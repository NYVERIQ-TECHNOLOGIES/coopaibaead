import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Poll briefly for webhook to land
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let attempts = 0;
    const tick = async () => {
      attempts++;
      const { data } = await supabase
        .from("user_subscriptions")
        .select("id, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.status === "active" || data?.status === "trialing" || attempts > 6) {
        setLoading(false);
        return;
      }
      setTimeout(tick, 1500);
    };
    tick();
  }, [user]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {loading ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <h1 className="text-2xl font-semibold">Confirmando seu pagamento…</h1>
            <p className="text-muted-foreground">Isso leva alguns segundos.</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
            <h1 className="text-3xl font-semibold">Pagamento concluído!</h1>
            <p className="text-muted-foreground">
              Obrigado pela sua compra. Seu acesso já está liberado.
            </p>
            <div className="flex gap-2 justify-center">
              <Button asChild>
                <Link to="/dashboard">Ir para o painel</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/cursos">Ver cursos</Link>
              </Button>
            </div>
            {sessionId && (
              <p className="text-xs text-muted-foreground break-all">Sessão: {sessionId}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
