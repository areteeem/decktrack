-- =====================================================
-- MIGRATION 014: Study mode + auto-complete signal support
-- =====================================================
-- 1. Add required_mode column to flashy_deck_assignments
-- 2. Allow authenticated Flashy students to INSERT into student_updates
--    (so Flashy can signal study completion directly to the teacher app)
-- =====================================================

-- ─── 1. Add required_mode to assignments ───
ALTER TABLE flashy_deck_assignments
  ADD COLUMN IF NOT EXISTS required_mode TEXT DEFAULT 'any';

-- ─── 2. Allow authenticated INSERT into student_updates ───
-- Flashy students are authenticated via Supabase Auth.
-- They need to write completion signals to student_updates so the
-- teacher app can auto-mark homework as done — even when the
-- Student App is closed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'student_updates'
      AND policyname = 'student_updates_auth_insert'
  ) THEN
    CREATE POLICY "student_updates_auth_insert"
      ON student_updates FOR INSERT TO authenticated
      WITH CHECK (teacher_id IS NOT NULL);
  END IF;
END $$;

-- ─── 3. Update flashy_bulk_assign_deck to accept p_required_mode ───
-- Drop old 10-arg signature first, then recreate with 11 args
DROP FUNCTION IF EXISTS public.flashy_bulk_assign_deck(
  UUID, UUID, UUID[], BOOLEAN, TEXT, INT, BOOLEAN, BOOLEAN, UUID, TEXT
);

CREATE OR REPLACE FUNCTION public.flashy_bulk_assign_deck(
  p_teacher_deck_id UUID,
  p_teacher_id UUID,
  p_student_ids UUID[],
  p_sync_enabled BOOLEAN DEFAULT TRUE,
  p_custom_name TEXT DEFAULT '',
  p_study_goal_daily INT DEFAULT 0,
  p_allow_student_cards BOOLEAN DEFAULT TRUE,
  p_allow_student_edit BOOLEAN DEFAULT TRUE,
  p_group_assignment_id UUID DEFAULT NULL,
  p_required_pool TEXT DEFAULT 'any',
  p_required_mode TEXT DEFAULT 'any'
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
  existing_assignment_id UUID;
  card_count INT;
  normalized_required_pool TEXT;
  normalized_required_mode TEXT;
BEGIN
  normalized_required_pool := LOWER(TRIM(COALESCE(p_required_pool, 'any')));
  IF normalized_required_pool NOT IN ('any', 'new', 'due', 'mixed') THEN
    normalized_required_pool := 'any';
  END IF;

  normalized_required_mode := LOWER(TRIM(COALESCE(p_required_mode, 'any')));
  IF normalized_required_mode NOT IN ('any', 'flashcards', 'quiz', 'mcq', 'match') THEN
    normalized_required_mode := 'any';
  END IF;

  FOREACH sid IN ARRAY p_student_ids LOOP
    SELECT id INTO existing_assignment_id
      FROM flashy_deck_assignments fda
     WHERE fda.teacher_deck_id = p_teacher_deck_id AND fda.student_id = sid
     LIMIT 1;

    IF existing_assignment_id IS NOT NULL THEN
      UPDATE flashy_deck_assignments
         SET required_pool = normalized_required_pool,
             required_mode = normalized_required_mode
       WHERE id = existing_assignment_id;

      assignment_id := existing_assignment_id;
      student_id    := sid;
      cards_copied  := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO flashy_deck_assignments (
      teacher_deck_id, student_id, teacher_id,
      sync_enabled, custom_name, study_goal_daily,
      allow_student_cards, allow_student_edit,
      group_assignment_id, required_pool, required_mode
    ) VALUES (
      p_teacher_deck_id, sid, p_teacher_id,
      p_sync_enabled, p_custom_name, p_study_goal_daily,
      p_allow_student_cards, p_allow_student_edit,
      p_group_assignment_id, normalized_required_pool, normalized_required_mode
    )
    RETURNING id INTO new_assignment_id;

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
    student_id    := sid;
    cards_copied  := card_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flashy_bulk_assign_deck(
  UUID, UUID, UUID[], BOOLEAN, TEXT, INT, BOOLEAN, BOOLEAN, UUID, TEXT, TEXT
) TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
