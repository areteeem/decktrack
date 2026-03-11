-- =====================================================
-- FLASHY MIGRATION 003: Sync triggers
-- When teacher edits master cards, changes propagate
-- to student copies (where sync_enabled = true and
-- is_custom = false).
-- =====================================================

-- ─────────────────────────────────────────────────────
-- On INSERT into flashy_cards → copy to all synced students
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION flashy_sync_card_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO flashy_student_cards (
    assignment_id, source_card_id, student_id,
    front, back, example_sentence, pronunciation,
    part_of_speech, image_url, notes, difficulty,
    sort_order, content_synced_at
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
    NEW.sort_order,
    NOW()
  FROM flashy_deck_assignments da
  WHERE da.teacher_deck_id = NEW.deck_id
    AND da.sync_enabled = TRUE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  CREATE TRIGGER trg_flashy_sync_card_insert
    AFTER INSERT ON flashy_cards
    FOR EACH ROW EXECUTE FUNCTION flashy_sync_card_insert();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────
-- On UPDATE of flashy_cards → update synced student copies
-- Only updates content fields; SRS state is never touched.
-- Skips cards marked is_custom = true.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION flashy_sync_card_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if content fields actually changed
  IF NEW.front IS DISTINCT FROM OLD.front
     OR NEW.back IS DISTINCT FROM OLD.back
     OR NEW.example_sentence IS DISTINCT FROM OLD.example_sentence
     OR NEW.pronunciation IS DISTINCT FROM OLD.pronunciation
     OR NEW.part_of_speech IS DISTINCT FROM OLD.part_of_speech
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.difficulty IS DISTINCT FROM OLD.difficulty
     OR NEW.sort_order IS DISTINCT FROM OLD.sort_order
  THEN
    UPDATE flashy_student_cards sc
    SET
      front = NEW.front,
      back = NEW.back,
      example_sentence = NEW.example_sentence,
      pronunciation = NEW.pronunciation,
      part_of_speech = NEW.part_of_speech,
      image_url = NEW.image_url,
      notes = NEW.notes,
      difficulty = NEW.difficulty,
      sort_order = NEW.sort_order,
      content_synced_at = NOW(),
      updated_at = NOW()
    FROM flashy_deck_assignments da
    WHERE sc.source_card_id = NEW.id
      AND sc.assignment_id = da.id
      AND da.sync_enabled = TRUE
      AND sc.is_custom = FALSE
      AND sc.is_deleted_by_teacher = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  CREATE TRIGGER trg_flashy_sync_card_update
    AFTER UPDATE ON flashy_cards
    FOR EACH ROW EXECUTE FUNCTION flashy_sync_card_update();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────
-- On DELETE of flashy_cards → soft-delete student copies
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION flashy_sync_card_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE flashy_student_cards
  SET is_deleted_by_teacher = TRUE, updated_at = NOW()
  WHERE source_card_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  CREATE TRIGGER trg_flashy_sync_card_delete
    BEFORE DELETE ON flashy_cards
    FOR EACH ROW EXECUTE FUNCTION flashy_sync_card_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────
-- Update last_synced_at on assignments when sync occurs
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION flashy_update_assignment_sync_time()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE flashy_deck_assignments
  SET last_synced_at = NOW()
  WHERE id = NEW.assignment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  CREATE TRIGGER trg_flashy_assignment_sync_time
    AFTER UPDATE ON flashy_student_cards
    FOR EACH ROW
    WHEN (NEW.content_synced_at IS DISTINCT FROM OLD.content_synced_at)
    EXECUTE FUNCTION flashy_update_assignment_sync_time();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
