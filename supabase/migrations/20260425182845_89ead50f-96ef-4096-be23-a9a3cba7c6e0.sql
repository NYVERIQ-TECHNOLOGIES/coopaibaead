-- Gate Realtime subscriptions on forum:reply:<topic_id> channels using
-- the same access rules as the parent topic (admin, topic author, or
-- active course enrollment when the topic belongs to a course).
DROP POLICY IF EXISTS "realtime_forum_reply_select" ON realtime.messages;

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
        public.has_role(auth.uid(), 'admin')
        OR ft.user_id = auth.uid()
        OR (ft.course_id IS NOT NULL AND public.can_access_course(auth.uid(), ft.course_id))
      )
  )
);

-- Mirror the same gating for INSERT (publish) on forum:reply:<topic_id>
DROP POLICY IF EXISTS "realtime_forum_reply_insert" ON realtime.messages;

CREATE POLICY "realtime_forum_reply_insert"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() LIKE 'forum:reply:%')
  AND EXISTS (
    SELECT 1 FROM public.forum_topics ft
    WHERE ft.id::text = split_part(realtime.topic(), ':', 3)
      AND (
        public.has_role(auth.uid(), 'admin')
        OR ft.user_id = auth.uid()
        OR (ft.course_id IS NOT NULL AND public.can_access_course(auth.uid(), ft.course_id))
      )
  )
);