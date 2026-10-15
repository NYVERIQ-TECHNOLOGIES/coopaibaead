import { withPasswordRotation } from "../_shared/passwordRotation.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { disconnectAppUser } from "../_shared/appUserConnector.ts";
import {
  getConnectionKeyForUser,
  getConnectionRow,
  deleteConnectionForUser,
} from "../_shared/appUserConnections.ts";

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
    const action = body?.action === "disconnect" ? "disconnect" : "status";

    if (action === "disconnect") {
      const key = await getConnectionKeyForUser(user.id, CONNECTOR_ID);
      if (key) {
        try {
          await disconnectAppUser({
            gatewayBaseUrl: GATEWAY_BASE_URL,
            connectionAPIKey: key,
            connectorId: CONNECTOR_ID,
          });
        } catch (e) {
          console.error("disconnect gateway error", e);
        }
      }
      await deleteConnectionForUser(user.id, CONNECTOR_ID);
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const configured = !!Deno.env.get("GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY");
    const row = await getConnectionRow(user.id, CONNECTOR_ID);
    return new Response(
      JSON.stringify({
        configured,
        connected: !!row,
        email: row?.account_email ?? null,
        connectedAt: row?.updated_at ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("google-connection-status", e);
    return new Response(JSON.stringify({ error: "Não foi possível concluir a operação. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
