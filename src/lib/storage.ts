import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts the storage path from either a public URL or a raw path.
 * Examples:
 *  - https://xxx.supabase.co/storage/v1/object/public/media/video/123.mp4 -> "video/123.mp4"
 *  - https://xxx.supabase.co/storage/v1/object/sign/media/video/123.mp4?... -> "video/123.mp4"
 *  - "video/123.mp4" -> "video/123.mp4"
 */
export function extractStoragePath(urlOrPath: string, bucket: string): string {
  if (!urlOrPath) return "";
  // raw path
  if (!urlOrPath.startsWith("http")) return urlOrPath;
  const markerPublic = `/storage/v1/object/public/${bucket}/`;
  const markerSign = `/storage/v1/object/sign/${bucket}/`;
  const idxPublic = urlOrPath.indexOf(markerPublic);
  if (idxPublic >= 0) {
    return urlOrPath.substring(idxPublic + markerPublic.length).split("?")[0];
  }
  const idxSign = urlOrPath.indexOf(markerSign);
  if (idxSign >= 0) {
    return urlOrPath.substring(idxSign + markerSign.length).split("?")[0];
  }
  return urlOrPath;
}

/**
 * Returns a short-lived signed URL for a file in the given bucket.
 * Falls back to the original input if signing fails (e.g. external URL).
 * @param expiresIn seconds (default 1h)
 */
export async function getSignedUrl(
  urlOrPath: string,
  bucket = "media",
  expiresIn = 3600,
): Promise<string> {
  if (!urlOrPath) return "";
  // If it's an external URL (not from our supabase storage), return as-is
  if (
    urlOrPath.startsWith("http") &&
    !urlOrPath.includes("/storage/v1/object/")
  ) {
    return urlOrPath;
  }
  const path = extractStoragePath(urlOrPath, bucket);
  if (!path) return urlOrPath;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return urlOrPath;
  return data.signedUrl;
}
