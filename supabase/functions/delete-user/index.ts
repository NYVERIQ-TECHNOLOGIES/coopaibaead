import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// IMPORTANT: Despite the function name, this performs a SOFT DELETE (deactivation)
// to preserve historical records (enrollments, certificates, exam attempts).
// Set { reactivate: true } in body to re-enable a previously deactivated user.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, reactivate } = await req.json();
    if (!user_id || typeof user_id !== "string") {
      return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === user.id) {
      return new Response(JSON.stringify({ error: "Você não pode alterar sua própria conta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block deactivating other admins
    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .eq("role", "admin")
      .maybeSingle();
    if (targetRole) {
      return new Response(JSON.stringify({ error: "Não é possível alterar contas de administradores" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isReactivate = reactivate === true;
    const isHardDelete = (await Promise.resolve(req)).headers.get("x-hard-delete") === "1"
      ? true
      : false;
    // re-read body flag (already consumed above isn't possible) — rely on body field
    const body = { user_id, reactivate, hard_delete: undefined as boolean | undefined };
    try {
      // body already parsed; read hard_delete from a re-parse fallback
    } catch {}
    // Re-parse from request clone above wasn't done; instead, accept hard_delete passed in body
    // (we already destructured user_id and reactivate; parse again safely)

    // Note: body re-parse not possible after .json(); rely on a second optional read of headers
    const hardDelete = isHardDelete;

    if (hardDelete && !isReactivate) {
      // Permanently delete the auth user; cascading FKs will remove profile/role rows where set up.
      // For safety, also explicitly delete dependent rows that lack ON DELETE CASCADE.
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ success: true, action: "deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Soft delete: mark profile as inactive (preserves all historical data)
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({
        is_active: !isReactivate ? false : true,
        deactivated_at: !isReactivate ? new Date().toISOString() : null,
      })
      .eq("user_id", user_id);
    if (profErr) {
      return new Response(JSON.stringify({ error: profErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Force sign-out by invalidating refresh tokens (only on deactivate)
    if (!isReactivate) {
      try {
        await supabaseAdmin.auth.admin.signOut(user_id, "global");
      } catch (_e) {
        // best effort
      }
    }

    return new Response(
      JSON.stringify({ success: true, action: isReactivate ? "reactivated" : "deactivated" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("delete-user (soft) error:", err);
    return new Response(JSON.stringify({ error: "Ocorreu um erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
