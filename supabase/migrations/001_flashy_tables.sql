-- =====================================================
-- FLASHY MIGRATION 001: Core tables
-- Run in Supabase SQL Editor (same project as TutPro)
-- All tables prefixed with flashy_ to avoid conflicts
-- =====================================================

-- Enable citext if not already
CREATE EXTENSION IF NOT EXISTS citext;

-- ─────────────────────────────────────────────────────
-- 1. flashy_profiles — extends auth.users with role info
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')) DEFAULT 'student',
  teacher_id UUID REFERENCES flashy_profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL DEFAULT '',
  email CITEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  settings JSONB DEFAULT '{}',
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashy_profiles_teacher ON flashy_profiles(teacher_id);
CREATE INDEX IF NOT EXISTS idx_flashy_profiles_role ON flashy_profiles(role);

-- ─────────────────────────────────────────────────────
-- 2. flashy_decks — teacher master decks + student personal decks
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES flashy_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced')),
  language_pair TEXT DEFAULT 'en-native',
  cover_image_url TEXT DEFAULT '',
  is_archived BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashy_decks_owner ON flashy_decks(owner_id);
CREATE INDEX IF NOT EXISTS idx_flashy_decks_archived ON flashy_decks(is_archived) WHERE is_archived = FALSE;

-- ─────────────────────────────────────────────────────
-- 3. flashy_cards — cards in teacher master decks
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES flashy_decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL DEFAULT '',
  back TEXT NOT NULL DEFAULT '',
  example_sentence TEXT DEFAULT '',
  pronunciation TEXT DEFAULT '',
  part_of_speech TEXT CHECK (part_of_speech IN (
    'noun', 'verb', 'adjective', 'adverb', 'phrase',
    'idiom', 'preposition', 'conjunction', 'other'
  )),
  image_url TEXT DEFAULT '',
  audio_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  tags TEXT[] DEFAULT '{}',
  sort_order INT DEFAULT 0,

  -- SRS state (for teacher self-study of master cards)
  due TIMESTAMPTZ DEFAULT NOW(),
  is_new BOOLEAN DEFAULT TRUE,
  retention INT DEFAULT 0,
  reviews INT DEFAULT 0,
  next_review_days INT DEFAULT 1,
  mastered BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashy_cards_deck ON flashy_cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_flashy_cards_sort ON flashy_cards(deck_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_flashy_cards_due ON flashy_cards(deck_id, due) WHERE is_new = FALSE AND mastered = FALSE;

-- ─────────────────────────────────────────────────────
-- 4. flashy_deck_assignments — teacher assigns deck to student
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_deck_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_deck_id UUID NOT NULL REFERENCES flashy_decks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES flashy_profiles(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES flashy_profiles(id),
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  custom_name TEXT DEFAULT '',
  study_goal_daily INT DEFAULT 0,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(teacher_deck_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_flashy_assignments_student ON flashy_deck_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_flashy_assignments_teacher ON flashy_deck_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_flashy_assignments_deck ON flashy_deck_assignments(teacher_deck_id);

-- ─────────────────────────────────────────────────────
-- 5. flashy_student_cards — student card copies with SRS state
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_student_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES flashy_deck_assignments(id) ON DELETE CASCADE,
  source_card_id UUID REFERENCES flashy_cards(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES flashy_profiles(id) ON DELETE CASCADE,

  -- Content (synced from teacher unless customized)
  front TEXT NOT NULL DEFAULT '',
  back TEXT NOT NULL DEFAULT '',
  example_sentence TEXT DEFAULT '',
  pronunciation TEXT DEFAULT '',
  part_of_speech TEXT,
  image_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  difficulty TEXT DEFAULT 'medium',

  -- SRS state (student-owned, never overwritten by sync)
  due TIMESTAMPTZ DEFAULT NOW(),
  is_new BOOLEAN DEFAULT TRUE,
  retention INT DEFAULT 0,
  reviews INT DEFAULT 0,
  next_review_days INT DEFAULT 1,
  mastered BOOLEAN DEFAULT FALSE,
  last_reviewed_at TIMESTAMPTZ,

  -- Sync metadata
  is_custom BOOLEAN DEFAULT FALSE,
  is_deleted_by_teacher BOOLEAN DEFAULT FALSE,
  content_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sort_order INT DEFAULT 0,

  -- Student personalizations
  is_favorite BOOLEAN DEFAULT FALSE,
  student_notes TEXT DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashy_student_cards_assignment ON flashy_student_cards(assignment_id);
CREATE INDEX IF NOT EXISTS idx_flashy_student_cards_student ON flashy_student_cards(student_id);
CREATE INDEX IF NOT EXISTS idx_flashy_student_cards_source ON flashy_student_cards(source_card_id);
CREATE INDEX IF NOT EXISTS idx_flashy_student_cards_due ON flashy_student_cards(student_id, due)
  WHERE is_new = FALSE AND mastered = FALSE AND is_deleted_by_teacher = FALSE;
CREATE INDEX IF NOT EXISTS idx_flashy_student_cards_new ON flashy_student_cards(student_id)
  WHERE is_new = TRUE AND is_deleted_by_teacher = FALSE;

-- ─────────────────────────────────────────────────────
-- 6. flashy_activity_log — dashboard feed
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_activity_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES flashy_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashy_activity_actor ON flashy_activity_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flashy_activity_action ON flashy_activity_log(action);

-- ─────────────────────────────────────────────────────
-- 7. flashy_study_sessions — per-session aggregate stats
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES flashy_profiles(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES flashy_deck_assignments(id) ON DELETE SET NULL,
  deck_name TEXT DEFAULT '',
  cards_studied INT DEFAULT 0,
  cards_correct INT DEFAULT 0,
  cards_incorrect INT DEFAULT 0,
  session_type TEXT CHECK (session_type IN ('learn', 'practice', 'test', 'quick_review')) DEFAULT 'practice',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_seconds INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_flashy_sessions_student ON flashy_study_sessions(student_id, started_at DESC);

-- ─────────────────────────────────────────────────────
-- 8. flashy_notifications — in-app notifications
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES flashy_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashy_notifications_user ON flashy_notifications(user_id, read, created_at DESC);

-- ─────────────────────────────────────────────────────
-- 9. flashy_card_comments — teacher comments on student cards
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashy_card_comments (
  id BIGSERIAL PRIMARY KEY,
  student_card_id UUID NOT NULL REFERENCES flashy_student_cards(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES flashy_profiles(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashy_comments_card ON flashy_card_comments(student_card_id);

-- ─────────────────────────────────────────────────────
-- Auto-update updated_at triggers
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION flashy_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_flashy_profiles_updated
    BEFORE UPDATE ON flashy_profiles
    FOR EACH ROW EXECUTE FUNCTION flashy_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_flashy_decks_updated
    BEFORE UPDATE ON flashy_decks
    FOR EACH ROW EXECUTE FUNCTION flashy_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_flashy_cards_updated
    BEFORE UPDATE ON flashy_cards
    FOR EACH ROW EXECUTE FUNCTION flashy_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_flashy_student_cards_updated
    BEFORE UPDATE ON flashy_student_cards
    FOR EACH ROW EXECUTE FUNCTION flashy_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────
-- Auto-create flashy_profiles on auth.users insert
-- (mirrors TutPro's teacher_profiles pattern)
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION flashy_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.flashy_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'flashy_role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create if not exists (don't conflict with other triggers on auth.users)
DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created_flashy
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION flashy_handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
