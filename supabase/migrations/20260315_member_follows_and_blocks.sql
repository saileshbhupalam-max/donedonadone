-- ═══════════════════════════════════════════════════════════════
-- VIP Attendance Alerts: member_follows
-- Max-tier members can follow people and get notified on RSVP.
-- Following is PRIVATE — the followed person never knows.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.member_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  followed_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, followed_id),
  CHECK (follower_id != followed_id)
);

ALTER TABLE public.member_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_follows" ON public.member_follows
  FOR SELECT USING (auth.uid() = follower_id);
CREATE POLICY "insert_own_follows" ON public.member_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "delete_own_follows" ON public.member_follows
  FOR DELETE USING (auth.uid() = follower_id);

CREATE INDEX idx_member_follows_follower ON public.member_follows(follower_id);
CREATE INDEX idx_member_follows_followed ON public.member_follows(followed_id);

-- ═══════════════════════════════════════════════════════════════
-- Safety Block List: member_blocks
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.member_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

ALTER TABLE public.member_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_blocks" ON public.member_blocks
  FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "insert_own_blocks" ON public.member_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "delete_own_blocks" ON public.member_blocks
  FOR DELETE USING (auth.uid() = blocker_id);
CREATE POLICY "admin_read_all_blocks" ON public.member_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.app_settings
      WHERE key = 'admin_emails'
      AND value::jsonb ? (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE INDEX idx_member_blocks_blocker ON public.member_blocks(blocker_id);
CREATE INDEX idx_member_blocks_blocked ON public.member_blocks(blocked_id);

-- ═══════════════════════════════════════════════════════════════
-- RPC: Notify followers and blockers when someone RSVPs
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_rsvp_followers_and_blockers(
  p_event_id UUID,
  p_rsvp_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_title TEXT;
  v_follow_count INT := 0;
  v_block_count INT := 0;
  v_follower RECORD;
  v_blocker RECORD;
BEGIN
  SELECT title INTO v_event_title FROM events WHERE id = p_event_id;
  IF v_event_title IS NULL THEN
    RETURN jsonb_build_object('follow_notified', 0, 'block_notified', 0);
  END IF;

  FOR v_follower IN
    SELECT mf.follower_id
    FROM member_follows mf
    JOIN profiles p ON p.id = mf.follower_id
    WHERE mf.followed_id = p_rsvp_user_id
      AND p.subscription_tier = 'max'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM event_rsvps
      WHERE event_id = p_event_id AND user_id = v_follower.follower_id AND status = 'going'
    ) THEN
      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (
        v_follower.follower_id, 'follow_rsvp',
        'Someone you follow just joined a session',
        'They RSVP''d to "' || v_event_title || '". Check it out?',
        jsonb_build_object('event_id', p_event_id), false
      );
      v_follow_count := v_follow_count + 1;
    END IF;
  END LOOP;

  FOR v_blocker IN
    SELECT mb.blocker_id
    FROM member_blocks mb
    JOIN event_rsvps er ON er.user_id = mb.blocker_id
      AND er.event_id = p_event_id AND er.status = 'going'
    WHERE mb.blocked_id = p_rsvp_user_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data, read)
    VALUES (
      v_blocker.blocker_id, 'block_alert',
      'Heads up about a session you''re attending',
      'Someone you''ve flagged just RSVP''d to "' || v_event_title || '". You can update your RSVP if needed.',
      jsonb_build_object('event_id', p_event_id), false
    );
    v_block_count := v_block_count + 1;
  END LOOP;

  FOR v_blocker IN
    SELECT mb.blocker_id
    FROM member_blocks mb
    JOIN event_rsvps er ON er.user_id = mb.blocked_id
      AND er.event_id = p_event_id AND er.status = 'going'
    WHERE mb.blocker_id = p_rsvp_user_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data, read)
    VALUES (
      v_blocker.blocker_id, 'block_alert',
      'Heads up about a session you''re joining',
      'Someone you''ve flagged is already going to "' || v_event_title || '". You can update your RSVP if needed.',
      jsonb_build_object('event_id', p_event_id), false
    );
    v_block_count := v_block_count + 1;
  END LOOP;

  RETURN jsonb_build_object('follow_notified', v_follow_count, 'block_notified', v_block_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_rsvp_followers_and_blockers(UUID, UUID) TO authenticated;
