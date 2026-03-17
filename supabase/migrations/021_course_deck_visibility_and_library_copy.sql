-- =====================================================
-- FLASHY MIGRATION 021:
-- 1) Per-student deck visibility in courses
-- 2) Optional "add assigned deck to student library" in bulk assign RPC
-- =====================================================

-- -----------------------------------------------------
-- 1) Per-student deck visibility (hide overrides)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flashy_course_student_deck_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.flashy_courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.flashy_profiles(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES public.flashy_decks(id) ON DELETE CASCADE,
  is_hidden BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, student_id, deck_id)
);

CREATE INDEX IF NOT EXISTS idx_course_visibility_course_student
  ON public.flashy_course_student_deck_visibility(course_id, student_id);

CREATE INDEX IF NOT EXISTS idx_course_visibility_student_course
  ON public.flashy_course_student_deck_visibility(student_id, course_id);

ALTER TABLE public.flashy_course_student_deck_visibility ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE TRIGGER trg_course_visibility_updated
    BEFORE UPDATE ON public.flashy_course_student_deck_visibility
    FOR EACH ROW EXECUTE FUNCTION public.flashy_set_updated_at();
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DROP POLICY IF EXISTS "course_visibility_owner_all" ON public.flashy_course_student_deck_visibility;
CREATE POLICY "course_visibility_owner_all" ON public.flashy_course_student_deck_visibility
  FOR ALL TO authenticated
  USING (public.flashy_is_course_owner(course_id, auth.uid()))
  WITH CHECK (public.flashy_is_course_owner(course_id, auth.uid()));

DROP POLICY IF EXISTS "course_visibility_student_read_own" ON public.flashy_course_student_deck_visibility;
CREATE POLICY "course_visibility_student_read_own" ON public.flashy_course_student_deck_visibility
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- -----------------------------------------------------
-- 2) Helper: copy teacher deck to student's personal deck
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.flashy_copy_deck_to_personal_library(
  p_source_deck_id UUID,
  p_student_id UUID,
  p_custom_name TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_deck RECORD;
  normalized_name TEXT;
  personal_deck_id UUID;
  personal_card_count INT := 0;
BEGIN
  SELECT
    d.id,
    d.name,
    d.description,
    d.category,
    d.tags,
    d.difficulty_level,
    d.language_pair,
    d.cover_image_url
  INTO source_deck
  FROM public.flashy_decks d
  WHERE d.id = p_source_deck_id
  LIMIT 1;

  IF source_deck.id IS NULL THEN
    RETURN NULL;
  END IF;

  normalized_name := COALESCE(
    NULLIF(BTRIM(COALESCE(p_custom_name, '')), ''),
    NULLIF(BTRIM(COALESCE(source_deck.name, '')), ''),
    'Assigned deck'
  );

  SELECT d.id
  INTO personal_deck_id
  FROM public.flashy_decks d
  WHERE d.owner_id = p_student_id
    AND d.is_archived = FALSE
    AND BTRIM(COALESCE(d.name, '')) = normalized_name
    AND COALESCE(d.category, '') = COALESCE(source_deck.category, '')
  ORDER BY d.created_at DESC
  LIMIT 1;

  IF personal_deck_id IS NULL THEN
    INSERT INTO public.flashy_decks (
      owner_id,
      name,
      description,
      category,
      tags,
      difficulty_level,
      language_pair,
      cover_image_url,
      is_archived,
      sort_order
    ) VALUES (
      p_student_id,
      normalized_name,
      COALESCE(source_deck.description, ''),
      COALESCE(source_deck.category, ''),
      COALESCE(source_deck.tags, '{}'),
      source_deck.difficulty_level,
      COALESCE(source_deck.language_pair, 'en-native'),
      COALESCE(source_deck.cover_image_url, ''),
      FALSE,
      0
    )
    RETURNING id INTO personal_deck_id;
  END IF;

  SELECT COUNT(*)
  INTO personal_card_count
  FROM public.flashy_cards c
  WHERE c.deck_id = personal_deck_id;

  IF personal_card_count = 0 THEN
    INSERT INTO public.flashy_cards (
      deck_id,
      front,
      back,
      example_sentence,
      pronunciation,
      part_of_speech,
      image_url,
      audio_url,
      notes,
      difficulty,
      tags,
      sort_order,
      due,
      is_new,
      retention,
      reviews,
      next_review_days,
      mastered,
      ease_factor,
      again_count,
      card_type
    )
    SELECT
      personal_deck_id,
      c.front,
      c.back,
      c.example_sentence,
      c.pronunciation,
      c.part_of_speech,
      c.image_url,
      c.audio_url,
      c.notes,
      c.difficulty,
      c.tags,
      c.sort_order,
      NOW(),
      TRUE,
      0,
      0,
      1,
      FALSE,
      2.5,
      0,
      c.card_type
    FROM public.flashy_cards c
    WHERE c.deck_id = p_source_deck_id
    ORDER BY c.sort_order ASC, c.created_at ASC;
  END IF;

  RETURN personal_deck_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flashy_copy_deck_to_personal_library(UUID, UUID, TEXT) TO authenticated;

-- -----------------------------------------------------
-- 3) Extend bulk assign RPC with library-copy option
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS public.flashy_bulk_assign_deck(
  UUID, UUID, UUID[], BOOLEAN, TEXT, INT, BOOLEAN, BOOLEAN, UUID, TEXT, TEXT
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
  p_required_mode TEXT DEFAULT 'any',
  p_add_to_personal_library BOOLEAN DEFAULT FALSE
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
  normalized_custom_name TEXT;
BEGIN
  normalized_required_pool := LOWER(TRIM(COALESCE(p_required_pool, 'any')));
  IF normalized_required_pool NOT IN ('any', 'new', 'due', 'mixed') THEN
    normalized_required_pool := 'any';
  END IF;

  normalized_required_mode := LOWER(TRIM(COALESCE(p_required_mode, 'any')));
  IF normalized_required_mode NOT IN ('any', 'flashcards', 'quiz', 'mcq', 'match', 'wheel') THEN
    normalized_required_mode := 'any';
  END IF;

  normalized_custom_name := BTRIM(COALESCE(p_custom_name, ''));

  FOREACH sid IN ARRAY p_student_ids LOOP
    SELECT id INTO existing_assignment_id
      FROM public.flashy_deck_assignments fda
     WHERE fda.teacher_deck_id = p_teacher_deck_id
       AND fda.student_id = sid
     LIMIT 1;

    IF existing_assignment_id IS NOT NULL THEN
      UPDATE public.flashy_deck_assignments
         SET required_pool = normalized_required_pool,
             required_mode = normalized_required_mode,
             custom_name = CASE
               WHEN normalized_custom_name <> '' THEN normalized_custom_name
               ELSE custom_name
             END
       WHERE id = existing_assignment_id;

      IF p_add_to_personal_library THEN
        PERFORM public.flashy_copy_deck_to_personal_library(
          p_teacher_deck_id,
          sid,
          normalized_custom_name
        );
      END IF;

      assignment_id := existing_assignment_id;
      student_id := sid;
      cards_copied := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO public.flashy_deck_assignments (
      teacher_deck_id,
      student_id,
      teacher_id,
      sync_enabled,
      custom_name,
      study_goal_daily,
      allow_student_cards,
      allow_student_edit,
      group_assignment_id,
      required_pool,
      required_mode
    ) VALUES (
      p_teacher_deck_id,
      sid,
      p_teacher_id,
      p_sync_enabled,
      normalized_custom_name,
      p_study_goal_daily,
      p_allow_student_cards,
      p_allow_student_edit,
      p_group_assignment_id,
      normalized_required_pool,
      normalized_required_mode
    )
    RETURNING id INTO new_assignment_id;

    INSERT INTO public.flashy_student_cards (
      assignment_id,
      source_card_id,
      student_id,
      front,
      back,
      example_sentence,
      pronunciation,
      part_of_speech,
      image_url,
      notes,
      difficulty,
      card_type,
      sort_order,
      content_synced_at
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
      c.card_type,
      c.sort_order,
      NOW()
    FROM public.flashy_cards c
    WHERE c.deck_id = p_teacher_deck_id;

    GET DIAGNOSTICS card_count = ROW_COUNT;

    IF p_add_to_personal_library THEN
      PERFORM public.flashy_copy_deck_to_personal_library(
        p_teacher_deck_id,
        sid,
        normalized_custom_name
      );
    END IF;

    assignment_id := new_assignment_id;
    student_id := sid;
    cards_copied := card_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Backward-compatible wrapper for existing 11-arg RPC callers
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.flashy_bulk_assign_deck(
    p_teacher_deck_id,
    p_teacher_id,
    p_student_ids,
    p_sync_enabled,
    p_custom_name,
    p_study_goal_daily,
    p_allow_student_cards,
    p_allow_student_edit,
    p_group_assignment_id,
    p_required_pool,
    p_required_mode,
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.flashy_bulk_assign_deck(
  UUID, UUID, UUID[], BOOLEAN, TEXT, INT, BOOLEAN, BOOLEAN, UUID, TEXT, TEXT, BOOLEAN
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.flashy_bulk_assign_deck(
  UUID, UUID, UUID[], BOOLEAN, TEXT, INT, BOOLEAN, BOOLEAN, UUID, TEXT, TEXT
) TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
