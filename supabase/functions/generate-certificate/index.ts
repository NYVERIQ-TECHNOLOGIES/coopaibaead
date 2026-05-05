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
    // Validate auth
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

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleData;

    const body = await req.json();
    let { user_id, course_id } = body;
    if (!course_id) {
      return new Response(JSON.stringify({ error: "course_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Non-admins may only request their own certificate, and only at 100% progress
    if (!isAdmin) {
      user_id = user.id;

      // Count total lessons in course
      const { data: mods } = await supabaseAdmin
        .from("course_modules")
        .select("id")
        .eq("course_id", course_id);
      const moduleIds = (mods || []).map((m: any) => m.id);
      let totalLessons = 0;
      if (moduleIds.length > 0) {
        const { count } = await supabaseAdmin
          .from("course_lessons")
          .select("id", { count: "exact", head: true })
          .in("module_id", moduleIds);
        totalLessons = count ?? 0;
      }

      const { data: lessons } = moduleIds.length > 0 ? await supabaseAdmin
        .from("course_lessons")
        .select("id")
        .in("module_id", moduleIds) : { data: [] as any[] };
      const lessonIds = (lessons || []).map((l: any) => l.id);

      let completedLessons = 0;
      if (lessonIds.length > 0) {
        const { count } = await supabaseAdmin
          .from("lesson_completions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("lesson_id", lessonIds);
        completedLessons = count ?? 0;
      }

      if (totalLessons === 0 || completedLessons < totalLessons) {
        return new Response(JSON.stringify({ error: "Conclua 100% do curso antes de gerar o certificado." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent duplicates
      const { data: existing } = await supabaseAdmin
        .from("certificates")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", course_id)
        .eq("status", "emitido")
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Certificado já emitido para este curso." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get student profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user_id)
      .single();

    // Get course
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("title, duration")
      .eq("id", course_id)
      .single();

    // Get active template
    const { data: template } = await supabaseAdmin
      .from("certificate_templates")
      .select("file_url")
      .eq("active", true)
      .limit(1)
      .single();

    if (!profile || !course) {
      return new Response(JSON.stringify({ error: "Student or course not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentName = profile.full_name || "Aluno";
    const courseTitle = course.title;
    const courseDuration = course.duration || "—";
    const dateStr = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Generate PDF with the certificate
    // We'll create a PDF that overlays text on the template image
    const templateUrl = template?.file_url || null;

    // Reserve cert code BEFORE building the PDF so we can embed the QR
    const certCode = `CERT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const verifyUrl = `https://coopaiba.com.br/validar-certificado/${certCode}`;

    // Build a simple but elegant PDF certificate
    // Using raw PDF generation for Deno compatibility
    const pdfBytes = await buildCertificatePdf({
      studentName,
      courseTitle,
      courseDuration,
      dateStr,
      templateUrl,
      certCode,
      verifyUrl,
    });

    // Upload to storage
    const filePath = `certificates/${certCode}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("media")
      .upload(filePath, pdfBytes, { contentType: "application/pdf" });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage.from("media").getPublicUrl(filePath);

    // Create certificate record
    const { data: cert, error: certError } = await supabaseAdmin
      .from("certificates")
      .insert({
        user_id,
        course_id,
        code: certCode,
        status: "emitido",
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (certError) throw certError;

    return new Response(
      JSON.stringify({ certificate: cert, pdf_url: urlData.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-certificate internal error:", err);
    return new Response(JSON.stringify({ error: "Ocorreu um erro interno ao gerar o certificado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface CertData {
  studentName: string;
  courseTitle: string;
  courseDuration: string;
  dateStr: string;
  templateUrl: string | null;
  certCode: string;
  verifyUrl: string;
}

async function buildCertificatePdf(data: CertData): Promise<Uint8Array> {
  // We'll use pdf-lib which works in Deno
  const { PDFDocument, rgb, StandardFonts } = await import(
    "https://esm.sh/pdf-lib@1.17.1"
  );
  const QRCode = (await import("https://esm.sh/qrcode@1.5.4")).default;

  const pdfDoc = await PDFDocument.create();

  // Landscape A4
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  // Try to embed template as background
  if (data.templateUrl) {
    try {
      const response = await fetch(data.templateUrl);
      if (response.ok) {
        const imgBytes = new Uint8Array(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "";
        let image;
        if (contentType.includes("png")) {
          image = await pdfDoc.embedPng(imgBytes);
        } else {
          image = await pdfDoc.embedJpg(imgBytes);
        }
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        });
      }
    } catch {
      // Template failed, use default design
    }
  }

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // If no template, draw a default background
  if (!data.templateUrl) {
    // Border
    const borderColor = rgb(0.14, 0.42, 0.28);
    page.drawRectangle({
      x: 20,
      y: 20,
      width: pageWidth - 40,
      height: pageHeight - 40,
      borderColor,
      borderWidth: 3,
    });
    page.drawRectangle({
      x: 30,
      y: 30,
      width: pageWidth - 60,
      height: pageHeight - 60,
      borderColor,
      borderWidth: 1,
    });
  }

  const centerX = pageWidth / 2;
  const textColor = rgb(0.1, 0.1, 0.1);
  const accentColor = rgb(0.14, 0.42, 0.28);

  // Title
  const title = "CERTIFICADO DE CONCLUSÃO";
  const titleWidth = fontBold.widthOfTextAtSize(title, 28);
  page.drawText(title, {
    x: centerX - titleWidth / 2,
    y: pageHeight - 120,
    size: 28,
    font: fontBold,
    color: accentColor,
  });

  // Decorative line
  page.drawLine({
    start: { x: centerX - 150, y: pageHeight - 135 },
    end: { x: centerX + 150, y: pageHeight - 135 },
    thickness: 2,
    color: accentColor,
  });

  // "Certificamos que"
  const certText = "Certificamos que";
  const certW = fontItalic.widthOfTextAtSize(certText, 14);
  page.drawText(certText, {
    x: centerX - certW / 2,
    y: pageHeight - 180,
    size: 14,
    font: fontItalic,
    color: textColor,
  });

  // Student name
  const nameW = fontBold.widthOfTextAtSize(data.studentName, 32);
  page.drawText(data.studentName, {
    x: centerX - nameW / 2,
    y: pageHeight - 230,
    size: 32,
    font: fontBold,
    color: accentColor,
  });

  // Line under name
  page.drawLine({
    start: { x: centerX - 200, y: pageHeight - 245 },
    end: { x: centerX + 200, y: pageHeight - 245 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });

  // Course completion text
  const line1 = "concluiu com êxito o curso";
  const l1W = fontRegular.widthOfTextAtSize(line1, 14);
  page.drawText(line1, {
    x: centerX - l1W / 2,
    y: pageHeight - 280,
    size: 14,
    font: fontRegular,
    color: textColor,
  });

  // Course title
  const ctW = fontBold.widthOfTextAtSize(data.courseTitle, 22);
  page.drawText(data.courseTitle, {
    x: centerX - ctW / 2,
    y: pageHeight - 315,
    size: 22,
    font: fontBold,
    color: textColor,
  });

  // Duration
  if (data.courseDuration !== "—") {
    const durText = `Carga horária: ${data.courseDuration}`;
    const durW = fontRegular.widthOfTextAtSize(durText, 12);
    page.drawText(durText, {
      x: centerX - durW / 2,
      y: pageHeight - 345,
      size: 12,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  // Date
  const dateText = `Emitido em ${data.dateStr}`;
  const dtW = fontRegular.widthOfTextAtSize(dateText, 12);
  page.drawText(dateText, {
    x: centerX - dtW / 2,
    y: 80,
    size: 12,
    font: fontRegular,
    color: textColor,
  });

  // Footer org
  const org = "Coopaiba EAD — Educação Cooperativista";
  const orgW = fontItalic.widthOfTextAtSize(org, 10);
  page.drawText(org, {
    x: centerX - orgW / 2,
    y: 55,
    size: 10,
    font: fontItalic,
    color: rgb(0.5, 0.5, 0.5),
  });

  // QR code (verification) — bottom right
  try {
    const qrDataUrl = await QRCode.toDataURL(data.verifyUrl, {
      margin: 1,
      width: 256,
      color: { dark: "#000000", light: "#ffffff" },
    });
    const qrBytes = Uint8Array.from(
      atob(qrDataUrl.split(",")[1]),
      (c) => c.charCodeAt(0),
    );
    const qrImage = await pdfDoc.embedPng(qrBytes);
    const qrSize = 80;
    const qrX = pageWidth - qrSize - 40;
    const qrY = 50;
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    const qrLabel = "Verifique a autenticidade";
    const qrLabelW = fontRegular.widthOfTextAtSize(qrLabel, 8);
    page.drawText(qrLabel, {
      x: qrX + qrSize / 2 - qrLabelW / 2,
      y: qrY - 12,
      size: 8,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });
  } catch (e) {
    console.error("QR code generation failed:", e);
  }

  // Certificate code — bottom left
  const codeLabel = "Código de validação:";
  page.drawText(codeLabel, {
    x: 50,
    y: 70,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });
  page.drawText(data.certCode, {
    x: 50,
    y: 55,
    size: 11,
    font: fontBold,
    color: textColor,
  });

  const pdfBytesArray = await pdfDoc.save();
  return new Uint8Array(pdfBytesArray);
}
