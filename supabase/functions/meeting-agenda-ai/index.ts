// Gera pauta e descrição de reunião com Lovable AI Gateway (modelo no servidor, chave nunca no navegador).
import { createClient } from "npm:@supabase/supabase-js@^2.101.0";
import { createOpenAI } from "npm:@ai-sdk/openai@^2";
import { streamText } from "npm:ai@^5";
import { z } from "npm:zod@^3.25.76";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "../_shared/run-id.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const agendaSchema = z.object({
  descricao: z.string().min(1),
  pauta: z.array(z.union([z.string().min(1), z.record(z.unknown())])).min(1),
});

function parseAgenda(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("A IA não retornou um resultado válido.");
  const parsed = agendaSchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
  if (!parsed.success) throw new Error("A IA retornou um resultado incompleto. Tente novamente.");
  return {
    descricao: parsed.data.descricao,
    pauta: parsed.data.pauta.map((item) =>
      typeof item === "string"
        ? item
        : Object.entries(item)
            .filter(([k, v]) => v != null && v !== "")
            .map(([k, v]) => {
              if (typeof v !== "number") return String(v);
              return /tempo|dura|min/i.test(k) ? `${v} min` : null;
            })
            .filter(Boolean)
            .join(" — ")
    ),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Sign in required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authError || !user) return json({ error: "Sign in required" }, 401);

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const allowed = (roles ?? []).some((r) => ["admin", "moderador", "professor"].includes(r.role));
  if (!allowed) {
    return json({ error: "Apenas organizadores (admin, moderador ou professor) podem gerar pautas." }, 403);
  }

  let body: { tema?: unknown; publico?: unknown; duracao?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }
  const tema = String(body.tema ?? "").trim().slice(0, 300);
  const publico = String(body.publico ?? "").trim().slice(0, 300);
  const duracao = String(body.duracao ?? "").trim().slice(0, 60);
  if (!tema) return json({ error: "Informe o tema da reunião." }, 400);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "IA não configurada no servidor." }, 500);

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      instructions:
        "Você cria pautas e descrições de reuniões para a plataforma de ensino da COOPAIBA (cooperativa). " +
        "Escreva em português do Brasil, em tom profissional e acolhedor, pronto para copiar e compartilhar no convite. " +
        "Responda SOMENTE com um objeto json neste formato exato, sem texto antes ou depois: " +
        '{"descricao": "texto de 2 a 4 frases apresentando a reunião", "pauta": ["item 1 (tempo sugerido)", "item 2 (tempo sugerido)"]}. ' +
        "Cada item da pauta deve ser uma string de texto simples (nunca um objeto). Os tempos da pauta devem somar a duração informada.",
      messages: [
        {
          role: "user",
          content:
            `Tema da reunião: ${tema}\n` +
            `Público: ${publico || "não informado"}\n` +
            `Duração prevista: ${duracao || "não informada"}\n\n` +
            "Gere a descrição e a pauta em json.",
        },
      ],
      abortSignal: req.signal,
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const output = parseAgenda(await result.text);
    return withLovableAiGatewayRunIdHeader(
      json({ descricao: output.descricao, pauta: output.pauta }),
      runIdFetch,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /402|insufficient|crédit|credit/i.test(message)
      ? 402
      : /429|rate limit/i.test(message)
        ? 429
        : 502;
    return json({ error: `Não foi possível gerar a pauta agora. ${message.slice(0, 200)}` }, status);
  }
});
