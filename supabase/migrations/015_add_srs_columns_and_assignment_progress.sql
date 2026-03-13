-- =====================================================
-- MIGRATION 015: Add missing SRS columns + assignment progress tracking
-- =====================================================
-- 1. Add ease_factor and again_count to flashy_cards (teacher self-study)
-- 2. Add ease_factor and again_count to flashy_student_cards (student SRS)
-- 3. Add progress_percent, completed, completed_at to flashy_deck_assignments
-- =====================================================

-- ─── 1. flashy_cards: SM-2 ease factor + again counter ───
ALTER TABLE public.flashy_cards
  ADD COLUMN IF NOT EXISTS ease_factor REAL NOT NULL DEFAULT 2.5;

ALTER TABLE public.flashy_cards
  ADD COLUMN IF NOT EXISTS again_count INT NOT NULL DEFAULT 0;

-- ─── 2. flashy_student_cards: SM-2 ease factor + again counter ───
ALTER TABLE public.flashy_student_cards
  ADD COLUMN IF NOT EXISTS ease_factor REAL NOT NULL DEFAULT 2.5;

ALTER TABLE public.flashy_student_cards
  ADD COLUMN IF NOT EXISTS again_count INT NOT NULL DEFAULT 0;

-- ─── 3. flashy_deck_assignments: completion tracking ───
ALTER TABLE public.flashy_deck_assignments
  ADD COLUMN IF NOT EXISTS progress_percent INT NOT NULL DEFAULT 0;

ALTER TABLE public.flashy_deck_assignments
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.flashy_deck_assignments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index for quick "incomplete assignments" queries
CREATE INDEX IF NOT EXISTS idx_flashy_assignments_completed
  ON flashy_deck_assignments(student_id, completed)
  WHERE completed = FALSE;
