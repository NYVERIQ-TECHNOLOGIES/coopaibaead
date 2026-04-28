import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf, password, full_name, cooperativa, avatar_url } = await req.json();

    const cleanCpf = String(cpf || "").replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ error: "CPF inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || String(password).length < 8) {
      return new Response(JSON.stringify({ error: "Senha inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!full_name || String(full_name).trim().length < 3) {
      return new Response(JSON.stringify({ error: "Nome inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const syntheticEmail = `cpf${cleanCpf}@cooperado.coopaiba.com.br`;

    // Verifica se já existe profile com esse CPF
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("user_id")
      .eq("cpf", cleanCpf)
      .maybeSingle();

    if (existingProfile) {
      return new Response(JSON.stringify({ error: "CPF já cadastrado" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: String(full_name).trim(),
        cpf: cleanCpf,
        cooperativa: cooperativa || null,
        user_type: "cooperado",
      },
    });

    if (createErr || !created.user) {
      return new Response(
        JSON.stringify({ error: createErr?.message || "Falha ao criar conta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = created.user.id;

    // Garante que o profile reflete os dados (o trigger handle_new_user já cria, mas atualizamos extras)
    const updates: Record<string, unknown> = {
      full_name: String(full_name).trim(),
      cpf: cleanCpf,
    };
    if (cooperativa) updates.cooperativa = cooperativa;
    if (avatar_url) updates.avatar_url = avatar_url;

    await admin.from("profiles").update(updates).eq("user_id", userId);

    return new Response(
      JSON.stringify({ success: true, email: syntheticEmail, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
