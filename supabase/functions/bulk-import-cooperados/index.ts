import { withPasswordRotation } from "../_shared/passwordRotation.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Row { full_name: string; cpf: string; }

const MAX_ROWS = 500;

Deno.serve(withPasswordRotation(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- AuthN: require Bearer token from a real authenticated user ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    // ---- AuthZ: require admin role ----
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem importar cooperados" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Input validation ----
    const body = await req.json().catch(() => null);
    const { rows } = (body ?? {}) as { rows?: Row[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rows.length > MAX_ROWS) {
      return new Response(JSON.stringify({ error: `Máximo de ${MAX_ROWS} linhas por importação` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    function randomPassword(): string {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "") + "Aa1!";
    }

    const results: Array<{ cpf: string; status: string; error?: string; setup_link?: string }> = [];
    for (const r of rows) {
      const cpf = String(r?.cpf || "").replace(/\D/g, "");
      const name = String(r?.full_name || "").trim();
      if (cpf.length !== 11 || name.length < 3) {
        results.push({ cpf, status: "skipped" }); continue;
      }
      const { data: existing } = await admin
        .from("profiles").select("user_id").eq("cpf", cpf).maybeSingle();
      if (existing) { results.push({ cpf, status: "exists" }); continue; }
      const email = `cpf${cpf}@cooperado.coopaiba.com.br`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password: randomPassword(), email_confirm: true,
        user_metadata: { full_name: name, cpf, user_type: "cooperado" },
      });
      if (createErr || !created?.user) {
        results.push({ cpf, status: "error", error: "Não foi possível criar a conta." });
        continue;
      }
      await admin.from("profiles").update({ full_name: name, cpf, cooperativa: "COOPAIBA" }).eq("user_id", created.user.id);
      await admin.from("user_roles").delete().eq("user_id", created.user.id);
      await admin.from("user_roles").insert({ user_id: created.user.id, role: "cooperado" });

      // Generate a per-user one-time recovery link instead of sharing a single password.
      let setupLink: string | undefined;
      try {
        const { data: linkData } = await admin.auth.admin.generateLink({ type: "recovery", email });
        setupLink = (linkData as { properties?: { action_link?: string } } | null)
          ?.properties?.action_link ?? undefined;
      } catch (_) { /* ignore */ }

      results.push({ cpf, status: "created", setup_link: setupLink });
    }
    const summary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1; return acc;
    }, {});

    // ---- Audit log ----
    await admin.from("bulk_import_audit").insert({
      performed_by: callerId,
      total_rows: rows.length,
      created_count: summary.created ?? 0,
      skipped_count: (summary.skipped ?? 0) + (summary.exists ?? 0),
      error_count: summary.error ?? 0,
      summary,
    });

    return new Response(JSON.stringify({ summary, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bulk-import-cooperados error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
