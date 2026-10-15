import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Public endpoint: creates a PENDING cooperado registration.
// Account is NOT created in auth.users until an admin approves it.
// This prevents anyone with a valid-format CPF from getting cooperado privileges.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;

async function enforceRateLimit(
  admin: ReturnType<typeof createClient>,
  identifier: string,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const { data: existing } = await admin
    .from("edge_function_rate_limits")
    .select("id, request_count, window_started_at")
    .eq("function_name", "register-cooperado")
    .eq("identifier", identifier)
    .maybeSingle();
  if (!existing) {
    await admin.from("edge_function_rate_limits").insert({
      function_name: "register-cooperado",
      identifier,
      request_count: 1,
      window_started_at: new Date(now).toISOString(),
    });
    return { allowed: true };
  }
  const windowStarted = new Date(existing.window_started_at as string).getTime();
  if (now - windowStarted > RATE_LIMIT_WINDOW_MS) {
    await admin
      .from("edge_function_rate_limits")
      .update({
        request_count: 1,
        window_started_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      })
      .eq("id", existing.id as string);
    return { allowed: true };
  }
  if ((existing.request_count as number) >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - windowStarted)) / 1000),
    };
  }
  await admin
    .from("edge_function_rate_limits")
    .update({
      request_count: (existing.request_count as number) + 1,
      updated_at: new Date(now).toISOString(),
    })
    .eq("id", existing.id as string);
  return { allowed: true };
}

// Lightweight password hash (bcrypt-like via Web Crypto). Stored only until approval, then discarded.
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return `pbkdf2$120000$${saltB64}$${hashB64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const rl = await enforceRateLimit(admin, ip);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Tente novamente em instantes." }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rl.retryAfter ?? 60),
          },
        },
      );
    }

    const { cpf, password, full_name, cooperativa, email, phone } = await req.json();

    const cleanCpf = String(cpf || "").replace(/\D/g, "");
    const cleanPhone = phone ? String(phone).replace(/\D/g, "").slice(0, 11) : null;
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
    const name = String(full_name || "").trim();
    if (name.length < 3 || name.length > 120) {
      return new Response(JSON.stringify({ error: "Nome inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cleanPhone && (cleanPhone.length < 10 || cleanPhone.length > 11)) {
      return new Response(JSON.stringify({ error: "Telefone inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CPF cannot already exist as approved profile or pending registration
    const { data: existingProfile } = await admin
      .from("profiles").select("user_id").eq("cpf", cleanCpf).maybeSingle();
    if (existingProfile) {
      return new Response(JSON.stringify({ error: "CPF já cadastrado" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: existingPending } = await admin
      .from("cooperado_pending_registrations")
      .select("id, status")
      .eq("cpf", cleanCpf)
      .maybeSingle();
    if (existingPending) {
      return new Response(
        JSON.stringify({
          error: "Já existe uma solicitação para este CPF. Aguarde a análise do administrador.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Password is intentionally NOT stored. A temporary password is generated
    // at approval time by the admin-approval edge function.
    void password;

    const { data: pendingRow, error: insErr } = await admin
      .from("cooperado_pending_registrations")
      .insert({
        full_name: name,
        cpf: cleanCpf,
        email: email ? String(email).trim().toLowerCase() : null,
        phone: cleanPhone,
        cooperativa: cooperativa || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insErr) {
      return new Response(JSON.stringify({ error: "Não foi possível enviar a solicitação. Tente novamente." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Approval is deliberately manual, regardless of legacy settings.
    return new Response(
      JSON.stringify({
        success: true,
        pending: true,
        message:
          "Solicitação enviada. Seu cadastro será analisado pela equipe administrativa antes de ser ativado.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("register-cooperado error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
