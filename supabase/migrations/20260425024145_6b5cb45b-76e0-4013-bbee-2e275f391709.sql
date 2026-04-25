
-- =========================================================
-- 1) Restrict Realtime subscriptions on forum:topic:<topic_id>
--    to users enrolled in the topic's course (or admins, or
--    topics with no course attached i.e. general forum).
-- =========================================================

DROP POLICY IF EXISTS "realtime_forum_topic_subscribe" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_forum_topic_select" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_forum_topic_read" ON realtime.messages;

-- Recreate scoped policy: forum:topic:<uuid>
CREATE POLICY "realtime_forum_topic_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'forum:topic:%')
  AND EXISTS (
    SELECT 1
    FROM public.forum_topics ft
    WHERE ft.id::text = split_part(realtime.topic(), ':', 3)
      AND (
        ft.course_id IS NULL
        OR public.has_role(auth.uid(), 'admin')
        OR public.can_access_course(auth.uid(), ft.course_id)
      )
  )
);

-- =========================================================
-- 2) Avatars bucket: prevent broad listing while still
--    allowing direct public URL fetches (bucket stays public,
--    so individual file URLs continue to work).
--    Remove the permissive SELECT-on-bucket policies that
--    enable listing every object via the API.
-- =========================================================

DROP POLICY IF EXISTS "Public avatar read access" ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;

-- Keep "Users list own avatar" (already owner-scoped) so users
-- can list/manage their own folder. Public direct URL access
-- to specific files continues to work because the bucket is
-- public — Supabase serves them outside RLS.
