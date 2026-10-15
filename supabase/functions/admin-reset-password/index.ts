import { withPasswordRotation } from "../_shared/passwordRotation.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(withPasswordRotation(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, userId, newEmail, password, token } = await req.json();

    let authorized = false;
    let bulkToken = false;
    let adminUserId: string | null = null;

    if (token && token === Deno.env.get("BULK_IMPORT_TOKEN")) {
      authorized = true;
      bulkToken = true;
    } else {
      // Verify caller is an authenticated admin (double check: JWT + role lookup)
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const jwt = authHeader.replace("Bearer ", "");
        const authClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
        );
        // 1) Validate JWT and get user
        const { data: userData, error: claimsErr } = await authClient.auth.getUser(jwt);
        const uid = userData?.user?.id;
        if (!claimsErr && uid) {
          const adminForCheck = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          );
          // 2) Confirm user still exists and is not banned
          const { data: userLookup, error: userErr } = await adminForCheck.auth.admin.getUserById(uid);
          if (!userErr && userLookup?.user && !(userLookup.user as any).banned_until) {
            // 3) Verify admin role via has_role RPC (server-authoritative)
            const { data: isAdmin } = await adminForCheck.rpc("has_role", {
              _user_id: uid,
              _role: "admin",
            });
            // 4) Extra defense: direct row check in user_roles
            const { data: roleRow } = await adminForCheck
              .from("user_roles")
              .select("role")
              .eq("user_id", uid)
              .eq("role", "admin")
              .maybeSingle();
            if (isAdmin === true && roleRow) {
              authorized = true;
              adminUserId = uid;
            }
          }
        }
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    let targetId = userId as string | undefined;
    let resolvedEmail: string | null = email ?? null;
    if (!targetId && email) {
      let page = 1;
      while (!targetId) {
        const { data: list, error: le } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (le) throw le;
        const u = list.users.find((x) => (x.email || "").toLowerCase() === email.toLowerCase());
        if (u) { targetId = u.id; resolvedEmail = u.email ?? email; break; }
        if (list.users.length < 1000) break;
        page++;
      }
    }
    if (!targetId) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: corsHeaders });

    // If we don't yet know the email but have an id, fetch it for the log
    if (!resolvedEmail && targetId) {
      const { data: u } = await admin.auth.admin.getUserById(targetId);
      resolvedEmail = u?.user?.email ?? null;
    }

    const updates: Record<string, unknown> = {};
    if (password) updates.password = password;
    if (newEmail) { updates.email = newEmail; updates.email_confirm = true; }
    const { error } = await admin.auth.admin.updateUserById(targetId, updates);
    if (error) throw error;
    if (password) {
      const { error: rotationError } = await admin.rpc("capture_password_reset", { _user_id: targetId });
      if (rotationError) throw rotationError;
    }

    // Audit log: only for password resets performed by a real admin (skip bulk-token flow)
    if (password && !bulkToken && adminUserId) {
      const ua = req.headers.get("user-agent") ?? null;
      const { error: logErr } = await admin.from("password_reset_logs").insert({
        admin_user_id: adminUserId,
        target_user_id: targetId,
        target_email: resolvedEmail,
        user_agent: ua,
      });
      if (logErr) console.error("password_reset_logs insert failed:", logErr);
    }

    return new Response(JSON.stringify({ ok: true, user_id: targetId }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Não foi possível redefinir o acesso." }), { status: 500, headers: corsHeaders });
  }
}));
