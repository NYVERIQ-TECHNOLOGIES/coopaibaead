import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Row { full_name: string; cpf: string; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { rows, password } = await req.json() as { rows: Row[]; password: string };
    if (!Array.isArray(rows) || !password) {
      return new Response(JSON.stringify({ error: "invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const results: Array<{ cpf: string; status: string; error?: string }> = [];
    for (const r of rows) {
      const cpf = String(r.cpf || "").replace(/\D/g, "");
      const name = String(r.full_name || "").trim();
      if (cpf.length !== 11 || name.length < 3) {
        results.push({ cpf, status: "skipped" }); continue;
      }
      const { data: existing } = await admin
        .from("profiles").select("user_id").eq("cpf", cpf).maybeSingle();
      if (existing) { results.push({ cpf, status: "exists" }); continue; }
      const email = `cpf${cpf}@cooperado.coopaiba.com.br`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: name, cpf, user_type: "cooperado" },
      });
      if (createErr || !created?.user) {
        results.push({ cpf, status: "error", error: createErr?.message });
        continue;
      }
      await admin.from("profiles").update({ full_name: name, cpf, cooperativa: "COOPAIBA" }).eq("user_id", created.user.id);
      // Garante papel 'cooperado' (sobrescreve qualquer papel padrão criado pelo trigger)
      await admin.from("user_roles").delete().eq("user_id", created.user.id);
      await admin.from("user_roles").insert({ user_id: created.user.id, role: "cooperado" });
      results.push({ cpf, status: "created" });
    }
    const summary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1; return acc;
    }, {});
    return new Response(JSON.stringify({ summary, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
