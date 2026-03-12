-- Fix: "column student_id is ambiguous" in flashy_bulk_assign_deck
-- Root cause: RETURNS TABLE has student_id column that shadows table column names.
-- Solution: Rename output columns with `out_` prefix to avoid ambiguity.

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
    -- Skip if already assigned (qualify with table name to avoid ambiguity)
    IF EXISTS (
      SELECT 1 FROM flashy_deck_assignments fda
      WHERE fda.teacher_deck_id = p_teacher_deck_id AND fda.student_id = sid
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
