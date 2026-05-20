import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  codigo: z.string().min(1).max(32),
  nome: z.string().min(2).max(200),
  cpf: z.string().optional().nullable(),
  matricula: z.string().max(64).optional().nullable(),
  tipo: z.enum(["desenho", "digitada", "checkin"]),
  assinaturaBase64: z.string().max(2_000_000).optional().nullable(), // ~2MB cap on base64 string
  assinaturaTexto: z.string().max(200).optional().nullable(),
});

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Lookup event
    const { data: eventoRow, error: eventoErr } = await admin
      .from("presenca_eventos")
      .select("id, codigo, status")
      .eq("codigo", body.codigo.toUpperCase())
      .maybeSingle();

    if (eventoErr) throw eventoErr;
    if (!eventoRow) {
      return new Response(JSON.stringify({ error: "Evento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (eventoRow.status !== "aberto") {
      return new Response(JSON.stringify({ error: "Evento encerrado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit per IP per event (best-effort)
    const ip = getClientIp(req) || "unknown";
    const ident = `${ip}:${eventoRow.codigo}`;
    try {
      const windowStart = new Date(Date.now() - 60_000).toISOString();
      const { data: rl } = await admin
        .from("edge_function_rate_limits")
        .select("id, request_count, window_started_at")
        .eq("function_name", "registrar-presenca")
        .eq("identifier", ident)
        .gte("window_started_at", windowStart)
        .maybeSingle();
      if (rl && (rl.request_count ?? 0) >= 10) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (rl) {
        await admin
          .from("edge_function_rate_limits")
          .update({ request_count: (rl.request_count ?? 0) + 1, updated_at: new Date().toISOString() })
          .eq("id", rl.id);
      } else {
        await admin.from("edge_function_rate_limits").insert({
          function_name: "registrar-presenca",
          identifier: ident,
          request_count: 1,
        });
      }
    } catch (_) {
      // Don't fail the request on rate-limit storage errors
    }

    // Handle signature upload (server-side, service role)
    let assinaturaUrl: string | null = null;
    if (body.tipo === "desenho") {
      if (!body.assinaturaBase64) {
        return new Response(JSON.stringify({ error: "Assinatura ausente" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const match = body.assinaturaBase64.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
      if (!match) {
        return new Response(JSON.stringify({ error: "Formato de assinatura inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const mime = match[1];
      const b64 = match[2];
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 1_500_000) {
        return new Response(JSON.stringify({ error: "Assinatura muito grande" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const path = `${eventoRow.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("assinaturas")
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (upErr) throw upErr;
      assinaturaUrl = path;
    } else if (body.tipo === "digitada") {
      if (!body.assinaturaTexto?.trim()) {
        return new Response(JSON.stringify({ error: "Assinatura digitada vazia" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      assinaturaUrl = `texto:${body.assinaturaTexto.trim()}`;
    }

    const { data, error } = await admin.rpc("registrar_presenca", {
      _codigo: body.codigo,
      _nome: body.nome,
      _cpf: body.cpf ?? null,
      _matricula: body.matricula ?? null,
      _assinatura_url: assinaturaUrl,
      _assinatura_tipo: body.tipo,
      _ip: ip,
      _user_agent: req.headers.get("user-agent"),
    });

    if (error) {
      const msg = error.message || "Erro ao registrar";
      const status = /já registrada/i.test(msg) ? 409 : 400;
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("registrar-presenca error", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
