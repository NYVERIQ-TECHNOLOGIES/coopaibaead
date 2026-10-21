// Gera pauta e descrição de reunião com Lovable AI Gateway (modelo no servidor, chave nunca no navegador).
import { createClient } from "npm:@supabase/supabase-js@^2.101.0";
import { createOpenAI } from "npm:@ai-sdk/openai@^2";
import { Output, streamText } from "npm:ai@^5";
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
  descricao: z.string().describe("Descrição da reunião pronta para o convite, 2 a 4 frases, em português."),
  pauta: z.array(z.string()).describe("Itens da pauta em ordem, cada um com o tempo sugerido entre parênteses."),
});

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
        "A descrição apresenta a reunião em 2 a 4 frases. " +
        "A pauta lista os itens em ordem, cada item com o tempo sugerido entre parênteses, somando a duração informada.",
      messages: [
        {
          role: "user",
          content:
            `Tema da reunião: ${tema}\n` +
            `Público: ${publico || "não informado"}\n` +
            `Duração prevista: ${duracao || "não informada"}\n\n` +
            "Gere a descrição e a pauta.",
        },
      ],
      experimental_output: Output.object({ schema: agendaSchema }),
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
    const output = await result.experimental_output;
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
