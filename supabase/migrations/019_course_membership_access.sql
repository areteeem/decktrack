-- =====================================================
-- FLASHY MIGRATION 019: Course membership access control
-- =====================================================
-- Adds explicit course membership assignments.
-- Students can read only courses they are assigned to.
-- =====================================================

-- 1. Course membership mapping table
CREATE TABLE IF NOT EXISTS flashy_course_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES flashy_courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES flashy_profiles(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES flashy_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_flashy_course_members_course
  ON flashy_course_members(course_id);
CREATE INDEX IF NOT EXISTS idx_flashy_course_members_student
  ON flashy_course_members(student_id);

ALTER TABLE flashy_course_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_members_owner_all" ON flashy_course_members;
CREATE POLICY "course_members_owner_all" ON flashy_course_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM flashy_courses
      WHERE flashy_courses.id = flashy_course_members.course_id
        AND flashy_courses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM flashy_courses
      WHERE flashy_courses.id = flashy_course_members.course_id
        AND flashy_courses.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "course_members_student_read_own" ON flashy_course_members;
CREATE POLICY "course_members_student_read_own" ON flashy_course_members
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- 2. Restrict student course visibility to explicit memberships
DROP POLICY IF EXISTS "courses_student_read" ON flashy_courses;
CREATE POLICY "courses_student_read" ON flashy_courses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM flashy_course_members
      WHERE flashy_course_members.course_id = flashy_courses.id
        AND flashy_course_members.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "course_decks_student_read" ON flashy_course_decks;
CREATE POLICY "course_decks_student_read" ON flashy_course_decks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM flashy_course_members
      WHERE flashy_course_members.course_id = flashy_course_decks.course_id
        AND flashy_course_members.student_id = auth.uid()
    )
  );
