import { withPasswordRotation } from "../_shared/passwordRotation.ts";
// Z-API WhatsApp informational notification (no attachments — just informs).
// Triggered by other edge functions (e.g. generate-certificate) using SERVICE ROLE.
// Also callable by admin/moderador users for manual resends.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

function normalizePhone(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return null;
  // If no country code, assume Brazil (55)
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if (digits.length >= 12 && digits.length <= 15) return digits;
  return null;
}

Deno.serve(withPasswordRotation(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      return new Response(JSON.stringify({ error: "Z-API não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { phone, message, user_id } = body as {
      phone?: string; message?: string; user_id?: string;
    };

    // Detect internal service-role call via Authorization header (not body),
    // avoiding exposure of the service key in logged request payloads.
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const isInternalCall = req.headers.get("x-internal-call") === "1" && bearer === serviceKey;

    if (!isInternalCall) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUser = createClient(supabaseUrl, serviceKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseAdmin = createClient(supabaseUrl, serviceKey);
      const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
      const allowed = (roles || []).some((r: any) => r.role === "admin" || r.role === "moderador");
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!message || typeof message !== "string" || message.trim().length < 2) {
      return new Response(JSON.stringify({ error: "message obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve phone: explicit > profiles[user_id]
    let resolvedPhone = phone;
    if (!resolvedPhone && user_id) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey);
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("phone").eq("user_id", user_id).maybeSingle();
      resolvedPhone = prof?.phone || undefined;
    }

    const e164 = resolvedPhone ? normalizePhone(resolvedPhone) : null;
    if (!e164) {
      return new Response(JSON.stringify({ error: "Telefone do cooperado não cadastrado ou inválido", skipped: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ZAPI_CLIENT_TOKEN) headers["Client-Token"] = ZAPI_CLIENT_TOKEN;

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: e164, message: message.trim() }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("Z-API error:", resp.status, data);
      return new Response(JSON.stringify({ error: "Falha ao enviar WhatsApp", details: "Serviço indisponível" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, phone: e164, zapi: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-whatsapp-notification error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
