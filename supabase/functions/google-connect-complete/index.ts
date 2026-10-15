import { withPasswordRotation } from "../_shared/passwordRotation.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { exchangeAppUserOAuthCode, callAsAppUser } from "../_shared/appUserConnector.ts";
import { saveConnectionKeyForUser } from "../_shared/appUserConnections.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

Deno.serve(withPasswordRotation(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code : null;
    if (!code) {
      return new Response(JSON.stringify({ error: "code ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, code);
    if (connectorId !== CONNECTOR_ID) {
      return new Response(JSON.stringify({ error: "Conector inesperado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Discover the connected account email from the primary calendar.
    let email: string | null = null;
    try {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey,
        connectorId: CONNECTOR_ID,
        path: "/calendar/v3/calendars/primary",
      });
      if (res.ok) {
        const cal = await res.json();
        email = cal?.id ?? null;
      } else {
        console.error("primary calendar lookup failed", res.status, await res.text());
      }
    } catch (e) {
      console.error("primary calendar lookup error", e);
    }

    await saveConnectionKeyForUser(user.id, connectorId, connectionAPIKey, email);

    return new Response(JSON.stringify({ ok: true, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-connect-complete", e);
    return new Response(JSON.stringify({ error: "Não foi possível concluir a operação. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
