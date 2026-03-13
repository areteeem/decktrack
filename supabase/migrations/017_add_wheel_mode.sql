-- =====================================================
-- FLASHY MIGRATION 017: Add 'wheel' to allowed study modes
-- =====================================================
-- Updates the flashy_bulk_assign_deck RPC to accept 'wheel' as a valid required_mode.
-- This is done by using CREATE OR REPLACE to redefine the function.
-- =====================================================

-- We simply recreate the validation logic.
-- Since we can't ALTER a CHECK inside a function body, we replace the function.
-- The function signature stays the same so existing calls keep working.

-- Step 1: Update the in-function validation via a quick replace approach:
-- We'll use a DO block to alter the function body.
DO $$
BEGIN
  -- Check if the function exists, then replace it with updated mode list
  EXECUTE format(
    'CREATE OR REPLACE FUNCTION flashy_bulk_assign_deck(
      p_teacher_deck_id UUID, p_teacher_id UUID, p_student_ids UUID[],
      p_sync_enabled BOOLEAN DEFAULT TRUE, p_custom_name TEXT DEFAULT '''',
      p_study_goal_daily INT DEFAULT 0, p_allow_student_cards BOOLEAN DEFAULT TRUE,
      p_allow_student_edit BOOLEAN DEFAULT TRUE, p_group_assignment_id UUID DEFAULT NULL,
      p_required_pool TEXT DEFAULT ''any'', p_required_mode TEXT DEFAULT ''any''
    ) RETURNS TABLE (assignment_id UUID, student_id UUID, cards_copied INT)
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
    DECLARE
      sid UUID; new_assignment_id UUID; existing_assignment_id UUID; card_count INT;
      normalized_required_pool TEXT; normalized_required_mode TEXT;
    BEGIN
      normalized_required_pool := LOWER(TRIM(COALESCE(p_required_pool, ''any'')));
      IF normalized_required_pool NOT IN (''any'', ''new'', ''due'', ''mixed'') THEN
        normalized_required_pool := ''any'';
      END IF;
      normalized_required_mode := LOWER(TRIM(COALESCE(p_required_mode, ''any'')));
      IF normalized_required_mode NOT IN (''any'', ''flashcards'', ''quiz'', ''mcq'', ''match'', ''wheel'') THEN
        normalized_required_mode := ''any'';
      END IF;
      FOREACH sid IN ARRAY p_student_ids LOOP
        SELECT id INTO existing_assignment_id
          FROM flashy_deck_assignments fda
         WHERE fda.teacher_deck_id = p_teacher_deck_id AND fda.student_id = sid LIMIT 1;
        IF existing_assignment_id IS NOT NULL THEN
          UPDATE flashy_deck_assignments
             SET required_pool = normalized_required_pool, required_mode = normalized_required_mode
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
        SELECT new_assignment_id, c.id, sid, c.front, c.back, c.example_sentence, c.pronunciation,
               c.part_of_speech, c.image_url, c.notes, c.difficulty, c.sort_order, NOW()
          FROM flashy_cards c WHERE c.deck_id = p_teacher_deck_id;
        GET DIAGNOSTICS card_count = ROW_COUNT;
        assignment_id := new_assignment_id;
        student_id    := sid;
        cards_copied  := card_count;
        RETURN NEXT;
      END LOOP;
    END;
    $fn$;'
  );
END;
$$;
