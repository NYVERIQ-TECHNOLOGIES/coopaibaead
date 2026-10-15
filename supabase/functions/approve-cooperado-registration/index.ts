import { withPasswordRotation } from "../_shared/passwordRotation.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Admin-only endpoint: approve or reject a pending cooperado registration.
// On approval: creates the auth user with a random password and sends a password-reset link.
// The original PBKDF2 hash submitted by the user is discarded (never converted back).

function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "") + "Aa1!";
}

Deno.serve(withPasswordRotation(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;


    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { registration_id, action, rejection_reason } = await req.json();
    if (!registration_id || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pending, error: pErr } = await admin
      .from("cooperado_pending_registrations")
      .select("*").eq("id", registration_id).maybeSingle();
    if (pErr || !pending) {
      return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (pending.status !== "pending") {
      return new Response(JSON.stringify({ error: "Solicitação já processada" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      await admin.from("cooperado_pending_registrations")
        .update({
          status: "rejected",
          reviewed_by: callerId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejection_reason ?? null,
        })
        .eq("id", registration_id);
      return new Response(JSON.stringify({ success: true, status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Approve: create the account with the standard default password
    const cpf = pending.cpf as string;
    const syntheticEmail = `cpf${cpf}@cooperado.coopaiba.com.br`;
    const temporaryPassword = randomPassword();

    const userMeta = {
      full_name: pending.full_name,
      cpf,
      cooperativa: pending.cooperativa ?? null,
      user_type: "cooperado",
    };

    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: userMeta,
    });

    if (created?.user) {
      userId = created.user.id;
    } else {
      // Likely already exists — find and reset password
      const msg = (createErr as { message?: string; code?: string; status?: number } | null)?.message ?? "";
      console.error("createUser failed:", JSON.stringify(createErr));
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page: 1, perPage: 200,
      });
      if (listErr) {
        return new Response(
          JSON.stringify({ error: "Não foi possível criar a conta." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const existing = list.users.find((u) => u.email?.toLowerCase() === syntheticEmail.toLowerCase());
      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Não foi possível criar a conta." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: userMeta,
      });
      if (updErr) {
        return new Response(
          JSON.stringify({ error: "Não foi possível redefinir o acesso." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = existing.id;
    }

    if (!userId) throw new Error("Account creation failed");
    const { error: rotationError } = await admin.rpc("capture_password_reset", { _user_id: userId });
    if (rotationError) throw rotationError;
    await admin.from("profiles").update({
      full_name: pending.full_name,
      cpf,
      cooperativa: pending.cooperativa ?? null,
      phone: pending.phone ?? null,
    }).eq("user_id", userId);
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role: "cooperado" });

    await admin.from("cooperado_pending_registrations")
      .update({
        status: "approved",
        reviewed_by: callerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", registration_id);

    return new Response(
      JSON.stringify({
        success: true,
        status: "approved",
        user_id: userId,
        login_email: syntheticEmail,
        temporary_password: temporaryPassword,
        note: "Compartilhe individualmente; a troca de senha é obrigatória no primeiro acesso.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("approve-cooperado-registration error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
