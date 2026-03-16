-- =====================================================
-- FLASHY MIGRATION 018: add card_type support
-- =====================================================

ALTER TABLE public.flashy_cards
  ADD COLUMN IF NOT EXISTS card_type TEXT;

ALTER TABLE public.flashy_student_cards
  ADD COLUMN IF NOT EXISTS card_type TEXT;

UPDATE public.flashy_cards
SET card_type = CASE
  WHEN LOWER(BTRIM(COALESCE(card_type, ''))) IN ('fill_blank', 'fill-blank', 'fill blank') THEN 'fill_blank'
  WHEN COALESCE(front, '') ~ '[_]{2,}' THEN 'fill_blank'
  ELSE 'normal'
END
WHERE card_type IS NULL
   OR BTRIM(card_type) = ''
   OR LOWER(BTRIM(card_type)) NOT IN ('normal', 'fill_blank');

UPDATE public.flashy_student_cards sc
SET card_type = COALESCE(
  CASE
    WHEN LOWER(BTRIM(COALESCE(sc.card_type, ''))) IN ('fill_blank', 'fill-blank', 'fill blank') THEN 'fill_blank'
    WHEN LOWER(BTRIM(COALESCE(sc.card_type, ''))) = 'normal' THEN 'normal'
    ELSE NULL
  END,
  fc.card_type,
  CASE
    WHEN COALESCE(sc.front, '') ~ '[_]{2,}' THEN 'fill_blank'
    ELSE 'normal'
  END
)
FROM public.flashy_cards fc
WHERE sc.source_card_id = fc.id
  AND (
    sc.card_type IS NULL
    OR BTRIM(sc.card_type) = ''
    OR LOWER(BTRIM(sc.card_type)) NOT IN ('normal', 'fill_blank')
  );

UPDATE public.flashy_student_cards
SET card_type = CASE
  WHEN LOWER(BTRIM(COALESCE(card_type, ''))) IN ('fill_blank', 'fill-blank', 'fill blank') THEN 'fill_blank'
  WHEN COALESCE(front, '') ~ '[_]{2,}' THEN 'fill_blank'
  ELSE 'normal'
END
WHERE card_type IS NULL
   OR BTRIM(card_type) = ''
   OR LOWER(BTRIM(card_type)) NOT IN ('normal', 'fill_blank');

ALTER TABLE public.flashy_cards
  ALTER COLUMN card_type SET DEFAULT 'normal';

ALTER TABLE public.flashy_cards
  ALTER COLUMN card_type SET NOT NULL;

ALTER TABLE public.flashy_student_cards
  ALTER COLUMN card_type SET DEFAULT 'normal';

ALTER TABLE public.flashy_student_cards
  ALTER COLUMN card_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flashy_cards_card_type_check'
  ) THEN
    ALTER TABLE public.flashy_cards
      ADD CONSTRAINT flashy_cards_card_type_check
      CHECK (card_type IN ('normal', 'fill_blank'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flashy_student_cards_card_type_check'
  ) THEN
    ALTER TABLE public.flashy_student_cards
      ADD CONSTRAINT flashy_student_cards_card_type_check
      CHECK (card_type IN ('normal', 'fill_blank'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.flashy_sync_card_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.flashy_student_cards (
    assignment_id, source_card_id, student_id,
    front, back, example_sentence, pronunciation,
    part_of_speech, image_url, notes, difficulty,
    card_type, sort_order, content_synced_at
  )
  SELECT
    da.id,
    NEW.id,
    da.student_id,
    NEW.front,
    NEW.back,
    NEW.example_sentence,
    NEW.pronunciation,
    NEW.part_of_speech,
    NEW.image_url,
    NEW.notes,
    NEW.difficulty,
    NEW.card_type,
    NEW.sort_order,
    NOW()
  FROM public.flashy_deck_assignments da
  WHERE da.teacher_deck_id = NEW.deck_id
    AND da.sync_enabled = TRUE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.flashy_sync_card_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.front IS DISTINCT FROM OLD.front
     OR NEW.back IS DISTINCT FROM OLD.back
     OR NEW.example_sentence IS DISTINCT FROM OLD.example_sentence
     OR NEW.pronunciation IS DISTINCT FROM OLD.pronunciation
     OR NEW.part_of_speech IS DISTINCT FROM OLD.part_of_speech
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.difficulty IS DISTINCT FROM OLD.difficulty
     OR NEW.card_type IS DISTINCT FROM OLD.card_type
     OR NEW.sort_order IS DISTINCT FROM OLD.sort_order
  THEN
    UPDATE public.flashy_student_cards sc
    SET
      front = NEW.front,
      back = NEW.back,
      example_sentence = NEW.example_sentence,
      pronunciation = NEW.pronunciation,
      part_of_speech = NEW.part_of_speech,
      image_url = NEW.image_url,
      notes = NEW.notes,
      difficulty = NEW.difficulty,
      card_type = NEW.card_type,
      sort_order = NEW.sort_order,
      content_synced_at = NOW(),
      updated_at = NOW()
    FROM public.flashy_deck_assignments da
    WHERE sc.source_card_id = NEW.id
      AND sc.assignment_id = da.id
      AND da.sync_enabled = TRUE
      AND sc.is_custom = FALSE
      AND sc.is_deleted_by_teacher = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.flashy_get_shared_deck(
  p_share_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_token TEXT := NULLIF(BTRIM(p_share_token), '');
  deck_record flashy_decks%ROWTYPE;
  cards_payload JSONB;
BEGIN
  IF normalized_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO deck_record
  FROM flashy_decks
  WHERE share_token::TEXT = normalized_token
  LIMIT 1;

  IF deck_record.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'front', c.front,
        'back', c.back,
        'example_sentence', c.example_sentence,
        'card_type', c.card_type,
        'sort_order', c.sort_order
      )
      ORDER BY c.sort_order ASC
    ),
    '[]'::JSONB
  )
  INTO cards_payload
  FROM flashy_cards c
  WHERE c.deck_id = deck_record.id;

  RETURN jsonb_build_object(
    'deck', jsonb_build_object(
      'id', deck_record.id,
      'name', deck_record.name,
      'description', deck_record.description,
      'category', deck_record.category,
      'difficulty_level', deck_record.difficulty_level,
      'tags', deck_record.tags,
      'language_pair', deck_record.language_pair,
      'owner_id', deck_record.owner_id
    ),
    'cards', cards_payload
  );
END;
$$;

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
  IF normalized_required_mode NOT IN ('any', 'flashcards', 'quiz', 'mcq', 'match', 'wheel') THEN
    normalized_required_mode := 'any';
  END IF;

  FOREACH sid IN ARRAY p_student_ids LOOP
    SELECT id INTO existing_assignment_id
      FROM public.flashy_deck_assignments fda
     WHERE fda.teacher_deck_id = p_teacher_deck_id AND fda.student_id = sid
     LIMIT 1;

    IF existing_assignment_id IS NOT NULL THEN
      UPDATE public.flashy_deck_assignments
         SET required_pool = normalized_required_pool,
             required_mode = normalized_required_mode
       WHERE id = existing_assignment_id;

      assignment_id := existing_assignment_id;
      student_id := sid;
      cards_copied := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO public.flashy_deck_assignments (
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

    INSERT INTO public.flashy_student_cards (
      assignment_id, source_card_id, student_id,
      front, back, example_sentence, pronunciation,
      part_of_speech, image_url, notes, difficulty,
      card_type, sort_order, content_synced_at
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

    assignment_id := new_assignment_id;
    student_id := sid;
    cards_copied := card_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flashy_bulk_assign_deck(
  UUID, UUID, UUID[], BOOLEAN, TEXT, INT, BOOLEAN, BOOLEAN, UUID, TEXT, TEXT
) TO authenticated;
