import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AppRole = "admin" | "aluno" | "cooperado";

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
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!callerRole) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem alterar perfis" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, new_role } = await req.json() as { user_id?: string; new_role?: AppRole };

    if (!user_id || !new_role) {
      return new Response(
        JSON.stringify({ error: "user_id e new_role são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["admin", "aluno", "cooperado"].includes(new_role)) {
      return new Response(
        JSON.stringify({ error: "Perfil inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-demotion (admin removing themselves from admin)
    if (user_id === user.id && new_role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Você não pode alterar seu próprio perfil de administrador" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If demoting an admin, ensure at least one admin remains
    const { data: targetCurrentRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id);

    const targetIsAdmin = (targetCurrentRoles ?? []).some((r) => r.role === "admin");

    if (targetIsAdmin && new_role !== "admin") {
      const { count: adminCount } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if ((adminCount ?? 0) <= 1) {
        return new Response(
          JSON.stringify({ error: "Não é possível remover o último administrador da plataforma" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Replace the user's role: delete existing roles then insert new one
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", user_id);
    if (delErr) {
      return new Response(
        JSON.stringify({ error: delErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id, role: new_role });
    if (insErr) {
      return new Response(
        JSON.stringify({ error: insErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id, new_role }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("manage-user-role error:", err);
    return new Response(
      JSON.stringify({ error: "Ocorreu um erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
