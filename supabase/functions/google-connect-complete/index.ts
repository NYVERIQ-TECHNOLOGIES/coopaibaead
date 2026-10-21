import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { exchangeAppUserOAuthCode, callAsAppUser } from "../_shared/appUserConnector.ts";
import { saveConnectionKeyForUser } from "../_shared/appUserConnections.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

Deno.serve(async (req) => {
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

    // Fallback: the calendar list marks one entry as primary; its id is the account email.
    if (!email || !email.includes("@")) {
      try {
        const res = await callAsAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey,
          connectorId: CONNECTOR_ID,
          path: "/calendar/v3/users/me/calendarList",
        });
        if (res.ok) {
          const list = await res.json();
          const items = Array.isArray(list?.items) ? list.items : [];
          const primary = items.find((c: { primary?: boolean }) => c?.primary) ?? items[0];
          const candidate = primary?.id ?? null;
          if (candidate && String(candidate).includes("@")) email = String(candidate);
        } else {
          console.error("calendar list lookup failed", res.status, await res.text());
        }
      } catch (e) {
        console.error("calendar list lookup error", e);
      }
    }

    if (email && !email.includes("@")) email = null;

    await saveConnectionKeyForUser(user.id, connectorId, connectionAPIKey, email);

    return new Response(JSON.stringify({ ok: true, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-connect-complete", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
