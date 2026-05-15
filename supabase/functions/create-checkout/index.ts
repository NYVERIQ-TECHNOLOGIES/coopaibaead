import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { priceId, environment, returnUrl, courseId } = await req.json();
    if (environment !== "sandbox" && environment !== "live") throw new Error("Invalid environment");
    if (!returnUrl) throw new Error("Missing returnUrl");
    if (!priceId && !courseId) throw new Error("Missing priceId or courseId");
    if (priceId && !/^[a-zA-Z0-9_-]+$/.test(priceId)) throw new Error("Invalid priceId");

    const env: StripeEnv = environment;

    // Identify user from JWT (optional but recommended)
    const authHeader = req.headers.get("Authorization");
    let userId: string | undefined;
    let userEmail: string | undefined;
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = data.user?.id;
      userEmail = data.user?.email ?? undefined;
    }

    const stripe = createStripeClient(env);
    const metadata: Record<string, string> = {};
    if (userId) metadata.userId = userId;
    if (courseId) metadata.courseId = String(courseId);

    // Course one-time purchase via dynamic price_data (no priceId required)
    let session;
    if (courseId && !priceId) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: course, error: cErr } = await admin
        .from("courses")
        .select("id, title, description, is_paid, price, promotional_price, standalone_access_days")
        .eq("id", courseId)
        .single();
      if (cErr || !course) throw new Error("Curso não encontrado");
      if (!course.is_paid) throw new Error("Curso gratuito não requer compra");
      const amountReais = Number(course.promotional_price ?? course.price ?? 0);
      const amount = Math.round(amountReais * 100);
      if (!amount || amount < 50) {
        throw new Error("Preço do curso abaixo do mínimo aceito (R$ 0,50). Atualize o valor do curso.");
      }
      if (course.standalone_access_days) {
        metadata.accessDays = String(course.standalone_access_days);
      }

      session = await stripe.checkout.sessions.create({
        allow_promotion_codes: true,
        line_items: [{
          price_data: {
            currency: "brl",
            product_data: {
              name: course.title,
              description: course.description ?? undefined,
            },
            unit_amount: amount,
          },
          quantity: 1,
        }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: returnUrl,
        ...(userEmail && { customer_email: userEmail }),
        metadata,
      });
    } else {
      const prices = await stripe.prices.list({ lookup_keys: [priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      session = await stripe.checkout.sessions.create({
        payment_method_types: isRecurring ? ["card"] : ["card", "pix"],
        allow_promotion_codes: true,
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: returnUrl,
        ...(userEmail && { customer_email: userEmail }),
        ...(Object.keys(metadata).length > 0 && {
          metadata,
          ...(isRecurring && { subscription_data: { metadata } }),
        }),
      });
    }

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
