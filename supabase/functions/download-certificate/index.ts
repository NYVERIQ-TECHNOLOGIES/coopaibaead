import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";

    if (!code) {
      return new Response(JSON.stringify({ error: "code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const supabaseUser = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cert, error: certErr } = await supabaseAdmin
      .from("certificates")
      .select("id, code, user_id, pdf_path, status, delivery_mode")
      .eq("code", code)
      .maybeSingle();


    if (certErr || !cert || !cert.pdf_path) {
      return new Response(JSON.stringify({ error: "Certificado não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: admin/moderador OR the certificate owner
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    const isStaff = userRoles.includes("admin") || userRoles.includes("moderador");
    const isOwner = cert.user_id === user.id;

    if (!isStaff && !isOwner) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("media")
      .download(cert.pdf_path);

    if (dlErr || !file) {
      return new Response(JSON.stringify({ error: "Falha ao recuperar PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filename = `${cert.code}.pdf`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: any) {
    console.error("download-certificate error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
