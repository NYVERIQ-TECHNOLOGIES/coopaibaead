import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { canIssueAccess } from "./permissions.ts";

const bodySchema = z.object({ user_id: z.string().uuid() });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Serviço indisponível" }, 503);
  const admin = createClient(url, key);
  const bearer = req.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
  const { data: caller, error: authError } = await admin.auth.getUser(bearer.slice(7));
  if (authError || !caller.user) return json({ error: "Não autorizado" }, 401);
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Selecione uma conta válida" }, 400);
    const targetId = parsed.data.user_id;
    const [{ data: isAdmin }, { data: isMaster }, targetRoles] = await Promise.all([
      admin.rpc("has_role", { _user_id: caller.user.id, _role: "admin" }),
      admin.rpc("is_master_admin", { _user_id: caller.user.id }),
      admin.from("user_roles").select("role").eq("user_id", targetId),
    ]);
    if (targetRoles.error || !canIssueAccess(isAdmin === true, isMaster === true, (targetRoles.data ?? []).map(r => r.role), caller.user.id === targetId)) {
      return json({ error: "Você não tem permissão para gerar acesso para esta conta" }, 403);
    }
    const [{ data: target }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(targetId),
      admin.from("profiles").select("full_name, cpf, cnpj, is_active").eq("user_id", targetId).single(),
    ]);
    if (!target.user?.email || !profile || profile.is_active === false) return json({ error: "Conta indisponível ou inativa" }, 400);
    // Audit before generating the credential. Never persist links or tokens.
    const { error: auditError } = await admin.from("password_reset_logs").insert({ admin_user_id: caller.user.id, target_user_id: targetId, target_email: target.user.email, user_agent: req.headers.get("user-agent") });
    if (auditError) return json({ error: "Não foi possível registrar a entrega" }, 500);
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "recovery", email: target.user.email });
    const token = link?.properties?.hashed_token;
    if (error || !token) return json({ error: "Não foi possível gerar o acesso" }, 500);
    return json({ name: profile.full_name, identifier: profile.cnpj || profile.cpf || target.user.email, link: `https://coopaibaead.app/reset-password?token_hash=${encodeURIComponent(token)}&type=recovery` });
  } catch {
    return json({ error: "Não foi possível gerar o acesso" }, 500);
  }
});