import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const schema = z.object({
  full_name: z.string().trim().min(3).max(200),
  cnpj: z.string().regex(/^\d{14}$/),
  nire: z.string().regex(/^\d{11}$/),
  cooperativa: z.string().trim().min(3).max(200),
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Serviço indisponível" }, 503);
  const admin = createClient(url, key);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
  const { data: caller, error: authError } = await admin.auth.getUser(auth.slice(7));
  if (authError || !caller.user) return json({ error: "Não autorizado" }, 401);
  const { data: role, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", caller.user.id).eq("role", "admin").maybeSingle();
  if (roleError || !role) return json({ error: "Apenas administradores podem criar contas institucionais" }, 403);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dados institucionais inválidos" }, 400);
    const input = parsed.data;
    const { data: existing, error: lookupError } = await admin.from("profiles").select("user_id").eq("cnpj", input.cnpj).maybeSingle();
    if (lookupError) return json({ error: "Não foi possível verificar o cadastro" }, 500);
    if (existing) return json({ status: "exists", user_id: existing.user_id });
    const password = `${crypto.randomUUID()}Aa1!`;
    const email = `cnpj${input.cnpj}@cooperado.coopaiba.com.br`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: input.full_name, cooperativa: input.cooperativa } });
    if (createError || !created.user) {
      console.error("Institution account creation failed", createError?.code, createError?.status);
      return json({ error: "Não foi possível criar a conta" }, 400);
    }
    const userId = created.user.id;
    const { error: profileError } = await admin.from("profiles").update({ ...input, cpf: null, data_nascimento: null }).eq("user_id", userId);
    if (profileError) { await admin.auth.admin.deleteUser(userId); return json({ error: "Não foi possível salvar a identificação institucional" }, 500); }
    const { error: deleteRoleError } = await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: insertRoleError } = await admin.from("user_roles").insert({ user_id: userId, role: "cooperado" });
    const { error: rotationError } = await admin.rpc("capture_password_reset", { _user_id: userId });
    if (deleteRoleError || insertRoleError || rotationError) { await admin.auth.admin.deleteUser(userId); return json({ error: "Não foi possível configurar o acesso seguro" }, 500); }
    await admin.from("bulk_import_audit").insert({ performed_by: caller.user.id, total_rows: 1, created_count: 1, skipped_count: 0, error_count: 0, summary: { institutional_created: 1 } });
    return json({ status: "created", user_id: userId });
  } catch { return json({ error: "Não foi possível criar a conta institucional" }, 500); }
});