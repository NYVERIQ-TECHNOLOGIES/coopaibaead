import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BRAND = {
  green: { r: 0.0, g: 0.588, b: 0.251 },
  blue: { r: 0.0, g: 0.341, b: 0.722 },
  yellow: { r: 0.969, g: 0.776, b: 0.0 },
  ink: { r: 0.1, g: 0.1, b: 0.1 },
  muted: { r: 0.45, g: 0.45, b: 0.45 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const supabaseUser = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only staff (admin or moderador) can pull the pickup receipt
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = (roles || []).some((r: any) => r.role === "admin" || r.role === "moderador");
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const download = url.searchParams.get("download") === "1";
    if (!code) {
      return new Response(JSON.stringify({ error: "code obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cert } = await supabaseAdmin
      .from("certificates")
      .select("*, courses(title), profiles!certificates_user_id_profiles_fkey(full_name, cpf, enrollment_number, cooperativa)")
      .eq("code", code).maybeSingle();

    if (!cert) {
      return new Response(JSON.stringify({ error: "Certificado não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine the holder's profile type (aluno / cooperado / cooperado eventual)
    let holderLabel = "Cooperado";
    if (cert.user_id) {
      const { data: holderRoles } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", cert.user_id);
      const rs = (holderRoles || []).map((r: any) => r.role);
      const priority = ["cooperado", "cooperado_eventual", "aluno"];
      const primary = priority.find((p) => rs.includes(p));
      if (primary === "aluno") holderLabel = "Aluno";
      else if (primary === "cooperado_eventual") holderLabel = "Cooperado Eventual";
      else if (primary === "cooperado") holderLabel = "Cooperado";
    }

    // Logo (optional)
    let logoUrl: string | null = null;
    try {
      const { data: signed } = await supabaseAdmin.storage
        .from("media").createSignedUrl("branding/logo-coopaiba.png", 60);
      if (signed?.signedUrl) {
        const head = await fetch(signed.signedUrl, { method: "HEAD" });
        if (head.ok) logoUrl = signed.signedUrl;
      }
    } catch {}

    // Saved signature (if pickup already registered)
    let savedSignatureUrl: string | null = null;
    if (cert.pickup_signature_url) {
      try {
        // pickup_signature_url is stored as storage path in 'media' or full URL
        if (cert.pickup_signature_url.startsWith("http")) {
          savedSignatureUrl = cert.pickup_signature_url;
        } else {
          const { data: sig } = await supabaseAdmin.storage
            .from("media").createSignedUrl(cert.pickup_signature_url, 60);
          savedSignatureUrl = sig?.signedUrl || null;
        }
      } catch {}
    }

    const pdfBytes = await buildReceipt({
      code: cert.code,
      studentName: cert.profiles?.full_name || cert.student_name_snapshot || "—",
      studentCpf: cert.profiles?.cpf || cert.student_cpf_snapshot || null,
      enrollmentNumber: cert.profiles?.enrollment_number || cert.enrollment_number_snapshot || null,
      cooperativa: cert.profiles?.cooperativa || cert.cooperativa_snapshot || null,
      courseTitle: cert.courses?.title || cert.course_title_snapshot || "—",
      courseDuration: cert.course_duration_snapshot || "—",
      issuedAt: cert.issued_at,
      pickupAt: cert.pickup_registered_at,
      attendantName: cert.pickup_attendant_name,
      documentPresented: cert.pickup_document_presented,
      observations: cert.pickup_observations,
      logoUrl,
      savedSignatureUrl,
      status: cert.status,
      holderLabel,
    });


    const filename = `comprovante-retirada-${cert.code}.pdf`;
    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("generate-pickup-receipt error:", err);
    return new Response(JSON.stringify({ error: "Erro ao gerar comprovante" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface ReceiptData {
  code: string;
  studentName: string;
  studentCpf: string | null;
  enrollmentNumber: string | null;
  cooperativa: string | null;
  courseTitle: string;
  courseDuration: string;
  issuedAt: string | null;
  pickupAt: string | null;
  attendantName: string | null;
  documentPresented: string | null;
  observations: string | null;
  logoUrl: string | null;
  savedSignatureUrl: string | null;
  status: string;
  holderLabel: string;
}

async function buildReceipt(d: ReceiptData): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import("https://esm.sh/pdf-lib@1.17.1");

  const pdf = await PDFDocument.create();
  const W = 595.28, H = 841.89; // A4 portrait
  const page = pdf.addPage([W, H]);

  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontR = await pdf.embedFont(StandardFonts.Helvetica);
  const fontI = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const green = rgb(BRAND.green.r, BRAND.green.g, BRAND.green.b);
  const blue = rgb(BRAND.blue.r, BRAND.blue.g, BRAND.blue.b);
  const yellow = rgb(BRAND.yellow.r, BRAND.yellow.g, BRAND.yellow.b);
  const ink = rgb(BRAND.ink.r, BRAND.ink.g, BRAND.ink.b);
  const muted = rgb(BRAND.muted.r, BRAND.muted.g, BRAND.muted.b);

  // Header bar
  page.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: green });
  page.drawRectangle({ x: 0, y: H - 96, width: W, height: 6, color: yellow });

  // Logo or text
  if (d.logoUrl) {
    try {
      const r = await fetch(d.logoUrl);
      if (r.ok) {
        const bytes = new Uint8Array(await r.arrayBuffer());
        const ct = r.headers.get("content-type") || "";
        const img = ct.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const th = 50;
        const scale = th / img.height;
        page.drawImage(img, { x: 36, y: H - 70, width: img.width * scale, height: th });
      }
    } catch {}
  } else {
    page.drawText("COOPAIBA", { x: 36, y: H - 55, size: 22, font: fontB, color: rgb(1, 1, 1) });
  }

  const headRight = "Comprovante de Retirada de Certificado";
  const hrw = fontB.widthOfTextAtSize(headRight, 13);
  page.drawText(headRight, { x: W - 36 - hrw, y: H - 45, size: 13, font: fontB, color: rgb(1, 1, 1) });
  const sub = "Programa de Educação Cooperativa — PEC";
  const sw = fontI.widthOfTextAtSize(sub, 9);
  page.drawText(sub, { x: W - 36 - sw, y: H - 60, size: 9, font: fontI, color: rgb(1, 1, 1) });

  let y = H - 130;

  // Section: Identificação do cooperado
  y = drawSection(page, fontB, fontR, `1. Identificação do ${d.holderLabel}`, y, blue, ink);
  y = drawField(page, fontB, fontR, "Nome:", d.studentName, y, ink, muted);
  if (d.studentCpf) y = drawField(page, fontB, fontR, "CPF:", formatCpf(d.studentCpf), y, ink, muted);
  if (d.enrollmentNumber) y = drawField(page, fontB, fontR, "Matrícula:", d.enrollmentNumber, y, ink, muted);
  if (d.cooperativa) y = drawField(page, fontB, fontR, "Cooperativa:", d.cooperativa, y, ink, muted);

  y -= 12;
  // Section: Certificado
  y = drawSection(page, fontB, fontR, "2. Certificado Retirado", y, blue, ink);
  y = drawField(page, fontB, fontR, "Código:", d.code, y, ink, muted);
  y = drawField(page, fontB, fontR, "Curso:", d.courseTitle, y, ink, muted);
  y = drawField(page, fontB, fontR, "Carga horária:", d.courseDuration, y, ink, muted);
  if (d.issuedAt) {
    y = drawField(page, fontB, fontR, "Emitido em:", new Date(d.issuedAt).toLocaleString("pt-BR"), y, ink, muted);
  }

  y -= 12;
  // Section: Retirada
  y = drawSection(page, fontB, fontR, "3. Dados da Retirada Presencial", y, blue, ink);
  y = drawField(page, fontB, fontR, "Data da retirada:", d.pickupAt ? new Date(d.pickupAt).toLocaleString("pt-BR") : "____/____/______  ____:____", y, ink, muted);
  y = drawField(page, fontB, fontR, "Documento apresentado:", d.documentPresented || "____________________________________________", y, ink, muted);
  y = drawField(page, fontB, fontR, "Atendente responsável:", d.attendantName || "____________________________________________", y, ink, muted);
  y = drawField(page, fontB, fontR, "Observações:", d.observations || "____________________________________________", y, ink, muted);

  y -= 18;
  // Declaration
  const declaration =
    "Declaro, para os devidos fins, que recebi nesta data, em via única e impressa, o certificado " +
    "acima identificado, emitido pela COOPAIBA — Cooperativa dos Agricultores Familiares e dos " +
    "Empreendimentos Solidários, por meio do Programa de Educação Cooperativa (PEC). Confirmo " +
    "que conferi os dados pessoais e do curso e que estou ciente das normas de uso e validação do " +
    "certificado pela cooperativa.";
  const lines = wrapText(declaration, fontR, 10, W - 80);
  for (const ln of lines) {
    page.drawText(ln, { x: 40, y, size: 10, font: fontR, color: ink });
    y -= 14;
  }

  // Signatures area
  y -= 30;
  const sigLen = 220;

  // Cooperado
  const lx = W * 0.28;
  page.drawLine({ start: { x: lx - sigLen / 2, y }, end: { x: lx + sigLen / 2, y }, thickness: 0.8, color: ink });
  const ln1 = `Assinatura do ${d.holderLabel}`;
  const ln1w = fontR.widthOfTextAtSize(ln1, 9);
  page.drawText(ln1, { x: lx - ln1w / 2, y: y - 12, size: 9, font: fontR, color: muted });

  // Atendente — paste saved digital signature image if available
  const rx = W * 0.72;
  if (d.savedSignatureUrl) {
    try {
      const r = await fetch(d.savedSignatureUrl);
      if (r.ok) {
        const bytes = new Uint8Array(await r.arrayBuffer());
        const img = await pdf.embedPng(bytes).catch(async () => pdf.embedJpg(bytes));
        const th = 50;
        const scale = Math.min(th / img.height, sigLen / img.width);
        const w = img.width * scale, h = img.height * scale;
        page.drawImage(img, { x: rx - w / 2, y: y + 2, width: w, height: h });
      }
    } catch {}
  }
  page.drawLine({ start: { x: rx - sigLen / 2, y }, end: { x: rx + sigLen / 2, y }, thickness: 0.8, color: ink });
  const ln2 = d.attendantName ? `${d.attendantName} — Atendente COOPAIBA` : "Assinatura do Atendente — COOPAIBA";
  const ln2w = fontR.widthOfTextAtSize(ln2, 9);
  page.drawText(ln2, { x: rx - ln2w / 2, y: y - 12, size: 9, font: fontR, color: muted });

  // Footer
  const foot = `Comprovante ${d.code} · COOPAIBA · gerado em ${new Date().toLocaleString("pt-BR")}`;
  const fw = fontR.widthOfTextAtSize(foot, 8);
  page.drawText(foot, { x: W / 2 - fw / 2, y: 30, size: 8, font: fontR, color: muted });

  const bytes = await pdf.save();
  return new Uint8Array(bytes);
}

function drawSection(page: any, fontB: any, _fontR: any, label: string, y: number, accent: any, _ink: any): number {
  page.drawRectangle({ x: 36, y: y - 2, width: 3, height: 14, color: accent });
  page.drawText(label, { x: 46, y, size: 12, font: fontB, color: accent });
  return y - 22;
}

function drawField(page: any, fontB: any, fontR: any, label: string, value: string, y: number, ink: any, muted: any): number {
  page.drawText(label, { x: 40, y, size: 9.5, font: fontB, color: muted });
  page.drawText(value, { x: 160, y, size: 10.5, font: fontR, color: ink });
  return y - 18;
}

function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const trial = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) current = trial;
    else { if (current) lines.push(current); current = w; }
  }
  if (current) lines.push(current);
  return lines;
}
