-- =====================================================
-- FLASHY MIGRATION 016: Courses (deck folders / collections)
-- =====================================================
-- Courses let teachers organise decks into named collections
-- and assign entire courses to students / groups at once.
-- =====================================================

-- 1. flashy_courses — course metadata
CREATE TABLE IF NOT EXISTS flashy_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES flashy_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  color TEXT DEFAULT 'blue',
  icon TEXT DEFAULT 'folder',
  sort_order INT DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashy_courses_owner ON flashy_courses(owner_id);

-- 2. flashy_course_decks — many-to-many: which decks belong to which course
CREATE TABLE IF NOT EXISTS flashy_course_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES flashy_courses(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES flashy_decks(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, deck_id)
);

CREATE INDEX IF NOT EXISTS idx_flashy_course_decks_course ON flashy_course_decks(course_id);
CREATE INDEX IF NOT EXISTS idx_flashy_course_decks_deck ON flashy_course_decks(deck_id);

-- RLS
ALTER TABLE flashy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashy_course_decks ENABLE ROW LEVEL SECURITY;

-- Teachers can CRUD their own courses
CREATE POLICY "courses_owner_all" ON flashy_courses
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Students can read courses owned by their teacher
CREATE POLICY "courses_student_read" ON flashy_courses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM flashy_profiles
      WHERE flashy_profiles.id = auth.uid()
        AND flashy_profiles.teacher_id = flashy_courses.owner_id
    )
  );

-- Course-deck links: owner of the course can manage
CREATE POLICY "course_decks_owner_all" ON flashy_course_decks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM flashy_courses
      WHERE flashy_courses.id = flashy_course_decks.course_id
        AND flashy_courses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM flashy_courses
      WHERE flashy_courses.id = flashy_course_decks.course_id
        AND flashy_courses.owner_id = auth.uid()
    )
  );

-- Students can read the deck list of courses they can see
CREATE POLICY "course_decks_student_read" ON flashy_course_decks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM flashy_courses
      JOIN flashy_profiles ON flashy_profiles.id = auth.uid()
      WHERE flashy_courses.id = flashy_course_decks.course_id
        AND flashy_profiles.teacher_id = flashy_courses.owner_id
    )
  );
