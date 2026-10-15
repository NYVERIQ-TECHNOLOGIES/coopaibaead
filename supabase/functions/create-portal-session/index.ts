import { withPasswordRotation } from "../_shared/passwordRotation.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(withPasswordRotation(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { environment, returnUrl } = await req.json();
    if (environment !== "sandbox" && environment !== "live") throw new Error("Invalid environment");
    if (returnUrl) {
      const ALLOWED_ORIGINS = [
        "https://coopaiba.com.br",
        "https://coopaibaead.lovable.app",
        "https://id-preview--e31127c3-135d-408d-bc68-803e74fb3989.lovable.app",
      ];
      try {
        const parsed = new URL(returnUrl);
        const isLovableSandbox = parsed.hostname.endsWith(".lovable.app") || parsed.hostname.endsWith(".lovableproject.com");
        if (!ALLOWED_ORIGINS.includes(parsed.origin) && !isLovableSandbox) {
          throw new Error("Invalid returnUrl origin");
        }
      } catch {
        throw new Error("Invalid returnUrl");
      }
    }
    const env: StripeEnv = environment;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userData.user.id)
      .eq("environment", env)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) throw new Error("Nenhuma assinatura encontrada");

    const stripe = createStripeClient(env);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id as string,
      ...(returnUrl && { return_url: returnUrl }),
    });

    return new Response(JSON.stringify({ url: portal.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-portal-session error:", e);
    return new Response(JSON.stringify({ error: "Não foi possível concluir a operação. Tente novamente." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
