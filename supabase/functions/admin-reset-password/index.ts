import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, newEmail, password, token } = await req.json();
    if (token !== Deno.env.get("BULK_IMPORT_TOKEN")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: list, error: le } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (le) throw le;
    const user = list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (!user) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: corsHeaders });
    const updates: Record<string, unknown> = {};
    if (password) updates.password = password;
    if (newEmail) { updates.email = newEmail; updates.email_confirm = true; }
    const { error } = await admin.auth.admin.updateUserById(user.id, updates);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, user_id: user.id }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
