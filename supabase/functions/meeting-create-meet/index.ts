import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callAsAppUser } from "../_shared/appUserConnector.ts";
import { getConnectionKeyForUser, adminClient } from "../_shared/appUserConnections.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

type MeetingRow = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  status: string;
  created_by: string;
  provider: string;
};

type Action = "create" | "update" | "cancel";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function calendarEventBody(m: MeetingRow) {
  return {
    summary: m.title,
    description: m.description ?? "",
    start: { dateTime: m.start_at, timeZone: "America/Sao_Paulo" },
    end: { dateTime: m.end_at, timeZone: "America/Sao_Paulo" },
    conferenceData: {
      createRequest: {
        requestId: `meeting-${m.id}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
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
    if (!user) return json({ error: "Sua sessão expirou. Entre novamente.", code: "unauthorized" });

    const body = await req.json().catch(() => ({}));
    const meetingId = typeof body?.meetingId === "string" ? body.meetingId : null;
    if (!meetingId) return json({ error: "meetingId obrigatório" });
    const action: Action = body?.action === "update" || body?.action === "cancel" ? body.action : "create";

    const admin = adminClient();
    const { data: m } = await admin
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .maybeSingle();
    if (!m) return json({ error: "Reunião não encontrada" });
    const meeting = m as MeetingRow;

    const { data: isManager } = await admin.rpc("meeting_is_manager", {
      _id: meeting.id,
      _uid: user.id,
    });
    if (!isManager) return json({ error: "Não autorizado" });

    const { data: linkRow } = await admin
      .from("meeting_google_links")
      .select("meet_event_id")
      .eq("meeting_id", meeting.id)
      .maybeSingle();
    const eventId: string | null = linkRow?.meet_event_id ?? null;

    const connectionAPIKey = await getConnectionKeyForUser(meeting.created_by, CONNECTOR_ID)
      ?? await getConnectionKeyForUser(user.id, CONNECTOR_ID);
    if (!connectionAPIKey) {
      // Estado esperado e recuperável pelo usuário: responder 200 com `error` no corpo
      // evita que o cliente trate como falha de rede/crash; a tela exibe o aviso.
      return json({ error: "Conecte uma conta Google antes de usar o Google Meet nesta reunião.", code: "google_not_connected" });
    }

    if (action === "update") {
      if (!eventId) return json({ error: "Esta reunião ainda não possui um evento no Google Agenda." });
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey,
        connectorId: CONNECTOR_ID,
        path: `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        init: {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: meeting.title,
            description: meeting.description ?? "",
            start: { dateTime: meeting.start_at, timeZone: "America/Sao_Paulo" },
            end: { dateTime: meeting.end_at, timeZone: "America/Sao_Paulo" },
          }),
        },
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("update meet event failed", res.status, text);
        return json({ error: `Falha ao atualizar o evento no Google (${res.status})` });
      }
      return json({ updated: true });
    }

    if (action === "cancel") {
      if (!eventId) return json({ cancelled: true, skipped: "Sem evento no Google Agenda." });
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey,
        connectorId: CONNECTOR_ID,
        path: `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        init: {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        },
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("cancel meet event failed", res.status, text);
        return json({ cancelled: false, warning: `A reunião foi cancelada na plataforma, mas o evento no Google pôde não ser cancelado (${res.status}).` });
      }
      return json({ cancelled: true });
    }

    // action === "create" — idempotente: reutiliza o link já criado.
    if (eventId) {
      const { data: existing } = await admin
        .from("meeting_google_links")
        .select("meet_url, meet_conference_id, google_account_email")
        .eq("meeting_id", meeting.id)
        .maybeSingle();
      if (existing?.meet_url) {
        return json({
          meetUrl: existing.meet_url,
          conferenceId: existing.meet_conference_id ?? null,
          alreadyExisted: true,
        });
      }
    }

    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CONNECTOR_ID,
      path: "/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calendarEventBody(meeting)),
      },
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("create meet failed", res.status, text);
      if (res.status === 403 && /SERVICE_DISABLED|accessNotConfigured/.test(text)) {
        return json({
          error: "A API do Google Agenda está desativada no seu projeto do Google Cloud. Ative a \"Google Calendar API\" em APIs e serviços → Biblioteca, aguarde alguns minutos e tente novamente.",
          code: "google_calendar_api_disabled",
        });
      }
      if (res.status === 401 || res.status === 403) {
        return json({
          error: "O Google recusou o acesso à sua agenda. Desconecte e conecte sua conta Google novamente, aceitando o acesso ao Google Agenda.",
          code: "google_permission_denied",
        });
      }
      return json({ error: `Falha ao criar a reunião no Google (${res.status}).`, code: "google_error" });
    }

    const event = JSON.parse(text);
    const meetUrl: string | null = event?.hangoutLink
      ?? event?.conferenceData?.entryPoints?.find((p: { entryPointType?: string; uri?: string }) =>
        p.entryPointType === "video")?.uri
      ?? null;

    if (!meetUrl) {
      return json({ error: "O Google não retornou um link do Meet para este evento." });
    }

    const { data: conn } = await admin
      .from("app_user_connections")
      .select("account_email")
      .eq("user_id", meeting.created_by)
      .eq("connector_id", CONNECTOR_ID)
      .maybeSingle();

    const { error: upErr } = await admin.from("meeting_google_links").upsert(
      {
        meeting_id: meeting.id,
        meet_url: meetUrl,
        meet_event_id: event?.id ?? null,
        meet_conference_id: event?.conferenceData?.conferenceId ?? null,
        google_account_email: conn?.account_email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "meeting_id" },
    );
    if (upErr) throw upErr;

    const { error: provErr } = await admin.from("meetings").update({
      provider: "google_meet",
      updated_at: new Date().toISOString(),
    }).eq("id", meeting.id);
    if (provErr) throw provErr;

    return json({
      meetUrl,
      eventId: event?.id ?? null,
      conferenceId: event?.conferenceData?.conferenceId ?? null,
      htmlLink: event?.htmlLink ?? null,
    });
  } catch (e) {
    console.error("meeting-create-meet", e);
    return json({ error: String((e as Error).message ?? e) });
  }
});
