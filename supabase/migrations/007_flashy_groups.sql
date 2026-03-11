-- =====================================================
-- FLASHY MIGRATION 007: Groups + Bulk Assignment + Assignment Settings
-- Run in Supabase SQL Editor after 006_flashy_student_auth.sql
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. flashy_groups — teacher organizes students into groups
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID NOT NULL REFERENCES flashy_profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  color       TEXT DEFAULT '#6366f1',
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashy_groups_teacher ON flashy_groups(teacher_id);

-- ─────────────────────────────────────────────────────
-- 2. flashy_group_members — many-to-many students ↔ groups
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_group_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES flashy_groups(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES flashy_profiles(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_flashy_group_members_group ON flashy_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_flashy_group_members_student ON flashy_group_members(student_id);

-- ─────────────────────────────────────────────────────
-- 3. flashy_group_assignments — assign deck to whole group
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_group_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID NOT NULL REFERENCES flashy_groups(id) ON DELETE CASCADE,
  teacher_deck_id  UUID NOT NULL REFERENCES flashy_decks(id) ON DELETE CASCADE,
  teacher_id       UUID NOT NULL REFERENCES flashy_profiles(id),
  sync_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, teacher_deck_id)
);

CREATE INDEX IF NOT EXISTS idx_flashy_group_assignments_group ON flashy_group_assignments(group_id);

-- ─────────────────────────────────────────────────────
-- 4. Add assignment settings columns to flashy_deck_assignments
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_deck_assignments
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE flashy_deck_assignments
  ADD COLUMN IF NOT EXISTS allow_student_cards BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE flashy_deck_assignments
  ADD COLUMN IF NOT EXISTS allow_student_edit BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE flashy_deck_assignments
  ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;

ALTER TABLE flashy_deck_assignments
  ADD COLUMN IF NOT EXISTS group_assignment_id UUID REFERENCES flashy_group_assignments(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────
-- 5. Add original_content column to flashy_student_cards
--    Stores a snapshot of the teacher's version when student edits a synced card
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_student_cards
  ADD COLUMN IF NOT EXISTS original_content JSONB;

-- ─────────────────────────────────────────────────────
-- 6. Updated_at triggers for new tables
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_flashy_groups_updated
    BEFORE UPDATE ON flashy_groups
    FOR EACH ROW EXECUTE FUNCTION flashy_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────
-- 7. RLS policies for groups
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_teacher_select"
  ON flashy_groups FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "groups_teacher_insert"
  ON flashy_groups FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "groups_teacher_update"
  ON flashy_groups FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "groups_teacher_delete"
  ON flashy_groups FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- ─────────────────────────────────────────────────────
-- 8. RLS for group_members
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_group_members ENABLE ROW LEVEL SECURITY;

-- Teachers can manage members of their groups
CREATE POLICY "group_members_teacher_select"
  ON flashy_group_members FOR SELECT TO authenticated
  USING (
    group_id IN (SELECT id FROM flashy_groups WHERE teacher_id = auth.uid())
  );

CREATE POLICY "group_members_teacher_insert"
  ON flashy_group_members FOR INSERT TO authenticated
  WITH CHECK (
    group_id IN (SELECT id FROM flashy_groups WHERE teacher_id = auth.uid())
  );

CREATE POLICY "group_members_teacher_delete"
  ON flashy_group_members FOR DELETE TO authenticated
  USING (
    group_id IN (SELECT id FROM flashy_groups WHERE teacher_id = auth.uid())
  );

-- Students can see their own memberships
CREATE POLICY "group_members_student_select"
  ON flashy_group_members FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- ─────────────────────────────────────────────────────
-- 9. RLS for group_assignments
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_group_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_assignments_teacher_select"
  ON flashy_group_assignments FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "group_assignments_teacher_insert"
  ON flashy_group_assignments FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "group_assignments_teacher_update"
  ON flashy_group_assignments FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "group_assignments_teacher_delete"
  ON flashy_group_assignments FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- ─────────────────────────────────────────────────────
-- 10. RLS: students can INSERT their own custom cards
-- ─────────────────────────────────────────────────────
CREATE POLICY "student_cards_insert_own"
  ON flashy_student_cards FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- ─────────────────────────────────────────────────────
-- 11. RLS: students can DELETE their own custom cards
-- ─────────────────────────────────────────────────────
CREATE POLICY "student_cards_delete_own"
  ON flashy_student_cards FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND is_custom = TRUE);

-- ─────────────────────────────────────────────────────
-- 12. Bulk assignment helper function
--     Assigns a deck to multiple students at once,
--     skipping already-assigned pairs.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.flashy_bulk_assign_deck(
  p_teacher_deck_id UUID,
  p_teacher_id UUID,
  p_student_ids UUID[],
  p_sync_enabled BOOLEAN DEFAULT TRUE,
  p_custom_name TEXT DEFAULT '',
  p_study_goal_daily INT DEFAULT 0,
  p_allow_student_cards BOOLEAN DEFAULT TRUE,
  p_allow_student_edit BOOLEAN DEFAULT TRUE,
  p_group_assignment_id UUID DEFAULT NULL
)
RETURNS TABLE (
  assignment_id UUID,
  student_id UUID,
  cards_copied INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid UUID;
  new_assignment_id UUID;
  card_count INT;
BEGIN
  FOREACH sid IN ARRAY p_student_ids LOOP
    -- Skip if already assigned
    IF EXISTS (
      SELECT 1 FROM flashy_deck_assignments
      WHERE teacher_deck_id = p_teacher_deck_id AND student_id = sid
    ) THEN
      CONTINUE;
    END IF;

    -- Create assignment
    INSERT INTO flashy_deck_assignments (
      teacher_deck_id, student_id, teacher_id,
      sync_enabled, custom_name, study_goal_daily,
      allow_student_cards, allow_student_edit,
      group_assignment_id
    ) VALUES (
      p_teacher_deck_id, sid, p_teacher_id,
      p_sync_enabled, p_custom_name, p_study_goal_daily,
      p_allow_student_cards, p_allow_student_edit,
      p_group_assignment_id
    )
    RETURNING id INTO new_assignment_id;

    -- Copy all master cards to student
    INSERT INTO flashy_student_cards (
      assignment_id, source_card_id, student_id,
      front, back, example_sentence, pronunciation,
      part_of_speech, image_url, notes, difficulty,
      sort_order, content_synced_at
    )
    SELECT
      new_assignment_id,
      c.id,
      sid,
      c.front,
      c.back,
      c.example_sentence,
      c.pronunciation,
      c.part_of_speech,
      c.image_url,
      c.notes,
      c.difficulty,
      c.sort_order,
      NOW()
    FROM flashy_cards c
    WHERE c.deck_id = p_teacher_deck_id;

    GET DIAGNOSTICS card_count = ROW_COUNT;

    assignment_id := new_assignment_id;
    student_id := sid;
    cards_copied := card_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flashy_bulk_assign_deck(UUID, UUID, UUID[], BOOLEAN, TEXT, INT, BOOLEAN, BOOLEAN, UUID) TO authenticated;
