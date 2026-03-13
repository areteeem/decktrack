-- 013: Repair canonical flashy_bulk_assign_deck RPC signature
-- This migration is safe to run after any previous state of 007/008/012.

ALTER TABLE public.flashy_deck_assignments
  ADD COLUMN IF NOT EXISTS required_pool TEXT NOT NULL DEFAULT 'any';

ALTER TABLE public.flashy_study_sessions
  ADD COLUMN IF NOT EXISTS pool TEXT;

UPDATE public.flashy_deck_assignments
SET required_pool = 'any'
WHERE required_pool IS NULL
   OR LOWER(TRIM(required_pool)) NOT IN ('any', 'new', 'due', 'mixed');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flashy_deck_assignments_required_pool_chk'
      AND conrelid = 'public.flashy_deck_assignments'::regclass
  ) THEN
    ALTER TABLE public.flashy_deck_assignments
      ADD CONSTRAINT flashy_deck_assignments_required_pool_chk
      CHECK (required_pool IN ('any', 'new', 'due', 'mixed'));
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.flashy_bulk_assign_deck(
  UUID, UUID, UUID[], BOOLEAN, TEXT, INT, BOOLEAN, BOOLEAN, UUID, TEXT
);

DROP FUNCTION IF EXISTS public.flashy_bulk_assign_deck(
  UUID, UUID, UUID[], BOOLEAN, TEXT, INT, BOOLEAN, BOOLEAN, UUID
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
  normalized_required_pool TEXT;
BEGIN
  normalized_required_pool := LOWER(TRIM(COALESCE(p_required_pool, 'any')));
  IF normalized_required_pool NOT IN ('any', 'new', 'due', 'mixed') THEN
    normalized_required_pool := 'any';
  END IF;

  FOREACH sid IN ARRAY p_student_ids LOOP
    SELECT id INTO existing_assignment_id
      FROM flashy_deck_assignments fda
     WHERE fda.teacher_deck_id = p_teacher_deck_id AND fda.student_id = sid
     LIMIT 1;

    IF existing_assignment_id IS NOT NULL THEN
      UPDATE flashy_deck_assignments
         SET required_pool = normalized_required_pool
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
      group_assignment_id, required_pool
    ) VALUES (
      p_teacher_deck_id, sid, p_teacher_id,
      p_sync_enabled, p_custom_name, p_study_goal_daily,
      p_allow_student_cards, p_allow_student_edit,
      p_group_assignment_id, normalized_required_pool
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
  UUID, UUID, UUID[], BOOLEAN, TEXT, INT, BOOLEAN, BOOLEAN, UUID, TEXT
) TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
