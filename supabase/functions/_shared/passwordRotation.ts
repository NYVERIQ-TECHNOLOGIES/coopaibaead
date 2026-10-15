import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export function withPasswordRotation(handler: (req: Request) => Response | Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (req.method !== "OPTIONS" && token && token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      try {
        const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data.user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: required, error: checkError } = await admin.rpc("password_change_required_for", { _user_id: data.user.id });
        if (checkError || required !== false) return new Response(JSON.stringify({ error: "Troque sua senha inicial para continuar." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({ error: "Não foi possível validar o acesso." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    return handler(req);
  };
}