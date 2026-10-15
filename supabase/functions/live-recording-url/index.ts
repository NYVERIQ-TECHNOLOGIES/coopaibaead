import { withPasswordRotation } from "../_shared/passwordRotation.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/appUserConnections.ts";

const BUCKET = "gravacoes";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Devolve uma URL assinada e temporária para o vídeo da gravação.
 * O arquivo nunca é exposto publicamente.
 */
Deno.serve(withPasswordRotation(async (req) => {
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
    const recordingId = typeof body?.recordingId === "string" ? body.recordingId : null;
    const storagePath = typeof body?.storagePath === "string" ? body.storagePath : null;

    const admin = adminClient();
    let path: string | null = null;
    let courseId: string | null = null;
    let teacherId: string | null = null;

    if (recordingId) {
      const { data: rec } = await admin
        .from("live_recordings")
        .select("storage_path, course_id, live_class_id")
        .eq("id", recordingId)
        .maybeSingle();
      if (!rec) return json({ error: "Gravação não encontrada" }, 404);
      path = rec.storage_path;
      courseId = rec.course_id;
      const { data: lc } = await admin
        .from("live_classes").select("teacher_id").eq("id", rec.live_class_id).maybeSingle();
      teacherId = lc?.teacher_id ?? null;
    } else if (storagePath) {
      const { data: rec } = await admin
        .from("live_recordings")
        .select("storage_path, course_id, live_class_id")
        .eq("storage_path", storagePath)
        .maybeSingle();
      if (!rec) return json({ error: "Gravação não encontrada" }, 404);
      path = rec.storage_path;
      courseId = rec.course_id;
      const { data: lc } = await admin
        .from("live_classes").select("teacher_id").eq("id", rec.live_class_id).maybeSingle();
      teacherId = lc?.teacher_id ?? null;
    } else {
      return json({ error: "Informe recordingId ou storagePath" }, 400);
    }

    if (!path) return json({ error: "Esta gravação ainda não possui arquivo de vídeo." }, 404);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    let allowed = !!isAdmin || teacherId === user.id;
    if (!allowed && courseId) {
      const { data: canAccess } = await admin.rpc("can_access_course", {
        _user_id: user.id,
        _course_id: courseId,
      });
      allowed = !!canAccess;
    }
    if (!allowed) return json({ error: "Você não tem acesso a esta gravação." }, 403);

    const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (error || !signed?.signedUrl) {
      return json({ error: "Não foi possível concluir a operação. Tente novamente." }, 500);
    }

    return json({ url: signed.signedUrl, expiresIn: 3600 });
  } catch (e) {
    console.error("live-recording-url", e);
    return json({ error: "Não foi possível concluir a operação. Tente novamente." }, 500);
  }
}));
