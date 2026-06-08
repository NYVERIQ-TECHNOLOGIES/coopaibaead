// Reissue an existing certificate: rebuilds the PDF preserving the original code,
// issued_at and QR Code. Increments reissue_count via SECURITY DEFINER RPC and logs audit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BRAND = {
  green: { r: 0.0, g: 0.588, b: 0.251 },
  blue:  { r: 0.0, g: 0.341, b: 0.722 },
  yellow:{ r: 0.969, g: 0.776, b: 0.0 },
  ink:   { r: 0.1, g: 0.1, b: 0.1 },
  muted: { r: 0.45, g: 0.45, b: 0.45 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Not authenticated" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const asUser = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);

    const { data: isAdminRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!isAdminRow) return json({ error: "Apenas administradores podem reemitir certificados." }, 403);

    const body = await req.json();
    const { certificate_id } = body as { certificate_id?: string };
    if (!certificate_id) return json({ error: "certificate_id required" }, 400);

    const { data: cert, error: certErr } = await admin
      .from("certificates").select("*").eq("id", certificate_id).maybeSingle();
    if (certErr || !cert) return json({ error: "Certificado não encontrado" }, 404);
    if (cert.status === "cancelado") return json({ error: "Certificado cancelado não pode ser reemitido." }, 409);

    // Re-load fresh course/profile data for snapshots that may have shifted,
    // but ALWAYS reuse the original code, issued_at and pdf_path.
    const { data: profile } = await admin
      .from("profiles").select("full_name, cpf, enrollment_number, cooperativa")
      .eq("user_id", cert.user_id).maybeSingle();
    const { data: course } = await admin
      .from("courses").select("title, duration").eq("id", cert.course_id).maybeSingle();

    const studentName = sanitizeName(cert.student_name_snapshot || profile?.full_name || "Aluno");
    const studentCpf = cert.student_cpf_snapshot || profile?.cpf || null;
    const courseTitle = cert.course_title_snapshot || course?.title || "Curso";
    const courseDuration = cert.course_duration_snapshot || course?.duration || "—";
    const courseStartedAt = cert.course_started_at_snapshot;
    const startStr = courseStartedAt
      ? new Date(courseStartedAt).toLocaleDateString("pt-BR") : "—";
    const issuedDate = cert.issued_at ? new Date(cert.issued_at) : new Date();
    const endStr = issuedDate.toLocaleDateString("pt-BR");
    const dateStr = issuedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const verifyUrl = `https://coopaiba.com.br/validar-certificado/${cert.code}`;

    // Resolve template + logo signed URLs (same logic as generate-certificate)
    let templateSignedUrl: string | null = null;
    const { data: tpl } = await admin
      .from("certificate_templates").select("file_url").eq("active", true).limit(1).maybeSingle();
    if (tpl?.file_url) {
      const { data: signed } = await admin.storage.from("media").createSignedUrl(tpl.file_url, 60);
      templateSignedUrl = signed?.signedUrl || null;
    }
    let logoSignedUrl: string | null = null;
    try {
      const { data: signedLogo } = await admin.storage
        .from("media").createSignedUrl("branding/logo-coopaiba.png", 60);
      if (signedLogo?.signedUrl) {
        const head = await fetch(signedLogo.signedUrl, { method: "HEAD" });
        if (head.ok) logoSignedUrl = signedLogo.signedUrl;
      }
    } catch { /* no logo */ }

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await buildCertificatePdf({
        studentName, studentCpf,
        enrollmentNumber: cert.enrollment_number_snapshot || profile?.enrollment_number || null,
        cooperativa: cert.cooperativa_snapshot || profile?.cooperativa || null,
        courseTitle, courseDuration, startStr, endStr, dateStr,
        templateUrl: templateSignedUrl, logoUrl: logoSignedUrl,
        certCode: cert.code, verifyUrl,
      });
    } catch (e: any) {
      await admin.rpc("mark_certificate_error", { _certificate_id: cert.id, _message: e?.message || "Falha na reemissão do PDF" });
      return json({ error: "Falha ao gerar o PDF. O certificado foi marcado como erro." }, 500);
    }

    // Overwrite the PDF at the same storage path → URL/code/QR unchanged.
    const filePath = cert.pdf_path || `certificates/${cert.code}.pdf`;
    const { error: upErr } = await admin.storage
      .from("media").upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      await admin.rpc("mark_certificate_error", { _certificate_id: cert.id, _message: upErr.message });
      return json({ error: "Falha ao salvar o PDF reemitido." }, 500);
    }

    if (!cert.pdf_path) {
      await admin.from("certificates").update({ pdf_path: filePath }).eq("id", cert.id);
    }

    // Increments reissue counter, updates last_reissued_at/by and logs audit
    const { error: rpcErr } = await asUser.rpc("register_certificate_reissue", { _certificate_id: cert.id });
    if (rpcErr) return json({ error: rpcErr.message }, 500);

    const { data: updated } = await admin
      .from("certificates").select("*").eq("id", cert.id).maybeSingle();

    return json({ certificate: updated }, 200);
  } catch (err: any) {
    console.error("reissue-certificate error:", err);
    return json({ error: "Erro interno ao reemitir o certificado." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// PDF builder — MUST stay visually identical to generate-certificate/index.ts
// ──────────────────────────────────────────────────────────────────────────────
interface CertData {
  studentName: string;
  studentCpf: string | null;
  enrollmentNumber: string | null;
  cooperativa: string | null;
  courseTitle: string;
  courseDuration: string;
  startStr: string;
  endStr: string;
  dateStr: string;
  templateUrl: string | null;
  logoUrl: string | null;
  certCode: string;
  verifyUrl: string;
}

async function buildCertificatePdf(data: CertData): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import("https://esm.sh/pdf-lib@1.17.1");
  const QRCode = (await import("https://esm.sh/qrcode@1.5.4")).default;

  const pdfDoc = await PDFDocument.create();
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  if (data.templateUrl) {
    try {
      const response = await fetch(data.templateUrl);
      if (response.ok) {
        const imgBytes = new Uint8Array(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "";
        const image = contentType.includes("png")
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes);
        page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
      }
    } catch { /* fallback */ }
  }

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const green = rgb(BRAND.green.r, BRAND.green.g, BRAND.green.b);
  const blue = rgb(BRAND.blue.r, BRAND.blue.g, BRAND.blue.b);
  const yellow = rgb(BRAND.yellow.r, BRAND.yellow.g, BRAND.yellow.b);
  const ink = rgb(BRAND.ink.r, BRAND.ink.g, BRAND.ink.b);
  const muted = rgb(BRAND.muted.r, BRAND.muted.g, BRAND.muted.b);

  if (!data.templateUrl) {
    page.drawRectangle({ x: 18, y: 18, width: pageWidth - 36, height: pageHeight - 36, borderColor: green, borderWidth: 4 });
    page.drawRectangle({ x: 28, y: 28, width: pageWidth - 56, height: pageHeight - 56, borderColor: blue, borderWidth: 1 });
    page.drawRectangle({ x: 28, y: pageHeight - 78, width: pageWidth - 56, height: 50, color: rgb(1, 1, 1), borderColor: green, borderWidth: 1 });
    page.drawRectangle({ x: 28, y: pageHeight - 84, width: pageWidth - 56, height: 6, color: yellow });
    const cs = 28;
    page.drawRectangle({ x: 28, y: 28, width: cs, height: 6, color: yellow });
    page.drawRectangle({ x: 28, y: 28, width: 6, height: cs, color: yellow });
    page.drawRectangle({ x: pageWidth - 28 - cs, y: 28, width: cs, height: 6, color: yellow });
    page.drawRectangle({ x: pageWidth - 34, y: 28, width: 6, height: cs, color: yellow });

    const headerCenterY = pageHeight - 53;
    if (data.logoUrl) {
      try {
        const resp = await fetch(data.logoUrl);
        if (resp.ok) {
          const bytes = new Uint8Array(await resp.arrayBuffer());
          const ct = resp.headers.get("content-type") || "";
          const img = ct.includes("png")
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);
          const targetH = 40;
          const scale = targetH / img.height;
          const targetW = img.width * scale;
          page.drawImage(img, { x: 48, y: pageHeight - 78 + (50 - targetH) / 2, width: targetW, height: targetH });
        }
      } catch { /* ignore */ }
    } else {
      page.drawText("COOPAIBA", { x: 48, y: headerCenterY - 8, size: 22, font: fontBold, color: green });
    }
    const headerRight = "Cooperativa dos Agricultores Familiares e dos Empreendimentos Solidários";
    const hrw = fontRegular.widthOfTextAtSize(headerRight, 9);
    page.drawText(headerRight, { x: pageWidth - 48 - hrw, y: headerCenterY - 2, size: 9, font: fontRegular, color: green });
    const pec = "Programa de Educação Cooperativa — PEC";
    const pw = fontItalic.widthOfTextAtSize(pec, 8);
    page.drawText(pec, { x: pageWidth - 48 - pw, y: headerCenterY - 14, size: 8, font: fontItalic, color: blue });
  }

  const centerX = pageWidth / 2;
  const title = "CERTIFICADO";
  const tw = fontBold.widthOfTextAtSize(title, 36);
  page.drawText(title, { x: centerX - tw / 2, y: pageHeight - 135, size: 36, font: fontBold, color: green });
  const sub = "DE CONCLUSÃO";
  const sw = fontBold.widthOfTextAtSize(sub, 16);
  page.drawText(sub, { x: centerX - sw / 2, y: pageHeight - 158, size: 16, font: fontBold, color: blue });
  page.drawLine({ start: { x: centerX - 90, y: pageHeight - 172 }, end: { x: centerX + 90, y: pageHeight - 172 }, thickness: 2, color: yellow });

  const intro = "A COOPAIBA — Cooperativa dos Agricultores Familiares e dos Empreendimentos Solidários,";
  const intro2 = "por meio do Programa de Educação Cooperativa — PEC, certifica que";
  const iw = fontRegular.widthOfTextAtSize(intro, 11);
  const i2w = fontRegular.widthOfTextAtSize(intro2, 11);
  page.drawText(intro, { x: centerX - iw / 2, y: pageHeight - 200, size: 11, font: fontRegular, color: ink });
  page.drawText(intro2, { x: centerX - i2w / 2, y: pageHeight - 216, size: 11, font: fontRegular, color: ink });

  const nameSize = 28;
  const nw = fontBold.widthOfTextAtSize(data.studentName, nameSize);
  page.drawText(data.studentName, { x: centerX - nw / 2, y: pageHeight - 258, size: nameSize, font: fontBold, color: blue });
  page.drawLine({ start: { x: centerX - 230, y: pageHeight - 270 }, end: { x: centerX + 230, y: pageHeight - 270 }, thickness: 0.8, color: muted });

  const idParts: string[] = [];
  if (data.studentCpf) idParts.push(`CPF ${formatCpf(data.studentCpf)}`);
  if (data.enrollmentNumber) idParts.push(`Matrícula ${data.enrollmentNumber}`);
  if (data.cooperativa) idParts.push(data.cooperativa);
  if (idParts.length) {
    const id = idParts.join("  ·  ");
    const idw = fontRegular.widthOfTextAtSize(id, 9);
    page.drawText(id, { x: centerX - idw / 2, y: pageHeight - 284, size: 9, font: fontRegular, color: muted });
  }

  const line1 = "concluiu com aproveitamento o curso";
  const l1 = fontRegular.widthOfTextAtSize(line1, 12);
  page.drawText(line1, { x: centerX - l1 / 2, y: pageHeight - 312, size: 12, font: fontRegular, color: ink });
  const courseSize = 20;
  const courseLines = wrapText(data.courseTitle, fontBold, courseSize, pageWidth - 160);
  let cy = pageHeight - 340;
  for (const ln of courseLines) {
    const cw = fontBold.widthOfTextAtSize(ln, courseSize);
    page.drawText(ln, { x: centerX - cw / 2, y: cy, size: courseSize, font: fontBold, color: ink });
    cy -= courseSize + 4;
  }

  const period = data.startStr !== "—"
    ? `realizado no período de ${data.startStr} a ${data.endStr}, com carga horária de ${data.courseDuration}.`
    : `concluído em ${data.endStr}, com carga horária de ${data.courseDuration}.`;
  const periodLines = wrapText(period, fontRegular, 11, pageWidth - 220);
  cy -= 8;
  for (const ln of periodLines) {
    const pw2 = fontRegular.widthOfTextAtSize(ln, 11);
    page.drawText(ln, { x: centerX - pw2 / 2, y: cy, size: 11, font: fontRegular, color: ink });
    cy -= 14;
  }

  const legal =
    "Fundamentação legal: Lei nº 9.394/96 (LDB), art. 39, § 2º, Inciso I, art. 41, 42 e 43, " +
    "Incisos VII e VIII; Lei nº 11.741/08, art. 1º; Decreto nº 5.154/04 e Decreto nº 8.268/14.";
  const legalLines = wrapText(legal, fontItalic, 8, pageWidth - 200);
  let ly = 188;
  for (const ln of legalLines) {
    const lw = fontItalic.widthOfTextAtSize(ln, 8);
    page.drawText(ln, { x: centerX - lw / 2, y: ly, size: 8, font: fontItalic, color: muted });
    ly -= 10;
  }

  const cityDate = `Piaçabuçu - AL, ${data.dateStr}.`;
  const cdw = fontItalic.widthOfTextAtSize(cityDate, 11);
  page.drawText(cityDate, { x: centerX - cdw / 2, y: 150, size: 11, font: fontItalic, color: ink });

  const sigY = 105;
  const sigLineLen = 200;
  const lx = pageWidth * 0.27;
  page.drawLine({ start: { x: lx - sigLineLen / 2, y: sigY }, end: { x: lx + sigLineLen / 2, y: sigY }, thickness: 0.8, color: ink });
  const ln1 = "Antonino Cardozo";
  const lt1 = "Presidente — COOPAIBA";
  const ln1w = fontBold.widthOfTextAtSize(ln1, 11);
  const lt1w = fontRegular.widthOfTextAtSize(lt1, 9);
  page.drawText(ln1, { x: lx - ln1w / 2, y: sigY - 14, size: 11, font: fontBold, color: ink });
  page.drawText(lt1, { x: lx - lt1w / 2, y: sigY - 26, size: 9, font: fontRegular, color: muted });
  const rx = pageWidth * 0.73;
  page.drawLine({ start: { x: rx - sigLineLen / 2, y: sigY }, end: { x: rx + sigLineLen / 2, y: sigY }, thickness: 0.8, color: ink });
  const ln2 = "Carlos Henrique Silva Santos";
  const lt2 = "Coordenador do PEC — COOPAIBA";
  const ln2w = fontBold.widthOfTextAtSize(ln2, 11);
  const lt2w = fontRegular.widthOfTextAtSize(lt2, 9);
  page.drawText(ln2, { x: rx - ln2w / 2, y: sigY - 14, size: 11, font: fontBold, color: ink });
  page.drawText(lt2, { x: rx - lt2w / 2, y: sigY - 26, size: 9, font: fontRegular, color: muted });

  try {
    const qrDataUrl = await QRCode.toDataURL(data.verifyUrl, { margin: 1, width: 256, color: { dark: "#0057B8", light: "#FFFFFF" } });
    const qrBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const qrImage = await pdfDoc.embedPng(qrBytes);
    const qrSize = 68;
    const qrX = pageWidth - qrSize - 48;
    const qrY = 48;
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    const ql = "Valide em coopaiba.com.br";
    const qlw = fontRegular.widthOfTextAtSize(ql, 7);
    page.drawText(ql, { x: qrX + qrSize / 2 - qlw / 2, y: qrY - 9, size: 7, font: fontRegular, color: muted });
  } catch (e) { console.error("QR error:", e); }

  page.drawText("Código de validação", { x: 48, y: 70, size: 8, font: fontRegular, color: muted });
  page.drawText(data.certCode, { x: 48, y: 56, size: 12, font: fontBold, color: blue });

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}

function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function sanitizeName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
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
