import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callAsAppUser } from "../_shared/appUserConnector.ts";
import { getConnectionKeyForUser, adminClient } from "../_shared/appUserConnections.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";
const BUCKET = "gravacoes";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function meetingCodeFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/meet\.google\.com\/([a-z0-9-]+)/i);
  return m ? m[1] : null;
}

/**
 * Tenta localizar a gravação da reunião pela Google Meet REST API e baixá-la
 * para o storage da plataforma. Quando a conta Google não disponibiliza a
 * gravação (plano sem gravação, gravação não iniciada, ou API indisponível),
 * a gravação fica marcada como "aguardando_upload" com uma mensagem clara,
 * e o professor pode enviar o arquivo manualmente.
 */
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
    const { data: lc } = await admin.from("live_classes").select("*").eq("id", liveClassId).maybeSingle();
    if (!lc) return json({ error: "Aula ao vivo não encontrada" }, 404);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (lc.teacher_id !== user.id && !isAdmin) return json({ error: "Não autorizado" }, 403);

    // Garante que existe um registro de gravação
    let { data: rec } = await admin
      .from("live_recordings")
      .select("*")
      .eq("live_class_id", lc.id)
      .maybeSingle();

    if (!rec) {
      const { data: created, error } = await admin.from("live_recordings").insert({
        live_class_id: lc.id,
        course_id: lc.course_id,
        module_id: lc.module_id,
        title: lc.title,
        description: lc.description,
        status: "processando",
        source: lc.provider,
      }).select("*").single();
      if (error) throw error;
      rec = created;
    }

    await admin.from("live_classes").update({
      status: lc.status === "publicada" ? "publicada" : "processando",
      recording_status: "processando",
      ended_at: lc.ended_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", lc.id);

    const connectionAPIKey = await getConnectionKeyForUser(lc.teacher_id, CONNECTOR_ID);
    const code = meetingCodeFromUrl(lc.meet_url);

    let failure = "Não foi possível localizar automaticamente a gravação desta reunião.";

    if (connectionAPIKey && code) {
      try {
        const listRes = await callAsAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey,
          connectorId: CONNECTOR_ID,
          path: `/v2/conferenceRecords?filter=${encodeURIComponent(`space.meeting_code="${code}"`)}`,
        });
        const listText = await listRes.text();
        if (!listRes.ok) {
          failure = `Google Meet API (${listRes.status}): ${listText.slice(0, 300)}`;
        } else {
          const parsed = JSON.parse(listText);
          const conference = parsed?.conferenceRecords?.[0];
          if (!conference) {
            failure = "A reunião ainda não foi encerrada ou não possui registro de conferência.";
          } else {
            const recRes = await callAsAppUser({
              gatewayBaseUrl: GATEWAY_BASE_URL,
              connectionAPIKey,
              connectorId: CONNECTOR_ID,
              path: `/v2/${conference.name}/recordings`,
            });
            const recText = await recRes.text();
            if (!recRes.ok) {
              failure = `Google Meet API (${recRes.status}): ${recText.slice(0, 300)}`;
            } else {
              const recordings = JSON.parse(recText)?.recordings ?? [];
              const ready = recordings.find((r: { state?: string }) => r.state === "FILE_GENERATED");
              const fileId = ready?.driveDestination?.file;
              if (!fileId) {
                failure = "A reunião foi encerrada, mas o Google ainda não gerou o arquivo da gravação.";
              } else {
                const fileRes = await callAsAppUser({
                  gatewayBaseUrl: GATEWAY_BASE_URL,
                  connectionAPIKey,
                  connectorId: CONNECTOR_ID,
                  path: `/drive/v3/files/${fileId}?alt=media`,
                });
                if (!fileRes.ok) {
                  failure = `Não foi possível baixar o arquivo da gravação (${fileRes.status}).`;
                } else {
                  const bytes = new Uint8Array(await fileRes.arrayBuffer());
                  const path = `${lc.id}/${rec.id}.mp4`;
                  const { error: upErr } = await admin.storage
                    .from(BUCKET)
                    .upload(path, bytes, { contentType: "video/mp4", upsert: true });
                  if (upErr) {
                    failure = `Falha ao armazenar a gravação: ${upErr.message}`;
                  } else {
                    await admin.from("live_recordings").update({
                      storage_path: path,
                      file_size: bytes.length,
                      status: "pronta",
                      error_message: null,
                      updated_at: new Date().toISOString(),
                    }).eq("id", rec.id);
                    await admin.from("live_classes").update({
                      status: "pronta",
                      recording_status: "pronta",
                      error_message: null,
                    }).eq("id", lc.id);
                    await admin.from("notifications").insert({
                      user_id: lc.teacher_id,
                      type: "live_recording_ready",
                      title: "A gravação está pronta",
                      message: `A gravação de "${lc.title}" já pode ser revisada e publicada.`,
                      link: "/ensino?tab=aulas-ao-vivo",
                    });
                    return json({ status: "pronta", storagePath: path });
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        failure = `Erro ao consultar a gravação: ${String((e as Error).message ?? e)}`;
        console.error("recording lookup", e);
      }
    } else if (!connectionAPIKey) {
      failure = "A conta Google do professor não está conectada.";
    }

    await admin.from("live_recordings").update({
      status: "aguardando_upload",
      error_message: failure,
      updated_at: new Date().toISOString(),
    }).eq("id", rec.id);
    await admin.from("live_classes").update({
      status: "encerrada",
      recording_status: "aguardando_upload",
      error_message: failure,
    }).eq("id", lc.id);

    return json({ status: "aguardando_upload", message: failure, recordingId: rec.id });
  } catch (e) {
    console.error("live-class-recording", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
