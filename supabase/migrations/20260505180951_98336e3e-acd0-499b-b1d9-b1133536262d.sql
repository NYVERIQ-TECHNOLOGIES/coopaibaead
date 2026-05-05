-- 1. Fix realtime forum policies to allow general (course_id IS NULL) topics
DROP POLICY IF EXISTS "realtime_forum_topic_select" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_forum_reply_select" ON realtime.messages;

CREATE POLICY "realtime_forum_topic_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'forum:topic:%')
  AND EXISTS (
    SELECT 1 FROM public.forum_topics ft
    WHERE ft.id::text = split_part(realtime.topic(), ':', 3)
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR ft.user_id = auth.uid()
        OR ft.course_id IS NULL
        OR public.can_access_course(auth.uid(), ft.course_id)
      )
  )
);

CREATE POLICY "realtime_forum_reply_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'forum:reply:%')
  AND EXISTS (
    SELECT 1 FROM public.forum_topics ft
    WHERE ft.id::text = split_part(realtime.topic(), ':', 3)
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR ft.user_id = auth.uid()
        OR ft.course_id IS NULL
        OR public.can_access_course(auth.uid(), ft.course_id)
      )
  )
);

-- 2. Revoke anon EXECUTE on functions not meant to be public
REVOKE EXECUTE ON FUNCTION public.get_admin_reports() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_lesson_access(uuid, uuid) FROM anon, public;
