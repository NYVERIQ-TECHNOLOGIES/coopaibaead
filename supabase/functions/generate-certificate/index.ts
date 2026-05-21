import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleData;

    const body = await req.json();
    let { user_id, course_id, reissue_of } = body as { user_id?: string; course_id?: string; reissue_of?: string };
    if (!course_id) {
      return new Response(JSON.stringify({ error: "course_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin) {
      user_id = user.id;

      const { data: mods } = await supabaseAdmin
        .from("course_modules").select("id").eq("course_id", course_id);
      const moduleIds = (mods || []).map((m: any) => m.id);
      let totalLessons = 0;
      let lessonIds: string[] = [];
      if (moduleIds.length > 0) {
        const { data: lessons } = await supabaseAdmin
          .from("course_lessons").select("id").in("module_id", moduleIds);
        lessonIds = (lessons || []).map((l: any) => l.id);
        totalLessons = lessonIds.length;
      }
      let completedLessons = 0;
      if (lessonIds.length > 0) {
        const { count } = await supabaseAdmin
          .from("lesson_completions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("lesson_id", lessonIds);
        completedLessons = count ?? 0;
      }
      const fullyCompleted = totalLessons > 0 && completedLessons >= totalLessons;

      let avgScoreOk = false;
      const { data: pubEvals } = await supabaseAdmin
        .from("course_evaluations").select("id")
        .eq("course_id", course_id).eq("status", "publicada");
      const pubEvalIds = (pubEvals || []).map((e: any) => e.id);
      if (pubEvalIds.length > 0) {
        const { data: attempts } = await supabaseAdmin
          .from("exam_attempts").select("evaluation_id, score")
          .eq("user_id", user.id).in("evaluation_id", pubEvalIds);
        const best = new Map<string, number>();
        for (const a of (attempts || []) as any[]) {
          const prev = best.get(a.evaluation_id) ?? 0;
          if (Number(a.score) > prev) best.set(a.evaluation_id, Number(a.score));
        }
        if (best.size === pubEvalIds.length) {
          const avg = Array.from(best.values()).reduce((s, v) => s + v, 0) / best.size;
          avgScoreOk = avg >= 70;
        }
      }

      if (!fullyCompleted && !avgScoreOk) {
        return new Response(JSON.stringify({ error: "Conclua 100% do curso ou atinja média mínima de 70% nas avaliações para gerar o certificado." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent duplicates (unless explicit reissue)
    if (!reissue_of) {
      const { data: existing } = await supabaseAdmin
        .from("certificates").select("id, status")
        .eq("user_id", user_id!).eq("course_id", course_id)
        .not("status", "in", "(cancelado)")
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Já existe um certificado vigente para este curso." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Snapshots
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("full_name, cpf").eq("user_id", user_id!).single();
    const { data: course } = await supabaseAdmin
      .from("courses").select("title, duration").eq("id", course_id).single();
    const { data: template } = await supabaseAdmin
      .from("certificate_templates").select("file_url").eq("active", true).limit(1).maybeSingle();

    if (!profile || !course) {
      return new Response(JSON.stringify({ error: "Aluno ou curso não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentName = profile.full_name || "Aluno";
    const studentCpf = profile.cpf || null;
    const courseTitle = course.title;
    const courseDuration = course.duration || "—";
    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const certCode = `CERT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const verifyUrl = `https://coopaiba.com.br/validar-certificado/${certCode}`;

    let templateSignedUrl: string | null = null;
    if (template?.file_url) {
      const { data: signed } = await supabaseAdmin.storage.from("media").createSignedUrl(template.file_url, 60);
      templateSignedUrl = signed?.signedUrl || null;
    }

    const pdfBytes = await buildCertificatePdf({
      studentName, courseTitle, courseDuration, dateStr,
      templateUrl: templateSignedUrl, certCode, verifyUrl,
    });

    const filePath = `certificates/${certCode}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("media").upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    const now = new Date().toISOString();
    const { data: cert, error: certError } = await supabaseAdmin
      .from("certificates")
      .insert({
        user_id: user_id!,
        course_id,
        code: certCode,
        status: "disponivel_retirada",
        issued_at: now,
        available_at: now,
        completed_at: now,
        pdf_path: filePath,
        student_name_snapshot: studentName,
        student_cpf_snapshot: studentCpf,
        course_title_snapshot: courseTitle,
        course_duration_snapshot: courseDuration,
        reissued_from: reissue_of || null,
      })
      .select()
      .single();
    if (certError) throw certError;

    // Audit log
    await supabaseAdmin.from("certificate_audit_log").insert({
      certificate_id: cert.id,
      action: reissue_of ? "reemitido" : "emitido",
      actor_user_id: user.id,
      details: { code: certCode, reissued_from: reissue_of || null },
    });

    // Notify the student
    await supabaseAdmin.from("notifications").insert({
      user_id: user_id!,
      type: "certificate_available",
      title: "Certificado disponível para retirada",
      message: `Seu certificado do curso ${courseTitle} está disponível para retirada presencial na Cooperativa Coopaíba.`,
      link: `/certificates/${certCode}/retirada`,
    });

    // Only admins receive the pdf_url back (for printing). Students never get a download URL.
    let pdf_url: string | null = null;
    if (isAdmin) {
      const { data: signed } = await supabaseAdmin.storage.from("media").createSignedUrl(filePath, 300);
      pdf_url = signed?.signedUrl || null;
    }

    return new Response(JSON.stringify({ certificate: cert, pdf_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-certificate error:", err);
    return new Response(JSON.stringify({ error: "Ocorreu um erro interno ao gerar o certificado." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface CertData {
  studentName: string; courseTitle: string; courseDuration: string;
  dateStr: string; templateUrl: string | null; certCode: string; verifyUrl: string;
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

  if (!data.templateUrl) {
    const borderColor = rgb(0.14, 0.42, 0.28);
    page.drawRectangle({ x: 20, y: 20, width: pageWidth - 40, height: pageHeight - 40, borderColor, borderWidth: 3 });
    page.drawRectangle({ x: 30, y: 30, width: pageWidth - 60, height: pageHeight - 60, borderColor, borderWidth: 1 });
  }

  const centerX = pageWidth / 2;
  const textColor = rgb(0.1, 0.1, 0.1);
  const accentColor = rgb(0.14, 0.42, 0.28);

  const title = "CERTIFICADO DE CONCLUSÃO";
  const tw = fontBold.widthOfTextAtSize(title, 28);
  page.drawText(title, { x: centerX - tw / 2, y: pageHeight - 120, size: 28, font: fontBold, color: accentColor });
  page.drawLine({ start: { x: centerX - 150, y: pageHeight - 135 }, end: { x: centerX + 150, y: pageHeight - 135 }, thickness: 2, color: accentColor });

  const certText = "Certificamos que";
  const cw = fontItalic.widthOfTextAtSize(certText, 14);
  page.drawText(certText, { x: centerX - cw / 2, y: pageHeight - 180, size: 14, font: fontItalic, color: textColor });

  const nw = fontBold.widthOfTextAtSize(data.studentName, 32);
  page.drawText(data.studentName, { x: centerX - nw / 2, y: pageHeight - 230, size: 32, font: fontBold, color: accentColor });
  page.drawLine({ start: { x: centerX - 200, y: pageHeight - 245 }, end: { x: centerX + 200, y: pageHeight - 245 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });

  const line1 = "concluiu com êxito o curso";
  const l1 = fontRegular.widthOfTextAtSize(line1, 14);
  page.drawText(line1, { x: centerX - l1 / 2, y: pageHeight - 280, size: 14, font: fontRegular, color: textColor });

  const ct = fontBold.widthOfTextAtSize(data.courseTitle, 22);
  page.drawText(data.courseTitle, { x: centerX - ct / 2, y: pageHeight - 315, size: 22, font: fontBold, color: textColor });

  if (data.courseDuration !== "—") {
    const dur = `Carga horária: ${data.courseDuration}`;
    const dw = fontRegular.widthOfTextAtSize(dur, 12);
    page.drawText(dur, { x: centerX - dw / 2, y: pageHeight - 345, size: 12, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  }

  const dateText = `Emitido em ${data.dateStr}`;
  const dw = fontRegular.widthOfTextAtSize(dateText, 12);
  page.drawText(dateText, { x: centerX - dw / 2, y: 80, size: 12, font: fontRegular, color: textColor });

  const org = "Coopaiba EAD — Educação Cooperativista";
  const ow = fontItalic.widthOfTextAtSize(org, 10);
  page.drawText(org, { x: centerX - ow / 2, y: 55, size: 10, font: fontItalic, color: rgb(0.5, 0.5, 0.5) });

  try {
    const qrDataUrl = await QRCode.toDataURL(data.verifyUrl, { margin: 1, width: 256 });
    const qrBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const qrImage = await pdfDoc.embedPng(qrBytes);
    const qrSize = 80;
    const qrX = pageWidth - qrSize - 40;
    const qrY = 50;
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    const ql = "Verifique a autenticidade";
    const qlw = fontRegular.widthOfTextAtSize(ql, 8);
    page.drawText(ql, { x: qrX + qrSize / 2 - qlw / 2, y: qrY - 12, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  } catch (e) { console.error("QR error:", e); }

  page.drawText("Código de validação:", { x: 50, y: 70, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(data.certCode, { x: 50, y: 55, size: 11, font: fontBold, color: textColor });

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}
