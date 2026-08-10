import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// COOPAIBA brand colors
const BRAND = {
  green: { r: 0.0, g: 0.588, b: 0.251 },   // #009640
  blue:  { r: 0.0, g: 0.341, b: 0.722 },   // #0057B8
  yellow:{ r: 0.969, g: 0.776, b: 0.0 },   // #F7C600
  ink:   { r: 0.1, g: 0.1, b: 0.1 },
  muted: { r: 0.45, g: 0.45, b: 0.45 },
};

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
    let { user_id, course_id, reissue_of, retry } = body as { user_id?: string; course_id?: string; reissue_of?: string; retry?: boolean };
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
    // Prevent duplicates (unless explicit reissue/retry)
    if (!reissue_of) {
      const { data: existing } = await supabaseAdmin
        .from("certificates").select("id, status, created_at")
        .eq("user_id", user_id!).eq("course_id", course_id)
        .not("status", "in", "(cancelado)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        if (!retry) {
          return new Response(JSON.stringify({ error: "Já existe um certificado vigente para este curso." }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Retry flow: only allow when previous request is pendente or erro
        if (!["pendente", "erro"].includes(existing.status)) {
          return new Response(JSON.stringify({ error: "Este certificado já foi emitido. Use a opção de reemissão." }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Enforce 48h cooldown server-side
        const created = new Date(existing.created_at).getTime();
        const hours = (Date.now() - created) / 3_600_000;
        if (hours < 48) {
          const remaining = Math.ceil(48 - hours);
          return new Response(JSON.stringify({
            error: `Aguarde ${remaining}h para reenviar a solicitação (limite de 48h entre tentativas).`,
            cooldown_hours_remaining: remaining,
          }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Cancel the stuck/errored request so a fresh one can be generated
        await supabaseAdmin
          .from("certificates")
          .update({ status: "cancelado", error_message: "Cancelado automaticamente para reenvio de solicitação." })
          .eq("id", existing.id);
      }
    }

    // Snapshots
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("full_name, cpf, enrollment_number, cooperativa").eq("user_id", user_id!).single();
    const { data: issuerProfile } = await supabaseAdmin
      .from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    const issuerName = issuerProfile?.full_name || user.email || "Sistema";
    const { data: course } = await supabaseAdmin
      .from("courses").select("title, duration").eq("id", course_id).single();
    const { data: enrollment } = await supabaseAdmin
      .from("enrollments").select("created_at").eq("user_id", user_id!).eq("course_id", course_id).maybeSingle();
    const { data: template } = await supabaseAdmin
      .from("certificate_templates").select("file_url").eq("active", true).limit(1).maybeSingle();

    if (!profile || !course) {
      return new Response(JSON.stringify({ error: "Aluno ou curso não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentName = sanitizeName(profile.full_name || "Aluno");
    const studentCpf = profile.cpf || null;
    const courseTitle = course.title;
    const courseDuration = course.duration || "—";
    const courseStartedAt = enrollment?.created_at || null;
    const nowIso = new Date().toISOString();
    const startStr = courseStartedAt
      ? new Date(courseStartedAt).toLocaleDateString("pt-BR")
      : "—";
    const endStr = new Date().toLocaleDateString("pt-BR");
    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const certCode = `CERT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const verifyUrl = `https://coopaiba.com.br/validar-certificado/${certCode}`;

    let templateSignedUrl: string | null = null;
    if (template?.file_url) {
      const { data: signed } = await supabaseAdmin.storage.from("media").createSignedUrl(template.file_url, 60);
      templateSignedUrl = signed?.signedUrl || null;
    }

    // Try to load official logo from branding folder (uploaded by admin)
    let logoSignedUrl: string | null = null;
    try {
      const { data: signedLogo } = await supabaseAdmin.storage
        .from("media").createSignedUrl("branding/logo-coopaiba.png", 60);
      if (signedLogo?.signedUrl) {
        const head = await fetch(signedLogo.signedUrl, { method: "HEAD" });
        if (head.ok) logoSignedUrl = signedLogo.signedUrl;
      }
    } catch { /* no logo yet */ }

    // President (Antonino) signature image
    let presidentSigUrl: string | null = null;
    try {
      const { data: signedSig } = await supabaseAdmin.storage
        .from("media").createSignedUrl("branding/assinatura-antonino.png", 60);
      if (signedSig?.signedUrl) {
        const head = await fetch(signedSig.signedUrl, { method: "HEAD" });
        if (head.ok) presidentSigUrl = signedSig.signedUrl;
      }
    } catch { /* no signature */ }

    // Coordenador (Carlos Henrique) signature image
    let coordSigUrl: string | null = null;
    try {
      const { data: signedSig2 } = await supabaseAdmin.storage
        .from("media").createSignedUrl("branding/assinatura-carlos.png", 60);
      if (signedSig2?.signedUrl) {
        const head = await fetch(signedSig2.signedUrl, { method: "HEAD" });
        if (head.ok) coordSigUrl = signedSig2.signedUrl;
      }
    } catch { /* no signature */ }

    const syllabus = await fetchSyllabus(supabaseAdmin, course_id);

    const pdfBytes = await buildCertificatePdf({
      studentName, studentCpf,
      enrollmentNumber: profile.enrollment_number || null,
      cooperativa: profile.cooperativa || null,
      courseTitle, courseDuration,
      startStr, endStr, dateStr,
      templateUrl: templateSignedUrl,
      logoUrl: logoSignedUrl,
      presidentSigUrl,
      coordSigUrl,
      certCode, verifyUrl, syllabus,
    });


    const filePath = `certificates/${certCode}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("media").upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    // Determine delivery mode and final status based on the certificate owner's profile.
    //   Aluno (sem cooperado e sem campanha eventual) → download → status 'emitido'
    //   Cooperado / Cooperado Eventual → retirada presencial → status 'disponivel_retirada'
    const { data: ownerRoles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user_id!);
    const ownerRoleList = (ownerRoles || []).map((r: any) => r.role);
    const isCooperado = ownerRoleList.includes("cooperado");

    let isEventual = false;
    if (!isCooperado) {
      const { data: eventualOk } = await supabaseAdmin
        .rpc("tem_acesso_curso_eventual", { _user_id: user_id!, _course_id: course_id });
      isEventual = !!eventualOk;
    }

    const requiresPickup = isCooperado || isEventual;
    const deliveryMode = requiresPickup ? "retirada" : "download";
    const finalStatus = requiresPickup ? "disponivel_retirada" : "emitido";

    const { data: cert, error: certError } = await supabaseAdmin
      .from("certificates")
      .insert({
        user_id: user_id!,
        course_id,
        code: certCode,
        status: finalStatus,
        delivery_mode: deliveryMode,
        issued_at: nowIso,
        available_at: nowIso,
        completed_at: nowIso,
        pdf_path: filePath,
        student_name_snapshot: studentName,
        student_cpf_snapshot: studentCpf,
        course_title_snapshot: courseTitle,
        course_duration_snapshot: courseDuration,
        course_started_at_snapshot: courseStartedAt,
        enrollment_number_snapshot: profile.enrollment_number || null,
        cooperativa_snapshot: profile.cooperativa || null,
        reissued_from: reissue_of || null,
        issued_by: user.id,
        issued_by_name: issuerName,
      })
      .select()
      .single();
    if (certError) throw certError;

    // Audit log
    await supabaseAdmin.from("certificate_audit_log").insert({
      certificate_id: cert.id,
      action: reissue_of ? "reemitido" : "emitido",
      actor_user_id: user.id,
      details: { code: certCode, reissued_from: reissue_of || null, delivery_mode: deliveryMode },
    });

    // In-platform notification — wording depends on delivery mode
    await supabaseAdmin.from("notifications").insert({
      user_id: user_id!,
      type: requiresPickup ? "certificate_available" : "certificate_download",
      title: requiresPickup
        ? "Certificado disponível para retirada"
        : "Certificado disponível para download",
      message: requiresPickup
        ? `Seu certificado do curso ${courseTitle} está disponível para retirada presencial na Cooperativa Coopaíba.`
        : `Seu certificado do curso ${courseTitle} já está disponível para download em "Meus Certificados".`,
      link: requiresPickup ? `/certificates/${certCode}/retirada` : `/certificates`,
    });

    // WhatsApp informational notification (best-effort, never blocks issuance)
    try {
      const waMessage = requiresPickup
        ? (`Olá, ${studentName}! 🎓\n\n` +
           `Seu certificado do curso *${courseTitle}* já está pronto e disponível para retirada presencial na sede da Cooperativa Coopaíba.\n\n` +
           `Código de validação: ${certCode}\n\n` +
           `Compareça em nosso horário de atendimento com um documento oficial com foto. ` +
           `Por motivos de segurança e validação de identidade, *o certificado não é enviado por download nem por e-mail*.\n\n` +
           `Mais informações: https://coopaiba.com.br/certificates/${certCode}/retirada`)
        : (`Olá, ${studentName}! 🎓\n\n` +
           `Seu certificado do curso *${courseTitle}* já está disponível para download em sua área de aluno.\n\n` +
           `Código de validação: ${certCode}\n\n` +
           `Acesse: https://coopaiba.com.br/certificates`);

      const waResp = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "x-internal-call": "1",
        },
        body: JSON.stringify({
          user_id: user_id!,
          message: waMessage,
        }),
      });
      const waData = await waResp.json().catch(() => ({}));
      console.log("WhatsApp notification result:", waResp.status, waData);
    } catch (waErr) {
      console.error("WhatsApp notification failed (non-blocking):", waErr);
    }

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
  presidentSigUrl?: string | null;
  coordSigUrl?: string | null;

  certCode: string;
  verifyUrl: string;
  syllabus?: SyllabusModule[];
}

async function buildCertificatePdf(data: CertData): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import("https://esm.sh/pdf-lib@1.17.1");
  const QRCode = (await import("https://esm.sh/qrcode@1.5.4")).default;

  const pdfDoc = await PDFDocument.create();
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  // Background template image (overrides our layout) if provided
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
    } catch { /* fallback to default layout */ }
  }

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const green = rgb(BRAND.green.r, BRAND.green.g, BRAND.green.b);
  const blue = rgb(BRAND.blue.r, BRAND.blue.g, BRAND.blue.b);
  const yellow = rgb(BRAND.yellow.r, BRAND.yellow.g, BRAND.yellow.b);
  const ink = rgb(BRAND.ink.r, BRAND.ink.g, BRAND.ink.b);
  const muted = rgb(BRAND.muted.r, BRAND.muted.g, BRAND.muted.b);

  // Only draw our COOPAIBA layout when there's NO custom template
  if (!data.templateUrl) {
    // Outer green border + inner blue + yellow accent corners
    page.drawRectangle({ x: 18, y: 18, width: pageWidth - 36, height: pageHeight - 36, borderColor: green, borderWidth: 4 });
    page.drawRectangle({ x: 28, y: 28, width: pageWidth - 56, height: pageHeight - 56, borderColor: blue, borderWidth: 1 });

    // Top bar (white with subtle border) to highlight the logo
    page.drawRectangle({ x: 28, y: pageHeight - 78, width: pageWidth - 56, height: 50, color: rgb(1, 1, 1), borderColor: green, borderWidth: 1 });
    // Yellow accent stripe under top bar
    page.drawRectangle({ x: 28, y: pageHeight - 84, width: pageWidth - 56, height: 6, color: yellow });

    // Corner accents
    const cs = 28;
    page.drawRectangle({ x: 28, y: 28, width: cs, height: 6, color: yellow });
    page.drawRectangle({ x: 28, y: 28, width: 6, height: cs, color: yellow });
    page.drawRectangle({ x: pageWidth - 28 - cs, y: 28, width: cs, height: 6, color: yellow });
    page.drawRectangle({ x: pageWidth - 34, y: 28, width: 6, height: cs, color: yellow });

    // Logo (top-left area) or text fallback inside top bar
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
      page.drawText("COOPAIBA", {
        x: 48, y: headerCenterY - 8, size: 22, font: fontBold, color: green,
      });
    }

    const headerRight = "Cooperativa dos Agricultores Familiares e dos Empreendimentos Solidários";
    const hrw = fontRegular.widthOfTextAtSize(headerRight, 9);
    page.drawText(headerRight, {
      x: pageWidth - 48 - hrw, y: headerCenterY - 2, size: 9, font: fontRegular, color: green,
    });
    const pec = "Programa de Educação Cooperativa — PEC";
    const pw = fontItalic.widthOfTextAtSize(pec, 8);
    page.drawText(pec, {
      x: pageWidth - 48 - pw, y: headerCenterY - 14, size: 8, font: fontItalic, color: blue,
    });

  }

  const centerX = pageWidth / 2;

  // Title
  const title = "CERTIFICADO";
  const tw = fontBold.widthOfTextAtSize(title, 36);
  page.drawText(title, { x: centerX - tw / 2, y: pageHeight - 135, size: 36, font: fontBold, color: green });

  const sub = "DE CONCLUSÃO";
  const sw = fontBold.widthOfTextAtSize(sub, 16);
  page.drawText(sub, { x: centerX - sw / 2, y: pageHeight - 158, size: 16, font: fontBold, color: blue });

  page.drawLine({
    start: { x: centerX - 90, y: pageHeight - 172 },
    end: { x: centerX + 90, y: pageHeight - 172 },
    thickness: 2, color: yellow,
  });

  // Institutional text (PEC)
  const intro = "A COOPAIBA — Cooperativa dos Agricultores Familiares e dos Empreendimentos Solidários,";
  const intro2 = "por meio do Programa de Educação Cooperativa — PEC, certifica que";
  const iw = fontRegular.widthOfTextAtSize(intro, 11);
  const i2w = fontRegular.widthOfTextAtSize(intro2, 11);
  page.drawText(intro, { x: centerX - iw / 2, y: pageHeight - 200, size: 11, font: fontRegular, color: ink });
  page.drawText(intro2, { x: centerX - i2w / 2, y: pageHeight - 216, size: 11, font: fontRegular, color: ink });

  // Student name
  const nameSize = 28;
  const nw = fontBold.widthOfTextAtSize(data.studentName, nameSize);
  page.drawText(data.studentName, { x: centerX - nw / 2, y: pageHeight - 258, size: nameSize, font: fontBold, color: blue });
  page.drawLine({
    start: { x: centerX - 230, y: pageHeight - 270 },
    end: { x: centerX + 230, y: pageHeight - 270 },
    thickness: 0.8, color: muted,
  });

  // CPF + matrícula line (subtle)
  const idParts: string[] = [];
  if (data.studentCpf) idParts.push(`CPF ${formatCpf(data.studentCpf)}`);
  if (data.enrollmentNumber) idParts.push(`Matrícula ${data.enrollmentNumber}`);
  if (data.cooperativa) idParts.push(data.cooperativa);
  if (idParts.length) {
    const id = idParts.join("  ·  ");
    const idw = fontRegular.widthOfTextAtSize(id, 9);
    page.drawText(id, { x: centerX - idw / 2, y: pageHeight - 284, size: 9, font: fontRegular, color: muted });
  }

  // Body
  const line1 = "concluiu com aproveitamento o curso";
  const l1 = fontRegular.widthOfTextAtSize(line1, 12);
  page.drawText(line1, { x: centerX - l1 / 2, y: pageHeight - 312, size: 12, font: fontRegular, color: ink });

  // Wrap course title if too long
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

  // Legal basis (MEC)
  const legal =
    "Certificado emitido com base na lei: Lei nº 9.394/96 (LDB), art. 39, § 2º, Inciso I, art. 41, 42 e 43, " +
    "Incisos VII e VIII; Lei nº 11.741/08, art. 1º; Decreto nº 5.154/04 e Decreto nº 8.268/14.";
  const legalLines = wrapText(legal, fontItalic, 8, pageWidth - 200);
  let ly = 188;
  for (const ln of legalLines) {
    const lw = fontItalic.widthOfTextAtSize(ln, 8);
    page.drawText(ln, { x: centerX - lw / 2, y: ly, size: 8, font: fontItalic, color: muted });
    ly -= 10;
  }

  // City/date line
  const cityDate = `Piaçabuçu - AL, ${data.dateStr}.`;
  const cdw = fontItalic.widthOfTextAtSize(cityDate, 11);
  page.drawText(cityDate, { x: centerX - cdw / 2, y: 150, size: 11, font: fontItalic, color: ink });

  // Signature lines — Antonino (left) and Carlos Henrique (right)
  const sigY = 105;
  const sigLineLen = 200;

  // Left
  const lx = pageWidth * 0.27;
  page.drawLine({ start: { x: lx - sigLineLen / 2, y: sigY }, end: { x: lx + sigLineLen / 2, y: sigY }, thickness: 0.8, color: ink });
  const ln1 = "Antonino Cardozo";
  const lt1 = "Presidente — COOPAIBA";
  const ln1w = fontBold.widthOfTextAtSize(ln1, 11);
  const lt1w = fontRegular.widthOfTextAtSize(lt1, 9);
  page.drawText(ln1, { x: lx - ln1w / 2, y: sigY - 14, size: 11, font: fontBold, color: ink });
  // President signature image, above the line
  if (data.presidentSigUrl) {
    try {
      const resp = await fetch(data.presidentSigUrl);
      if (resp.ok) {
        const bytes = new Uint8Array(await resp.arrayBuffer());
        const ct = resp.headers.get("content-type") || "";
        const sig = ct.includes("png")
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
        const targetH = 50;
        const scale = targetH / sig.height;
        const targetW = sig.width * scale;
        page.drawImage(sig, { x: lx - targetW / 2, y: sigY + 2, width: targetW, height: targetH });
      }
    } catch { /* ignore */ }
  }


  // Right
  const rx = pageWidth * 0.73;
  page.drawLine({ start: { x: rx - sigLineLen / 2, y: sigY }, end: { x: rx + sigLineLen / 2, y: sigY }, thickness: 0.8, color: ink });
  const ln2 = "Carlos Henrique Silva Santos";
  const lt2 = "Coordenador do PEC — COOPAIBA";
  const ln2w = fontBold.widthOfTextAtSize(ln2, 11);
  const lt2w = fontRegular.widthOfTextAtSize(lt2, 9);
  page.drawText(ln2, { x: rx - ln2w / 2, y: sigY - 14, size: 11, font: fontBold, color: ink });
  page.drawText(lt2, { x: rx - lt2w / 2, y: sigY - 26, size: 9, font: fontRegular, color: muted });
  // Coordenador signature image, above the line
  if (data.coordSigUrl) {
    try {
      const resp = await fetch(data.coordSigUrl);
      if (resp.ok) {
        const bytes = new Uint8Array(await resp.arrayBuffer());
        const ct = resp.headers.get("content-type") || "";
        const sig = ct.includes("png")
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
        const targetH = 50;
        const scale = targetH / sig.height;
        const targetW = sig.width * scale;
        page.drawImage(sig, { x: rx - targetW / 2, y: sigY + 2, width: targetW, height: targetH });
      }
    } catch { /* ignore */ }
  }

  // QR Code + validation code (bottom-right outside signature area)
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

  // Validation code (bottom-left)
  page.drawText("Código de validação", { x: 48, y: 70, size: 8, font: fontRegular, color: muted });
  page.drawText(data.certCode, { x: 48, y: 56, size: 12, font: fontBold, color: blue });

  // Verso: conteúdo programático + carga horária
  await drawSyllabusPages(pdfDoc, rgb, { fontBold, fontRegular, fontItalic }, data);

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}

function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function sanitizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // strip diacritics
    .replace(/[^A-Za-z0-9\s]/g, " ")  // strip special chars
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const trial = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ──────────────────────────────────────────────────────────────────────────────
// Conteúdo programático (verso do certificado)
// ──────────────────────────────────────────────────────────────────────────────
interface SyllabusLesson { title: string; duration: string | null }
interface SyllabusModule { title: string; lessons: SyllabusLesson[]; minutes: number }

function parseDurationToMinutes(d: string | null): number {
  if (!d) return 0;
  const s = String(d).toLowerCase().replace(",", ".");
  let total = 0;
  const h = s.match(/([\d.]+)\s*(h|hora)/);
  const m = s.match(/([\d.]+)\s*(min|m\b)/);
  if (h) total += parseFloat(h[1]) * 60;
  if (m) total += parseFloat(m[1]);
  if (!h && !m) {
    const clock = s.match(/^(\d{1,2}):(\d{2})$/);
    if (clock) total += parseInt(clock[1]) * 60 + parseInt(clock[2]);
    else {
      const n = s.match(/([\d.]+)/);
      if (n) total += parseFloat(n[1]);
    }
  }
  return Math.round(total);
}

function formatMinutes(min: number): string {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

async function fetchSyllabus(admin: any, courseId: string): Promise<SyllabusModule[]> {
  try {
    const { data: mods } = await admin
      .from("course_modules").select("id, title, sort_order")
      .eq("course_id", courseId).order("sort_order", { ascending: true });
    if (!mods || mods.length === 0) return [];
    const { data: lessons } = await admin
      .from("course_lessons").select("module_id, title, duration, sort_order")
      .in("module_id", mods.map((m: any) => m.id))
      .order("sort_order", { ascending: true });
    return mods.map((m: any) => {
      const ls = (lessons || []).filter((l: any) => l.module_id === m.id);
      return {
        title: m.title,
        lessons: ls.map((l: any) => ({ title: l.title, duration: l.duration || null })),
        minutes: ls.reduce((s: number, l: any) => s + parseDurationToMinutes(l.duration), 0),
      };
    });
  } catch {
    return [];
  }
}

async function drawSyllabusPages(pdfDoc: any, rgb: any, fonts: any, data: CertData) {
  const modules = data.syllabus || [];
  if (modules.length === 0) return;

  const W = 841.89, H = 595.28;
  const { fontBold, fontRegular, fontItalic } = fonts;
  const green = rgb(BRAND.green.r, BRAND.green.g, BRAND.green.b);
  const blue = rgb(BRAND.blue.r, BRAND.blue.g, BRAND.blue.b);
  const yellow = rgb(BRAND.yellow.r, BRAND.yellow.g, BRAND.yellow.b);
  const ink = rgb(BRAND.ink.r, BRAND.ink.g, BRAND.ink.b);
  const muted = rgb(BRAND.muted.r, BRAND.muted.g, BRAND.muted.b);

  const totalMinutes = modules.reduce((s, m) => s + m.minutes, 0);
  const colW = (W - 96 - 30) / 2;
  const colX = [48, 48 + colW + 30];

  let page: any = null;
  let col = 0;
  let y = 0;

  const newPage = () => {
    page = pdfDoc.addPage([W, H]);
    page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, borderColor: green, borderWidth: 3 });
    page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: blue, borderWidth: 0.8 });
    page.drawText("CONTEÚDO PROGRAMÁTICO", { x: 48, y: H - 62, size: 16, font: fontBold, color: green });
    page.drawRectangle({ x: 48, y: H - 72, width: 120, height: 4, color: yellow });
    const t = data.courseTitle;
    const tw = fontBold.widthOfTextAtSize(t, 11);
    page.drawText(t.length > 70 ? t.slice(0, 70) + "…" : t, { x: 48, y: H - 92, size: 11, font: fontBold, color: ink });
    const ch = `Carga horária total: ${data.courseDuration}${totalMinutes ? `  ·  Conteúdo mapeado: ${formatMinutes(totalMinutes)}` : ""}`;
    page.drawText(ch, { x: 48, y: H - 108, size: 9.5, font: fontRegular, color: blue });
    const right = `Certificado ${data.certCode}`;
    const rw = fontRegular.widthOfTextAtSize(right, 9);
    page.drawText(right, { x: W - 48 - rw, y: H - 62, size: 9, font: fontRegular, color: muted });
    const foot = `${data.studentName} · COOPAIBA — Programa de Educação Cooperativa (PEC) · Valide em coopaiba.com.br`;
    const fw = fontItalic.widthOfTextAtSize(foot, 7.5);
    page.drawText(foot, { x: W / 2 - fw / 2, y: 38, size: 7.5, font: fontItalic, color: muted });
    col = 0;
    y = H - 135;
    void tw;
  };

  const ensure = (needed: number) => {
    if (!page) { newPage(); return; }
    if (y - needed < 58) {
      if (col === 0) { col = 1; y = H - 135; }
      else newPage();
    }
  };

  newPage();

  modules.forEach((m, i) => {
    ensure(34);
    const x = colX[col];
    const head = `${i + 1}. ${m.title}`;
    const headLines = wrapText(head, fontBold, 10.5, colW - 60);
    for (const ln of headLines) {
      ensure(16);
      page.drawText(ln, { x: colX[col], y, size: 10.5, font: fontBold, color: blue });
      y -= 14;
    }
    if (m.minutes > 0) {
      const lbl = formatMinutes(m.minutes);
      const lw = fontRegular.widthOfTextAtSize(lbl, 8.5);
      page.drawText(lbl, { x: colX[col] + colW - lw, y: y + 14, size: 8.5, font: fontRegular, color: green });
    }
    for (const l of m.lessons) {
      const lines = wrapText(`•  ${l.title}`, fontRegular, 9, colW - 55);
      for (const ln of lines) {
        ensure(13);
        page.drawText(ln, { x: colX[col] + 8, y, size: 9, font: fontRegular, color: ink });
        y -= 12;
      }
      if (l.duration) {
        const dl = String(l.duration);
        const dw = fontRegular.widthOfTextAtSize(dl, 8);
        page.drawText(dl, { x: colX[col] + colW - dw, y: y + 12, size: 8, font: fontRegular, color: muted });
      }
    }
    y -= 8;
    void x;
  });
}
