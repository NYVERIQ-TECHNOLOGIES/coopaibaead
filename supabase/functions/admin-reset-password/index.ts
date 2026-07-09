import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, userId, newEmail, password, token } = await req.json();

    let authorized = false;
    if (token && token === Deno.env.get("BULK_IMPORT_TOKEN")) {
      authorized = true;
    } else {
      // Verify caller is an authenticated admin
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const jwt = authHeader.replace("Bearer ", "");
        const authClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
        );
        const { data: claims } = await authClient.auth.getClaims(jwt);
        const uid = claims?.claims?.sub;
        if (uid) {
          const adminForCheck = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          );
          const { data: isAdmin } = await adminForCheck.rpc("has_role", {
            _user_id: uid,
            _role: "admin",
          });
          if (isAdmin === true) authorized = true;
        }
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    let targetId = userId as string | undefined;
    if (!targetId && email) {
      let page = 1;
      while (!targetId) {
        const { data: list, error: le } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (le) throw le;
        const u = list.users.find((x) => (x.email || "").toLowerCase() === email.toLowerCase());
        if (u) { targetId = u.id; break; }
        if (list.users.length < 1000) break;
        page++;
      }
    }
    if (!targetId) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: corsHeaders });
    const updates: Record<string, unknown> = {};
    if (password) updates.password = password;
    if (newEmail) { updates.email = newEmail; updates.email_confirm = true; }
    const { error } = await admin.auth.admin.updateUserById(targetId, updates);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, user_id: targetId }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
