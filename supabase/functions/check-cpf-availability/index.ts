import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

const json = (body: Record<string, unknown>, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const now = Date.now();

    const { data: limit } = await admin
      .from("edge_function_rate_limits")
      .select("id, request_count, window_started_at")
      .eq("function_name", "check-cpf-availability")
      .eq("identifier", ip)
      .maybeSingle();

    if (limit) {
      const startedAt = new Date(limit.window_started_at as string).getTime();
      if (now - startedAt <= RATE_LIMIT_WINDOW_MS && (limit.request_count as number) >= RATE_LIMIT_MAX) {
        return json({ error: "Muitas tentativas. Aguarde um minuto e tente novamente." }, 429, {
          "Retry-After": "60",
        });
      }

      const resetWindow = now - startedAt > RATE_LIMIT_WINDOW_MS;
      await admin
        .from("edge_function_rate_limits")
        .update({
          request_count: resetWindow ? 1 : (limit.request_count as number) + 1,
          window_started_at: resetWindow ? new Date(now).toISOString() : limit.window_started_at,
          updated_at: new Date(now).toISOString(),
        })
        .eq("id", limit.id as string);
    } else {
      await admin.from("edge_function_rate_limits").insert({
        function_name: "check-cpf-availability",
        identifier: ip,
        request_count: 1,
        window_started_at: new Date(now).toISOString(),
      });
    }

    const body = await req.json().catch(() => null);
    const cpf = String((body as { cpf?: unknown } | null)?.cpf ?? "").replace(/\D/g, "");
    if (cpf.length !== 11) return json({ error: "CPF inválido" }, 400);

    const { data, error } = await admin
      .from("profiles")
      .select("user_id")
      .eq("cpf", cpf)
      .maybeSingle();
    if (error) throw error;

    return json({ available: !data });
  } catch (error) {
    console.error("check-cpf-availability error:", error);
    return json({ error: "Não foi possível validar o CPF" }, 500);
  }
});