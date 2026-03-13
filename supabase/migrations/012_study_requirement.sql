-- 012: Add study requirement to deck assignments + pool tracking on sessions
-- required_pool: which card pool the teacher wants the student to complete
--   'any'   – any study counts (default, backward-compatible)
--   'new'   – student must do a "learn new cards" session
--   'due'   – student must do a "review due cards" session
--   'mixed' – student must do a mixed new+due session

ALTER TABLE public.flashy_deck_assignments
  ADD COLUMN IF NOT EXISTS required_pool TEXT NOT NULL DEFAULT 'any';

-- pool: which card pool the student actually studied in this session
ALTER TABLE public.flashy_study_sessions
  ADD COLUMN IF NOT EXISTS pool TEXT;

-- ─── Update bulk-assign RPC to accept and store required_pool ────────────────
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
  p_required_pool TEXT DEFAULT 'any'
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
BEGIN
  FOREACH sid IN ARRAY p_student_ids LOOP
    -- Check if already assigned
    SELECT id INTO existing_assignment_id
      FROM flashy_deck_assignments fda
     WHERE fda.teacher_deck_id = p_teacher_deck_id AND fda.student_id = sid
     LIMIT 1;

    IF existing_assignment_id IS NOT NULL THEN
      -- Update required_pool on existing assignment so teacher changes propagate
      UPDATE flashy_deck_assignments
         SET required_pool = p_required_pool
       WHERE id = existing_assignment_id;

      assignment_id := existing_assignment_id;
      student_id    := sid;
      cards_copied  := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Create new assignment
    INSERT INTO flashy_deck_assignments (
      teacher_deck_id, student_id, teacher_id,
      sync_enabled, custom_name, study_goal_daily,
      allow_student_cards, allow_student_edit,
      group_assignment_id, required_pool
    ) VALUES (
      p_teacher_deck_id, sid, p_teacher_id,
      p_sync_enabled, p_custom_name, p_study_goal_daily,
      p_allow_student_cards, p_allow_student_edit,
      p_group_assignment_id, p_required_pool
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
    student_id    := sid;
    cards_copied  := card_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flashy_bulk_assign_deck TO authenticated;
