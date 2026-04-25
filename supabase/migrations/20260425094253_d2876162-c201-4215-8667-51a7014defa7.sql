-- Drop the over-permissive general Realtime policies that allowed any authenticated
-- user to subscribe/publish to any forum:topic:* channel.
DROP POLICY IF EXISTS "realtime_messages_select" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_messages_insert" ON realtime.messages;

-- Recreate the general SELECT policy WITHOUT the open forum:topic:% branch.
-- Forum topic access is now governed exclusively by realtime_forum_topic_select.
CREATE POLICY "realtime_messages_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Support: user-scoped channels
  (realtime.topic() = 'support:user:' || auth.uid()::text)
  -- Support: conversation channels owned by the user OR admin
  OR (
    realtime.topic() LIKE 'support:conversation:%'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.support_conversations sc
        WHERE sc.id::text = split_part(realtime.topic(), ':', 3)
          AND sc.user_id = auth.uid()
      )
    )
  )
  -- Course channels: only enrolled users / admins
  OR (
    realtime.topic() LIKE 'course:%'
    AND public.can_access_course(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
  )
  -- Admin channels
  OR (
    realtime.topic() LIKE 'admin:%'
    AND public.has_role(auth.uid(), 'admin')
  )
);

-- Recreate the general INSERT policy WITHOUT the open forum:topic:% branch.
CREATE POLICY "realtime_messages_insert"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() = 'support:user:' || auth.uid()::text)
  OR (
    realtime.topic() LIKE 'support:conversation:%'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.support_conversations sc
        WHERE sc.id::text = split_part(realtime.topic(), ':', 3)
          AND sc.user_id = auth.uid()
      )
    )
  )
  OR (
    realtime.topic() LIKE 'course:%'
    AND public.can_access_course(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
  )
  OR (
    realtime.topic() LIKE 'admin:%'
    AND public.has_role(auth.uid(), 'admin')
  )
);