// Server-only storage helpers for app-user connection keys.
import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptConnectionKey, decryptConnectionKey } from "./connectionKeyCrypto.ts";

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: string,
  connectionAPIKey: string,
  accountEmail?: string | null,
) {
  const { error } = await adminClient().from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      connection_key_ciphertext: await encryptConnectionKey(connectionAPIKey),
      account_email: accountEmail ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function setAccountEmail(userId: string, connectorId: string, email: string | null) {
  await adminClient()
    .from("app_user_connections")
    .update({ account_email: email, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}

export async function getConnectionKeyForUser(userId: string, connectorId: string) {
  const { data, error } = await adminClient()
    .from("app_user_connections")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  return data ? await decryptConnectionKey(data.connection_key_ciphertext) : null;
}

export async function getConnectionRow(userId: string, connectorId: string) {
  const { data } = await adminClient()
    .from("app_user_connections")
    .select("account_email, updated_at")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  return data;
}

export async function deleteConnectionForUser(userId: string, connectorId: string) {
  await adminClient()
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}
