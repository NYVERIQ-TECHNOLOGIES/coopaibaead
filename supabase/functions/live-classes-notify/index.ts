import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/appUserConnections.ts";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const WINDOWS: { type: string; minutes: number; label: string }[] = [
  { type: "live_reminder_1d", minutes: 24 * 60, label: "começa amanhã" },
  { type: "live_reminder_1h", minutes: 60, label: "começa em 1 hora" },
  { type: "live_reminder_15m", minutes: 15, label: "começa em 15 minutos" },
  { type: "live_started", minutes: 0, label: "está ao vivo! Entre agora" },
];

/**
 * Dispara as notificações in-app das aulas ao vivo.
 * Pode ser chamada por um agendador externo ou pela própria plataforma.
 * A arquitetura já separa o "evento" do "canal" — e-mail, WhatsApp e push
 * podem ser plugados aqui depois.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = adminClient();
    const now = Date.now();

    const { data: classes, error } = await admin
      .from("live_classes")
      .select("id, course_id, title, scheduled_at, status, teacher_id")
      .in("status", ["agendada", "ao_vivo"])
      .gte("scheduled_at", new Date(now - 60 * 60 * 1000).toISOString())
      .lte("scheduled_at", new Date(now + 26 * 60 * 60 * 1000).toISOString());
    if (error) throw error;

    let created = 0;

    for (const lc of classes ?? []) {
      const diffMin = (new Date(lc.scheduled_at).getTime() - now) / 60000;

      for (const w of WINDOWS) {
        const inWindow = w.minutes === 0
          ? diffMin <= 0 && diffMin > -30
          : diffMin <= w.minutes && diffMin > w.minutes - 10;
        if (!inWindow) continue;

        const link = `/courses/${lc.course_id}?live=${lc.id}`;

        const { data: already } = await admin
          .from("notifications")
          .select("id")
          .eq("type", w.type)
          .eq("link", link)
          .limit(1);
        if (already && already.length > 0) continue;

        const { data: enrolled } = await admin
          .from("enrollments")
          .select("user_id")
          .eq("course_id", lc.course_id);

        const recipients = new Set<string>((enrolled ?? []).map((e) => e.user_id));
        recipients.add(lc.teacher_id);

        const rows = [...recipients].map((uid) => ({
          user_id: uid,
          type: w.type,
          title: w.minutes === 0 ? "Aula ao vivo começando" : "Lembrete de aula ao vivo",
          message: `A aula "${lc.title}" ${w.label}.`,
          link,
        }));

        if (rows.length > 0) {
          const { error: insErr } = await admin.from("notifications").insert(rows);
          if (insErr) console.error("notify insert", insErr);
          else created += rows.length;
        }

        if (w.minutes === 0 && lc.status !== "ao_vivo") {
          await admin.from("live_classes").update({
            status: "ao_vivo",
            started_at: new Date().toISOString(),
          }).eq("id", lc.id);
        }
      }
    }

    return json({ ok: true, notifications: created });
  } catch (e) {
    console.error("live-classes-notify", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
