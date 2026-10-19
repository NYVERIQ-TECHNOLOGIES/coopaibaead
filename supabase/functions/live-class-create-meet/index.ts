import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callAsAppUser } from "../_shared/appUserConnector.ts";
import { getConnectionKeyForUser, adminClient } from "../_shared/appUserConnections.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Sign in required" }, 401);

    const body = await req.json().catch(() => ({}));
    const liveClassId = typeof body?.liveClassId === "string" ? body.liveClassId : null;
    if (!liveClassId) return json({ error: "liveClassId obrigatório" }, 400);

    const admin = adminClient();
    const { data: lc } = await admin
      .from("live_classes")
      .select("*")
      .eq("id", liveClassId)
      .maybeSingle();
    if (!lc) return json({ error: "Aula ao vivo não encontrada" }, 404);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (lc.teacher_id !== user.id && !isAdmin) return json({ error: "Não autorizado" }, 403);

    const connectionAPIKey = await getConnectionKeyForUser(lc.teacher_id, CONNECTOR_ID)
      ?? await getConnectionKeyForUser(user.id, CONNECTOR_ID);
    if (!connectionAPIKey) return json({ error: "Conecte uma conta Google antes de criar a reunião." }, 400);

    const start = new Date(lc.scheduled_at);
    const end = new Date(start.getTime() + (lc.duration_minutes ?? 60) * 60000);

    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CONNECTOR_ID,
      path: "/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: lc.title,
          description: lc.description ?? "",
          start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
          end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
          conferenceData: {
            createRequest: {
              requestId: `live-${lc.id}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }),
      },
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("create meet failed", res.status, text);
      await admin.from("live_classes").update({
        error_message: `Google (${res.status}): ${text.slice(0, 400)}`,
      }).eq("id", lc.id);
      return json({ error: "Falha ao criar a reunião no Google", status: res.status, details: text }, res.status);
    }

    const event = JSON.parse(text);
    const meetUrl: string | null = event?.hangoutLink
      ?? event?.conferenceData?.entryPoints?.find((p: { entryPointType?: string; uri?: string }) =>
        p.entryPointType === "video")?.uri
      ?? null;

    if (!meetUrl) {
      return json({ error: "O Google não retornou um link do Meet para este evento." }, 502);
    }

    const { data: conn } = await admin
      .from("app_user_connections")
      .select("account_email")
      .eq("user_id", lc.teacher_id)
      .eq("connector_id", CONNECTOR_ID)
      .maybeSingle();

    const { error: upErr } = await admin.from("live_classes").update({
      meet_url: meetUrl,
      meet_event_id: event?.id ?? null,
      meet_conference_id: event?.conferenceData?.conferenceId ?? null,
      google_account_email: conn?.account_email ?? null,
      provider: "google_meet",
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", lc.id);
    if (upErr) throw upErr;

    return json({
      meetUrl,
      eventId: event?.id ?? null,
      conferenceId: event?.conferenceData?.conferenceId ?? null,
      htmlLink: event?.htmlLink ?? null,
    });
  } catch (e) {
    console.error("live-class-create-meet", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
