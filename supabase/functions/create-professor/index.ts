import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return json({ error: "Não autorizado" }, 401);

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return json({ error: "Apenas administradores podem gerenciar professores" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "create";

    if (action === "create") {
      const { email, password, full_name, phone, avatar_url, area_atuacao, especialidade, is_active } = body;
      if (!email || !password || !full_name) {
        return json({ error: "Nome, e-mail e senha são obrigatórios" }, 400);
      }
      if (String(password).length < 8) {
        return json({ error: "A senha deve ter ao menos 8 caracteres" }, 400);
      }

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role: "professor" },
      });
      if (createError) return json({ error: createError.message }, 400);

      const newId = created.user.id;

      await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newId, role: "professor" });
      if (roleErr) return json({ error: roleErr.message }, 400);

      const { error: profErr } = await supabaseAdmin
        .from("profiles")
        .upsert({
          user_id: newId,
          full_name,
          phone: phone ?? null,
          avatar_url: avatar_url ?? null,
          area_atuacao: area_atuacao ?? null,
          especialidade: especialidade ?? null,
          is_active: is_active ?? true,
        }, { onConflict: "user_id" });
      if (profErr) return json({ error: profErr.message }, 400);

      return json({ success: true, user_id: newId });
    }

    if (action === "promote") {
      const { user_id, area_atuacao, especialidade } = body;
      if (!user_id) return json({ error: "user_id é obrigatório" }, 400);

      const { data: target } = await supabaseAdmin.auth.admin.getUserById(user_id);
      if (!target?.user) return json({ error: "Usuário não encontrado" }, 404);

      const { data: isAdminTarget } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id)
        .eq("role", "admin")
        .maybeSingle();
      if (isAdminTarget) {
        return json({ error: "Não é possível alterar o papel de um administrador" }, 400);
      }

      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id, role: "professor" });
      if (roleErr) return json({ error: roleErr.message }, 400);

      const patch: Record<string, unknown> = {};
      if (area_atuacao !== undefined && area_atuacao !== null) patch.area_atuacao = area_atuacao;
      if (especialidade !== undefined && especialidade !== null) patch.especialidade = especialidade;
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from("profiles").update(patch).eq("user_id", user_id);
      }

      return json({ success: true, user_id });
    }

    if (action === "update") {
      const { user_id, full_name, phone, avatar_url, area_atuacao, especialidade, is_active, bio } = body;
      if (!user_id) return json({ error: "user_id é obrigatório" }, 400);
      const patch: Record<string, unknown> = {};
      if (full_name !== undefined) patch.full_name = full_name;
      if (phone !== undefined) patch.phone = phone;
      if (avatar_url !== undefined) patch.avatar_url = avatar_url;
      if (area_atuacao !== undefined) patch.area_atuacao = area_atuacao;
      if (especialidade !== undefined) patch.especialidade = especialidade;
      if (bio !== undefined) patch.bio = bio;
      if (is_active !== undefined) {
        patch.is_active = is_active;
        patch.deactivated_at = is_active ? null : new Date().toISOString();
      }
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("user_id", user_id);
      if (error) return json({ error: error.message }, 400);

      if (is_active === false) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });
      } else if (is_active === true) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "none" });
      }
      return json({ success: true });
    }

    if (action === "reset_password") {
      const { user_id, password } = body;
      if (!user_id || !password) return json({ error: "user_id e password são obrigatórios" }, 400);
      if (String(password).length < 8) {
        return json({ error: "A senha deve ter ao menos 8 caracteres" }, 400);
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message }, 400);
      await supabaseAdmin.from("password_reset_logs").insert({
        admin_user_id: user.id,
        target_user_id: user_id,
        user_agent: req.headers.get("user-agent") ?? null,
      });
      return json({ success: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err) {
    console.error("create-professor error:", err);
    return json({ error: "Ocorreu um erro interno. Tente novamente." }, 500);
  }
});
