import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Public endpoint used by "forgot password" flow.
// Hardened with per-IP rate limiting (5 req / minute).
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

async function enforceRateLimit(
  admin: ReturnType<typeof createClient>,
  identifier: string,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const { data: existing } = await admin
    .from("edge_function_rate_limits")
    .select("id, request_count, window_started_at")
    .eq("function_name", "check-email-exists")
    .eq("identifier", identifier)
    .maybeSingle();

  if (!existing) {
    await admin.from("edge_function_rate_limits").insert({
      function_name: "check-email-exists",
      identifier,
      request_count: 1,
      window_started_at: new Date(now).toISOString(),
    });
    return { allowed: true };
  }

  const windowStarted = new Date(existing.window_started_at as string).getTime();
  if (now - windowStarted > RATE_LIMIT_WINDOW_MS) {
    await admin
      .from("edge_function_rate_limits")
      .update({
        request_count: 1,
        window_started_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      })
      .eq("id", existing.id as string);
    return { allowed: true };
  }

  if ((existing.request_count as number) >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - windowStarted)) / 1000);
    return { allowed: false, retryAfter };
  }

  await admin
    .from("edge_function_rate_limits")
    .update({
      request_count: (existing.request_count as number) + 1,
      updated_at: new Date(now).toISOString(),
    })
    .eq("id", existing.id as string);
  return { allowed: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Identify caller by IP for rate limiting.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const rl = await enforceRateLimit(supabaseAdmin, ip);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Tente novamente em instantes." }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rl.retryAfter ?? 60),
          },
        },
      );
    }

    const { email } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "E-mail inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized) || normalized.length > 254) {
      return new Response(JSON.stringify({ error: "Formato de e-mail inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let exists = false;
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      if (data.users.some((u) => (u.email ?? "").toLowerCase() === normalized)) {
        exists = true;
        break;
      }
      if (data.users.length < perPage) break;
      page += 1;
      if (page > 50) break;
    }

    return new Response(JSON.stringify({ exists }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("check-email-exists error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
